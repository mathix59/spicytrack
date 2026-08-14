import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { GithubAppWebhooksController } from "./github-app-webhooks.controller";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { OrganizationGithubAppSettingsController } from "./organization-github-app-settings.controller";
import { GithubProvider } from "./vcs/github.provider";
import { GitlabProvider } from "./vcs/gitlab.provider";
import { VcsFactory } from "./vcs/vcs.factory";

@Module({
  imports: [AuditModule, ProjectsModule, RbacModule],
  controllers: [
    IntegrationsController,
    OrganizationGithubAppSettingsController,
    GithubAppWebhooksController,
  ],
  providers: [IntegrationsService, GithubProvider, GitlabProvider, VcsFactory],
  exports: [IntegrationsService, VcsFactory],
})
export class IntegrationsModule {}
