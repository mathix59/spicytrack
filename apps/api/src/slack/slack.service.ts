import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  issues,
  organizationMembers,
  organizationSlackSettings,
  projects,
  users,
} from "../database/schema";
import { publicAppUrl } from "../integrations/integrations.service";
import { IssuesService } from "../issues/issues.service";
import { AccessResolver } from "../rbac/access-resolver.service";
import {
  SlackApiError,
  callSlack,
  isSlackResponseUrl,
  postToResponseUrl,
  verifySlackSignature,
} from "./slack-api";
import {
  SLACK_ACTION_PREFIX,
  SLACK_ISSUE_ACTIONS,
  type SlackIssueAction,
  parseActionValue,
  updatedAlertBlocks,
} from "./slack-blocks";

const REQUIRED_SCOPES = ["incoming-webhook", "users:read", "users:read.email"];

type SlackSettingsRecord = typeof organizationSlackSettings.$inferSelect;

type BlockActionsPayload = {
  type?: string;
  team?: { id?: string };
  user?: { id?: string; team_id?: string };
  response_url?: string;
  actions?: Array<{ action_id?: string; value?: string }>;
  message?: { text?: string; blocks?: Array<Record<string, unknown>> };
};

const STATUS_VERBS: Record<SlackIssueAction, string> = {
  resolve: "Resolved",
  ignore: "Ignored",
  reopen: "Reopened",
  assign_me: "Assigned",
};

export function slackRequestUrl() {
  return `${publicAppUrl()}/api/slack/interactions`;
}

/** Slack app manifest with interactivity pointed at this SpicyTrack. */
export function slackAppManifest() {
  return {
    display_information: {
      name: "SpicyTrack",
      description: "Error alerts you can resolve, ignore or assign from Slack.",
    },
    features: { bot_user: { display_name: "SpicyTrack", always_online: false } },
    oauth_config: { scopes: { bot: REQUIRED_SCOPES } },
    settings: {
      interactivity: { is_enabled: true, request_url: slackRequestUrl() },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly issuesService: IssuesService,
    private readonly accessResolver: AccessResolver,
    private readonly auditService: AuditService,
  ) {}

  async getSettings(organizationId: string) {
    const [settings] = await this.db
      .select()
      .from(organizationSlackSettings)
      .where(eq(organizationSlackSettings.organizationId, organizationId))
      .limit(1);
    return {
      configured: Boolean(settings),
      teamId: settings?.teamId ?? null,
      teamName: settings?.teamName ?? null,
      updatedAt: settings?.updatedAt ?? null,
      requestUrl: slackRequestUrl(),
      manifest: JSON.stringify(slackAppManifest(), null, 2),
    };
  }

  /** Saves the app's credentials once the bot token reads its workspace with the right scopes. */
  async updateSettings(input: {
    organizationId: string;
    actorUserId: string;
    signingSecret: string;
    botToken: string;
  }) {
    const signingSecret = input.signingSecret.trim();
    const botToken = input.botToken.trim();
    if (!/^[0-9a-f]{16,128}$/i.test(signingSecret)) {
      throw new BadRequestException("signingSecret must be the app's signing secret (hexadecimal)");
    }
    if (!botToken.startsWith("xoxb-")) {
      throw new BadRequestException("botToken must be a bot token (xoxb-…)");
    }

    let identity: { team_id?: string; team?: string };
    let scopes: string[];
    try {
      ({ body: identity, scopes } = await callSlack<{ team_id?: string; team?: string }>(
        botToken,
        "auth.test",
      ));
    } catch (error) {
      if (error instanceof SlackApiError) {
        throw error.code === "unreachable"
          ? new BadGatewayException(error.message)
          : new UnprocessableEntityException(`Slack refused the bot token: ${error.code}`);
      }
      throw error;
    }
    const missing = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `The bot token lacks the ${missing.join(", ")} scope${missing.length > 1 ? "s" : ""}. Add ${
          missing.length > 1 ? "them" : "it"
        } in the Slack app, reinstall it, and copy the new token.`,
      );
    }
    if (!identity.team_id) throw new UnprocessableEntityException("Slack returned no workspace");

    const values = {
      organizationId: input.organizationId,
      teamId: identity.team_id,
      teamName: identity.team ?? null,
      signingSecretCiphertext: encryptSecret(signingSecret),
      botTokenCiphertext: encryptSecret(botToken),
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    };
    await this.db
      .insert(organizationSlackSettings)
      .values(values)
      .onConflictDoUpdate({ target: organizationSlackSettings.organizationId, set: values });
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "integration.slack.connected",
      targetType: "organization",
      targetId: input.organizationId,
      payload: { teamId: identity.team_id, teamName: identity.team ?? null },
    });
    return this.getSettings(input.organizationId);
  }

  async deleteSettings(input: { organizationId: string; actorUserId: string }) {
    const deleted = await this.db
      .delete(organizationSlackSettings)
      .where(eq(organizationSlackSettings.organizationId, input.organizationId))
      .returning({ teamId: organizationSlackSettings.teamId });
    if (deleted.length > 0) {
      await this.auditService.record({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "integration.slack.disconnected",
        targetType: "organization",
        targetId: input.organizationId,
        payload: { teamId: deleted[0].teamId },
      });
    }
    return { success: true };
  }

  /**
   * Verifies an interaction request and returns the work to do after Slack has been answered:
   * Slack gives up on requests that take more than three seconds.
   */
  async acceptInteraction(input: {
    rawBody: string;
    timestamp: string | undefined;
    signature: string | undefined;
  }): Promise<(() => Promise<void>) | null> {
    const payloadText = new URLSearchParams(input.rawBody).get("payload");
    let payload: BlockActionsPayload;
    try {
      payload = JSON.parse(payloadText ?? "") as BlockActionsPayload;
    } catch {
      throw new BadRequestException("Expected a Slack interaction payload");
    }
    const teamId = payload.team?.id ?? payload.user?.team_id;
    const candidates = teamId
      ? await this.db
          .select()
          .from(organizationSlackSettings)
          .where(eq(organizationSlackSettings.teamId, teamId))
      : [];
    const settings = candidates.find((candidate) =>
      verifySlackSignature({
        signingSecret: decryptSecret(candidate.signingSecretCiphertext),
        timestamp: input.timestamp,
        signature: input.signature,
        rawBody: input.rawBody,
      }),
    );
    if (!settings) throw new UnauthorizedException("Invalid Slack signature");

    const action = payload.actions?.[0];
    const name = action?.action_id?.startsWith(SLACK_ACTION_PREFIX)
      ? action.action_id.slice(SLACK_ACTION_PREFIX.length)
      : null;
    // URL buttons ("View issue") also report clicks; there is nothing to do for them.
    if (
      payload.type !== "block_actions" ||
      !SLACK_ISSUE_ACTIONS.includes(name as SlackIssueAction)
    ) {
      return null;
    }
    return () =>
      this.runAction(settings, payload, name as SlackIssueAction, action?.value).catch(
        (error: unknown) => {
          this.logger.warn(
            `Slack action ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      );
  }

  /** Acts on the issue as the SpicyTrack member behind the Slack user, then updates the alert. */
  async runAction(
    settings: SlackSettingsRecord,
    payload: BlockActionsPayload,
    action: SlackIssueAction,
    value: string | undefined,
  ) {
    const reply = async (text: string) => {
      if (!isSlackResponseUrl(payload.response_url)) return;
      await postToResponseUrl(payload.response_url, {
        response_type: "ephemeral",
        replace_original: false,
        text,
      });
    };

    const target = parseActionValue(value);
    const [issue] = target
      ? await this.db
          .select({
            id: issues.id,
            projectId: issues.projectId,
            projectName: projects.name,
            teamId: projects.teamId,
          })
          .from(issues)
          .innerJoin(projects, eq(projects.id, issues.projectId))
          .where(
            and(
              eq(issues.id, target.issueId),
              eq(issues.projectId, target.projectId),
              eq(projects.organizationId, settings.organizationId),
            ),
          )
          .limit(1)
      : [];
    if (!issue) return reply("This issue no longer exists in SpicyTrack.");

    let email: string | undefined;
    try {
      const { body } = await callSlack<{ user?: { profile?: { email?: string } } }>(
        decryptSecret(settings.botTokenCiphertext),
        "users.info",
        { user: payload.user?.id ?? "" },
      );
      email = body.user?.profile?.email;
    } catch (error) {
      this.logger.warn(`Slack users.info failed: ${(error as Error).message}`);
    }
    if (!email) {
      return reply(
        "SpicyTrack could not read your Slack email. The Slack app needs the users:read.email scope.",
      );
    }

    const [member] = await this.db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
      })
      .from(users)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.userId, users.id),
          eq(organizationMembers.organizationId, settings.organizationId),
        ),
      )
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (!member) {
      return reply(
        `No member of this SpicyTrack organization uses ${email}. Sign up with your Slack email to act from Slack.`,
      );
    }
    const missing = await this.accessResolver.missingPermissions(
      {
        organizationId: settings.organizationId,
        role: member.role,
        userId: member.userId,
        teamId: issue.teamId,
      },
      ["project.issues.manage"],
    );
    if (missing.length > 0) {
      return reply(`You cannot manage issues in ${issue.projectName}.`);
    }

    const scope = {
      organizationId: settings.organizationId,
      projectId: issue.projectId,
      issueId: issue.id,
      actorUserId: member.userId,
    };
    let updated: { status: string };
    try {
      updated =
        action === "assign_me"
          ? await this.issuesService.updateAssignee({ ...scope, assignedUserId: member.userId })
          : await this.issuesService.updateStatus({
              ...scope,
              status: action === "resolve" ? "resolved" : action === "ignore" ? "ignored" : "open",
              ...(action === "resolve" ? { resolution: "now" as const } : {}),
              ...(action === "ignore" ? { ignoredUntil: null } : {}),
            });
    } catch (error) {
      return reply(
        `SpicyTrack could not update the issue: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const actor = member.name?.trim() || member.email;
    const statusLine = `${STATUS_VERBS[action]}${action === "assign_me" ? ` to ${actor}` : ` by ${actor}`} in SpicyTrack`;
    const blocks = payload.message?.blocks;
    if (!blocks?.length || !isSlackResponseUrl(payload.response_url)) {
      return reply(`${statusLine}.`);
    }
    await postToResponseUrl(payload.response_url, {
      replace_original: true,
      text: payload.message?.text ?? statusLine,
      blocks: updatedAlertBlocks(
        blocks,
        { projectId: issue.projectId, issueId: issue.id, status: updated.status },
        statusLine,
      ),
    });
  }
}
