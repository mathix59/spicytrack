import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { OrganizationAuditController } from "../audit/organization-audit.controller";
import { EmailModule } from "../email/email.module";
import { JobsModule } from "../jobs/jobs.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { OrganizationDeletionService } from "./organization-deletion.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsJobsService } from "./organizations-jobs.service";
import { OrganizationsOverviewService } from "./organizations-overview.service";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [AuditModule, EmailModule, RbacModule, ProjectsModule, JobsModule],
  controllers: [OrganizationsController, OrganizationAuditController],
  providers: [
    OrganizationDeletionService,
    OrganizationsService,
    OrganizationsOverviewService,
    OrganizationsJobsService,
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
