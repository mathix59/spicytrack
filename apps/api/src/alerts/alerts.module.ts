import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { JobsModule } from "../jobs/jobs.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { AlertDeliveryQueueService } from "./alert-delivery-queue.service";
import { AlertsController } from "./alerts.controller";
import { AlertsDeliveryService } from "./alerts-delivery.service";
import { AlertsExecutionService } from "./alerts-execution.service";
import { AlertsService } from "./alerts.service";
import { DailyDigestService } from "./daily-digest.service";

@Module({
  imports: [AuditModule, ProjectsModule, RbacModule, EmailModule, JobsModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsDeliveryService,
    AlertsExecutionService,
    AlertDeliveryQueueService,
    DailyDigestService,
  ],
  exports: [AlertsService, AlertsDeliveryService, DailyDigestService],
})
export class AlertsModule {}
