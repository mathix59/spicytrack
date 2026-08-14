import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { AlertsController } from "./alerts.controller";
import { AlertsDeliveryService } from "./alerts-delivery.service";
import { AlertsExecutionService } from "./alerts-execution.service";
import { AlertsService } from "./alerts.service";
import { DailyDigestService } from "./daily-digest.service";

@Module({
  imports: [AuditModule, ProjectsModule, RbacModule, EmailModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsDeliveryService, AlertsExecutionService, DailyDigestService],
  exports: [AlertsService, DailyDigestService],
})
export class AlertsModule {}
