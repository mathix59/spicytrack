import { Module } from "@nestjs/common";
import { IngestPipelineModule } from "../ingest/ingest-pipeline.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [IngestPipelineModule, ProjectsModule, RbacModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
