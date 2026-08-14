import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { optionalNullableString, optionalNumber, optionalString } from "../common/validators";
import {
  AutofixConfigDto,
  AutofixRunDto,
  ReviewAutofixBodyDto,
  UpdateAutofixConfigBodyDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { AutofixService } from "./autofix.service";

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return Boolean(value);
}

@ApiTags("autofix")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class AutofixController {
  constructor(private readonly autofixService: AutofixService) {}

  @Get("autofix/config")
  @ApiOperation({ operationId: "getAutofixConfig" })
  @ApiOkResponse({ type: AutofixConfigDto })
  @RequirePermissions("project.autofix.read")
  @UseGuards(PermissionGuard)
  async getConfig(@CurrentProject() project: ProjectRecord) {
    return this.autofixService.getConfig(project.id);
  }

  @Put("autofix/config")
  @ApiOperation({ operationId: "updateAutofixConfig" })
  @ApiBody({ type: UpdateAutofixConfigBodyDto })
  @ApiOkResponse({ type: AutofixConfigDto })
  @RequirePermissions("project.autofix.manage")
  @UseGuards(PermissionGuard)
  async updateConfig(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    return this.autofixService.updateConfig({
      organizationId: organization.id,
      projectId: project.id,
      actorUserId: user.id,
      enabled: optionalBoolean(body.enabled),
      autoTriggerOnNewIssue: optionalBoolean(body.autoTriggerOnNewIssue),
      autoMerge: optionalBoolean(body.autoMerge),
      dailyCap: optionalNumber(body.dailyCap, "dailyCap"),
      targetBranch:
        body.targetBranch === undefined ? undefined : optionalNullableString(body.targetBranch),
    });
  }

  @Post("issues/:issueId/autofix")
  @ApiOperation({ operationId: "triggerAutofix" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: AutofixRunDto })
  @RequirePermissions("project.autofix.run")
  @UseGuards(PermissionGuard)
  async trigger(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId", new ParseUUIDPipe()) issueId: string,
  ) {
    return this.autofixService.trigger({
      organizationId: organization.id,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      trigger: "manual",
    });
  }

  @Get("issues/:issueId/autofix/runs")
  @ApiOperation({ operationId: "listIssueAutofixRuns" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: [AutofixRunDto] })
  @RequirePermissions("project.autofix.read")
  @UseGuards(PermissionGuard)
  async listRuns(
    @CurrentProject() project: ProjectRecord,
    @Param("issueId", new ParseUUIDPipe()) issueId: string,
  ) {
    return this.autofixService.listRunsForIssue(project.id, issueId);
  }

  @Get("autofix/runs/:runId")
  @ApiOperation({ operationId: "getAutofixRun" })
  @ApiParam({ name: "runId", type: String })
  @ApiOkResponse({ type: AutofixRunDto })
  @RequirePermissions("project.autofix.read")
  @UseGuards(PermissionGuard)
  async getRun(
    @CurrentProject() project: ProjectRecord,
    @Param("runId", new ParseUUIDPipe()) runId: string,
  ) {
    return this.autofixService.getRun(project.id, runId);
  }

  @Post("autofix/runs/:runId/review")
  @ApiOperation({ operationId: "reviewAutofixRun" })
  @ApiParam({ name: "runId", type: String })
  @ApiBody({ type: ReviewAutofixBodyDto })
  @ApiOkResponse({ type: AutofixRunDto })
  @RequirePermissions("project.autofix.run")
  @UseGuards(PermissionGuard)
  async reviewRun(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const status = body.status;
    if (status !== "approved" && status !== "rejected") {
      throw new BadRequestException("status must be approved or rejected");
    }
    const comment = optionalString(body.comment);
    if (comment && comment.length > 2000) throw new BadRequestException("comment is too long");
    return this.autofixService.reviewRun({
      organizationId: organization.id,
      projectId: project.id,
      runId,
      actorUserId: user.id,
      status,
      comment,
    });
  }
}
