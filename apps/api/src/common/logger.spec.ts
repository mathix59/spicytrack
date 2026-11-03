import { ConsoleLogger } from "@nestjs/common";
import { Writable } from "node:stream";

import { createPinoLogger, createServiceLogging, loggingSettings, PinoNestLogger } from "./logger";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(JSON.parse(String(chunk)));
      done();
    },
  });
  const logger = new PinoNestLogger(
    createPinoLogger("api", { format: "json", level: "debug" }, stream),
  );
  return { lines, logger };
}

describe("loggingSettings", () => {
  it("defaults to JSON in production and pretty elsewhere", () => {
    expect(loggingSettings({ NODE_ENV: "production" })).toEqual({ format: "json", level: "info" });
    expect(loggingSettings({})).toEqual({ format: "pretty", level: "info" });
    expect(loggingSettings({ NODE_ENV: "production", LOG_FORMAT: "pretty" }).format).toBe("pretty");
    expect(loggingSettings({ LOG_FORMAT: "json", LOG_LEVEL: "debug" })).toEqual({
      format: "json",
      level: "debug",
    });
  });

  it("chooses the logger matching the format", () => {
    expect(createServiceLogging("api", {}).nest).toBeInstanceOf(ConsoleLogger);
    const json = createServiceLogging("api", { LOG_FORMAT: "json", LOG_LEVEL: "silent" });
    expect(json.nest).toBeInstanceOf(PinoNestLogger);
    expect(json.http).toBeDefined();
  });

  it("keeps only failed requests when request logs are off", () => {
    const quiet = createServiceLogging("ingest", { LOG_FORMAT: "json" }, { logRequests: false });
    const strict = createServiceLogging(
      "ingest",
      { LOG_FORMAT: "json", LOG_LEVEL: "error" },
      { logRequests: false },
    );

    expect(quiet.http?.level).toBe("warn");
    expect(strict.http?.level).toBe("error");
  });
});

describe("PinoNestLogger", () => {
  it("writes one JSON line with the service, level and Nest context", () => {
    const { lines, logger } = capture();

    logger.log("Worker started", "WorkerAdmin");

    expect(lines[0]).toMatchObject({
      level: "info",
      service: "api",
      context: "WorkerAdmin",
      msg: "Worker started",
    });
    expect(typeof lines[0].time).toBe("string");
  });

  it("keeps the stack Nest passes with errors", () => {
    const { lines, logger } = capture();

    logger.error("Job failed", "Error: boom\n    at run (job.ts:1:1)", "JobsRunner");
    logger.error(new Error("exploded"), "JobsRunner");

    expect(lines[0]).toMatchObject({
      level: "error",
      context: "JobsRunner",
      msg: "Job failed",
      stack: expect.stringContaining("at run"),
    });
    expect(lines[1]).toMatchObject({
      msg: "exploded",
      err: expect.objectContaining({ message: "exploded" }),
    });
  });

  it("keeps structured messages and extra arguments", () => {
    const { lines, logger } = capture();

    logger.debug({ jobId: "j1" }, "Jobs");
    logger.warn("Slow", 1200, "Jobs");

    expect(lines[0]).toMatchObject({ level: "debug", context: "Jobs", data: { jobId: "j1" } });
    expect(lines[1]).toMatchObject({ level: "warn", msg: "Slow", details: 1200 });
  });
});
