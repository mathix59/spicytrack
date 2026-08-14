import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentMembership } from "../common/current-membership.decorator";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentProject } from "../common/current-project.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { OrganizationRecord } from "../common/request-context";
import type { OrganizationMemberRecord } from "../common/request-context";
import type { ProjectRecord } from "../common/request-context";
import type { UserRecord } from "../common/request-context";
import { AuthGuard } from "../auth/auth.guard";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import {
  parseCreateProjectBody,
  parseCreateProjectKeyBody,
  parseCreateSavedSearchBody,
  parseUpdateProjectBody,
  parseUpdateProjectKeyBody,
} from "./projects-controller.utils";
import { ProjectsService } from "./projects.service";
import {
  CreateProjectBodyDto,
  CreateProjectKeyBodyDto,
  ProjectDto,
  ProjectEnvironmentDto,
  ProjectKeyDto,
  ProjectSavedSearchDto,
  ProjectReleaseDetailDto,
  ProjectReleaseDto,
  AuditLogDto,
  CreateProjectSavedSearchBodyDto,
  SuccessDto,
  UpdateProjectBodyDto,
  UpdateProjectKeyBodyDto,
} from "../openapi/contracts";

@ApiTags("projects")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@Controller("organizations/:orgSlug/projects")
@UseGuards(AuthGuard, OrganizationContextGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly configService: ConfigService,
  ) {}

  private get ingestBaseUrl() {
    return (
      this.configService.get<string>("INGEST_BASE_URL") ||
      this.configService.get<string>("PUBLIC_BASE_URL")
    );
  }

  @Get()
  @ApiOperation({ operationId: "listProjects" })
  @ApiOkResponse({ type: [ProjectDto] })
  @RequirePermissions("org.projects.read")
  @UseGuards(PermissionGuard)
  async list(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentMembership() membership: OrganizationMemberRecord,
    @CurrentUser() user: UserRecord,
  ) {
    return this.projectsService.listAccessible({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
    });
  }

  @Post()
  @ApiOperation({ operationId: "createProject" })
  @ApiBody({ type: CreateProjectBodyDto })
  @ApiOkResponse({ type: ProjectDto })
  @RequirePermissions("org.projects.create")
  @UseGuards(PermissionGuard)
  async create(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseCreateProjectBody(body);

    return this.projectsService.create({
      organizationId: organization.id,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Get(":projectSlug")
  @ApiOperation({ operationId: "getProject" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiOkResponse({ type: ProjectDto })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  get(@CurrentProject() project: ProjectRecord) {
    return project;
  }

  @Patch(":projectSlug")
  @ApiOperation({ operationId: "updateProject" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiBody({ type: UpdateProjectBodyDto })
  @ApiOkResponse({ type: ProjectDto })
  @RequirePermissions("org.projects.update")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async update(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseUpdateProjectBody(body);

    return this.projectsService.updateProject({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Get(":projectSlug/keys")
  @ApiOperation({ operationId: "listProjectKeys" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiOkResponse({ type: [ProjectKeyDto] })
  @RequirePermissions("project.keys.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async listKeys(@CurrentProject() project: ProjectRecord) {
    return this.projectsService.listKeys({
      projectId: project.id,
      projectPublicId: project.publicId,
      publicBaseUrl: this.ingestBaseUrl,
    });
  }

  @Get(":projectSlug/saved-searches")
  @ApiOperation({ operationId: "listProjectSavedSearches" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiOkResponse({ type: [ProjectSavedSearchDto] })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async listSavedSearches(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
  ) {
    return this.projectsService.listSavedSearches({
      projectId: project.id,
      userId: user.id,
    });
  }

  @Post(":projectSlug/saved-searches")
  @ApiOperation({ operationId: "createProjectSavedSearch" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiBody({ type: CreateProjectSavedSearchBodyDto })
  @ApiOkResponse({ type: ProjectSavedSearchDto })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async createSavedSearch(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseCreateSavedSearchBody(body);

    return this.projectsService.createSavedSearch({
      organizationId: organization.id,
      projectId: project.id,
      userId: user.id,
      ...payload,
    });
  }

  @Delete(":projectSlug/saved-searches/:savedSearchId")
  @ApiOperation({ operationId: "deleteProjectSavedSearch" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiParam({ name: "savedSearchId", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async deleteSavedSearch(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("savedSearchId") savedSearchId: string,
  ) {
    return this.projectsService.deleteSavedSearch({
      projectId: project.id,
      userId: user.id,
      savedSearchId,
    });
  }

  @Get(":projectSlug/environments")
  @ApiOperation({ operationId: "listProjectEnvironments" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiOkResponse({ type: [ProjectEnvironmentDto] })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async listEnvironments(@CurrentProject() project: ProjectRecord) {
    return this.projectsService.listEnvironments(project.id);
  }

  @Get(":projectSlug/releases")
  @ApiOperation({ operationId: "listProjectReleases" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiOkResponse({ type: [ProjectReleaseDto] })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async listReleases(@CurrentProject() project: ProjectRecord) {
    return this.projectsService.listReleases(project.id);
  }

  @Get(":projectSlug/releases/:releaseVersion")
  @ApiOperation({ operationId: "getProjectRelease" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiOkResponse({ type: ProjectReleaseDetailDto })
  @RequirePermissions("project.releases.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async getRelease(
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
  ) {
    return this.projectsService.getReleaseDetail({
      projectId: project.id,
      releaseVersion,
    });
  }

  @Post(":projectSlug/keys")
  @ApiOperation({ operationId: "createProjectKey" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiBody({ type: CreateProjectKeyBodyDto })
  @ApiOkResponse({ type: ProjectKeyDto })
  @RequirePermissions("project.keys.manage")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async createKey(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseCreateProjectKeyBody(body);

    return this.projectsService.createKey({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      projectSlug: project.slug,
      projectPublicId: project.publicId,
      ...payload,
      publicBaseUrl: this.ingestBaseUrl,
    });
  }

  @Patch(":projectSlug/keys/:keyId")
  @ApiOperation({ operationId: "updateProjectKey" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiParam({ name: "keyId", type: String })
  @ApiBody({ type: UpdateProjectKeyBodyDto })
  @ApiOkResponse({ type: ProjectKeyDto })
  @RequirePermissions("project.keys.manage")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async updateKey(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("keyId") keyId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseUpdateProjectKeyBody(body);

    return this.projectsService.updateKey({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      keyId,
      ...payload,
      publicBaseUrl: this.ingestBaseUrl,
      projectPublicId: project.publicId,
    });
  }

  @Post(":projectSlug/keys/:keyId/rotate")
  @ApiOperation({ operationId: "rotateProjectKey" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiParam({ name: "keyId", type: String })
  @ApiOkResponse({ type: ProjectKeyDto })
  @RequirePermissions("project.keys.manage")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async rotateKey(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("keyId") keyId: string,
  ) {
    return this.projectsService.rotateKey({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      keyId,
      publicBaseUrl: this.ingestBaseUrl,
      projectPublicId: project.publicId,
    });
  }

  @Get(":projectSlug/audit")
  @ApiOperation({ operationId: "listProjectAudit" })
  @ApiParam({ name: "projectSlug", type: String })
  @ApiOkResponse({ type: [AuditLogDto] })
  @RequirePermissions("audit.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  async listAudit(@CurrentProject() project: ProjectRecord) {
    return this.projectsService.listAudit(project.id);
  }
}
