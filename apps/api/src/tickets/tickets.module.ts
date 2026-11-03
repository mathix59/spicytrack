import { Module } from "@nestjs/common";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { AuditModule } from "../audit/audit.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [ArtifactsModule, AuditModule, IntegrationsModule, ProjectsModule, RbacModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
