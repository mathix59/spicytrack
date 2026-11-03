import { ConsoleLogger, type LoggerService, type LogLevel } from "@nestjs/common";
import pino, { type Logger as PinoLogger } from "pino";

export type LogFormat = "json" | "pretty";

export const LOG_FORMATS: LogFormat[] = ["json", "pretty"];
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
type PinoLevel = (typeof LOG_LEVELS)[number];

/** Nest levels shown for each minimum level in pretty mode. */
const NEST_LEVELS: Record<PinoLevel, LogLevel[]> = {
  trace: ["verbose", "debug", "log", "warn", "error", "fatal"],
  debug: ["debug", "log", "warn", "error", "fatal"],
  info: ["log", "warn", "error", "fatal"],
  warn: ["warn", "error", "fatal"],
  error: ["error", "fatal"],
  fatal: ["fatal"],
  silent: [],
};

type LoggingSettings = { format: LogFormat; level: PinoLevel };

/** JSON in production so log pipelines can parse it; readable lines everywhere else. */
export function loggingSettings(environment: NodeJS.ProcessEnv = process.env): LoggingSettings {
  const format = environment.LOG_FORMAT?.trim();
  const level = environment.LOG_LEVEL?.trim();

  return {
    format: LOG_FORMATS.includes(format as LogFormat)
      ? (format as LogFormat)
      : environment.NODE_ENV === "production"
        ? "json"
        : "pretty",
    level: LOG_LEVELS.includes(level as PinoLevel) ? (level as PinoLevel) : "info",
  };
}

/** Request URLs lose their query string: SDKs send the DSN key there. */
function serializeRequest(request: {
  id?: string;
  method?: string;
  url?: string;
  ip?: string;
}): Record<string, unknown> {
  return {
    id: request.id,
    method: request.method,
    url: request.url?.split("?", 1)[0],
    remoteAddress: request.ip,
  };
}

export function createPinoLogger(
  service: string,
  settings: LoggingSettings,
  destination?: pino.DestinationStream,
): PinoLogger {
  return pino(
    {
      level: settings.level,
      base: { service },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      serializers: { req: serializeRequest, err: pino.stdSerializers.err },
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-sentry-auth']"],
        remove: true,
      },
    },
    destination,
  );
}

function isStack(value: unknown): value is string {
  return typeof value === "string" && /\n\s+at /.test(value);
}

/** Nest LoggerService writing through pino; Nest passes the context as the last argument. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: unknown, ...params: unknown[]) {
    this.write("info", message, params);
  }

  warn(message: unknown, ...params: unknown[]) {
    this.write("warn", message, params);
  }

  debug(message: unknown, ...params: unknown[]) {
    this.write("debug", message, params);
  }

  verbose(message: unknown, ...params: unknown[]) {
    this.write("trace", message, params);
  }

  fatal(message: unknown, ...params: unknown[]) {
    this.write("fatal", message, params);
  }

  error(message: unknown, ...params: unknown[]) {
    this.write("error", message, params);
  }

  private write(level: Exclude<PinoLevel, "silent">, message: unknown, params: unknown[]) {
    const rest = [...params];
    const context =
      rest.length > 0 && typeof rest[rest.length - 1] === "string" && !isStack(rest.at(-1))
        ? (rest.pop() as string)
        : undefined;
    const fields: Record<string, unknown> = context ? { context } : {};

    if (message instanceof Error) {
      fields.err = message;
    } else if (level === "error" && isStack(rest[0])) {
      fields.stack = rest.shift();
    }
    if (rest.length > 0) fields.details = rest.length === 1 ? rest[0] : rest;

    if (message instanceof Error) {
      this.logger[level](fields, message.message);
    } else if (typeof message === "string") {
      this.logger[level](fields, message);
    } else {
      this.logger[level]({ ...fields, data: message });
    }
  }
}

export type ServiceLogging = {
  /** Logger for Nest. */
  nest: LoggerService;
  /** Pino instance for Fastify's own logs, only in JSON mode. */
  http?: PinoLogger;
};

export function createServiceLogging(
  service: string,
  environment: NodeJS.ProcessEnv = process.env,
  { logRequests = true }: { logRequests?: boolean } = {},
): ServiceLogging {
  const settings = loggingSettings(environment);

  if (settings.format === "pretty") {
    return { nest: new ConsoleLogger({ logLevels: NEST_LEVELS[settings.level] }) };
  }

  const logger = createPinoLogger(service, settings);
  // Per-request lines are info; without them the HTTP logger still reports failed requests.
  const httpLevel =
    logRequests || pino.levels.values[settings.level] >= pino.levels.values.warn
      ? settings.level
      : "warn";
  return {
    nest: new PinoNestLogger(logger),
    http: logger.child({ context: "http" }, { level: httpLevel }),
  };
}
