import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { IngestController } from "./ingest.controller";
import { BrowserIngestCorsService } from "./browser-ingest-cors.service";
import { IngestResolversService } from "./ingest-resolvers.service";
import { IngestService } from "./ingest.service";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";

@Module({
  imports: [JobsModule],
  controllers: [IngestController],
  providers: [
    IngestService,
    IngestResolversService,
    PostIngestPublisherService,
    BrowserIngestCorsService,
  ],
  exports: [BrowserIngestCorsService],
})
export class IngestModule {}
