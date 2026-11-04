import { BadRequestException } from "@nestjs/common";

import { decodeCreatedAtCursor, parsePageLimit } from "../common/created-at-cursor";
import { assertEmail, assertOneOf, assertString, optionalNumber } from "../common/validators";
import { DELIVERY_STATUSES, type DestinationType } from "./alerts.types";
import { parseWebhookUrl } from "./webhook-url-policy";

const TRIGGER_TYPES = ["new_issue", "regression", "event_threshold", "daily_digest"] as const;
type TriggerType = (typeof TRIGGER_TYPES)[number];

export function assertTriggerTypes(value: unknown, legacyValue?: unknown): TriggerType[] {
  const candidate = value ?? (legacyValue === undefined ? undefined : [legacyValue]);
  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw new BadRequestException("triggerTypes must contain at least one trigger");
  }

  return [
    ...new Set(candidate.map((trigger) => assertOneOf(trigger, TRIGGER_TYPES, "triggerTypes"))),
  ];
}

const LIMITS = {
  threshold: { min: 1, max: 1_000_000 },
  thresholdWindowMinutes: { min: 1, max: 7 * 24 * 60 },
  cooldownMinutes: { min: 1, max: 7 * 24 * 60 },
} as const;

export function optionalBoundedInteger(
  value: unknown,
  field: keyof typeof LIMITS,
): number | undefined {
  const number = optionalNumber(value, field);
  if (number === undefined) return undefined;
  const { min, max } = LIMITS[field];
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
  }
  return number;
}

// PagerDuty Events v2 integration (routing) keys are 32 alphanumeric characters.
const PAGERDUTY_ROUTING_KEY = /^[A-Za-z0-9]{32}$/;

export function assertDestinationTarget(destinationType: DestinationType, value: unknown): string {
  if (destinationType === "email") return assertEmail(value);
  if (destinationType === "pagerduty") {
    const routingKey = assertString(value, "destinationTarget").trim();
    if (!PAGERDUTY_ROUTING_KEY.test(routingKey)) {
      throw new BadRequestException(
        "destinationTarget must be a PagerDuty Events v2 integration key (32 characters)",
      );
    }
    return routingKey;
  }
  return parseWebhookUrl(assertString(value, "destinationTarget")).toString();
}

/**
 * The target is validated against the type the rule will have after the update, so a type change
 * can never keep a target of the old kind (e.g. a webhook URL stored as an email address).
 */
export function resolveDestinationUpdate(
  currentType: DestinationType,
  nextType: DestinationType | undefined,
  target: unknown,
): { destinationType: DestinationType; destinationTarget?: string } {
  const destinationType = nextType ?? currentType;
  if (target === undefined) {
    if (destinationType !== currentType) {
      throw new BadRequestException("destinationTarget is required when changing destinationType");
    }
    return { destinationType };
  }
  return { destinationType, destinationTarget: assertDestinationTarget(destinationType, target) };
}

export const DELIVERY_PAGE_SIZE = 25;
export const MAX_DELIVERY_PAGE_SIZE = 100;

/** `cursor`, `limit` and `status` of the deliveries list. */
export function parseDeliveryQuery(query: Record<string, unknown>) {
  const status =
    query.status === undefined || query.status === ""
      ? undefined
      : assertOneOf(query.status, DELIVERY_STATUSES, "status");
  return {
    limit: parsePageLimit(query.limit, DELIVERY_PAGE_SIZE, MAX_DELIVERY_PAGE_SIZE),
    cursor: decodeCreatedAtCursor(query.cursor),
    status,
  };
}
