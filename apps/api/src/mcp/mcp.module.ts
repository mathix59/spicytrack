import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AutofixModule } from "../autofix/autofix.module";
import { DatabaseModule } from "../database/database.module";
import { IssuesModule } from "../issues/issues.module";
import { RbacModule } from "../rbac/rbac.module";
import { McpController, OrganizationMcpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
  imports: [DatabaseModule, AuditModule, IssuesModule, AutofixModule, RbacModule],
  controllers: [McpController, OrganizationMcpController],
  providers: [McpService],
})
export class McpModule {}
