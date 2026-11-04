import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListProjectSavedSearchesQueryKey,
  useCreateProjectSavedSearch,
  useDeleteProjectSavedSearch,
  useListProjectSavedSearches,
} from "@/generated/api";
import type { IssueFilterSnapshot, SavedIssueSearch } from "@/features/issues/saved-searches";
import { getErrorMessage } from "@/lib/utils";

/** A project's saved issue views, and the dialog that saves the current filters as one. */
function useIssueSavedSearches({
  orgSlug,
  projectSlug,
  currentFilterSnapshot,
}: {
  orgSlug: string;
  projectSlug: string;
  currentFilterSnapshot: IssueFilterSnapshot;
}) {
  const queryClient = useQueryClient();
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("");
  const savedSearchesQuery = useListProjectSavedSearches(orgSlug, projectSlug, {
    query: { enabled: true },
  });
  const createSavedSearchMutation = useCreateProjectSavedSearch({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListProjectSavedSearchesQueryKey(orgSlug, projectSlug),
        });
      },
    },
  });
  const deleteSavedSearchMutation = useDeleteProjectSavedSearch({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListProjectSavedSearchesQueryKey(orgSlug, projectSlug),
        });
      },
    },
  });
  const savedSearches = useMemo(
    () => (savedSearchesQuery.data?.data ?? []) as SavedIssueSearch[],
    [savedSearchesQuery.data],
  );

  const removeSavedSearch = async (searchId: string) => {
    try {
      await deleteSavedSearchMutation.mutateAsync({
        orgSlug,
        projectSlug,
        savedSearchId: searchId,
      });
      toast.success("Saved view removed");
    } catch (caughtError) {
      toast.error("Could not remove the saved view", { description: getErrorMessage(caughtError) });
    }
  };

  const saveCurrentSearch = async () => {
    const trimmedName = savedSearchName.trim();

    if (trimmedName.length === 0) {
      return;
    }

    try {
      await createSavedSearchMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          name: trimmedName,
          filters: currentFilterSnapshot,
        },
      });
      toast.success(`Saved view "${trimmedName}" created`);
      setSavedSearchName("");
      setSaveSearchOpen(false);
    } catch (caughtError) {
      toast.error("Could not save this view", { description: getErrorMessage(caughtError) });
    }
  };

  return {
    removeSavedSearch,
    saveCurrentSearch,
    savedSearchName,
    savedSearches,
    saveSearchOpen,
    setSavedSearchName,
    setSaveSearchOpen,
  };
}

export { useIssueSavedSearches };
