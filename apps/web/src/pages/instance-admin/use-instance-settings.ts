import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchInstanceSettings,
  instanceAdminKeys,
  updateInstanceSettings,
} from "./instance-admin-api";
import type { InstanceSettingsUpdate } from "./types";

function isForbidden(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

function useInstanceSettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: instanceAdminKeys.settings,
    queryFn: fetchInstanceSettings,
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
  });

  const saveMutation = useMutation({
    mutationFn: updateInstanceSettings,
    // Callers confirm with a toast that names what changed.
    onSuccess: (settings) => {
      queryClient.setQueryData(instanceAdminKeys.settings, settings);
    },
  });

  return {
    settingsQuery,
    isForbidden: isForbidden(settingsQuery.error),
    isSaving: saveMutation.isPending,
    /** Saves settings; rejects with a readable error so callers can show it inline. */
    save: (next: InstanceSettingsUpdate) => saveMutation.mutateAsync(next),
  };
}

export { useInstanceSettings };
