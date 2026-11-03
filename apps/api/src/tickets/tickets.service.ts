import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { issueUrl, loadProjectLinks } from "../alerts/alert-links";
import { SourcemapResolverService } from "../artifacts/sourcemap-resolver.service";
import { AuditService } from "../audit/audit.service";
import { redactEventPayload } from "../common/event-payload-redaction";
import { asString, getAllFrames } from "../common/grouping";
import { isUniqueViolation } from "../common/postgres-errors";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  environments,
  events,
  issueActivity,
  issues,
  issueTickets,
  releases,
  type TicketTrackerConfig,
  ticketTrackers,
} from "../database/schema";
import { IntegrationsService } from "../integrations/integrations.service";
import { GithubProvider } from "../integrations/vcs/github.provider";
import {
  type RepoConnectionInput,
  VcsRequestError,
} from "../integrations/vcs/vcs-provider.interface";
import {
  type CreatedTicket,
  type JiraConnection,
  TicketProviderError,
  assertJiraBaseUrl,
  createJiraIssue,
  createLinearIssue,
  findJiraIssueType,
  findLinearTeam,
} from "./ticket-providers";

export const TICKET_PROVIDERS = ["github", "linear", "jira"] as const;
export type TicketProvider = (typeof TICKET_PROVIDERS)[number];

export const MAX_TICKET_TITLE = 255;
export const MAX_TICKET_DESCRIPTION = 20_000;
const MAX_DRAFT_FRAMES = 15;
const MAX_EXCEPTION_VALUE = 1000;

type TrackerRecord = typeof ticketTrackers.$inferSelect;
type TicketRecord = typeof issueTickets.$inferSelect;

export type CreateTrackerInput = {
  organizationId: string;
  projectId: string;
  actorUserId: string;
  provider: TicketProvider;
  name: string;
  token: string | null;
  repository: string | null;
  teamKey: string | null;
  baseUrl: string | null;
  email: string | null;
  projectKey: string | null;
  issueType: string | null;
};

const PROVIDER_NAMES: Record<TicketProvider, string> = {
  github: "GitHub",
  linear: "Linear",
  jira: "Jira",
};

function trackerTarget(config: TicketTrackerConfig): string {
  switch (config.provider) {
    case "github":
      return config.repository ?? "Connected repository";
    case "linear":
      return `${config.teamKey} · ${config.teamName}`;
    case "jira":
      return `${config.projectKey} · ${config.issueType}`;
  }
}

function trackerDto(tracker: TrackerRecord) {
  const config = tracker.config;
  return {
    id: tracker.id,
    provider: tracker.provider as TicketProvider,
    name: tracker.name,
    target: trackerTarget(config),
    usesRepoConnection: config.provider === "github" && !tracker.tokenCiphertext,
    repository: config.provider === "github" ? config.repository : null,
    teamKey: config.provider === "linear" ? config.teamKey : null,
    baseUrl: config.provider === "jira" ? config.baseUrl : null,
    email: config.provider === "jira" ? config.email : null,
    projectKey: config.provider === "jira" ? config.projectKey : null,
    issueType: config.provider === "jira" ? config.issueType : null,
    createdAt: tracker.createdAt,
  };
}

function ticketDto(ticket: TicketRecord) {
  return {
    id: ticket.id,
    trackerId: ticket.trackerId,
    provider: ticket.provider as TicketProvider,
    externalKey: ticket.externalKey,
    url: ticket.url,
    title: ticket.title,
    createdByUserId: ticket.createdByUserId,
    createdAt: ticket.createdAt,
  };
}

function required(value: string | null, field: string): string {
  if (!value?.trim()) throw new BadRequestException(`${field} is required`);
  return value.trim();
}

/** Keeps user text from closing the fenced code block of a draft. */
const fenceSafe = (value: string) => value.replaceAll("```", "'''");

@Injectable()
export class TicketsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly integrationsService: IntegrationsService,
    private readonly githubProvider: GithubProvider,
    private readonly sourcemapResolverService: SourcemapResolverService,
    private readonly auditService: AuditService,
  ) {}

  async listTrackers(projectId: string) {
    const trackers = await this.db
      .select()
      .from(ticketTrackers)
      .where(eq(ticketTrackers.projectId, projectId))
      .orderBy(asc(ticketTrackers.createdAt));
    return trackers.map(trackerDto);
  }

  /** Saves a tracker after checking its credentials reach the repository, team or project. */
  async createTracker(input: CreateTrackerInput) {
    const name = required(input.name, "name");
    if (name.length > 80) throw new BadRequestException("name must be at most 80 characters");

    let config: TicketTrackerConfig;
    let token = input.token?.trim() || null;
    try {
      config = await this.verifyTracker(input, token);
    } catch (error) {
      throw this.providerException(error, "Could not verify the tracker");
    }
    if (config.provider === "github" && !input.token) token = null;

    let tracker: TrackerRecord;
    try {
      [tracker] = await this.db
        .insert(ticketTrackers)
        .values({
          organizationId: input.organizationId,
          projectId: input.projectId,
          provider: input.provider,
          name,
          config,
          tokenCiphertext: token ? encryptSecret(token) : null,
          createdByUserId: input.actorUserId,
        })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A tracker with this name already exists in the project");
      }
      throw error;
    }

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "integration.ticket_tracker.created",
      targetType: "ticket_tracker",
      targetId: tracker.id,
      payload: { provider: tracker.provider, name, target: trackerTarget(config) },
    });
    return trackerDto(tracker);
  }

  async deleteTracker(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    trackerId: string;
  }) {
    const [tracker] = await this.db
      .delete(ticketTrackers)
      .where(
        and(eq(ticketTrackers.projectId, input.projectId), eq(ticketTrackers.id, input.trackerId)),
      )
      .returning();
    if (!tracker) throw new NotFoundException("Tracker not found");
    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "integration.ticket_tracker.deleted",
      targetType: "ticket_tracker",
      targetId: tracker.id,
      payload: { provider: tracker.provider, name: tracker.name },
    });
    return { success: true };
  }

  async listIssueTickets(projectId: string, issueId: string) {
    await this.getIssue(projectId, issueId);
    const tickets = await this.db
      .select()
      .from(issueTickets)
      .where(and(eq(issueTickets.projectId, projectId), eq(issueTickets.issueId, issueId)))
      .orderBy(desc(issueTickets.createdAt));
    return tickets.map(ticketDto);
  }

  /** Default title and Markdown description: what the error is, where, and how often. */
  async draft(projectId: string, issueId: string) {
    const issue = await this.getIssue(projectId, issueId);
    const [event] = await this.db
      .select({
        rawPayload: events.rawPayload,
        releaseId: events.releaseId,
        sdkName: events.sdkName,
        platform: events.platform,
        release: releases.version,
        environment: environments.name,
      })
      .from(events)
      .leftJoin(releases, eq(releases.id, events.releaseId))
      .leftJoin(environments, eq(environments.id, events.environmentId))
      .where(and(eq(events.projectId, projectId), eq(events.issueId, issueId)))
      .orderBy(desc(events.timestamp))
      .limit(1);
    const links = await loadProjectLinks(this.db, projectId);
    const link = issueUrl(links, issueId);

    const day = (date: Date) => date.toISOString().slice(0, 10);
    const lines = [
      `**${issue.level}** in ${links.projectName}, seen ${issue.timesSeen} ${
        issue.timesSeen === 1 ? "time" : "times"
      } between ${day(issue.firstSeenAt)} and ${day(issue.lastSeenAt)}.`,
    ];
    if (link) lines.push("", `[View the issue in SpicyTrack](${link})`);
    const facts = [
      issue.culprit ? `Culprit: \`${issue.culprit.replaceAll("`", "'")}\`` : null,
      event?.release ? `Release: \`${event.release}\`` : null,
      event?.environment ? `Environment: \`${event.environment}\`` : null,
    ].filter((fact): fact is string => fact !== null);
    if (facts.length > 0) lines.push("", ...facts);

    const stack = event ? await this.stackSummary(event) : null;
    if (stack) lines.push("", "```", fenceSafe(stack), "```");

    return {
      title: issue.title.replace(/\s+/g, " ").slice(0, MAX_TICKET_TITLE),
      description: lines.join("\n").slice(0, MAX_TICKET_DESCRIPTION),
    };
  }

  async createTicket(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    trackerId: string;
    title?: string;
    description?: string;
  }) {
    const issue = await this.getIssue(input.projectId, input.issueId);
    const [tracker] = await this.db
      .select()
      .from(ticketTrackers)
      .where(
        and(eq(ticketTrackers.projectId, input.projectId), eq(ticketTrackers.id, input.trackerId)),
      )
      .limit(1);
    if (!tracker) throw new NotFoundException("Tracker not found");

    const draft =
      input.title === undefined || input.description === undefined
        ? await this.draft(input.projectId, input.issueId)
        : null;
    const title = (input.title ?? draft!.title).trim();
    const description = input.description ?? draft!.description;
    if (!title) throw new BadRequestException("title must not be empty");

    let created: CreatedTicket;
    try {
      created = await this.createRemote(tracker, { title, description });
    } catch (error) {
      throw this.providerException(
        error,
        `Could not create the ${PROVIDER_NAMES[tracker.provider as TicketProvider]} ticket`,
      );
    }

    const ticket = await this.db.transaction(async (tx) => {
      const [ticket] = await tx
        .insert(issueTickets)
        .values({
          organizationId: input.organizationId,
          projectId: input.projectId,
          issueId: input.issueId,
          trackerId: tracker.id,
          provider: tracker.provider,
          externalKey: created.externalKey,
          url: created.url,
          title,
          createdByUserId: input.actorUserId,
        })
        .returning();
      // The first ticket also becomes the issue's external link, unless one was set by hand.
      await tx
        .update(issues)
        .set({ externalIssueUrl: created.url, updatedAt: new Date() })
        .where(and(eq(issues.id, issue.id), isNull(issues.externalIssueUrl)));
      await tx.insert(issueActivity).values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        issueId: input.issueId,
        actorUserId: input.actorUserId,
        type: "issue.ticket_created",
        payload: { provider: tracker.provider, externalKey: created.externalKey, url: created.url },
      });
      return ticket;
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "issue.ticket.create",
      targetType: "issue",
      targetId: input.issueId,
      payload: {
        trackerId: tracker.id,
        provider: tracker.provider,
        externalKey: created.externalKey,
        url: created.url,
      },
    });
    return ticketDto(ticket);
  }

  private async verifyTracker(
    input: CreateTrackerInput,
    token: string | null,
  ): Promise<TicketTrackerConfig> {
    switch (input.provider) {
      case "github": {
        const repository = input.repository?.trim() || null;
        if (repository && !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
          throw new BadRequestException("repository must look like owner/name");
        }
        const connection = await this.githubConnection(input.projectId, input.organizationId, {
          repository,
          token,
        });
        if (!(await this.githubProvider.issuesEnabled(connection))) {
          throw new BadRequestException(`Issues are turned off in ${connection.repoIdentifier}.`);
        }
        return { provider: "github", repository };
      }
      case "linear": {
        const team = await findLinearTeam(
          required(token, "token"),
          required(input.teamKey, "teamKey"),
        );
        return { provider: "linear", teamId: team.id, teamKey: team.key, teamName: team.name };
      }
      case "jira": {
        const connection: JiraConnection = {
          baseUrl: await assertJiraBaseUrl(required(input.baseUrl, "baseUrl")),
          email: input.email?.trim() || null,
          token: required(token, "token"),
        };
        const target = await findJiraIssueType(
          connection,
          required(input.projectKey, "projectKey"),
          input.issueType?.trim() || "Bug",
        );
        return {
          provider: "jira",
          baseUrl: connection.baseUrl,
          email: connection.email,
          ...target,
        };
      }
    }
  }

  /**
   * A token tracker targets its own repository. Without a token, the project's connected GitHub
   * repository is used, through the organization's GitHub App when it has one.
   */
  private async githubConnection(
    projectId: string,
    organizationId: string,
    target: { repository: string | null; token: string | null },
  ): Promise<RepoConnectionInput> {
    if (target.token) {
      if (!target.repository) {
        throw new BadRequestException("repository is required with a token");
      }
      return { baseUrl: null, repoIdentifier: target.repository, token: target.token };
    }
    if (target.repository) {
      throw new BadRequestException(
        "A token is required for a repository other than the connected one",
      );
    }
    const connection = await this.integrationsService.getAutofixConnection(
      projectId,
      organizationId,
    );
    if (!connection || connection.provider !== "github") {
      throw new BadRequestException(
        "Connect a GitHub repository to the project, or enter a repository and a token.",
      );
    }
    return connection.input;
  }

  private async createRemote(
    tracker: TrackerRecord,
    ticket: { title: string; description: string },
  ): Promise<CreatedTicket> {
    const token = tracker.tokenCiphertext ? decryptSecret(tracker.tokenCiphertext) : null;
    const config = tracker.config;
    switch (config.provider) {
      case "github": {
        const connection = await this.githubConnection(tracker.projectId, tracker.organizationId, {
          repository: token ? config.repository : null,
          token,
        });
        const created = await this.githubProvider.createIssue(connection, {
          title: ticket.title,
          body: ticket.description,
        });
        return { externalKey: `#${created.number}`, url: created.url };
      }
      case "linear":
        return createLinearIssue(token!, config.teamId, ticket);
      case "jira":
        return createJiraIssue(
          { baseUrl: config.baseUrl, email: config.email, token: token! },
          { projectKey: config.projectKey, issueType: config.issueType },
          ticket,
        );
    }
  }

  /** Tracker failures as API errors: 422 when it refused, 502 when it was unreachable or down. */
  private providerException(error: unknown, prefix: string): Error {
    const status =
      error instanceof TicketProviderError || error instanceof VcsRequestError
        ? error.status
        : undefined;
    if (status === undefined) return error as Error;
    let message = error instanceof Error ? error.message : String(error);
    if (error instanceof VcsRequestError) {
      message =
        status === 403 || status === 404
          ? `GitHub refused access (HTTP ${status}). The token or GitHub App needs the Issues: write permission on this repository.`
          : status === 401
            ? "GitHub refused the credentials (HTTP 401)."
            : `GitHub returned HTTP ${status}.`;
    }
    const text = `${prefix}: ${message}`;
    return status === null || status >= 500
      ? new BadGatewayException(text)
      : new UnprocessableEntityException(text);
  }

  private async getIssue(projectId: string, issueId: string) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.id, issueId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");
    return issue;
  }

  /** The error and its newest frames, source-mapped, as plain text. */
  private async stackSummary(event: {
    rawPayload: unknown;
    releaseId: string | null;
    sdkName: string | null;
    platform: string | null;
  }): Promise<string | null> {
    const payload = redactEventPayload((event.rawPayload ?? {}) as Record<string, unknown>);
    const exception = payload.exception as { values?: unknown[] } | unknown[] | undefined;
    const values = Array.isArray(exception) ? exception : (exception?.values ?? []);
    const last = values.at(-1) as Record<string, unknown> | undefined;
    const type = asString(last?.type);
    const value = asString(last?.value)?.slice(0, MAX_EXCEPTION_VALUE) ?? null;
    const header = [type, value].filter(Boolean).join(": ") || asString(payload.message);

    const rawFrames = getAllFrames(payload);
    const resolved = await this.sourcemapResolverService.resolveFrames({
      releaseId: event.releaseId,
      frames: rawFrames,
      sdkName: event.sdkName,
      platform: event.platform,
    });
    const frames = rawFrames.map((frame, index) => {
      const mapped = resolved[index];
      return {
        inApp: frame.inApp,
        function: (mapped?.resolved ? mapped.function : null) ?? frame.function ?? "<anonymous>",
        path:
          (mapped?.resolved ? mapped.filename : null) ??
          frame.filename ??
          frame.absPath ??
          frame.module ??
          "?",
        lineno: (mapped?.resolved ? mapped.lineno : null) ?? frame.lineno,
      };
    });
    const hasInApp = frames.some((frame) => frame.inApp === true);
    const shown = frames
      .filter((frame) => (hasInApp ? frame.inApp === true : frame.inApp !== false))
      .reverse()
      .slice(0, MAX_DRAFT_FRAMES)
      .map(
        (frame) =>
          `    at ${frame.function} (${frame.path}${frame.lineno ? `:${frame.lineno}` : ""})`,
      );
    if (!header && shown.length === 0) return null;
    return [header ?? "Error", ...shown].join("\n");
  }
}
