import "reflect-metadata";
import { AppModule } from "./app.module";
import { bootstrapHttpApplication } from "./bootstrap-http";
import { validateProductionSecretConfiguration } from "./common/secrets";

async function bootstrap() {
  validateProductionSecretConfiguration();
  await bootstrapHttpApplication(AppModule, {
    registerAuthHandler: true,
    registerMultipart: true,
    setupOpenApi: true,
  });
}

void bootstrap();
