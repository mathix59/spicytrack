import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentProject } from "../common/current-project.decorator";
import type { ProjectRecord } from "../common/request-context";
import { ReleaseCommitsDto, SuspectCommitsDto } from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { ReleaseCommitsService } from "./release-commits.service";

@ApiTags("releases")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class ReleaseCommitsController {
  constructor(private readonly releaseCommitsService: ReleaseCommitsService) {}

  @Get("releases/:releaseVersion/commits")
  @ApiOperation({ operationId: "listReleaseCommits" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiOkResponse({ type: ReleaseCommitsDto })
  @RequirePermissions("project.releases.read")
  @UseGuards(PermissionGuard)
  async list(
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
  ) {
    return this.releaseCommitsService.listForRelease(project.id, releaseVersion);
  }

  @Post("releases/:releaseVersion/commits/sync")
  @ApiOperation({ operationId: "syncReleaseCommits" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiOkResponse({ type: ReleaseCommitsDto })
  @RequirePermissions("project.releases.manage")
  @UseGuards(PermissionGuard)
  async sync(
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
  ) {
    const release = await this.releaseCommitsService.getRelease(project.id, releaseVersion);
    await this.releaseCommitsService.requestSync(release);
    return this.releaseCommitsService.listForRelease(project.id, releaseVersion);
  }

  @Get("issues/:issueId/suspect-commits")
  @ApiOperation({ operationId: "getIssueSuspectCommits" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: SuspectCommitsDto })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async suspects(
    @CurrentProject() project: ProjectRecord,
    @Param("issueId", new ParseUUIDPipe()) issueId: string,
  ) {
    return this.releaseCommitsService.suspectsForIssue(project.id, issueId);
  }
}
