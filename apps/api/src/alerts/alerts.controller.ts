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
import { DESTINATION_TYPES } from "./alerts.types";
import type { DestinationType } from "./alerts.types";
import { parseWebhookUrl } from "./webhook-url-policy";

const TRIGGER_TYPES = ["new_issue", "regression", "event_threshold", "daily_digest"] as const;
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

const LIMITS = {
  threshold: { min: 1, max: 1_000_000 },
  thresholdWindowMinutes: { min: 1, max: 7 * 24 * 60 },
  cooldownMinutes: { min: 1, max: 7 * 24 * 60 },
} as const;

function optionalBoundedInteger(value: unknown, field: keyof typeof LIMITS): number | undefined {
  const number = optionalNumber(value, field);
  if (number === undefined) return undefined;
  const { min, max } = LIMITS[field];
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function assertDestinationTarget(destinationType: DestinationType, value: unknown): string {
  return destinationType === "email"
    ? assertEmail(value)
    : parseWebhookUrl(assertString(value, "destinationTarget")).toString();
}

/**
 * The target is validated against the type the rule will have after the update, so a type change
 * can never keep a target of the old kind (e.g. a webhook URL stored as an email address).
 */
export function resolveDestinationUpdate(
  currentType: DestinationType,
  nextType: DestinationType | undefined,
  target: unknown,
): { destinationType: DestinationType; destinationTarget?: string } {
  const destinationType = nextType ?? currentType;
  if (target === undefined) {
    if (destinationType !== currentType) {
      throw new BadRequestException("destinationTarget is required when changing destinationType");
    }
    return { destinationType };
  }
  return { destinationType, destinationTarget: assertDestinationTarget(destinationType, target) };
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
      threshold: optionalBoundedInteger(body.threshold, "threshold") ?? null,
      thresholdWindowMinutes: optionalBoundedInteger(
        body.thresholdWindowMinutes,
        "thresholdWindowMinutes",
      ),
      cooldownMinutes: optionalBoundedInteger(body.cooldownMinutes, "cooldownMinutes"),
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
    const destinationTarget =
      body.destinationTarget === undefined || body.destinationTarget === ""
        ? undefined
        : body.destinationTarget;

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
        body.threshold === null ? null : optionalBoundedInteger(body.threshold, "threshold"),
      thresholdWindowMinutes: optionalBoundedInteger(
        body.thresholdWindowMinutes,
        "thresholdWindowMinutes",
      ),
      cooldownMinutes: optionalBoundedInteger(body.cooldownMinutes, "cooldownMinutes"),
      destination:
        destinationType === undefined && destinationTarget === undefined
          ? undefined
          : (currentType: DestinationType) =>
              resolveDestinationUpdate(currentType, destinationType, destinationTarget),
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
