import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
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
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord, UserRecord } from "../common/request-context";
import { assertSlug, assertString, optionalNullableString } from "../common/validators";
import { AuthGuard } from "../auth/auth.guard";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { TEAM_PERMISSIONS, TeamsService } from "./teams.service";
import {
  AddTeamMemberBodyDto,
  CreateTeamBodyDto,
  SuccessDto,
  TeamDto,
  TeamMemberDto,
  TeamRoleDto,
  CreateTeamRoleBodyDto,
  UpdateTeamRoleBodyDto,
  UpdateTeamBodyDto,
  TeamMembersResponseDto,
} from "../openapi/contracts";

function assertTeamRole(value: unknown) {
  return assertString(value, "role");
}

function assertTeamPermissions(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => TEAM_PERMISSIONS.includes(item as never))) {
    throw new BadRequestException("Invalid team permissions");
  }
  return value as (typeof TEAM_PERMISSIONS)[number][];
}

@ApiTags("teams")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@Controller("organizations/:orgSlug/teams")
@UseGuards(AuthGuard, OrganizationContextGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ operationId: "listTeams" })
  @ApiOkResponse({ type: [TeamDto] })
  @RequirePermissions("org.teams.read")
  @UseGuards(PermissionGuard)
  async list(@CurrentOrganization() organization: OrganizationRecord) {
    return this.teamsService.list(organization.id);
  }

  @Post()
  @ApiOperation({ operationId: "createTeam" })
  @ApiBody({ type: CreateTeamBodyDto })
  @ApiOkResponse({ type: TeamDto })
  @RequirePermissions("org.teams.create")
  @UseGuards(PermissionGuard)
  async create(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.teamsService.create({
      organizationId: organization.id,
      name: assertString(body.name, "name"),
      slug: assertSlug(body.slug),
      description: optionalNullableString(body.description) ?? undefined,
      actorUserId: user.id,
    });
  }

  @Patch(":teamSlug")
  @ApiOperation({ operationId: "updateTeam" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiBody({ type: UpdateTeamBodyDto })
  @ApiOkResponse({ type: TeamDto })
  @RequirePermissions("org.teams.update")
  @UseGuards(PermissionGuard)
  async update(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.teamsService.update({
      organizationId: organization.id,
      teamSlug,
      name: optionalNullableString(body.name) ?? undefined,
      description:
        body.description === null ? null : (optionalNullableString(body.description) ?? undefined),
      actorUserId: user.id,
    });
  }

  @Delete(":teamSlug")
  @ApiOperation({ operationId: "deleteTeam" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("org.teams.delete")
  @UseGuards(PermissionGuard)
  async delete(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
  ) {
    return this.teamsService.delete(organization.id, teamSlug, user.id);
  }

  @Get(":teamSlug/members")
  @ApiOperation({ operationId: "listTeamMembers" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiOkResponse({ type: TeamMembersResponseDto })
  @RequirePermissions("org.teams.read")
  @UseGuards(PermissionGuard)
  async members(
    @CurrentOrganization() organization: OrganizationRecord,
    @Param("teamSlug") teamSlug: string,
  ) {
    return this.teamsService.listMembers(organization.id, teamSlug);
  }

  @Get(":teamSlug/roles")
  @ApiOperation({ operationId: "listTeamRoles" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiOkResponse({ type: [TeamRoleDto] })
  @RequirePermissions("org.teams.read")
  @UseGuards(PermissionGuard)
  async listRoles(
    @CurrentOrganization() organization: OrganizationRecord,
    @Param("teamSlug") teamSlug: string,
  ) {
    return this.teamsService.listRoles(organization.id, teamSlug);
  }

  @Post(":teamSlug/roles")
  @ApiOperation({ operationId: "createTeamRole" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiBody({ type: CreateTeamRoleBodyDto })
  @ApiOkResponse({ type: TeamRoleDto })
  @RequirePermissions("org.teams.update")
  @UseGuards(PermissionGuard)
  async createRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    const name = assertString(body.name, "name");
    const key = assertSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      "name",
      32,
    );
    return this.teamsService.createRole({
      organizationId: organization.id,
      teamSlug,
      key,
      name,
      permissions: assertTeamPermissions(body.permissions),
      actorUserId: user.id,
    });
  }

  @Delete(":teamSlug/roles/:roleKey")
  @ApiOperation({ operationId: "deleteTeamRole" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiParam({ name: "roleKey", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("org.teams.update")
  @UseGuards(PermissionGuard)
  async deleteRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
    @Param("roleKey") roleKey: string,
  ) {
    return this.teamsService.deleteRole({
      organizationId: organization.id,
      teamSlug,
      roleKey: assertSlug(roleKey, "roleKey", 32),
      actorUserId: user.id,
    });
  }

  @Patch(":teamSlug/roles/:roleKey")
  @ApiOperation({ operationId: "updateTeamRole" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiParam({ name: "roleKey", type: String })
  @ApiBody({ type: UpdateTeamRoleBodyDto })
  @ApiOkResponse({ type: TeamRoleDto })
  @RequirePermissions("org.teams.update")
  @UseGuards(PermissionGuard)
  async updateRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
    @Param("roleKey") roleKey: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.teamsService.updateRole({
      organizationId: organization.id,
      teamSlug,
      roleKey: assertSlug(roleKey, "roleKey", 32),
      name: assertString(body.name, "name"),
      permissions: assertTeamPermissions(body.permissions),
      actorUserId: user.id,
    });
  }

  @Post(":teamSlug/members")
  @ApiOperation({ operationId: "addTeamMember" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiBody({ type: AddTeamMemberBodyDto })
  @ApiOkResponse({ type: TeamMemberDto })
  @RequirePermissions("org.teams.update")
  @UseGuards(PermissionGuard)
  async addMember(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.teamsService.addMember({
      organizationId: organization.id,
      teamSlug,
      userId: assertString(body.userId, "userId"),
      role: assertTeamRole(body.role),
      actorUserId: user.id,
    });
  }

  @Delete(":teamSlug/members/:userId")
  @ApiOperation({ operationId: "removeTeamMember" })
  @ApiParam({ name: "teamSlug", type: String })
  @ApiParam({ name: "userId", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("org.teams.update")
  @UseGuards(PermissionGuard)
  async removeMember(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("teamSlug") teamSlug: string,
    @Param("userId") userId: string,
  ) {
    return this.teamsService.removeMember({
      organizationId: organization.id,
      teamSlug,
      userId,
      actorUserId: user.id,
    });
  }
}
