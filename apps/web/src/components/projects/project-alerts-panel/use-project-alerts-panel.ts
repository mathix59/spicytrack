import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListProjectAlertDeliveriesQueryKey,
  getListProjectAlertsQueryKey,
  useCreateProjectAlert,
  useDeleteProjectAlert,
  useListProjectAlertDeliveries,
  useListProjectAlerts,
  useUpdateProjectAlert,
  type AlertDeliveryDto,
  type AlertRuleDto,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

import type { DestinationType, ProjectAlertsPanelData, ProjectAlertsPanelProps } from "./types";

const EMPTY_RULES: AlertRuleDto[] = [];
const EMPTY_DELIVERIES: AlertDeliveryDto[] = [];

function useProjectAlertsPanel({
  orgSlug,
  projectSlug,
}: ProjectAlertsPanelProps): ProjectAlertsPanelData {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDestinationType, setCreateDestinationType] = useState<DestinationType>("webhook");

  const alertsQuery = useListProjectAlerts(orgSlug, projectSlug);
  const deliveriesQuery = useListProjectAlertDeliveries(orgSlug, projectSlug);

  const invalidateAlerts = async () => {
    await invalidateQueryKeys(queryClient, [
      getListProjectAlertsQueryKey(orgSlug, projectSlug),
      getListProjectAlertDeliveriesQueryKey(orgSlug, projectSlug),
    ]);
  };

  const createAlertMutation = useCreateProjectAlert({
    mutation: {
      onSuccess: invalidateAlerts,
    },
  });
  const updateAlertMutation = useUpdateProjectAlert({
    mutation: {
      onSuccess: invalidateAlerts,
    },
  });
  const deleteAlertMutation = useDeleteProjectAlert({
    mutation: {
      onSuccess: invalidateAlerts,
    },
  });

  const rules = alertsQuery.data?.data ?? EMPTY_RULES;
  const deliveries = deliveriesQuery.data?.data ?? EMPTY_DELIVERIES;

  const createRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const triggerType = String(formData.get("triggerType") ?? "new_issue");
    const thresholdValue = String(formData.get("threshold") ?? "");

    try {
      await createAlertMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          name: String(formData.get("name") ?? ""),
          triggerType,
          threshold:
            triggerType === "event_threshold" && thresholdValue.length > 0
              ? Number(thresholdValue)
              : null,
          cooldownMinutes: Number(formData.get("cooldownMinutes") ?? 30) || 30,
          destinationType: String(formData.get("destinationType") ?? "webhook"),
          destinationTarget: String(formData.get("destinationTarget") ?? ""),
        },
      });
      setCreateDestinationType("webhook");
      setCreateOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const updateRule = async (event: FormEvent<HTMLFormElement>, rule: AlertRuleDto) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const triggerType = String(formData.get("triggerType") ?? rule.triggerType);
    const thresholdValue = String(formData.get("threshold") ?? "");

    try {
      await updateAlertMutation.mutateAsync({
        orgSlug,
        projectSlug,
        alertRuleId: rule.id,
        data: {
          name: String(formData.get("name") ?? rule.name),
          isActive: String(formData.get("isActive") ?? "true") === "true",
          triggerType,
          threshold:
            triggerType === "event_threshold" && thresholdValue.length > 0
              ? Number(thresholdValue)
              : null,
          cooldownMinutes: Number(formData.get("cooldownMinutes") ?? 30) || 30,
          destinationType: String(formData.get("destinationType") ?? rule.destinationType),
          destinationTarget: String(formData.get("destinationTarget") ?? rule.destinationTarget),
        },
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const removeRule = async (ruleId: string) => {
    setError(null);

    try {
      await deleteAlertMutation.mutateAsync({
        orgSlug,
        projectSlug,
        alertRuleId: ruleId,
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return {
    error,
    createOpen,
    createDestinationType,
    rules,
    deliveries,
    isCreating: createAlertMutation.isPending,
    isUpdating: updateAlertMutation.isPending,
    isDeleting: deleteAlertMutation.isPending,
    setCreateOpen,
    setCreateDestinationType,
    createRule,
    updateRule,
    removeRule,
  };
}

export { useProjectAlertsPanel };
