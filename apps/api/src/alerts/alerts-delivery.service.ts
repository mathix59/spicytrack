import { Injectable } from "@nestjs/common";

import { decryptSecret } from "../common/secrets";
import { EmailService } from "../email/email.service";
import {
  alertTriggerLabel,
  discordMessage,
  PAGERDUTY_EVENTS_URL,
  pagerDutyEvent,
  slackMessage,
  WEBHOOK_SIGNATURE_HEADER,
  webhookSignature,
} from "./alert-formats";
import { assertSafeWebhookUrl } from "./webhook-url-policy";

import type {
  AlertPayload,
  AlertRuleRecord,
  DeliveryOptions,
  DeliveryResult,
} from "./alerts.types";

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY_LENGTH = 2_000;
const RETRYABLE_STATUSES = new Set([408, 425, 429]);

export function isRetryableStatus(status: number): boolean {
  return status >= 500 || RETRYABLE_STATUSES.has(status);
}

function truncate(body: string): string {
  return body.length > MAX_RESPONSE_BODY_LENGTH
    ? `${body.slice(0, MAX_RESPONSE_BODY_LENGTH)}…`
    : body;
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function projectLabel(payload: AlertPayload): string {
  return textValue(payload.projectName, payload.projectId);
}

@Injectable()
export class AlertsDeliveryService {
  constructor(private readonly emailService: EmailService) {}

  async deliverToDestination(
    rule: AlertRuleRecord,
    payload: AlertPayload,
    options: DeliveryOptions = {},
  ): Promise<DeliveryResult> {
    switch (rule.destinationType) {
      case "webhook":
        return this.deliverWebhook(rule.destinationTarget, payload, {
          ...options,
          signingSecret: rule.signingSecret ? decryptSecret(rule.signingSecret) : undefined,
        });
      case "slack":
        return this.deliverWebhook(
          rule.destinationTarget,
          slackMessage(payload, this.buildMessage(payload)),
          options,
        );
      case "teams":
        return this.deliverWebhook(
          rule.destinationTarget,
          { text: this.buildMessage(payload) },
          options,
        );
      case "discord":
        return this.deliverWebhook(rule.destinationTarget, discordMessage(payload), options);
      case "pagerduty":
        if (payload.triggerType === "daily_digest") {
          return {
            status: "failed",
            responseStatus: null,
            responseBody: "PagerDuty rules do not send daily digests",
          };
        }
        return this.deliverWebhook(
          PAGERDUTY_EVENTS_URL,
          pagerDutyEvent(payload, rule.destinationTarget),
          options,
        );
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
    options: DeliveryOptions & { signingSecret?: string },
  ): Promise<DeliveryResult> {
    let safeTarget: string;
    try {
      safeTarget = await assertSafeWebhookUrl(target);
    } catch (error) {
      // A URL rejected by the policy will not become valid on retry.
      return {
        status: "failed",
        responseStatus: null,
        responseBody: error instanceof Error ? error.message : "Webhook URL is not allowed",
      };
    }

    const serializedBody = JSON.stringify(body);
    const timeout = AbortSignal.timeout(WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(safeTarget, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SpicyTrack-Alerts",
          ...(options.deliveryId
            ? {
                "Idempotency-Key": options.deliveryId,
                "X-SpicyTrack-Delivery": options.deliveryId,
              }
            : {}),
          ...(options.signingSecret
            ? {
                [WEBHOOK_SIGNATURE_HEADER]: webhookSignature(
                  options.signingSecret,
                  serializedBody,
                  Math.floor(Date.now() / 1000),
                ),
              }
            : {}),
        },
        body: serializedBody,
        signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });
      const responseBody = truncate(await response.text());

      return {
        status: response.ok ? "success" : "failed",
        responseStatus: response.status,
        responseBody,
        retryable: !response.ok && isRetryableStatus(response.status),
      };
    } catch (error) {
      return {
        status: "failed",
        responseStatus: null,
        responseBody: timeout.aborted
          ? `No response within ${WEBHOOK_TIMEOUT_MS / 1000} s`
          : error instanceof Error
            ? error.message
            : "Unknown delivery error",
        retryable: true,
      };
    }
  }

  private async deliverEmail(to: string, payload: AlertPayload): Promise<DeliveryResult> {
    try {
      const outcome = await this.emailService.send({
        to,
        subject: this.buildSubject(payload),
        text: this.buildMessage(payload),
      });

      if (outcome === "logged") {
        return {
          status: "failed",
          responseStatus: null,
          responseBody:
            "SMTP is not configured on this instance, so the email was not sent. Configure SMTP in instance settings.",
        };
      }

      return { status: "success", responseStatus: null, responseBody: null };
    } catch (error) {
      // SMTP failures (connection, greylisting, 4xx replies) are usually transient.
      return {
        status: "failed",
        responseStatus: null,
        responseBody: error instanceof Error ? error.message : "Unknown delivery error",
        retryable: true,
      };
    }
  }

  private buildSubject(payload: AlertPayload): string {
    return payload.triggerType === "daily_digest"
      ? `[SpicyTrack] Daily digest for ${projectLabel(payload)}`
      : `[SpicyTrack] ${alertTriggerLabel(payload)}: ${textValue(payload.issueTitle, "Unknown issue")}`;
  }

  buildMessage(payload: AlertPayload): string {
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
        `[SpicyTrack] Daily digest for ${projectLabel(payload)}`,
        `${numberValue(payload.eventCount24h)} events in the last 24h`,
        `${numberValue(payload.newIssueCount24h)} new issues`,
        `${numberValue(payload.openRegressionCount)} open regressions`,
        topRegressions ? `Top regressions:\n${topRegressions}` : "No open regressions.",
        typeof payload.projectUrl === "string" ? payload.projectUrl : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      `[SpicyTrack] ${alertTriggerLabel(payload)}: ${textValue(payload.issueTitle, "Unknown issue")}`,
      `Project: ${projectLabel(payload)} · seen ${numberValue(payload.timesSeen)} times`,
      typeof payload.issueUrl === "string" ? payload.issueUrl : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
