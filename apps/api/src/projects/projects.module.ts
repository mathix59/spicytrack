import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { ProjectsCatalogService } from "./projects-catalog.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsKeysService } from "./projects-keys.service";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [AuditModule, RbacModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsCatalogService, ProjectsKeysService, ProjectContextGuard],
  exports: [ProjectsService, ProjectContextGuard],
})
export class ProjectsModule {}
