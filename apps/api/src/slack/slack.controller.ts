import { Body, Controller, Delete, Get, Put, UseGuards } from "@nestjs/common";
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
import { assertString } from "../common/validators";
import {
  OrganizationSlackSettingsDto,
  SuccessDto,
  UpdateOrganizationSlackSettingsBodyDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { SlackService } from "./slack.service";

@ApiTags("organizations")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@Controller("organizations/:orgSlug/settings/slack")
@UseGuards(AuthGuard, OrganizationContextGuard)
export class SlackSettingsController {
  constructor(private readonly slackService: SlackService) {}

  @Get()
  @ApiOperation({ operationId: "getOrganizationSlackSettings" })
  @ApiOkResponse({ type: OrganizationSlackSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async get(@CurrentOrganization() organization: OrganizationRecord) {
    return this.slackService.getSettings(organization.id);
  }

  @Put()
  @ApiOperation({ operationId: "updateOrganizationSlackSettings" })
  @ApiBody({ type: UpdateOrganizationSlackSettingsBodyDto })
  @ApiOkResponse({ type: OrganizationSlackSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async update(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.slackService.updateSettings({
      organizationId: organization.id,
      actorUserId: user.id,
      signingSecret: assertString(body.signingSecret, "signingSecret"),
      botToken: assertString(body.botToken, "botToken"),
    });
  }

  @Delete()
  @ApiOperation({ operationId: "deleteOrganizationSlackSettings" })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async remove(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
  ) {
    return this.slackService.deleteSettings({
      organizationId: organization.id,
      actorUserId: user.id,
    });
  }
}
