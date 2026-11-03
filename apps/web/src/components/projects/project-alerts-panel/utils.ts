import { BellRing, Hash, Mail, Siren, Webhook } from "lucide-react";

import type { AlertRuleDto } from "@/generated/api";
import { formatLocalDateTime } from "@/lib/utils";

import type { DestinationType, TriggerType } from "./types";

const DESTINATION_TYPES: DestinationType[] = [
  "webhook",
  "email",
  "slack",
  "teams",
  "discord",
  "pagerduty",
];
const DESTINATION_LABELS: Record<DestinationType, string> = {
  webhook: "Webhook",
  email: "Email",
  slack: "Slack",
  teams: "Microsoft Teams",
  discord: "Discord",
  pagerduty: "PagerDuty",
};

function destinationLabel(type: string) {
  return DESTINATION_LABELS[type as DestinationType] ?? type;
}
const TRIGGER_TYPES: Array<{ value: TriggerType; label: string }> = [
  { value: "new_issue", label: "New issue" },
  { value: "regression", label: "Regression" },
  { value: "event_threshold", label: "Event threshold" },
  { value: "daily_digest", label: "Daily digest" },
];

function ruleTriggerTypes(rule: AlertRuleDto): TriggerType[] {
  const values = rule.triggerTypes?.length ? rule.triggerTypes : [rule.triggerType ?? "new_issue"];
  return values.filter((value): value is TriggerType =>
    TRIGGER_TYPES.some((trigger) => trigger.value === value),
  );
}

function compactDate(value: string | null | undefined) {
  if (!value) {
    return "never";
  }

  return formatLocalDateTime(value);
}

function formatWindow(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes} min`;
}

function triggerLabel(
  triggerType: string,
  threshold: number | null | undefined,
  thresholdWindowMinutes = 60,
) {
  if (triggerType === "event_threshold") {
    return threshold
      ? `${threshold} events / ${formatWindow(thresholdWindowMinutes)}`
      : "Threshold n/a";
  }

  if (triggerType === "regression") {
    return "Regression";
  }

  if (triggerType === "daily_digest") {
    return "Daily digest";
  }

  return "New issue";
}

function deliveryTitle(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Alert delivery";
  }

  const record = payload as Record<string, unknown>;
  const issueTitle = typeof record.issueTitle === "string" ? record.issueTitle : null;
  const projectSlug = typeof record.projectSlug === "string" ? record.projectSlug : null;

  if (issueTitle && projectSlug) {
    return `${projectSlug} · ${issueTitle}`;
  }

  if (issueTitle) {
    return issueTitle;
  }

  return "Alert delivery";
}

function destinationTargetLabel(destinationType: DestinationType) {
  if (destinationType === "email") return "Email address";
  if (destinationType === "pagerduty") return "Integration key";
  return "Webhook URL";
}

function destinationTargetInputType(destinationType: DestinationType) {
  if (destinationType === "email") return "email";
  if (destinationType === "pagerduty") return "text";
  return "url";
}

function destinationTargetHint(destinationType: DestinationType) {
  switch (destinationType) {
    case "pagerduty":
      return "Events API v2 key. One incident per issue.";
    case "webhook":
      return "Signed with a secret shown once after saving.";
    default:
      return undefined;
  }
}

function destinationTargetPlaceholder(destinationType: DestinationType) {
  switch (destinationType) {
    case "email":
      return "oncall@company.dev";
    case "slack":
      return "https://hooks.slack.com/services/...";
    case "teams":
      return "https://...webhook.office.com/...";
    case "discord":
      return "https://discord.com/api/webhooks/...";
    case "pagerduty":
      return "32-character integration key";
    default:
      return "https://example.com/webhook";
  }
}

export {
  BellRing,
  DESTINATION_TYPES,
  TRIGGER_TYPES,
  compactDate,
  deliveryTitle,
  destinationLabel,
  destinationTargetHint,
  destinationTargetInputType,
  destinationTargetLabel,
  destinationTargetPlaceholder,
  Hash,
  Mail,
  ruleTriggerTypes,
  Siren,
  triggerLabel,
  Webhook,
};
