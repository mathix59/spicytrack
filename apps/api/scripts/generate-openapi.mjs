import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { AppModule } from "../dist/src/app.module.js";
import { setupSwagger } from "../dist/src/openapi/swagger.js";

try {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/spicytrack";
  process.env.STORAGE_ENDPOINT ??= "http://localhost:9002";
  process.env.STORAGE_ACCESS_KEY_ID ??= "spicytrack";
  process.env.STORAGE_SECRET_ACCESS_KEY ??= "spicytrack-secret";
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: ["error", "warn"],
  });
  const document = setupSwagger(app);
  const target = resolve(process.cwd(), "../web/openapi/spicytrack.json");

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(document, null, 2), "utf8");
  await app.close();
  console.log(`OpenAPI written to ${target}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
