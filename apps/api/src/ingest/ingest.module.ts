import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { IngestController } from "./ingest.controller";
import { IngestResolversService } from "./ingest-resolvers.service";
import { IngestService } from "./ingest.service";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";

@Module({
  imports: [JobsModule],
  controllers: [IngestController],
  providers: [IngestService, IngestResolversService, PostIngestPublisherService],
})
export class IngestModule {}
