import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppWorkerAdminModule } from "./app-worker-admin.module";
import { validateProductionSecretConfiguration } from "./common/secrets";

async function bootstrap() {
  validateProductionSecretConfiguration();
  const app = await NestFactory.createApplicationContext(AppWorkerAdminModule);
  const logger = new Logger("WorkerAdmin");

  logger.log("Worker admin started");

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker admin`);
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrap();
