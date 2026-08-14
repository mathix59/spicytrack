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
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExcludeController,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";

import { AuthGuard } from "../auth/auth.guard";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord, UserRecord } from "../common/request-context";
import { assertBoolean, assertString, optionalNumber } from "../common/validators";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { McpService } from "./mcp.service";
import { isMcpScope, MCP_SCOPES } from "./mcp.types";

function parseCreateCredentialBody(body: Record<string, unknown>) {
  const scopes = body.scopes;
  const projectIds = body.projectIds;
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(isMcpScope)) {
    throw new BadRequestException(`scopes must contain one or more of: ${MCP_SCOPES.join(", ")}`);
  }
  if (
    projectIds !== undefined &&
    (!Array.isArray(projectIds) || !projectIds.every((id) => typeof id === "string"))
  ) {
    throw new BadRequestException("projectIds must be an array of project IDs");
  }
  const expiresInDays = optionalNumber(body.expiresInDays, "expiresInDays");
  if (expiresInDays !== undefined && (expiresInDays < 1 || expiresInDays > 365))
    throw new BadRequestException("expiresInDays must be between 1 and 365");
  return {
    name: assertString(body.name, "name"),
    scopes,
    allProjects: assertBoolean(body.allProjects, "allProjects"),
    projectIds: projectIds ?? [],
    expiresInDays,
  };
}

@ApiTags("organization-mcp")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@Controller("organizations/:orgSlug/mcp")
@UseGuards(AuthGuard, OrganizationContextGuard, PermissionGuard)
export class OrganizationMcpController {
  constructor(private readonly mcpService: McpService) {}

  @Get()
  @RequirePermissions("org.mcp.manage")
  @ApiOperation({ operationId: "getOrganizationMcp" })
  async get(@CurrentOrganization() organization: OrganizationRecord) {
    const [settings, credentials, activity] = await Promise.all([
      this.mcpService.getSettings(organization.id),
      this.mcpService.listCredentials(organization.id),
      this.mcpService.listActivity(organization.id),
    ]);
    return { ...settings, credentials, activity };
  }

  @Patch("settings")
  @RequirePermissions("org.mcp.manage")
  @ApiOperation({ operationId: "updateOrganizationMcpSettings" })
  async updateSettings(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.mcpService.updateSettings({
      organizationId: organization.id,
      actorUserId: user.id,
      enabled: assertBoolean(body.enabled, "enabled"),
    });
  }

  @Post("credentials")
  @RequirePermissions("org.mcp.manage")
  @ApiOperation({ operationId: "createOrganizationMcpCredential" })
  async createCredential(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.mcpService.createCredential({
      organizationId: organization.id,
      actorUserId: user.id,
      ...parseCreateCredentialBody(body),
    });
  }

  @Post("credentials/:credentialId/verify")
  @RequirePermissions("org.mcp.manage")
  @ApiOperation({ operationId: "verifyOrganizationMcpCredential" })
  @ApiParam({ name: "credentialId", type: String })
  async verifyCredential(
    @CurrentOrganization() organization: OrganizationRecord,
    @Param("credentialId") credentialId: string,
  ) {
    return this.mcpService.verifyCredential({
      organizationId: organization.id,
      credentialId,
    });
  }

  @Delete("credentials/:credentialId")
  @RequirePermissions("org.mcp.manage")
  @HttpCode(200)
  @ApiOperation({ operationId: "revokeOrganizationMcpCredential" })
  @ApiParam({ name: "credentialId", type: String })
  async revokeCredential(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("credentialId") credentialId: string,
  ) {
    return this.mcpService.revokeCredential({
      organizationId: organization.id,
      actorUserId: user.id,
      credentialId,
    });
  }

  @Post("credentials/:credentialId/rotate")
  @RequirePermissions("org.mcp.manage")
  @ApiOperation({ operationId: "rotateOrganizationMcpCredential" })
  @ApiParam({ name: "credentialId", type: String })
  async rotateCredential(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Param("credentialId") credentialId: string,
  ) {
    return this.mcpService.rotateCredential({
      organizationId: organization.id,
      actorUserId: user.id,
      credentialId,
    });
  }
}

@ApiExcludeController()
@EndpointAccess("mcp-credential")
@Controller("mcp")
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  async handle(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    return this.mcpService.handleHttpRequest(request, reply);
  }
}
