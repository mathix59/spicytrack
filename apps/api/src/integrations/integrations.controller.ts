import { Body, Controller, Delete, Get, Post, Put, UseGuards } from "@nestjs/common";
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
  assertOneOf,
  assertString,
  optionalNumber,
  optionalNullableString,
  optionalString,
} from "../common/validators";
import {
  RepoConnectionDto,
  SuccessDto,
  TestRepoConnectionBodyDto,
  TestRepoConnectionResultDto,
  UpsertRepoConnectionBodyDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { IntegrationsService } from "./integrations.service";

const PROVIDERS = ["github", "gitlab"] as const;

@ApiTags("integrations")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug/integrations")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get("repo-connection")
  @ApiOperation({ operationId: "getRepoConnection" })
  @ApiOkResponse({ type: RepoConnectionDto })
  @RequirePermissions("project.integrations.read")
  @UseGuards(PermissionGuard)
  async getConnection(@CurrentProject() project: ProjectRecord) {
    return this.integrationsService.getConnectionDto(project.id);
  }

  @Put("repo-connection")
  @ApiOperation({ operationId: "upsertRepoConnection" })
  @ApiBody({ type: UpsertRepoConnectionBodyDto })
  @ApiOkResponse({ type: RepoConnectionDto })
  @RequirePermissions("project.integrations.manage")
  @UseGuards(PermissionGuard)
  async upsertConnection(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.upsertConnection({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      provider: assertOneOf(body.provider, PROVIDERS, "provider"),
      baseUrl: optionalNullableString(body.baseUrl) ?? null,
      htmlUrl: optionalNullableString(body.htmlUrl) ?? null,
      apiUrl: optionalNullableString(body.apiUrl) ?? null,
      gitUser: optionalNullableString(body.gitUser) ?? null,
      gitPort: optionalNumber(body.gitPort, "gitPort") ?? null,
      repoIdentifier: assertString(body.repoIdentifier, "repoIdentifier"),
      token: optionalString(body.token),
      defaultBranch: optionalString(body.defaultBranch),
    });
  }

  @Delete("repo-connection")
  @ApiOperation({ operationId: "deleteRepoConnection" })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("project.integrations.manage")
  @UseGuards(PermissionGuard)
  async deleteConnection(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
  ) {
    return this.integrationsService.deleteConnection({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
    });
  }

  @Post("repo-connection/test")
  @ApiOperation({ operationId: "testRepoConnection" })
  @ApiBody({ type: TestRepoConnectionBodyDto })
  @ApiOkResponse({ type: TestRepoConnectionResultDto })
  @RequirePermissions("project.integrations.manage")
  @UseGuards(PermissionGuard)
  async testConnection(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.testConnection({
      organizationId: organization.id,
      projectId: project.id,
      provider: body.provider ? assertOneOf(body.provider, PROVIDERS, "provider") : undefined,
      baseUrl: body.baseUrl === undefined ? undefined : optionalNullableString(body.baseUrl),
      htmlUrl: body.htmlUrl === undefined ? undefined : optionalNullableString(body.htmlUrl),
      apiUrl: body.apiUrl === undefined ? undefined : optionalNullableString(body.apiUrl),
      gitUser: body.gitUser === undefined ? undefined : optionalNullableString(body.gitUser),
      gitPort: optionalNumber(body.gitPort, "gitPort"),
      repoIdentifier: optionalString(body.repoIdentifier),
      token: optionalString(body.token),
    });
  }
}
