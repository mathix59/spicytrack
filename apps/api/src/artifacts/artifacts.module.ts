import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { JobsModule } from "../jobs/jobs.module";
import { ReleaseCommitsController } from "../release-commits/release-commits.controller";
import { ReleaseCommitsService } from "../release-commits/release-commits.service";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { StorageModule } from "../storage/storage.module";
import { ArtifactsController } from "./artifacts.controller";
import { ArtifactsService } from "./artifacts.service";
import { SourcemapResolverService } from "./sourcemap-resolver.service";

@Module({
  imports: [IntegrationsModule, JobsModule, RbacModule, ProjectsModule, StorageModule],
  controllers: [ArtifactsController, ReleaseCommitsController],
  providers: [ArtifactsService, SourcemapResolverService, ReleaseCommitsService],
  exports: [SourcemapResolverService, ReleaseCommitsService],
})
export class ArtifactsModule {}
