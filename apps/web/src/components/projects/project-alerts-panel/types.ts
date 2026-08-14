import type { FormEvent } from "react";

import type { AlertDeliveryDto, AlertRuleDto } from "@/generated/api";

type DestinationType = "webhook" | "email" | "slack" | "teams" | "discord";

type ProjectAlertsPanelData = {
  error: string | null;
  createOpen: boolean;
  createDestinationType: DestinationType;
  rules: AlertRuleDto[];
  deliveries: AlertDeliveryDto[];
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  setCreateOpen: (open: boolean) => void;
  setCreateDestinationType: (value: DestinationType) => void;
  createRule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateRule: (event: FormEvent<HTMLFormElement>, rule: AlertRuleDto) => Promise<void>;
  removeRule: (ruleId: string) => Promise<void>;
};

type ProjectAlertsPanelProps = {
  orgSlug: string;
  projectSlug: string;
};

export type { DestinationType, ProjectAlertsPanelData, ProjectAlertsPanelProps };
