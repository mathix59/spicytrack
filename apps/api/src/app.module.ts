import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AlertsModule } from "./alerts/alerts.module";
import { ArtifactsModule } from "./artifacts/artifacts.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AutofixModule } from "./autofix/autofix.module";
import { DatabaseModule } from "./database/database.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { InstanceAdminModule } from "./instance-admin/instance-admin.module";
import { IssuesModule } from "./issues/issues.module";
import { JobsModule } from "./jobs/jobs.module";
import { McpModule } from "./mcp/mcp.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PersonalTokensModule } from "./personal-tokens/personal-tokens.module";
import { ProjectsModule } from "./projects/projects.module";
import { RbacModule } from "./rbac/rbac.module";
import { SystemModule } from "./system.module";
import { TeamsModule } from "./teams/teams.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Look in the package dir first (docker/CI can inject env vars directly
      // with no .env present), then fall back to the monorepo root .env used
      // for local dev (pnpm sets cwd to apps/api when run via a filter).
      envFilePath: [".env", "../../.env"],
    }),
    DatabaseModule,
    AlertsModule,
    ArtifactsModule,
    AuditModule,
    RbacModule,
    SystemModule,
    AuthModule,
    PersonalTokensModule,
    McpModule,
    OrganizationsModule,
    ProjectsModule,
    TeamsModule,
    IssuesModule,
    IntegrationsModule,
    InstanceAdminModule,
    AutofixModule,
    JobsModule,
  ],
})
export class AppModule {}
