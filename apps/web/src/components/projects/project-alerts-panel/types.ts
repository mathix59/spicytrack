import type { FormEvent } from "react";

import type { AlertDeliveryDto, AlertRuleDto } from "@/generated/api";

type DestinationType = "webhook" | "email" | "slack" | "teams" | "discord";
type TriggerType = "new_issue" | "regression" | "event_threshold" | "daily_digest";

type ProjectAlertsPanelData = {
  error: string | null;
  createOpen: boolean;
  createDestinationType: DestinationType;
  rules: AlertRuleDto[];
  deliveries: AlertDeliveryDto[];
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  testingRuleId: string | null;
  setCreateOpen: (open: boolean) => void;
  setCreateDestinationType: (value: DestinationType) => void;
  createRule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateRule: (event: FormEvent<HTMLFormElement>, rule: AlertRuleDto) => Promise<void>;
  removeRule: (ruleId: string) => Promise<void>;
  testRule: (ruleId: string) => Promise<void>;
};

type ProjectAlertsPanelProps = {
  orgSlug: string;
  projectSlug: string;
};

export type { DestinationType, ProjectAlertsPanelData, ProjectAlertsPanelProps, TriggerType };
