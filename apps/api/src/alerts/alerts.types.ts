import { alertRules } from "../database/schema";

type AlertPayload = {
  [key: string]: unknown;
  triggerType: string;
  triggerTypes?: string[];
  projectId: string;
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

export type { AlertPayload, AlertRuleRecord, DeliveryResult };
