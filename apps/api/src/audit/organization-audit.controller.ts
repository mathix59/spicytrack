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
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord, UserRecord } from "../common/request-context";
import { AuditEntryPageDto, AuditFacetsDto } from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import {
  decodeAuditCursor,
  parseAuditExportFormat,
  parseAuditFilters,
  parseAuditLimit,
  renderAuditExport,
} from "./audit-query";
import { AuditService } from "./audit.service";

/** Query parameters shared by the audit list and export endpoints. */
export function ApiAuditFilters(): MethodDecorator {
  const params = [
    { name: "action", description: 'Exact action, or a prefix ending with "." (e.g. "member.")' },
    { name: "actorUserId" },
    { name: "projectId" },
    { name: "targetType" },
    { name: "from", description: "ISO date, inclusive" },
    { name: "to", description: "ISO date, inclusive" },
  ];
  return (target, key, descriptor) => {
    for (const param of params) {
      ApiQuery({ ...param, required: false, type: String })(target, key, descriptor);
    }
  };
}

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("organizations/:orgSlug/audit")
@UseGuards(AuthGuard, OrganizationContextGuard, PermissionGuard)
export class OrganizationAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ operationId: "listOrganizationAudit" })
  @RequirePermissions("audit.read")
  @ApiParam({ name: "orgSlug", type: String })
  @ApiAuditFilters()
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ type: AuditEntryPageDto })
  list(
    @CurrentOrganization() organization: OrganizationRecord,
    @Query() query: Record<string, unknown>,
  ) {
    return this.auditService.list(
      { organizationId: organization.id },
      parseAuditFilters(query),
      parseAuditLimit(query.limit),
      decodeAuditCursor(query.cursor),
    );
  }

  @Get("facets")
  @ApiOperation({ operationId: "getOrganizationAuditFacets" })
  @RequirePermissions("audit.read")
  @ApiParam({ name: "orgSlug", type: String })
  @ApiOkResponse({ type: AuditFacetsDto })
  facets(@CurrentOrganization() organization: OrganizationRecord) {
    return this.auditService.facets({ organizationId: organization.id });
  }

  @Get("export")
  @ApiOperation({ operationId: "exportOrganizationAudit" })
  @RequirePermissions("audit.read")
  @ApiParam({ name: "orgSlug", type: String })
  @ApiAuditFilters()
  @ApiQuery({ name: "format", required: false, enum: ["csv", "json"] })
  @ApiProduces("text/csv", "application/json")
  @ApiOkResponse({ description: "Up to 10,000 entries, newest first", type: String })
  async export(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const filters = parseAuditFilters(query);
    const format = parseAuditExportFormat(query.format);
    const { rows, truncated } = await this.auditService.export(
      { organizationId: organization.id },
      filters,
    );
    // Exporting the log is itself sensitive: record it after reading, so the
    // export never contains its own entry.
    await this.auditService.record({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "audit.exported",
      targetType: "organization",
      targetId: organization.id,
      payload: { format, rowCount: rows.length, truncated, filters: { ...filters } },
    });
    const file = renderAuditExport(rows, format, organization.slug);
    reply.header("Content-Type", file.contentType);
    reply.header("Content-Disposition", `attachment; filename="${file.fileName}"`);
    reply.header("Cache-Control", "no-store");
    reply.header("X-SpicyTrack-Export-Truncated", String(truncated));
    return file.body;
  }
}
