import { alertRules } from "../database/schema";

const DESTINATION_TYPES = ["webhook", "email", "slack", "teams", "discord"] as const;
type DestinationType = (typeof DESTINATION_TYPES)[number];

type AlertPayload = {
  [key: string]: unknown;
  triggerType: string;
  triggerTypes?: string[];
  projectId: string;
  projectName?: string;
  projectUrl?: string;
  issueUrl?: string;
  issueId?: string;
  eventId?: string;
  issueTitle?: string;
  issueStatus?: string;
  timesSeen?: number;
};

type DeliveryResult = {
  status: "success" | "failed";
  responseStatus: number | null;
  responseBody: string | null;
  /** A failure that may succeed later (network error, timeout, 408, 425, 429, 5xx). */
  retryable?: boolean;
};

type DeliveryOptions = {
  /** Sent as Idempotency-Key and X-SpicyTrack-Delivery so receivers can drop retried duplicates. */
  deliveryId?: string;
  signal?: AbortSignal;
};

type AlertRuleRecord = typeof alertRules.$inferSelect;

export { DESTINATION_TYPES };
export type { AlertPayload, AlertRuleRecord, DeliveryOptions, DeliveryResult, DestinationType };
