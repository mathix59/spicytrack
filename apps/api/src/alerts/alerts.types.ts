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
  status: string;
  responseStatus: number | null;
  responseBody: string | null;
};

type AlertRuleRecord = typeof alertRules.$inferSelect;

export { DESTINATION_TYPES };
export type { AlertPayload, AlertRuleRecord, DeliveryResult, DestinationType };
