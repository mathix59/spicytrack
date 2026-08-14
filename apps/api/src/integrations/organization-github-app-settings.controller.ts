import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
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
import {
  assertOneOf,
  assertString,
  optionalNullableString,
  optionalNumber,
  optionalString,
} from "../common/validators";
import {
  CompleteGithubAppManifestBodyDto,
  CompleteGithubAppInstallationBodyDto,
  CreateGithubAppManifestBodyDto,
  GithubAppManifestDto,
  GithubAppManifestResultDto,
  GithubAppInstallUrlDto,
  GithubAppRepositoryDto,
  OrganizationGithubAppSettingsDto,
  UpdateOrganizationGithubAppSettingsBodyDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { IntegrationsService } from "./integrations.service";

@ApiTags("organizations")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@Controller("organizations/:orgSlug/settings/github-app")
@UseGuards(AuthGuard, OrganizationContextGuard)
export class OrganizationGithubAppSettingsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ operationId: "getOrganizationGithubAppSettings" })
  @ApiOkResponse({ type: OrganizationGithubAppSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async get(@CurrentOrganization() organization: OrganizationRecord) {
    return this.integrationsService.getOrgGithubAppSettings(organization.id);
  }

  @Get("install-url")
  @ApiOperation({ operationId: "getOrganizationGithubAppInstallUrl" })
  @ApiOkResponse({ type: GithubAppInstallUrlDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async getInstallUrl(@CurrentOrganization() organization: OrganizationRecord) {
    return this.integrationsService.getOrgGithubAppInstallUrl(organization.id);
  }

  @Post("manifest")
  @ApiOperation({ operationId: "createOrganizationGithubAppManifest" })
  @ApiBody({ type: CreateGithubAppManifestBodyDto })
  @ApiOkResponse({ type: GithubAppManifestDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async createManifest(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.createOrgGithubAppManifest({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      actorUserId: user.id,
      githubOrganization: optionalString(body.githubOrganization),
    });
  }

  @Put("complete-manifest")
  @ApiOperation({ operationId: "completeOrganizationGithubAppManifest" })
  @ApiBody({ type: CompleteGithubAppManifestBodyDto })
  @ApiOkResponse({ type: GithubAppManifestResultDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async completeManifest(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.completeOrgGithubAppManifest({
      organizationId: organization.id,
      actorUserId: user.id,
      code: assertString(body.code, "code"),
      state: assertString(body.state, "state"),
    });
  }

  @Get("repositories")
  @ApiOperation({ operationId: "listOrganizationGithubRepositories" })
  @ApiOkResponse({ type: GithubAppRepositoryDto, isArray: true })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async listRepositories(@CurrentOrganization() organization: OrganizationRecord) {
    return this.integrationsService.listOrgGithubRepositories(organization.id);
  }

  @Post("repositories/sync")
  @ApiOperation({ operationId: "syncOrganizationGithubRepositories" })
  @ApiOkResponse({ type: GithubAppRepositoryDto, isArray: true })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async syncRepositories(@CurrentOrganization() organization: OrganizationRecord) {
    return this.integrationsService.syncOrgGithubRepositories(organization.id);
  }

  @Put("complete-installation")
  @ApiOperation({ operationId: "completeOrganizationGithubAppInstallation" })
  @ApiBody({ type: CompleteGithubAppInstallationBodyDto })
  @ApiOkResponse({ type: OrganizationGithubAppSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async completeInstallation(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.completeOrgGithubAppInstallation({
      organizationId: organization.id,
      actorUserId: user.id,
      installationId: assertString(body.installationId, "installationId"),
      state: optionalString(body.state),
    });
  }

  @Put()
  @ApiOperation({ operationId: "updateOrganizationGithubAppSettings" })
  @ApiBody({ type: UpdateOrganizationGithubAppSettingsBodyDto })
  @ApiOkResponse({ type: OrganizationGithubAppSettingsDto })
  @RequirePermissions("org.settings.manage")
  @UseGuards(PermissionGuard)
  async update(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.updateOrgGithubAppSettings({
      organizationId: organization.id,
      actorUserId: user.id,
      mode: body.mode
        ? assertOneOf(body.mode, ["cloud", "enterprise"] as const, "mode")
        : undefined,
      htmlUrl: body.htmlUrl === undefined ? undefined : optionalNullableString(body.htmlUrl),
      apiUrl: body.apiUrl === undefined ? undefined : optionalNullableString(body.apiUrl),
      gitUser: body.gitUser === undefined ? undefined : optionalNullableString(body.gitUser),
      gitPort: optionalNumber(body.gitPort, "gitPort"),
      appSlug: body.appSlug === undefined ? undefined : optionalNullableString(body.appSlug),
      appId: body.appId === undefined ? undefined : optionalNullableString(body.appId),
      clientId: body.clientId === undefined ? undefined : optionalNullableString(body.clientId),
      installationId:
        body.installationId === undefined ? undefined : optionalNullableString(body.installationId),
      installationAccountLogin:
        body.installationAccountLogin === undefined
          ? undefined
          : optionalNullableString(body.installationAccountLogin),
      installationAccountType:
        body.installationAccountType === undefined
          ? undefined
          : optionalNullableString(body.installationAccountType),
      clientSecret:
        body.clientSecret === undefined ? undefined : optionalNullableString(body.clientSecret),
      privateKey:
        body.privateKey === undefined ? undefined : optionalNullableString(body.privateKey),
      webhookSecret:
        body.webhookSecret === undefined ? undefined : optionalNullableString(body.webhookSecret),
    });
  }
}
