import "reflect-metadata";
import { AppModule } from "./app.module";
import { bootstrapHttpApplication } from "./bootstrap-http";

async function bootstrap() {
  await bootstrapHttpApplication(AppModule, {
    service: "api",
    logRequests: true,
    registerAuthHandler: true,
    registerMultipart: true,
    setupOpenApi: true,
  });
}

void bootstrap();
