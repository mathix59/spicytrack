import { Injectable } from "@nestjs/common";

import { EmailService } from "../email/email.service";
import { assertSafeWebhookUrl } from "./webhook-url-policy";

import type { AlertPayload, AlertRuleRecord, DeliveryResult } from "./alerts.types";

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

@Injectable()
export class AlertsDeliveryService {
  constructor(private readonly emailService: EmailService) {}

  async deliverToDestination(
    rule: AlertRuleRecord,
    payload: AlertPayload,
  ): Promise<DeliveryResult> {
    switch (rule.destinationType) {
      case "webhook":
        return this.deliverWebhook(rule.destinationTarget, payload);
      case "slack":
        return this.deliverWebhook(rule.destinationTarget, {
          text: this.buildMessage(payload),
        });
      case "teams":
        return this.deliverWebhook(rule.destinationTarget, {
          text: this.buildMessage(payload),
        });
      case "discord":
        return this.deliverWebhook(rule.destinationTarget, {
          content: this.buildMessage(payload),
        });
      case "email":
        return this.deliverEmail(rule.destinationTarget, payload);
      default:
        return {
          status: "failed",
          responseStatus: null,
          responseBody: "Unsupported destination type",
        };
    }
  }

  private async deliverWebhook(
    target: string,
    body: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    try {
      const safeTarget = await assertSafeWebhookUrl(target);
      const response = await fetch(safeTarget, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const responseBody = await response.text();

      return {
        status: response.ok ? "success" : "failed",
        responseStatus: response.status,
        responseBody,
      };
    } catch (error) {
      return {
        status: "failed",
        responseStatus: null,
        responseBody: error instanceof Error ? error.message : "Unknown delivery error",
      };
    }
  }

  private async deliverEmail(to: string, payload: AlertPayload): Promise<DeliveryResult> {
    try {
      await this.emailService.send({
        to,
        subject: this.buildSubject(payload),
        text: this.buildMessage(payload),
      });

      return { status: "success", responseStatus: null, responseBody: null };
    } catch (error) {
      return {
        status: "failed",
        responseStatus: null,
        responseBody: error instanceof Error ? error.message : "Unknown delivery error",
      };
    }
  }

  private buildSubject(payload: AlertPayload): string {
    return payload.triggerType === "daily_digest"
      ? "[SpicyTrack] Daily error digest"
      : `[SpicyTrack] ${payload.issueTitle}`;
  }

  private buildMessage(payload: AlertPayload): string {
    if (payload.triggerType === "daily_digest") {
      const topRegressions = Array.isArray(payload.topRegressions)
        ? payload.topRegressions
            .map((entry) => {
              const regression = entry as { title?: unknown; timesSeen?: unknown };
              return `- ${textValue(regression.title, "Unknown issue")} (${numberValue(regression.timesSeen)} events)`;
            })
            .join("\n")
        : "";
      return [
        `[SpicyTrack] Daily digest for project ${payload.projectId}`,
        `${numberValue(payload.eventCount24h)} events in the last 24h`,
        `${numberValue(payload.newIssueCount24h)} new issues`,
        `${numberValue(payload.openRegressionCount)} open regressions`,
        topRegressions ? `Top regressions:\n${topRegressions}` : "No open regression.",
      ].join("\n");
    }
    return `[SpicyTrack] ${payload.issueTitle} — ${payload.triggerType} (vu ${payload.timesSeen}x) sur le projet ${payload.projectId}`;
  }
}
