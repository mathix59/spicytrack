import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CurrentProject } from "../common/current-project.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { ProjectRecord, UserRecord } from "../common/request-context";
import { assertOneOf, assertString, optionalNullableString } from "../common/validators";
import {
  CreateIssueTicketBodyDto,
  CreateTicketTrackerBodyDto,
  IssueTicketDraftDto,
  IssueTicketDto,
  IssueTicketsDto,
  SuccessDto,
  TicketTrackerDto,
} from "../openapi/contracts";
import { OrganizationContextGuard } from "../rbac/organization-context.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { ProjectContextGuard } from "../rbac/project-context.guard";
import { RequirePermissions } from "../rbac/permissions.decorator";
import {
  MAX_TICKET_DESCRIPTION,
  MAX_TICKET_TITLE,
  TICKET_PROVIDERS,
  TicketsService,
} from "./tickets.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new BadRequestException(`${field} must be a string`);
  if (value.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return value;
}

@ApiTags("tickets")
@ApiBearerAuth()
@ApiParam({ name: "orgSlug", type: String })
@ApiParam({ name: "projectSlug", type: String })
@Controller("organizations/:orgSlug/projects/:projectSlug")
@UseGuards(AuthGuard, OrganizationContextGuard, ProjectContextGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get("ticket-trackers")
  @ApiOperation({ operationId: "listTicketTrackers" })
  @ApiOkResponse({ type: [TicketTrackerDto] })
  @RequirePermissions("project.integrations.read")
  @UseGuards(PermissionGuard)
  async listTrackers(@CurrentProject() project: ProjectRecord) {
    return this.ticketsService.listTrackers(project.id);
  }

  @Post("ticket-trackers")
  @ApiOperation({ operationId: "createTicketTracker" })
  @ApiBody({ type: CreateTicketTrackerBodyDto })
  @ApiOkResponse({ type: TicketTrackerDto })
  @RequirePermissions("project.integrations.manage")
  @UseGuards(PermissionGuard)
  async createTracker(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Body() body: Record<string, unknown>,
  ) {
    const text = (field: string) => optionalNullableString(body[field]) ?? null;
    return this.ticketsService.createTracker({
      organizationId: project.organizationId,
      projectId: project.id,
      actorUserId: user.id,
      provider: assertOneOf(body.provider, TICKET_PROVIDERS, "provider"),
      name: assertString(body.name, "name"),
      token: text("token"),
      repository: text("repository"),
      teamKey: text("teamKey"),
      baseUrl: text("baseUrl"),
      email: text("email"),
      projectKey: text("projectKey"),
      issueType: text("issueType"),
    });
  }

  @Delete("ticket-trackers/:trackerId")
  @ApiOperation({ operationId: "deleteTicketTracker" })
  @ApiParam({ name: "trackerId", type: String })
  @ApiOkResponse({ type: SuccessDto })
  @RequirePermissions("project.integrations.manage")
  @UseGuards(PermissionGuard)
  async deleteTracker(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("trackerId", ParseUUIDPipe) trackerId: string,
  ) {
    return this.ticketsService.deleteTracker({
      organizationId: project.organizationId,
      projectId: project.id,
      actorUserId: user.id,
      trackerId,
    });
  }

  @Get("issues/:issueId/tickets")
  @ApiOperation({ operationId: "listIssueTickets" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: IssueTicketsDto })
  @RequirePermissions("project.issues.read")
  @UseGuards(PermissionGuard)
  async listTickets(
    @CurrentProject() project: ProjectRecord,
    @Param("issueId", ParseUUIDPipe) issueId: string,
  ) {
    const [tickets, trackers] = await Promise.all([
      this.ticketsService.listIssueTickets(project.id, issueId),
      this.ticketsService.listTrackers(project.id),
    ]);
    return {
      tickets,
      trackers: trackers.map(({ id, provider, name, target }) => ({ id, provider, name, target })),
    };
  }

  @Get("issues/:issueId/tickets/draft")
  @ApiOperation({ operationId: "getIssueTicketDraft" })
  @ApiParam({ name: "issueId", type: String })
  @ApiOkResponse({ type: IssueTicketDraftDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async draft(
    @CurrentProject() project: ProjectRecord,
    @Param("issueId", ParseUUIDPipe) issueId: string,
  ) {
    return this.ticketsService.draft(project.id, issueId);
  }

  @Post("issues/:issueId/tickets")
  @ApiOperation({ operationId: "createIssueTicket" })
  @ApiParam({ name: "issueId", type: String })
  @ApiBody({ type: CreateIssueTicketBodyDto })
  @ApiOkResponse({ type: IssueTicketDto })
  @RequirePermissions("project.issues.manage")
  @UseGuards(PermissionGuard)
  async createTicket(
    @CurrentProject() project: ProjectRecord,
    @CurrentUser() user: UserRecord,
    @Param("issueId", ParseUUIDPipe) issueId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const trackerId = assertString(body.trackerId, "trackerId");
    if (!UUID_PATTERN.test(trackerId)) throw new BadRequestException("trackerId must be a UUID");
    return this.ticketsService.createTicket({
      organizationId: project.organizationId,
      projectId: project.id,
      issueId,
      actorUserId: user.id,
      trackerId,
      title: optionalText(body.title, "title", MAX_TICKET_TITLE),
      description: optionalText(body.description, "description", MAX_TICKET_DESCRIPTION),
    });
  }
}
