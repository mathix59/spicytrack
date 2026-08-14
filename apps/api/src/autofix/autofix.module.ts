import { forwardRef, Module } from "@nestjs/common";
import { AiUsageModule } from "../ai-usage/ai-usage.module";
import { AuditModule } from "../audit/audit.module";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { IssuesModule } from "../issues/issues.module";
import { JobsModule } from "../jobs/jobs.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { AutofixController } from "./autofix.controller";
import { AutofixJobHandler } from "./autofix-job.handler";
import { AutofixService } from "./autofix.service";
import { OrganizationAiSettingsController } from "./organization-ai-settings.controller";

@Module({
  imports: [
    AuditModule,
    AiUsageModule,
    ArtifactsModule,
    IntegrationsModule,
    forwardRef(() => IssuesModule),
    JobsModule,
    ProjectsModule,
    RbacModule,
  ],
  controllers: [AutofixController, OrganizationAiSettingsController],
  providers: [AutofixService, AutofixJobHandler],
  exports: [AutofixService, AutofixJobHandler],
})
export class AutofixModule {}
