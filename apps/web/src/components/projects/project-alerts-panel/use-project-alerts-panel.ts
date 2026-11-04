import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListProjectAlertDeliveriesQueryKey,
  getListProjectAlertsQueryKey,
  useCreateProjectAlert,
  useDeleteProjectAlert,
  useListProjectAlerts,
  useRotateProjectAlertSigningSecret,
  useTestProjectAlert,
  useUpdateProjectAlert,
  type AlertRuleDto,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

import type { DestinationType, ProjectAlertsPanelData, ProjectAlertsPanelProps } from "./types";
import { useAlertDeliveries } from "./use-alert-deliveries";

const EMPTY_RULES: AlertRuleDto[] = [];

/**
 * Reads the trigger/threshold/cooldown/destination fields shared by create and edit forms.
 * A blank target is left out so an edit keeps the saved (masked) URL.
 */
function readRuleConfig(formData: FormData, fallback?: AlertRuleDto) {
  const triggerTypes = formData.getAll("triggerTypes").map(String);
  const thresholdValue = String(formData.get("threshold") ?? "");
  const destinationTarget = String(formData.get("destinationTarget") ?? "").trim();

  return {
    triggerTypes,
    threshold:
      triggerTypes.includes("event_threshold") && thresholdValue.length > 0
        ? Number(thresholdValue)
        : null,
    thresholdWindowMinutes: Number(formData.get("thresholdWindowMinutes") ?? 60) || 60,
    cooldownMinutes: Number(formData.get("cooldownMinutes") ?? 30) || 30,
    destinationType: String(
      formData.get("destinationType") ?? fallback?.destinationType ?? "webhook",
    ) as DestinationType,
    ...(destinationTarget ? { destinationTarget } : {}),
  };
}

function useProjectAlertsPanel({
  orgSlug,
  projectSlug,
}: ProjectAlertsPanelProps): ProjectAlertsPanelData {
  const queryClient = useQueryClient();
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOpen, setCreateOpenState] = useState(false);
  const [createDestinationType, setCreateDestinationType] = useState<DestinationType>("webhook");
  const [revealedSecret, setRevealedSecret] =
    useState<ProjectAlertsPanelData["revealedSecret"]>(null);
  const revealSecret = (rule: AlertRuleDto) => {
    if (rule.signingSecret) setRevealedSecret({ ruleName: rule.name, secret: rule.signingSecret });
  };

  const alertsQuery = useListProjectAlerts(orgSlug, projectSlug);
  const deliveries = useAlertDeliveries(orgSlug, projectSlug);

  const invalidateAlerts = async () => {
    await invalidateQueryKeys(queryClient, [
      getListProjectAlertsQueryKey(orgSlug, projectSlug),
      getListProjectAlertDeliveriesQueryKey(orgSlug, projectSlug),
    ]);
  };

  const createAlertMutation = useCreateProjectAlert({ mutation: { onSuccess: invalidateAlerts } });
  const updateAlertMutation = useUpdateProjectAlert({ mutation: { onSuccess: invalidateAlerts } });
  const deleteAlertMutation = useDeleteProjectAlert({ mutation: { onSuccess: invalidateAlerts } });
  const testAlertMutation = useTestProjectAlert({ mutation: { onSuccess: invalidateAlerts } });
  const rotateSecretMutation = useRotateProjectAlertSigningSecret({
    mutation: { onSuccess: invalidateAlerts },
  });

  const setCreateOpen = (open: boolean) => {
    setCreateError(null);
    if (!open) setCreateDestinationType("webhook");
    setCreateOpenState(open);
  };

  const createRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setCreateError,
      action: () =>
        createAlertMutation.mutateAsync({
          orgSlug,
          projectSlug,
          data: {
            name: String(formData.get("name") ?? ""),
            destinationTarget: "",
            ...readRuleConfig(formData),
          },
        }),
      onSuccess: (response) => {
        setCreateDestinationType("webhook");
        setCreateOpenState(false);
        toast.success("Alert rule created");
        revealSecret(response.data);
      },
    });
  };

  /** Throws on failure so the rule form can show the error next to its fields. */
  const updateRule = async (event: FormEvent<HTMLFormElement>, rule: AlertRuleDto) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const response = await updateAlertMutation.mutateAsync({
      orgSlug,
      projectSlug,
      alertRuleId: rule.id,
      data: {
        name: String(formData.get("name") ?? rule.name),
        isActive: String(formData.get("isActive") ?? "true") === "true",
        ...readRuleConfig(formData, rule),
      },
    });
    toast.success("Alert rule saved");
    revealSecret(response.data);
  };

  /** Throws on failure so the confirmation dialog can show the error. */
  const rotateSigningSecret = async (ruleId: string) => {
    const response = await rotateSecretMutation.mutateAsync({
      orgSlug,
      projectSlug,
      alertRuleId: ruleId,
    });
    revealSecret(response.data);
  };

  const removeRule = async (ruleId: string) => {
    await deleteAlertMutation.mutateAsync({ orgSlug, projectSlug, alertRuleId: ruleId });
  };

  const testRule = async (ruleId: string) => {
    try {
      await testAlertMutation.mutateAsync({ orgSlug, projectSlug, alertRuleId: ruleId });
      toast.success("Test alert sent. Check the deliveries list for the result.");
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    }
  };

  return {
    rules: alertsQuery.data?.data ?? EMPTY_RULES,
    deliveries: deliveries.deliveries,
    rulesQuery: {
      isLoading: alertsQuery.isLoading,
      error: alertsQuery.error,
      retry: () => void alertsQuery.refetch(),
    },
    deliveriesQuery: {
      isLoading: deliveries.query.isPending,
      error: deliveries.query.error,
      retry: () => void deliveries.query.refetch(),
      hasNextPage: deliveries.query.hasNextPage,
      isFetchingNextPage: deliveries.query.isFetchingNextPage,
      fetchNextPage: () => void deliveries.query.fetchNextPage(),
    },
    deliveryStatusFilter: deliveries.statusFilter,
    setDeliveryStatusFilter: deliveries.setStatusFilter,
    createError,
    createOpen,
    createDestinationType,
    isCreating: createAlertMutation.isPending,
    savingRuleId: updateAlertMutation.isPending
      ? (updateAlertMutation.variables?.alertRuleId ?? null)
      : null,
    testingRuleId: testAlertMutation.isPending
      ? (testAlertMutation.variables?.alertRuleId ?? null)
      : null,
    setCreateOpen,
    setCreateDestinationType,
    createRule,
    updateRule,
    removeRule,
    testRule,
    rotateSigningSecret,
    revealedSecret,
    dismissRevealedSecret: () => setRevealedSecret(null),
  };
}

export { useProjectAlertsPanel };
