import { startTransition, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListIssuesQueryKey,
  getListProjectAuditQueryKey,
  useBulkUpdateIssueAssignee,
  useBulkUpdateIssueStatus,
} from "@/generated/api";
import type { IssueBulkFiltersDto } from "@/generated/api";
import { issueListContextFilters } from "@/features/issues/issue-list-context";
import { getErrorMessage } from "@/lib/utils";

import { pluralizeIssues } from "./issue-filters";

/** Checked issues of the list, "select all matching", and the bulk actions on them. */
function useIssueSelection({
  orgSlug,
  projectSlug,
  listContext,
  listContextKey,
  totalIssues,
  visibleIssueIds,
}: {
  orgSlug: string;
  projectSlug: string;
  /** The applied list filters, as carried into an issue's URL. */
  listContext: URLSearchParams;
  listContextKey: string;
  totalIssues: number;
  visibleIssueIds: string[];
}) {
  const queryClient = useQueryClient();
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  // Filters (as a list context string) whose every result is selected, beyond the visible page.
  const [allMatchingContext, setAllMatchingContext] = useState<string | null>(null);
  const [bulkAssigneeValue, setBulkAssigneeValue] = useState("__placeholder__");
  const bulkUpdateIssueStatusMutation = useBulkUpdateIssueStatus({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListIssuesQueryKey(orgSlug, projectSlug),
        });
        await queryClient.invalidateQueries({
          queryKey: getListProjectAuditQueryKey(orgSlug, projectSlug),
        });
        setSelectedIssueIds([]);
        setAllMatchingContext(null);
        setBulkAssigneeValue("__placeholder__");
      },
    },
  });
  const bulkUpdateIssueAssigneeMutation = useBulkUpdateIssueAssignee({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListIssuesQueryKey(orgSlug, projectSlug),
        });
        await queryClient.invalidateQueries({
          queryKey: getListProjectAuditQueryKey(orgSlug, projectSlug),
        });
        setSelectedIssueIds([]);
        setAllMatchingContext(null);
        setBulkAssigneeValue("__placeholder__");
      },
    },
  });
  const selectedIssueIdSet = useMemo(() => new Set(selectedIssueIds), [selectedIssueIds]);
  const allMatchingSelected = allMatchingContext === listContextKey && totalIssues > 0;
  const effectiveSelectedIdSet = allMatchingSelected
    ? new Set(visibleIssueIds)
    : selectedIssueIdSet;

  // Drop selected issues that are no longer visible when the page of results changes.
  const [selectionVisibleIssueIds, setSelectionVisibleIssueIds] = useState(visibleIssueIds);
  if (selectionVisibleIssueIds !== visibleIssueIds) {
    setSelectionVisibleIssueIds(visibleIssueIds);
    setSelectedIssueIds((current) =>
      current.filter((issueId) => visibleIssueIds.includes(issueId)),
    );
  }

  const toggleIssueSelection = (issueId: string) => {
    if (allMatchingSelected) {
      setAllMatchingContext(null);
      setSelectedIssueIds(visibleIssueIds.filter((id) => id !== issueId));
      return;
    }
    startTransition(() => {
      setSelectedIssueIds((current) =>
        current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId],
      );
    });
  };

  const clearSelection = () => {
    setAllMatchingContext(null);
    setSelectedIssueIds([]);
  };

  const selectAllMatching = () => setAllMatchingContext(listContextKey);

  /** What a bulk action changes: the checked issues, or every issue matching the filters. */
  const bulkTarget = (): { issueIds: string[] } | { filters: IssueBulkFiltersDto } => {
    if (!allMatchingSelected) return { issueIds: selectedIssueIds };
    const { sortBy: _sortBy, sortDir: _sortDir, ...filters } = issueListContextFilters(listContext);
    return { filters };
  };
  const selectedCount = allMatchingSelected ? totalIssues : selectedIssueIds.length;
  const allVisibleSelected =
    visibleIssueIds.length > 0 && visibleIssueIds.every((id) => effectiveSelectedIdSet.has(id));

  const toggleVisibleIssues = () => {
    if (allMatchingSelected) {
      clearSelection();
      return;
    }
    const visibleIds = visibleIssueIds;
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((issueId) => selectedIssueIdSet.has(issueId));

    startTransition(() => {
      setSelectedIssueIds((current) => {
        if (allVisibleSelected) {
          return current.filter((issueId) => !visibleIds.includes(issueId));
        }

        return Array.from(new Set([...current, ...visibleIds]));
      });
    });
  };

  const bulkSetStatus = async (status: string) => {
    if (selectedCount === 0) {
      return;
    }

    try {
      const response = await bulkUpdateIssueStatusMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: { ...bulkTarget(), status },
      });
      const count = response.data.updatedCount;
      const verb = status === "open" ? "reopened" : status;
      toast.success(`${pluralizeIssues(count)} ${verb}`);
    } catch (caughtError) {
      toast.error("Could not update the selected issues", {
        description: getErrorMessage(caughtError),
      });
    }
  };

  const bulkSetAssignee = async (assignedUserId: string) => {
    if (selectedCount === 0) {
      return;
    }

    try {
      const response = await bulkUpdateIssueAssigneeMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          ...bulkTarget(),
          assignedUserId: assignedUserId.length > 0 ? assignedUserId : null,
        },
      });
      const count = response.data.updatedCount;
      toast.success(
        assignedUserId.length > 0
          ? `${pluralizeIssues(count)} assigned`
          : `${pluralizeIssues(count)} unassigned`,
      );
    } catch (caughtError) {
      setBulkAssigneeValue("__placeholder__");
      toast.error("Could not reassign the selected issues", {
        description: getErrorMessage(caughtError),
      });
    }
  };

  return {
    allMatchingSelected,
    allVisibleSelected,
    bulkAssigneeValue,
    bulkSetAssignee,
    bulkSetStatus,
    bulkUpdateIssueAssigneeMutation,
    bulkUpdateIssueStatusMutation,
    clearSelection,
    selectAllMatching,
    selectedCount,
    selectedIssueIds,
    selectedIssueIdSet: effectiveSelectedIdSet,
    setBulkAssigneeValue,
    toggleIssueSelection,
    toggleVisibleIssues,
  };
}

export { useIssueSelection };
