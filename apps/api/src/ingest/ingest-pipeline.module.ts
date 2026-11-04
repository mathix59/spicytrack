import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { ReleaseHealthIngestService } from "../release-health/release-health-ingest.service";
import { IngestResolversService } from "./ingest-resolvers.service";
import { IngestService } from "./ingest.service";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";

/** The ingest pipeline without its public routes, so the web API can send test events. */
@Module({
  imports: [JobsModule],
  providers: [
    IngestService,
    IngestResolversService,
    PostIngestPublisherService,
    ReleaseHealthIngestService,
  ],
  exports: [IngestService],
})
export class IngestPipelineModule {}
