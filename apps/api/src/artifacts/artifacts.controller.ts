import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOrganization } from "../common/current-organization.decorator";
import { CurrentProject } from "../common/current-project.decorator";
import type { OrganizationRecord, ProjectRecord } from "../common/request-context";
import { ProjectReleaseDto, ReleaseArtifactDto, SuccessDto } from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { ArtifactsService } from "./artifacts.service";

@ApiTags("releases")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug/releases")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Put(":releaseVersion")
  @ApiOperation({ operationId: "upsertProjectRelease" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiOkResponse({ type: ProjectReleaseDto })
  @RequirePermissions("project.releases.manage")
  @UseGuards(PermissionGuard)
  async upsertRelease(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
  ) {
    return this.artifactsService.upsertRelease({
      organizationId: organization.id,
      projectId: project.id,
      releaseVersion,
    });
  }

  @Post(":releaseVersion/artifacts")
  @ApiOperation({ operationId: "uploadReleaseArtifact" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOkResponse({ type: ReleaseArtifactDto })
  @RequirePermissions("project.artifacts.manage")
  @UseGuards(PermissionGuard)
  async uploadArtifact(
    @CurrentOrganization() organization: OrganizationRecord,
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException("file is required");
    }

    return this.artifactsService.uploadArtifact({
      organizationId: organization.id,
      projectId: project.id,
      releaseVersion,
      name: file.filename,
      contentType: file.mimetype,
      body: await file.toBuffer(),
    });
  }

  @Get(":releaseVersion/artifacts")
  @ApiOperation({ operationId: "listReleaseArtifacts" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiOkResponse({ type: [ReleaseArtifactDto] })
  @RequirePermissions("project.artifacts.read")
  @UseGuards(PermissionGuard)
  async listArtifacts(
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
  ) {
    return this.artifactsService.listArtifacts({
      projectId: project.id,
      releaseVersion,
    });
  }

  @Delete(":releaseVersion/artifacts/:artifactId")
  @ApiOperation({ operationId: "deleteReleaseArtifact" })
  @ApiParam({ name: "releaseVersion", type: String })
  @ApiParam({ name: "artifactId", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("project.artifacts.manage")
  @UseGuards(PermissionGuard)
  async deleteArtifact(
    @CurrentProject() project: ProjectRecord,
    @Param("releaseVersion") releaseVersion: string,
    @Param("artifactId") artifactId: string,
  ) {
    return this.artifactsService.deleteArtifact({
      projectId: project.id,
      releaseVersion,
      artifactId,
    });
  }
}
