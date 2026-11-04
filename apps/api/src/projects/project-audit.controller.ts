import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { AuthGuard } from "../auth/auth.guard";
import {
  decodeAuditCursor,
  parseAuditExportFormat,
  parseAuditFilters,
  parseAuditLimit,
  renderAuditExport,
} from "../audit/audit-query";
import { AuditService } from "../audit/audit.service";
import { ApiAuditFilters } from "../audit/organization-audit.controller";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentProject } from "../common/current-project.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord, ProjectRecord, UserRecord } from "../common/request-context";
import { AuditEntryPageDto, AuditFacetsDto } from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";

/** The organization audit log, narrowed to one project, with the same filters and pages. */
@ApiTags("projects")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug/audit")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard, PermissionGuard)
export class ProjectAuditController {
  constructor(private readonly auditService: AuditService) {}

  private scope(organization: OrganizationRecord, project: ProjectRecord) {
    return { organizationId: organization.id, projectId: project.id };
  }

  @Get("entries")
  @ApiOperation({ operationId: "listProjectAuditEntries" })
  @RequirePermissions("audit.read")
  @ApiAuditFilters()
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ type: AuditEntryPageDto })
  list(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @Query() query: Record<string, unknown>,
  ) {
    return this.auditService.list(
      this.scope(organization, project),
      // The project is the scope: a projectId filter would be redundant.
      { ...parseAuditFilters(query), projectId: undefined },
      parseAuditLimit(query.limit),
      decodeAuditCursor(query.cursor),
    );
  }

  @Get("facets")
  @ApiOperation({ operationId: "getProjectAuditFacets" })
  @RequirePermissions("audit.read")
  @ApiOkResponse({ type: AuditFacetsDto })
  facets(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
  ) {
    return this.auditService.facets(this.scope(organization, project));
  }

  @Get("export")
  @ApiOperation({ operationId: "exportProjectAudit" })
  @RequirePermissions("audit.read")
  @ApiAuditFilters()
  @ApiQuery({ name: "format", required: false, enum: ["csv", "json"] })
  @ApiProduces("text/csv", "application/json")
  @ApiOkResponse({ description: "Up to 10,000 entries, newest first", type: String })
  async export(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const filters = { ...parseAuditFilters(query), projectId: undefined };
    const format = parseAuditExportFormat(query.format);
    const { rows, truncated } = await this.auditService.export(
      this.scope(organization, project),
      filters,
    );
    // Recorded after reading, so the export never contains its own entry.
    await this.auditService.record({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      action: "audit.exported",
      targetType: "project",
      targetId: project.id,
      payload: { format, rowCount: rows.length, truncated, filters: { ...filters } },
    });
    const file = renderAuditExport(rows, format, `${organization.slug}-${project.slug}`);
    reply.header("Content-Type", file.contentType);
    reply.header("Content-Disposition", `attachment; filename="${file.fileName}"`);
    reply.header("Cache-Control", "no-store");
    reply.header("X-SpicyTrack-Export-Truncated", String(truncated));
    return file.body;
  }
}
