import { forwardRef, Module } from "@nestjs/common";
import { AiUsageModule } from "../ai-usage/ai-usage.module";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { AuditModule } from "../audit/audit.module";
import { AutofixModule } from "../autofix/autofix.module";
import { IssueCountsService } from "../ingest/issue-counts.service";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { IssuesController } from "./issues.controller";
import { IssuesHistoryService } from "./issues-history.service";
import { IssuesService } from "./issues.service";
import { IssueTriageService } from "./issue-triage.service";
import { IssueTrendsService } from "./issue-trends.service";

@Module({
  imports: [
    AuditModule,
    AiUsageModule,
    RbacModule,
    ProjectsModule,
    ArtifactsModule,
    forwardRef(() => AutofixModule),
  ],
  controllers: [IssuesController],
  providers: [
    IssuesService,
    IssuesHistoryService,
    IssueTriageService,
    IssueTrendsService,
    IssueCountsService,
  ],
  exports: [IssuesService],
})
export class IssuesModule {}
