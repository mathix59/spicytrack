import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
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
import { CurrentProject } from "../common/current-project.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord, ProjectRecord, UserRecord } from "../common/request-context";
import {
  assertEmail,
  assertOneOf,
  assertString,
  optionalNullableString,
  optionalNumber,
} from "../common/validators";
import {
  AlertDeliveryDto,
  AlertRuleDto,
  CreateAlertRuleBodyDto,
  SuccessDto,
  UpdateAlertRuleBodyDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { AlertsService } from "./alerts.service";
import { parseWebhookUrl } from "./webhook-url-policy";

const DESTINATION_TYPES = ["webhook", "email", "slack", "teams", "discord"] as const;
const TRIGGER_TYPES = ["new_issue", "regression", "event_threshold", "daily_digest"] as const;
type DestinationType = (typeof DESTINATION_TYPES)[number];
type TriggerType = (typeof TRIGGER_TYPES)[number];

function assertTriggerTypes(value: unknown, legacyValue?: unknown): TriggerType[] {
  const candidate = value ?? (legacyValue === undefined ? undefined : [legacyValue]);
  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw new BadRequestException("triggerTypes must contain at least one trigger");
  }

  return [
    ...new Set(candidate.map((trigger) => assertOneOf(trigger, TRIGGER_TYPES, "triggerTypes"))),
  ];
}

function assertDestinationTarget(destinationType: DestinationType, value: unknown): string {
  return destinationType === "email"
    ? assertEmail(value)
    : parseWebhookUrl(assertString(value, "destinationTarget")).toString();
}

@ApiTags("alerts")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug/alerts")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ operationId: "listProjectAlerts" })
  @ApiOkResponse({ type: [AlertRuleDto] })
  @RequirePermissions("project.alerts.read")
  @UseGuards(PermissionGuard)
  async list(@CurrentProject() project: ProjectRecord) {
    return this.alertsService.listRules(project.id);
  }

  @Post()
  @ApiOperation({ operationId: "createProjectAlert" })
  @ApiBody({ type: CreateAlertRuleBodyDto })
  @ApiOkResponse({ type: AlertRuleDto })
  @RequirePermissions("project.alerts.manage")
  @UseGuards(PermissionGuard)
  async create(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const destinationType = assertOneOf(body.destinationType, DESTINATION_TYPES, "destinationType");

    return this.alertsService.createRule({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      name: assertString(body.name, "name"),
      triggerTypes: assertTriggerTypes(body.triggerTypes, body.triggerType),
      threshold: optionalNumber(body.threshold, "threshold") ?? null,
      cooldownMinutes: optionalNumber(body.cooldownMinutes, "cooldownMinutes") ?? undefined,
      destinationType,
      destinationTarget: assertDestinationTarget(destinationType, body.destinationTarget),
    });
  }

  @Patch(":alertRuleId")
  @ApiOperation({ operationId: "updateProjectAlert" })
  @ApiParam({ name: "alertRuleId", type: String })
  @ApiBody({ type: UpdateAlertRuleBodyDto })
  @ApiOkResponse({ type: AlertRuleDto })
  @RequirePermissions("project.alerts.manage")
  @UseGuards(PermissionGuard)
  async update(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("alertRuleId") alertRuleId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const destinationType =
      body.destinationType === undefined
        ? undefined
        : assertOneOf(body.destinationType, DESTINATION_TYPES, "destinationType");

    // Strict email-format validation only applies when destinationType is
    // changing in this same request; otherwise we can't know the rule's
    // existing type without a fetch, so accept the raw string as-is.
    const destinationTarget =
      body.destinationTarget === undefined
        ? undefined
        : destinationType
          ? assertDestinationTarget(destinationType, body.destinationTarget)
          : (optionalNullableString(body.destinationTarget) ?? undefined);

    return this.alertsService.updateRule({
      organizationId: organization.id,
      projectId: project.id,
      alertRuleId,
      actorUserId: user.id,
      name: optionalNullableString(body.name) ?? undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      triggerTypes:
        body.triggerTypes === undefined && body.triggerType === undefined
          ? undefined
          : assertTriggerTypes(body.triggerTypes, body.triggerType),
      threshold:
        body.threshold === null ? null : (optionalNumber(body.threshold, "threshold") ?? undefined),
      cooldownMinutes: optionalNumber(body.cooldownMinutes, "cooldownMinutes") ?? undefined,
      destinationType,
      destinationTarget,
    });
  }

  @Post(":alertRuleId/test")
  @HttpCode(200)
  @ApiOperation({ operationId: "testProjectAlert" })
  @ApiParam({ name: "alertRuleId", type: String })
  @ApiOkResponse({ type: AlertDeliveryDto })
  @RequirePermissions("project.alerts.manage")
  @UseGuards(PermissionGuard)
  async test(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("alertRuleId") alertRuleId: string,
  ) {
    return this.alertsService.testRule({
      organizationId: organization.id,
      projectId: project.id,
      alertRuleId,
      actorUserId: user.id,
    });
  }

  @Delete(":alertRuleId")
  @ApiOperation({ operationId: "deleteProjectAlert" })
  @ApiParam({ name: "alertRuleId", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("project.alerts.manage")
  @UseGuards(PermissionGuard)
  async remove(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("alertRuleId") alertRuleId: string,
  ) {
    return this.alertsService.deleteRule({
      organizationId: organization.id,
      projectId: project.id,
      alertRuleId,
      actorUserId: user.id,
    });
  }

  @Get("deliveries")
  @ApiOperation({ operationId: "listProjectAlertDeliveries" })
  @ApiOkResponse({ type: [AlertDeliveryDto] })
  @RequirePermissions("project.alerts.read")
  @UseGuards(PermissionGuard)
  async listDeliveries(@CurrentProject() project: ProjectRecord) {
    return this.alertsService.listDeliveries(project.id);
  }
}
