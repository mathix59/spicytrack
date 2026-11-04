import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { ReleaseHealthController } from "./release-health.controller";
import { ReleaseHealthService } from "./release-health.service";

@Module({
  imports: [ProjectsModule, RbacModule],
  controllers: [ReleaseHealthController],
  providers: [ReleaseHealthService],
  exports: [ReleaseHealthService],
})
export class ReleaseHealthModule {}
