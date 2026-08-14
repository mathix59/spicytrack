import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { StorageModule } from "../storage/storage.module";
import { ArtifactsController } from "./artifacts.controller";
import { ArtifactsService } from "./artifacts.service";
import { SourcemapResolverService } from "./sourcemap-resolver.service";

@Module({
  imports: [RbacModule, ProjectsModule, StorageModule],
  controllers: [ArtifactsController],
  providers: [ArtifactsService, SourcemapResolverService],
  exports: [SourcemapResolverService],
})
export class ArtifactsModule {}
