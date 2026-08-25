import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { Type, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { handleBetterAuthRequest } from "./auth/better-auth";
import { buildBetterAuthRequestUrl } from "./auth/auth-request-url";
import { webOrigins } from "./auth/web-origins";
import { decodeSentryBody } from "./ingest/sentry-body";
import { BrowserIngestCorsService } from "./ingest/browser-ingest-cors.service";
import { setupSwagger } from "./openapi/swagger";
import { artifactMaxUploadBytes } from "./artifacts/artifact-upload-limits";

type HttpBootstrapOptions = {
  registerAuthHandler?: boolean;
  registerMultipart?: boolean;
  registerRawBodyParsers?: boolean;
  setupOpenApi?: boolean;
  bodyLimit?: number;
  projectAwareIngestCors?: boolean;
};

async function createHttpApplication(
  rootModule: Type<unknown>,
  options: Pick<HttpBootstrapOptions, "bodyLimit" | "projectAwareIngestCors">,
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    rootModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      ...(options.bodyLimit ? { bodyLimit: options.bodyLimit } : {}),
    }),
    { rawBody: true },
  );

  app.setGlobalPrefix("api");
  if (options.projectAwareIngestCors) {
    const ingestCors = app.get(BrowserIngestCorsService);
    app.enableCors({
      delegator: (request: FastifyRequest) => ingestCors.optionsFor(request),
    });
  } else {
    app.enableCors({
      origin: webOrigins(),
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
  }
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onSend", (_request, reply, _payload, done) => {
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.header("Referrer-Policy", "no-referrer");
      reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      done();
    });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  return app;
}

async function registerBetterAuthHandler(app: NestFastifyApplication): Promise<void> {
  const fastify = app.getHttpAdapter().getInstance();

  fastify.all("/api/better-auth/*", async (request, reply) => {
    const url = buildBetterAuthRequestUrl(request.url);
    const authRequest = new Request(url, {
      method: request.method,
      headers: fromNodeHeaders(request.headers),
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
    const authResponse = await handleBetterAuthRequest(authRequest);

    reply.status(authResponse.status);
    authResponse.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    return reply.send(authResponse.body ? await authResponse.text() : undefined);
  });
}

function registerRawBodyParsers(app: NestFastifyApplication, bodyLimit: number): void {
  const fastify = app.getHttpAdapter().getInstance();

  const parser = (
    request: { headers: Record<string, string | string[] | undefined> },
    body: Buffer,
    done: (error: Error | null, value?: string) => void,
  ) => {
    try {
      done(null, decodeSentryBody(body, request.headers["content-encoding"], bodyLimit));
    } catch (error) {
      done(error as Error);
    }
  };

  fastify.addContentTypeParser(
    ["application/x-sentry-envelope", "text/plain"],
    { parseAs: "buffer" },
    parser,
  );
  fastify.addContentTypeParser("*", { parseAs: "buffer" }, parser);
}

export async function bootstrapHttpApplication(
  rootModule: Type<unknown>,
  options: HttpBootstrapOptions,
): Promise<void> {
  const app = await createHttpApplication(rootModule, options);

  await app.register(cookie);

  if (options.registerMultipart) {
    await app.register(multipart, { limits: { fileSize: artifactMaxUploadBytes() } });
  }

  if (options.registerRawBodyParsers) {
    registerRawBodyParsers(app, options.bodyLimit ?? 1024 * 1024);
  }

  if (options.registerAuthHandler) {
    await registerBetterAuthHandler(app);
  }

  if (options.setupOpenApi) {
    setupSwagger(app);
  }

  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
