import { BadRequestException, Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord, UserRecord } from "../common/request-context";
import { assertOneOf, optionalNullableString } from "../common/validators";
import {
  OrganizationAiSettingsDto,
  UpdateOrganizationAiSettingsBodyDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { AutofixService } from "./autofix.service";
import { AiUsageService } from "../ai-usage/ai-usage.service";

@ApiTags("organizations")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@Controller("organizations/:orgSlug/settings/ai")
@UseGuards(AuthGuard, OrganizationContextGuard)
export class OrganizationAiSettingsController {
  constructor(
    private readonly autofixService: AutofixService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  @Get()
  @ApiOperation({ operationId: "getOrganizationAiSettings" })
  @ApiOkResponse({ type: OrganizationAiSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async get(@CurrentOrganization() organization: OrganizationRecord) {
    return this.autofixService.getOrgAiSettings(organization.id);
  }

  @Get("usage")
  @ApiOperation({ operationId: "getOrganizationAiUsage" })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async usage(@CurrentOrganization() organization: OrganizationRecord) {
    return this.aiUsageService.summary(organization.id);
  }

  @Get("pricing-overrides")
  @ApiOperation({ operationId: "listOrganizationAiPricingOverrides" })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async listPricingOverrides(@CurrentOrganization() organization: OrganizationRecord) {
    return this.aiUsageService.listOverrides(organization.id);
  }

  @Put("pricing-overrides")
  @ApiOperation({ operationId: "replaceOrganizationAiPricingOverrides" })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async replacePricingOverrides(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: { overrides?: unknown },
  ) {
    if (!Array.isArray(body.overrides)) throw new BadRequestException("overrides must be an array");
    return this.aiUsageService.replaceOverrides({
      organizationId: organization.id,
      actorUserId: user.id,
      overrides: body.overrides as Array<{
        provider: string;
        model: string;
        conditions?: Record<string, string | boolean | number | null>;
        ratesPerMillion: Record<string, number>;
        isActive?: boolean;
      }>,
    });
  }

  @Put()
  @ApiOperation({ operationId: "updateOrganizationAiSettings" })
  @ApiBody({ type: UpdateOrganizationAiSettingsBodyDto })
  @ApiOkResponse({ type: OrganizationAiSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async update(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.autofixService.updateOrgAiSettings({
      organizationId: organization.id,
      actorUserId: user.id,
      provider: body.provider
        ? assertOneOf(body.provider, ["anthropic", "openai", "google"] as const, "provider")
        : undefined,
      model: body.model === undefined ? undefined : optionalNullableString(body.model),
      apiKey: body.apiKey === undefined ? undefined : optionalNullableString(body.apiKey),
    });
  }
}
