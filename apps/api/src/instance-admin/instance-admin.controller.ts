import { DeleteUserService } from "./delete-user.service";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import {
  decodeAuditCursor,
  parseAuditExportFormat,
  parseAuditFilters,
  parseAuditLimit,
  renderAuditExport,
} from "../audit/audit-query";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { InstanceAdminTokenGuard } from "../personal-tokens/personal-token.guards";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { InstanceAdminService } from "./instance-admin.service";
import { UpdateCheckService } from "./update-check.service";
import { SmtpTestEmailService } from "./smtp-test-email.service";

@UseGuards(AuthGuard, InstanceAdminTokenGuard)
@EndpointAccess("instance-admin")
@Controller("instance-admin")
export class InstanceAdminController {
  constructor(
    private readonly service: InstanceAdminService,
    private readonly updateCheck: UpdateCheckService,
    private readonly deleteUserService: DeleteUserService,
    private readonly auditService: AuditService,
    private readonly smtpTestEmail: SmtpTestEmailService,
  ) {}

  /** Super-admin actions outside any organization go to the instance audit log. */
  private audit(actorUserId: string, action: string, targetId: string | null, payload = {}) {
    return this.auditService.record({
      organizationId: null,
      actorUserId,
      action,
      targetType: targetId ? "user" : "instance",
      targetId,
      payload,
    });
  }
  @Get("settings") async get(@CurrentUser() user: { id: string }) {
    await this.service.assertSuperAdmin(user.id);
    return this.service.get();
  }
  @Patch("settings") async update(
    @CurrentUser() user: { id: string },
    @Body() body: Record<string, unknown>,
  ) {
    const settings = await this.service.update(
      user.id,
      body as Parameters<InstanceAdminService["update"]>[1],
    );
    // Field names only for SMTP: never the password, and hosts may be internal.
    await this.audit(user.id, "instance.settings.updated", null, {
      changed: Object.keys(body).sort(),
      ...(typeof body.registrationsEnabled === "boolean"
        ? { registrationsEnabled: body.registrationsEnabled }
        : {}),
    });
    return settings;
  }
  @Post("smtp/test") async testSmtp(
    @CurrentUser() user: { id: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.testSmtp(user.id, body as Parameters<InstanceAdminService["testSmtp"]>[1]);
  }
  /** Sends an email with the saved settings to the requesting administrator's own address. */
  @Post("smtp/test-email") async sendSmtpTestEmail(@CurrentUser() user: { id: string }) {
    const result = await this.smtpTestEmail.send(user.id);
    await this.audit(user.id, "instance.smtp.test_email_sent", null);
    return result;
  }
  @Get("update") async updateInformation(@CurrentUser() user: { id: string }) {
    await this.service.assertSuperAdmin(user.id);
    return this.updateCheck.getLatest();
  }
  @Get("users") async users(
    @CurrentUser() user: { id: string },
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.listUsers(
      user.id,
      search ?? "",
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 20)),
    );
  }
  @Delete("users/:userId") async deleteUser(
    @CurrentUser() user: { id: string },
    @Param("userId") userId: string,
    @Body() body: { confirmationEmail?: unknown },
  ) {
    const result = await this.deleteUserService.delete(user.id, userId, body?.confirmationEmail);
    await this.audit(user.id, "instance.user.deleted", userId);
    return result;
  }
  @Patch("users/:userId") async updateUser(
    @CurrentUser() user: { id: string },
    @Param("userId") userId: string,
    @Body() body: { isSuperAdmin: boolean },
  ) {
    const result = await this.service.setSuperAdmin(user.id, userId, body.isSuperAdmin);
    await this.audit(
      user.id,
      body.isSuperAdmin ? "instance.user.super_admin_granted" : "instance.user.super_admin_revoked",
      userId,
    );
    return result;
  }
  @Get("audit") async listAudit(
    @CurrentUser() user: { id: string },
    @Query() query: Record<string, unknown>,
  ) {
    await this.service.assertSuperAdmin(user.id);
    return this.auditService.list(
      { instance: true },
      parseAuditFilters(query),
      parseAuditLimit(query.limit),
      decodeAuditCursor(query.cursor),
    );
  }
  @Get("audit/facets") async auditFacets(@CurrentUser() user: { id: string }) {
    await this.service.assertSuperAdmin(user.id);
    return this.auditService.facets({ instance: true });
  }
  @Get("audit/export") async exportAudit(
    @CurrentUser() user: { id: string },
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.service.assertSuperAdmin(user.id);
    const filters = parseAuditFilters(query);
    const format = parseAuditExportFormat(query.format);
    const { rows, truncated } = await this.auditService.export({ instance: true }, filters);
    await this.audit(user.id, "audit.exported", null, {
      format,
      rowCount: rows.length,
      truncated,
      filters: { ...filters },
    });
    const file = renderAuditExport(rows, format, "instance");
    reply.header("Content-Type", file.contentType);
    reply.header("Content-Disposition", `attachment; filename="${file.fileName}"`);
    reply.header("Cache-Control", "no-store");
    reply.header("X-SpicyTrack-Export-Truncated", String(truncated));
    return file.body;
  }
}
