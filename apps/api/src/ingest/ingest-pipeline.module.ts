import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { IngestResolversService } from "./ingest-resolvers.service";
import { IngestService } from "./ingest.service";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";

/** The ingest pipeline without its public routes, so the web API can send test events. */
@Module({
  imports: [JobsModule],
  providers: [IngestService, IngestResolversService, PostIngestPublisherService],
  exports: [IngestService],
})
export class IngestPipelineModule {}
