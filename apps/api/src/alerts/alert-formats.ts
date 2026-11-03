import { issueActionsBlock } from "../slack/slack-blocks";
import { createHmac } from "node:crypto";

import type { AlertPayload } from "./alerts.types";

/**
 * Destination-specific alert bodies: Slack Block Kit, Discord embeds, PagerDuty Events v2 and the
 * signature of generic webhooks. Pure functions so every format is unit tested.
 */

export const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";
export const WEBHOOK_SIGNATURE_HEADER = "X-SpicyTrack-Signature";

const MAX_TITLE_LENGTH = 150;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function alertTriggerLabel(payload: AlertPayload): string {
  switch (payload.triggerType) {
    case "new_issue":
      return "New issue";
    case "regression":
      return "Regression";
    case "event_threshold":
      return typeof payload.recentEventCount === "number" &&
        typeof payload.thresholdWindowMinutes === "number"
        ? `${payload.recentEventCount}+ events in ${payload.thresholdWindowMinutes} min`
        : "Event threshold reached";
    case "daily_digest":
      return "Daily digest";
    case "test":
      return "Test alert";
    default:
      return "Alert";
  }
}

function projectName(payload: AlertPayload) {
  return text(payload.projectName) ?? payload.projectId;
}

function issueTitle(payload: AlertPayload) {
  return clip(text(payload.issueTitle) ?? "Unknown issue", MAX_TITLE_LENGTH);
}

/** Label and value pairs shown by every rich format, in this order, skipping unknown ones. */
function issueFacts(payload: AlertPayload): [string, string][] {
  const facts: [string, string | undefined][] = [
    ["Project", projectName(payload)],
    ["Level", text(payload.level)],
    ["Environment", text(payload.environment)],
    ["Release", text(payload.release)],
    ["Events", payload.timesSeen === undefined ? undefined : String(count(payload.timesSeen))],
    ["Users", payload.userCount === undefined ? undefined : String(count(payload.userCount))],
  ];
  return facts.filter((fact): fact is [string, string] => fact[1] !== undefined);
}

function digestLines(payload: AlertPayload): string[] {
  const regressions = Array.isArray(payload.topRegressions)
    ? payload.topRegressions.map((entry) => {
        const regression = entry as { title?: unknown; timesSeen?: unknown };
        return `• ${text(regression.title) ?? "Unknown issue"} (${count(regression.timesSeen)} events)`;
      })
    : [];
  return [
    `${count(payload.eventCount24h)} events in the last 24h`,
    `${count(payload.newIssueCount24h)} new issues`,
    `${count(payload.openRegressionCount)} open regressions`,
    ...(regressions.length > 0 ? ["Top regressions:", ...regressions] : []),
  ];
}

// Slack escapes only these three characters in mrkdwn.
function slackEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Slack incoming webhook body: Block Kit, with `text` as the notification fallback. With
 * `interactive`, issue alerts carry Resolve, Ignore and Assign buttons handled by the
 * organization's Slack app.
 */
export function slackMessage(
  payload: AlertPayload,
  fallback: string,
  options: { interactive?: boolean } = {},
) {
  const link = text(payload.issueUrl) ?? text(payload.projectUrl);

  if (payload.triggerType === "daily_digest") {
    return {
      text: fallback,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: clip(`Daily digest: ${projectName(payload)}`, 150) },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: slackEscape(digestLines(payload).join("\n")) },
        },
        ...(link
          ? [
              {
                type: "actions",
                elements: [
                  { type: "button", text: { type: "plain_text", text: "Open project" }, url: link },
                ],
              },
            ]
          : []),
      ],
    };
  }

  const title = slackEscape(issueTitle(payload));
  const culprit = text(payload.culprit);
  const issueId = text(payload.issueId);
  const actions = issueActionsBlock(
    {
      projectId: payload.projectId,
      issueId: issueId ?? "",
      status: text(payload.issueStatus) ?? "open",
      link,
    },
    Boolean(options.interactive && issueId),
  );
  return {
    text: fallback,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*${slackEscape(alertTriggerLabel(payload))}*`,
            link ? `*<${link}|${title}>*` : `*${title}*`,
            culprit ? `\`${slackEscape(clip(culprit, 200))}\`` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      },
      {
        type: "section",
        fields: issueFacts(payload).map(([label, value]) => ({
          type: "mrkdwn",
          text: `*${label}*\n${slackEscape(value)}`,
        })),
      },
      ...[actions].filter((block) => block !== null),
    ],
  };
}

const DISCORD_COLORS: Record<string, number> = {
  new_issue: 0xe5484d,
  regression: 0xf76b15,
  event_threshold: 0xffc53d,
  daily_digest: 0x3e63dd,
};

/** Discord webhook body with one embed. */
export function discordMessage(payload: AlertPayload) {
  const link = text(payload.issueUrl) ?? text(payload.projectUrl);
  const color = DISCORD_COLORS[payload.triggerType] ?? 0x8b8d98;

  if (payload.triggerType === "daily_digest") {
    return {
      embeds: [
        {
          title: clip(`Daily digest: ${projectName(payload)}`, 256),
          url: link,
          description: digestLines(payload).join("\n").slice(0, 4_000),
          color,
        },
      ],
    };
  }

  const culprit = text(payload.culprit);
  return {
    embeds: [
      {
        author: { name: alertTriggerLabel(payload) },
        title: issueTitle(payload),
        url: link,
        description: culprit ? `\`${clip(culprit, 300)}\`` : undefined,
        color,
        fields: issueFacts(payload).map(([name, value]) => ({ name, value, inline: true })),
        footer: { text: "SpicyTrack" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

const PAGERDUTY_SEVERITIES: Record<string, "critical" | "error" | "warning" | "info"> = {
  fatal: "critical",
  error: "error",
  warning: "warning",
  info: "info",
  debug: "info",
};

/** PagerDuty Events API v2 trigger. One incident per issue: repeated alerts are grouped. */
export function pagerDutyEvent(payload: AlertPayload, routingKey: string) {
  const link = text(payload.issueUrl);
  return {
    routing_key: routingKey,
    event_action: "trigger",
    dedup_key: payload.issueId ? `spicytrack-issue-${payload.issueId}` : undefined,
    payload: {
      summary: clip(`${alertTriggerLabel(payload)}: ${issueTitle(payload)}`, 1_024),
      source: projectName(payload),
      severity: PAGERDUTY_SEVERITIES[text(payload.level) ?? "error"] ?? "error",
      component: text(payload.culprit),
      group: text(payload.environment),
      class: payload.triggerType,
      custom_details: Object.fromEntries(issueFacts(payload)),
    },
    client: "SpicyTrack",
    client_url: link,
    links: link ? [{ href: link, text: "View issue in SpicyTrack" }] : [],
  };
}

/**
 * `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, the same scheme as Stripe: the
 * receiver recomputes it with the rule's secret and rejects old timestamps to stop replays.
 */
export function webhookSignature(secret: string, body: string, timestamp: number) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}
