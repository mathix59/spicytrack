import {
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
import { assertOneOf, assertString, optionalNullableString } from "../common/validators";
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
import {
  assertDestinationTarget,
  assertTriggerTypes,
  optionalBoundedInteger,
  resolveDestinationUpdate,
} from "./alerts-controller.utils";
import { AlertsService } from "./alerts.service";
import { DESTINATION_TYPES } from "./alerts.types";
import type { DestinationType } from "./alerts.types";

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
