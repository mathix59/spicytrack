import { BadRequestException, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { CurrentProject } from "../common/current-project.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { ProjectRecord, UserRecord } from "../common/request-context";
import { ProjectFirstEventDto, TestEventResultDto } from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import { MAX_FIRST_EVENT_WAIT_SECONDS, OnboardingService } from "./onboarding.service";

export function parseWait(value: unknown) {
  if (value === undefined || value === "") return 0;
  const wait = Number(value);
  if (!Number.isInteger(wait) || wait < 0 || wait > MAX_FIRST_EVENT_WAIT_SECONDS) {
    throw new BadRequestException(`wait must be between 0 and ${MAX_FIRST_EVENT_WAIT_SECONDS}`);
  }
  return wait;
}

@ApiTags("projects")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug/onboarding")
@UseGuards(AuthGuard, OrganizationContextGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get("first-event")
  @ApiOperation({ operationId: "getProjectFirstEvent" })
  @ApiQuery({
    name: "wait",
    required: false,
    type: Number,
    description: `Seconds to hold the request until the first event arrives (max ${MAX_FIRST_EVENT_WAIT_SECONDS})`,
  })
  @ApiOkResponse({ type: ProjectFirstEventDto })
  @RequirePermissions("project.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  firstEvent(
    @CurrentProject() project: ProjectRecord,
    @Query("wait") wait: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    let closed = false;
    request.raw.once("close", () => {
      closed = true;
    });
    return this.onboardingService.waitForFirstEvent(project.id, parseWait(wait), () => closed);
  }

  // Anyone who can read the project's DSN can already send it events.
  @Post("test-event")
  @ApiOperation({ operationId: "sendProjectTestEvent" })
  @ApiOkResponse({ type: TestEventResultDto })
  @RequirePermissions("project.keys.read")
  @UseGuards(ProjectContextGuard, PermissionGuard)
  sendTestEvent(@CurrentProject() project: ProjectRecord, @CurrentUser() user: UserRecord) {
    return this.onboardingService.sendTestEvent(project, user.email);
  }
}
