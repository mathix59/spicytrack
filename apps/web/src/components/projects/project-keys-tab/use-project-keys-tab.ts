import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListProjectAuditQueryKey,
  getListProjectKeysQueryKey,
  useCreateProjectKey,
  useListProjectKeys,
  useRotateProjectKey,
  useUpdateProjectKey,
  type ProjectKeyDto,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

import type { ProjectKeysTabData, ProjectKeysTabProps } from "./types";
import { SETUP_PLATFORMS } from "./utils";

const EMPTY_KEYS: ProjectKeyDto[] = [];

function useProjectKeysTab({
  orgSlug,
  projectSlug,
  projectPlatform,
}: ProjectKeysTabProps): ProjectKeysTabData {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [managedKey, setManagedKey] = useState<ProjectKeyDto | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const keysQuery = useListProjectKeys(orgSlug, projectSlug);
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

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);

    try {
      await createMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          name: String(data.get("name") ?? ""),
          rateLimitPerMinute: Number(data.get("rateLimitPerMinute") ?? 0) || undefined,
        },
      });
      setCreateOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const saveKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!managedKey) {
      return;
    }

    setError(null);
    const data = new FormData(event.currentTarget);

    try {
      await updateMutation.mutateAsync({
        orgSlug,
        projectSlug,
        keyId: managedKey.id,
        data: {
          name: String(data.get("name") ?? "").trim(),
          isActive: data.get("isActive") === "on",
          rateLimitPerMinute: Number(data.get("rateLimitPerMinute") ?? 0) || null,
        },
      });
      setManagedKey(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const updateKey = async (key: ProjectKeyDto, isActive: boolean) => {
    setError(null);

    try {
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
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const rotateKey = async (keyId: string) => {
    setError(null);

    try {
      await rotateMutation.mutateAsync({ orgSlug, projectSlug, keyId });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return {
    error,
    createOpen,
    managedKey,
    keys,
    primaryKey,
    effectivePlatform,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRotating: rotateMutation.isPending,
    setCreateOpen,
    setManagedKey,
    setSelectedPlatform,
    createKey,
    saveKey,
    updateKey,
    rotateKey,
    resetError: () => setError(null),
  };
}

export { useProjectKeysTab };
