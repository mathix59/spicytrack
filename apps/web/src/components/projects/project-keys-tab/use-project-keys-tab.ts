import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListProjectAuditQueryKey,
  getListProjectKeysQueryKey,
  useCreateProjectKey,
  useListProjectKeys,
  useRotateProjectKey,
  useUpdateProjectKey,
  type ProjectKeyDto,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { invalidateQueryKeys } from "@/lib/query-utils";

import type { ProjectKeysTabData, ProjectKeysTabProps } from "./types";
import { useFirstEventStatus } from "./use-first-event-status";
import { SETUP_PLATFORMS } from "./utils";

const EMPTY_KEYS: ProjectKeyDto[] = [];

function readRateLimit(data: FormData) {
  return Number(data.get("rateLimitPerMinute") ?? 0) || null;
}

function useProjectKeysTab({
  orgSlug,
  projectSlug,
  projectPlatform,
}: ProjectKeysTabProps): ProjectKeysTabData {
  const queryClient = useQueryClient();
  const [createError, setCreateError] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [createOpen, setCreateOpenState] = useState(false);
  const [managedKey, setManagedKeyState] = useState<ProjectKeyDto | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const keysQuery = useListProjectKeys(orgSlug, projectSlug);
  const firstEvent = useFirstEventStatus(orgSlug, projectSlug);
  const keys = keysQuery.data?.data ?? EMPTY_KEYS;
  const primaryKey = keys.find((key) => key.isActive) ?? keys[0] ?? null;
  const effectivePlatform =
    selectedPlatform ??
    (SETUP_PLATFORMS.includes(projectPlatform) ? projectPlatform : "javascript");

  const invalidate = async () => {
    await invalidateQueryKeys(queryClient, [
      getListProjectKeysQueryKey(orgSlug, projectSlug),
      getListProjectAuditQueryKey(orgSlug, projectSlug),
    ]);
  };

  const createMutation = useCreateProjectKey({ mutation: { onSuccess: invalidate } });
  const updateMutation = useUpdateProjectKey({ mutation: { onSuccess: invalidate } });
  const rotateMutation = useRotateProjectKey({ mutation: { onSuccess: invalidate } });

  const setCreateOpen = (open: boolean) => {
    setCreateError(null);
    setCreateOpenState(open);
  };

  const setManagedKey = (key: ProjectKeyDto | null) => {
    setManageError(null);
    setManagedKeyState(key);
  };

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setCreateError,
      action: () =>
        createMutation.mutateAsync({
          orgSlug,
          projectSlug,
          data: {
            name: String(data.get("name") ?? "").trim(),
            rateLimitPerMinute: readRateLimit(data) ?? undefined,
          },
        }),
      onSuccess: () => {
        setCreateOpenState(false);
        toast.success("Key created");
      },
    });
  };

  const saveKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!managedKey) {
      return;
    }

    const data = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setManageError,
      action: () =>
        updateMutation.mutateAsync({
          orgSlug,
          projectSlug,
          keyId: managedKey.id,
          data: {
            name: String(data.get("name") ?? "").trim(),
            isActive: data.get("isActive") === "on",
            rateLimitPerMinute: readRateLimit(data),
          },
        }),
      onSuccess: () => {
        setManagedKeyState(null);
        toast.success("Key updated");
      },
    });
  };

  /** Throws on failure so confirmation dialogs can surface the error. */
  const setKeyActive = async (key: ProjectKeyDto, isActive: boolean) => {
    await updateMutation.mutateAsync({
      orgSlug,
      projectSlug,
      keyId: key.id,
      data: {
        isActive,
        name: key.name,
        rateLimitPerMinute: key.rateLimitPerMinute ?? null,
      },
    });
  };

  /** Throws on failure so confirmation dialogs can surface the error. */
  const rotateKey = async (keyId: string) => {
    await rotateMutation.mutateAsync({ orgSlug, projectSlug, keyId });
  };

  return {
    keys,
    primaryKey,
    isLoading: keysQuery.isLoading,
    loadError: keysQuery.error,
    retry: () => void keysQuery.refetch(),
    firstEvent,
    createError,
    manageError,
    createOpen,
    managedKey,
    effectivePlatform,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    setCreateOpen,
    setManagedKey,
    setSelectedPlatform,
    createKey,
    saveKey,
    setKeyActive,
    rotateKey,
  };
}

export { useProjectKeysTab };
