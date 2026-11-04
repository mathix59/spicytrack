import type { FormEvent } from "react";

import type { AlertDeliveryListItemDto, AlertRuleDto } from "@/generated/api";

type DestinationType = "webhook" | "email" | "slack" | "teams" | "discord" | "pagerduty";
type TriggerType = "new_issue" | "regression" | "event_threshold" | "daily_digest";

type QueryState = {
  isLoading: boolean;
  error: unknown;
  retry: () => void;
};

type DeliveryStatusFilter = "all" | "failed";

type PagedQueryState = QueryState & {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

type ProjectAlertsPanelData = {
  rules: AlertRuleDto[];
  /** The pages loaded so far, newest first. */
  deliveries: AlertDeliveryListItemDto[];
  rulesQuery: QueryState;
  deliveriesQuery: PagedQueryState;
  deliveryStatusFilter: DeliveryStatusFilter;
  setDeliveryStatusFilter: (value: DeliveryStatusFilter) => void;
  createError: string | null;
  createOpen: boolean;
  createDestinationType: DestinationType;
  isCreating: boolean;
  savingRuleId: string | null;
  testingRuleId: string | null;
  setCreateOpen: (open: boolean) => void;
  setCreateDestinationType: (value: DestinationType) => void;
  createRule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Throws on failure so the rule form can show the error. */
  updateRule: (event: FormEvent<HTMLFormElement>, rule: AlertRuleDto) => Promise<void>;
  /** Throws on failure so the confirmation dialog can show the error. */
  removeRule: (ruleId: string) => Promise<void>;
  testRule: (ruleId: string) => Promise<void>;
  /** Replaces a webhook rule's signing secret and shows the new one. */
  rotateSigningSecret: (ruleId: string) => Promise<void>;
  /** A signing secret just created, shown once. */
  revealedSecret: { ruleName: string; secret: string } | null;
  dismissRevealedSecret: () => void;
};

type ProjectAlertsPanelProps = {
  orgSlug: string;
  projectSlug: string;
};

export type {
  DeliveryStatusFilter,
  DestinationType,
  ProjectAlertsPanelData,
  ProjectAlertsPanelProps,
  TriggerType,
};
