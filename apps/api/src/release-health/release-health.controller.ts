import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentProject } from "../common/current-project.decorator";
import type { ProjectRecord } from "../common/request-context";
import { ReleaseHealthDetailDto, ReleaseHealthSummaryDto } from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { ReleaseHealthService } from "./release-health.service";

const PERIOD_QUERY = { name: "period", required: false, enum: ["24h", "7d", "14d", "30d"] };
const ENVIRONMENT_QUERY = { name: "environment", required: false, type: String };

@ApiTags("releases")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class ReleaseHealthController {
  constructor(private readonly releaseHealthService: ReleaseHealthService) {}

  @Get("release-health")
  @ApiOperation({ operationId: "getProjectReleaseHealth" })
  @ApiQuery(PERIOD_QUERY)
  @ApiQuery(ENVIRONMENT_QUERY)
  @ApiOkResponse({ type: ReleaseHealthSummaryDto })
  @RequirePermissions("project.releases.read")
  @UseGuards(PermissionGuard)
  async summary(
    @CurrentProject() project: ProjectRecord,
    @Query("period") period?: string,
    @Query("environment") environment?: string,
  ) {
    return this.releaseHealthService.summary(project.id, { period, environment });
  }

  @Get("releases/:releaseVersion/health")
  @ApiOperation({ operationId: "getReleaseHealth" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiQuery(PERIOD_QUERY)
  @ApiQuery(ENVIRONMENT_QUERY)
  @ApiOkResponse({ type: ReleaseHealthDetailDto })
  @RequirePermissions("project.releases.read")
  @UseGuards(PermissionGuard)
  async release(
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
    @Query("period") period?: string,
    @Query("environment") environment?: string,
  ) {
    return this.releaseHealthService.release(project.id, releaseVersion, { period, environment });
  }
}
