import { BellRing, Hash, Mail, Webhook } from "lucide-react";

import { formatLocalDateTime } from "@/lib/utils";

import type { DestinationType } from "./types";

const DESTINATION_TYPES: DestinationType[] = ["webhook", "email", "slack", "teams", "discord"];

function compactDate(value: string | null | undefined) {
  if (!value) {
    return "never";
  }

  return formatLocalDateTime(value);
}

function triggerLabel(triggerType: string, threshold: number | null | undefined) {
  if (triggerType === "event_threshold") {
    return `Threshold ${threshold ?? "n/a"}`;
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
  return destinationType === "email" ? "Email address" : "Webhook URL";
}

function destinationTargetInputType(destinationType: DestinationType) {
  return destinationType === "email" ? "email" : "url";
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
    default:
      return "https://example.com/webhook";
  }
}

function destinationIcon(destinationType: string) {
  return destinationType === "email"
    ? Mail
    : destinationType === "slack" || destinationType === "teams" || destinationType === "discord"
      ? Hash
      : Webhook;
}

export {
  BellRing,
  DESTINATION_TYPES,
  compactDate,
  deliveryTitle,
  destinationIcon,
  destinationTargetInputType,
  destinationTargetLabel,
  destinationTargetPlaceholder,
  Hash,
  Mail,
  triggerLabel,
  Webhook,
};
