import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import type { OrganizationRecord, UserRecord } from "../common/request-context";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import {
  parseAcceptInvitationBody,
  parseCreateInvitationBody,
  parseCreateOrganizationBody,
  parseOrganizationJobQueueQuery,
  parseUpdateMemberRoleBody,
  resolveOrganizationActorRole,
} from "./organizations-controller.utils";
import { OrganizationsService } from "./organizations.service";
import {
  AcceptInvitationBodyDto,
  CreateInvitationBodyDto,
  CreateOrganizationBodyDto,
  InvitationResultDto,
  OrganizationJobDto,
  OrganizationJobQueueOverviewDto,
  OrganizationInvitationDto,
  OrganizationOverviewDto,
  OrganizationDto,
  OrganizationListItemDto,
  OrganizationRoleDto,
  CreateOrganizationRoleBodyDto,
  UpdateOrganizationRoleBodyDto,
  OrganizationMemberDto,
  SuccessDto,
  UpdateMemberRoleBodyDto,
} from "../openapi/contracts";
import { BadRequestException } from "@nestjs/common";
import { assertSlug, assertString } from "../common/validators";
import { ROLE_PERMISSIONS } from "../rbac/permissions.constants";
import type { Permission } from "../rbac/permissions.types";

const ORGANIZATION_ROLE_PERMISSIONS = new Set(Object.values(ROLE_PERMISSIONS).flat());

function parseOrganizationRoleBody(
  body: Record<string, unknown>,
  includeKey: true,
): { key: string; name: string; permissions: Permission[] };
function parseOrganizationRoleBody(
  body: Record<string, unknown>,
  includeKey: false,
): { name: string; permissions: Permission[] };
function parseOrganizationRoleBody(body: Record<string, unknown>, includeKey: boolean) {
  const permissions = body.permissions;
  if (
    !Array.isArray(permissions) ||
    !permissions.every(
      (permission) =>
        typeof permission === "string" && ORGANIZATION_ROLE_PERMISSIONS.has(permission as never),
    )
  ) {
    throw new BadRequestException("Invalid organization permissions");
  }

  return {
    ...(includeKey ? { key: assertSlug(body.key, "key", 32) } : {}),
    name: assertString(body.name, "name"),
    permissions: permissions as Permission[],
  };
}

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("organizations")
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ operationId: "listOrganizations" })
  @ApiOkResponse({ type: [OrganizationListItemDto] })
  async list(@CurrentUser() user: UserRecord) {
    return this.organizationsService.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ operationId: "createOrganization" })
  @ApiBody({ type: CreateOrganizationBodyDto })
  @ApiOkResponse({ type: OrganizationDto })
  async create(@CurrentUser() user: UserRecord, @Body() body: Record<string, unknown>) {
    const payload = parseCreateOrganizationBody(body);

    return this.organizationsService.createOrganization({
      userId: user.id,
      ...payload,
    });
  }

  @Get(":orgSlug")
  @ApiOperation({ operationId: "getOrganization" })
  @ApiParam({ name: "orgSlug", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.read")
  @ApiOkResponse({ type: OrganizationDto })
  get(@CurrentOrganization() organization: OrganizationRecord) {
    return organization;
  }

  @Get(":orgSlug/members")
  @ApiOperation({ operationId: "listOrganizationMembers" })
  @ApiParam({ name: "orgSlug", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.read")
  @ApiOkResponse({ type: [OrganizationMemberDto] })
  async members(@CurrentOrganization() organization: OrganizationRecord) {
    return this.organizationsService.listMembers(organization.id);
  }

  @Get(":orgSlug/roles")
  @ApiOperation({ operationId: "listOrganizationRoles" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiOkResponse({ type: [OrganizationRoleDto] })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.read")
  async roles(@CurrentOrganization() organization: OrganizationRecord) {
    return this.organizationsService.listRoles(organization.id);
  }

  @Post(":orgSlug/roles")
  @ApiOperation({ operationId: "createOrganizationRole" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiBody({ type: CreateOrganizationRoleBodyDto })
  @ApiOkResponse({ type: OrganizationRoleDto })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.settings.manage")
  async createRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.organizationsService.createRole(
      organization.id,
      parseOrganizationRoleBody(body, true),
      user.id,
    );
  }

  @Patch(":orgSlug/roles/:roleKey")
  @ApiOperation({ operationId: "updateOrganizationRole" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiParam({ name: "roleKey", type: String })
  @ApiBody({ type: UpdateOrganizationRoleBodyDto })
  @ApiOkResponse({ type: OrganizationRoleDto })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.settings.manage")
  async updateRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("roleKey") roleKey: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.organizationsService.updateRole(
      organization.id,
      assertSlug(roleKey, "roleKey", 32),
      parseOrganizationRoleBody(body, false),
      user.id,
    );
  }

  @Delete(":orgSlug/roles/:roleKey")
  @ApiOperation({ operationId: "deleteOrganizationRole" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiParam({ name: "roleKey", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.settings.manage")
  async deleteRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("roleKey") roleKey: string,
  ) {
    return this.organizationsService.deleteRole(organization.id, roleKey, user.id);
  }

  @Get(":orgSlug/overview")
  @ApiOperation({ operationId: "getOrganizationOverview" })
  @ApiParam({ name: "orgSlug", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.projects.read")
  @ApiOkResponse({ type: OrganizationOverviewDto })
  async overview(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.getOverview({
      organizationId: organization.id,
      userId: user.id,
      role: resolveOrganizationActorRole(request),
    });
  }

  @Get(":orgSlug/jobs")
  @ApiOperation({ operationId: "getOrganizationJobQueueOverview" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "type", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.settings.manage")
  @ApiOkResponse({ type: OrganizationJobQueueOverviewDto })
  async jobQueue(
    @CurrentOrganization() organization: OrganizationRecord,
    @Query()
    query: { status?: string; type?: string; projectId?: string; limit?: string },
  ) {
    return this.organizationsService.getQueueOverview(
      organization.id,
      parseOrganizationJobQueueQuery(query),
    );
  }

  @Post(":orgSlug/jobs/:jobId/requeue")
  @ApiOperation({ operationId: "requeueOrganizationJob" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiParam({ name: "jobId", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.settings.manage")
  @ApiOkResponse({ type: OrganizationJobDto })
  async requeueJob(
    @CurrentOrganization() organization: OrganizationRecord,
    @Param("jobId") jobId: string,
  ) {
    return this.organizationsService.requeueFailedJob(organization.id, jobId);
  }

  @Post(":orgSlug/invitations")
  @ApiOperation({ operationId: "createOrganizationInvitation" })
  @ApiParam({ name: "orgSlug", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.invite")
  @ApiBody({ type: CreateInvitationBodyDto })
  @ApiOkResponse({ type: InvitationResultDto })
  async createInvitation(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseCreateInvitationBody(body);

    return this.organizationsService.createInvitation({
      organizationId: organization.id,
      invitedByUserId: user.id,
      ...payload,
    });
  }

  @Get(":orgSlug/invitations")
  @ApiOperation({ operationId: "listOrganizationInvitations" })
  @ApiParam({ name: "orgSlug", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.read")
  @ApiOkResponse({ type: [OrganizationInvitationDto] })
  async listInvitations(@CurrentOrganization() organization: OrganizationRecord) {
    return this.organizationsService.listPendingInvitations(organization.id);
  }

  @Post(":orgSlug/invitations/:invitationId/resend")
  @ApiOperation({ operationId: "resendOrganizationInvitation" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiParam({ name: "invitationId", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.invite")
  @ApiOkResponse({ type: InvitationResultDto })
  async resendInvitation(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("invitationId") invitationId: string,
  ) {
    return this.organizationsService.resendInvitation({
      organizationId: organization.id,
      invitedByUserId: user.id,
      invitationId,
    });
  }

  @Post("invitations/accept")
  @ApiOperation({ operationId: "acceptOrganizationInvitation" })
  @ApiBody({ type: AcceptInvitationBodyDto })
  @ApiOkResponse({ type: OrganizationDto })
  async acceptInvitation(@CurrentUser() user: UserRecord, @Body() body: Record<string, unknown>) {
    const payload = parseAcceptInvitationBody(body);

    return this.organizationsService.acceptInvitation({
      userId: user.id,
      ...payload,
    });
  }

  @Patch(":orgSlug/members/:memberId")
  @ApiOperation({ operationId: "updateOrganizationMemberRole" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiParam({ name: "memberId", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.update_role")
  @ApiBody({ type: UpdateMemberRoleBodyDto })
  @ApiOkResponse({ type: OrganizationMemberDto })
  async updateMemberRole(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("memberId") memberId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseUpdateMemberRoleBody(body);

    return this.organizationsService.updateMemberRole({
      organizationId: organization.id,
      actorUserId: user.id,
      memberId,
      ...payload,
    });
  }

  @Delete(":orgSlug/members/:memberId")
  @ApiOperation({ operationId: "removeOrganizationMember" })
  @ApiParam({ name: "orgSlug", type: String })
  @ApiParam({ name: "memberId", type: String })
  @UseGuards(OrganizationContextGuard, PermissionGuard)
  @RequirePermissions("org.members.remove")
  @ApiOkResponse({ type: SuccessDto })
  async removeMember(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("memberId") memberId: string,
  ) {
    return this.organizationsService.removeMember({
      organizationId: organization.id,
      actorUserId: user.id,
      memberId,
    });
  }
}
