import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { BrowserIngestCorsService } from "./browser-ingest-cors.service";
import { IngestPipelineModule } from "./ingest-pipeline.module";

@Module({
  imports: [IngestPipelineModule],
  controllers: [IngestController],
  providers: [BrowserIngestCorsService],
  exports: [BrowserIngestCorsService],
})
export class IngestModule {}
