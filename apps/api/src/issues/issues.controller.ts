import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import { CurrentProject } from "../common/current-project.decorator";
import type { OrganizationRecord, ProjectRecord } from "../common/request-context";
import type { UserRecord } from "../common/request-context";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { IssuesService } from "./issues.service";
import { IssueTriageService } from "./issue-triage.service";
import {
  parseBulkIssueAssigneeBody,
  parseBulkIssuePriorityBody,
  parseBulkIssueStatusBody,
  parseCreateCommentBody,
  parseIssueAssigneeBody,
  parseIssueEventPagination,
  parseIssueListQuery,
  parseIssuePriorityBody,
  parseIssueStatusBody,
  parseIssueExternalLinkBody,
  parseMergeIssueBody,
} from "./issues-controller.utils";
import {
  BulkIssueAssigneeUpdateBodyDto,
  BulkIssuePriorityUpdateBodyDto,
  BulkIssueStatusUpdateBodyDto,
  BulkOperationResultDto,
  CreateIssueCommentBodyDto,
  EventDto,
  IssueActivityDto,
  IssueAssigneeUpdateBodyDto,
  IssueCommentDto,
  IssueDetailDto,
  IssuePriorityUpdateBodyDto,
  IssueDto,
  IssueStatusUpdateBodyDto,
  IssueTriageDto,
  IssueExternalLinkBodyDto,
  MergeIssueBodyDto,
  PaginatedIssuesDto,
} from "../openapi/contracts";

@ApiTags("issues")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class IssuesController {
  constructor(
    private readonly issuesService: IssuesService,
    private readonly issueTriageService: IssueTriageService,
  ) {}

  @Get("issues")
  @ApiOperation({ operationId: "listIssues" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "q", required: false, type: String })
  @ApiQuery({ name: "level", required: false, type: String })
  @ApiQuery({ name: "priority", required: false, type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "assignedUserId", required: false, type: String })
  @ApiQuery({ name: "isRegressed", required: false, type: Boolean })
  @ApiQuery({ name: "environment", required: false, type: String })
  @ApiQuery({ name: "release", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, type: String })
  @ApiQuery({ name: "sortDir", required: false, type: String })
  @ApiOkResponse({ type: PaginatedIssuesDto })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async list(
    @CurrentProject() project: ProjectRecord,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("q") q?: string,
    @Query("level") level?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
    @Query("assignedUserId") assignedUserId?: string,
    @Query("isRegressed") isRegressed?: string,
    @Query("environment") environment?: string,
    @Query("release") release?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: string,
  ) {
    const query = parseIssueListQuery({
      page,
      pageSize,
      q,
      level,
      priority,
      status,
      assignedUserId,
      isRegressed,
      environment,
      release,
      sortBy,
      sortDir,
    });

    return this.issuesService.listByProject({
      projectId: project.id,
      ...query,
    });
  }

  @Get("issues/:issueId")
  @ApiOperation({ operationId: "getIssue" })
  @ApiParam({ name: "issueId", type: String })
  @ApiQuery({ name: "eventPage", required: false, type: Number })
  @ApiQuery({ name: "eventPageSize", required: false, type: Number })
  @ApiOkResponse({ type: IssueDetailDto })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async getIssue(
    @CurrentProject() project: ProjectRecord,
    @Param("issueId") issueId: string,
    @Query("eventPage") eventPage?: string,
    @Query("eventPageSize") eventPageSize?: string,
  ) {
    const pagination = parseIssueEventPagination({ eventPage, eventPageSize });

    return this.issuesService.getIssue({
      projectId: project.id,
      issueId,
      ...pagination,
    });
  }

  @Post("issues/:issueId/triage")
  @ApiOperation({ operationId: "generateIssueTriage" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: IssueTriageDto })
  @RequirePermissions("project.autofix.run")
  @UseGuards(PermissionGuard)
  async generateTriage(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
  ) {
    return this.issueTriageService.generate({
      organizationId: organization.id,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
    });
  }

  @Get("issues/:issueId/triage")
  @ApiOperation({ operationId: "listIssueTriageRuns" })
  @ApiParam({ name: "issueId", type: String })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async listTriageRuns(
    @CurrentProject() project: ProjectRecord,
    @Param("issueId") issueId: string,
  ) {
    return this.issueTriageService.list(project.id, issueId);
  }

  @Get("events/:eventId")
  @ApiOperation({ operationId: "getEvent" })
  @ApiParam({ name: "eventId", type: String })
  @ApiOkResponse({ type: EventDto })
  @RequirePermissions("project.events.read")
  @UseGuards(PermissionGuard)
  async getEvent(@CurrentProject() project: ProjectRecord, @Param("eventId") eventId: string) {
    return this.issuesService.getEvent(project.id, eventId);
  }

  @Patch("issues/:issueId/status")
  @ApiOperation({ operationId: "updateIssueStatus" })
  @ApiParam({ name: "issueId", type: String })
  @ApiBody({ type: IssueStatusUpdateBodyDto })
  @ApiOkResponse({ type: IssueDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async updateStatus(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseIssueStatusBody(body);

    return this.issuesService.updateStatus({
      projectId: project.id,
      organizationId: project.organizationId,
      issueId,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Patch("issues/:issueId/assignee")
  @ApiOperation({ operationId: "updateIssueAssignee" })
  @ApiParam({ name: "issueId", type: String })
  @ApiBody({ type: IssueAssigneeUpdateBodyDto })
  @ApiOkResponse({ type: IssueDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async updateAssignee(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseIssueAssigneeBody(body);

    return this.issuesService.updateAssignee({
      organizationId: organization.id,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Patch("issues/:issueId/priority")
  @ApiOperation({ operationId: "updateIssuePriority" })
  @ApiParam({ name: "issueId", type: String })
  @ApiBody({ type: IssuePriorityUpdateBodyDto })
  @ApiOkResponse({ type: IssueDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async updatePriority(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseIssuePriorityBody(body);

    return this.issuesService.updatePriority({
      organizationId: project.organizationId,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Patch("issues/:issueId/external-link")
  @ApiOperation({ operationId: "updateIssueExternalLink" })
  @ApiBody({ type: IssueExternalLinkBodyDto })
  @ApiOkResponse({ type: IssueDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async updateExternalLink(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.issuesService.updateExternalLink({
      organizationId: project.organizationId,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      ...parseIssueExternalLinkBody(body),
    });
  }

  @Post("issues/:issueId/merge")
  @ApiOperation({ operationId: "mergeIssue" })
  @ApiBody({ type: MergeIssueBodyDto })
  @ApiOkResponse({ type: IssueDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async merge(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.issuesService.mergeIssue({
      organizationId: project.organizationId,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      ...parseMergeIssueBody(body),
    });
  }

  @Post("issues/:issueId/unmerge")
  @ApiOperation({ operationId: "unmergeIssue" })
  @ApiOkResponse({ type: IssueDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async unmerge(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
  ) {
    return this.issuesService.unmergeIssue({
      organizationId: project.organizationId,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
    });
  }

  @Patch("issues/actions/status")
  @ApiOperation({ operationId: "bulkUpdateIssueStatus" })
  @ApiBody({ type: BulkIssueStatusUpdateBodyDto })
  @ApiOkResponse({ type: BulkOperationResultDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async bulkUpdateStatus(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseBulkIssueStatusBody(body);

    return this.issuesService.bulkUpdateStatus({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Patch("issues/actions/priority")
  @ApiOperation({ operationId: "bulkUpdateIssuePriority" })
  @ApiBody({ type: BulkIssuePriorityUpdateBodyDto })
  @ApiOkResponse({ type: BulkOperationResultDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async bulkUpdatePriority(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseBulkIssuePriorityBody(body);

    return this.issuesService.bulkUpdatePriority({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Patch("issues/actions/assignee")
  @ApiOperation({ operationId: "bulkUpdateIssueAssignee" })
  @ApiBody({ type: BulkIssueAssigneeUpdateBodyDto })
  @ApiOkResponse({ type: BulkOperationResultDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async bulkUpdateAssignee(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseBulkIssueAssigneeBody(body);

    return this.issuesService.bulkUpdateAssignee({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Get("issues/:issueId/comments")
  @ApiOperation({ operationId: "listIssueComments" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: [IssueCommentDto] })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async listComments(@CurrentProject() project: ProjectRecord, @Param("issueId") issueId: string) {
    return this.issuesService.listComments(project.id, issueId);
  }

  @Post("issues/:issueId/comments")
  @ApiOperation({ operationId: "createIssueComment" })
  @ApiParam({ name: "issueId", type: String })
  @ApiBody({ type: CreateIssueCommentBodyDto })
  @ApiOkResponse({ type: IssueCommentDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async createComment(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId") issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload = parseCreateCommentBody(body);

    return this.issuesService.createComment({
      organizationId: organization.id,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      ...payload,
    });
  }

  @Get("issues/:issueId/activity")
  @ApiOperation({ operationId: "listIssueActivity" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: [IssueActivityDto] })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async listActivity(@CurrentProject() project: ProjectRecord, @Param("issueId") issueId: string) {
    return this.issuesService.listActivity(project.id, issueId);
  }
}
