import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppWorkerAdminModule } from "./app-worker-admin.module";
import { createServiceLogging } from "./common/logger";
import { DATABASE_POOL } from "./database/database.provider";
import { JobsRunnerService } from "./jobs/jobs-runner.service";
import { JobsService } from "./jobs/jobs.service";
import { startWorkerHealthServer } from "./jobs/worker-health-server";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppWorkerAdminModule, {
    logger: createServiceLogging("worker-admin").nest,
  });
  const logger = new Logger("WorkerAdmin");

  const healthServer = startWorkerHealthServer({
    runner: app.get(JobsRunnerService),
    jobs: app.get(JobsService),
    pool: app.get(DATABASE_POOL),
  });

  logger.log("Worker admin started");

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker admin`);
    healthServer?.close();
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
