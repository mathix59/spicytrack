import { BadRequestException } from "@nestjs/common";

import { assertEmail, assertOneOf, assertString, optionalNumber } from "../common/validators";
import type { DestinationType } from "./alerts.types";
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

export function assertDestinationTarget(destinationType: DestinationType, value: unknown): string {
  return destinationType === "email"
    ? assertEmail(value)
    : parseWebhookUrl(assertString(value, "destinationTarget")).toString();
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
