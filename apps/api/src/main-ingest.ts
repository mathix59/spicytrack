import "reflect-metadata";
import { AppIngestModule } from "./app-ingest.module";
import { bootstrapHttpApplication } from "./bootstrap-http";
import { ingestLimits } from "./ingest/ingest-limits";

async function bootstrap() {
  await bootstrapHttpApplication(AppIngestModule, {
    service: "ingest",
    // One line per SDK request would dwarf every other log.
    logRequests: false,
    registerRawBodyParsers: true,
    projectAwareIngestCors: true,
    bodyLimit: ingestLimits().maxEventBytes + 1024,
  });
}

void bootstrap();
