import { startTransition, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListIssuesQueryKey,
  getListProjectAuditQueryKey,
  getListProjectSavedSearchesQueryKey,
  useBulkUpdateIssueAssignee,
  useBulkUpdateIssueStatus,
  useCreateProjectSavedSearch,
  useDeleteProjectSavedSearch,
  useListIssues,
  useListOrganizationMembers,
  useListProjectEnvironments,
  useListProjectReleases,
  useListProjectSavedSearches,
} from "@/generated/api";
import type { IssueBulkFiltersDto } from "@/generated/api";
import {
  issueListContext,
  issueListContextFilters,
  withIssueListContext,
} from "@/features/issues/issue-list-context";
import type { IssueFilterSnapshot, SavedIssueSearch } from "@/features/issues/saved-searches";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getErrorMessage } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;
/** Same cap as the API for bulk actions on every result of a search. */
const MAX_BULK_MATCHING_ISSUES = 5_000;

function pluralizeIssues(count: number) {
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

type ProjectIssuesOptions = { orgSlug: string; projectSlug: string };

function useProjectIssues({ orgSlug, projectSlug }: ProjectIssuesOptions) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("");
  const [issueSearch, setIssueSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "open");
  const [levelFilter, setLevelFilter] = useState(() => searchParams.get("level") ?? "all");
  const [assignedUserFilter, setAssignedUserFilter] = useState(
    () => searchParams.get("assignedUserId") ?? "all",
  );
  const [environmentFilter, setEnvironmentFilter] = useState(
    () => searchParams.get("environment") ?? "all",
  );
  const [releaseFilter, setReleaseFilter] = useState(() => searchParams.get("release") ?? "all");
  const [regressedFilter, setRegressedFilter] = useState(
    () => searchParams.get("isRegressed") ?? "all",
  );
  const [sortBy, setSortBy] = useState(() => searchParams.get("sortBy") ?? "lastSeenAt");
  const [sortDir, setSortDir] = useState(() => searchParams.get("sortDir") ?? "desc");
  const [page, setPage] = useState(() => {
    const value = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const value = Number(searchParams.get("pageSize") ?? "25");
    return Number.isFinite(value) && value > 0 ? value : 25;
  });
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  // Filters (as a list context string) whose every result is selected, beyond the visible page.
  const [allMatchingContext, setAllMatchingContext] = useState<string | null>(null);
  const [bulkAssigneeValue, setBulkAssigneeValue] = useState("__placeholder__");
  const environmentsQuery = useListProjectEnvironments(orgSlug, projectSlug);
  const releasesQuery = useListProjectReleases(orgSlug, projectSlug);
  const savedSearchesQuery = useListProjectSavedSearches(orgSlug, projectSlug, {
    query: { enabled: true },
  });
  const deferredIssueSearch = useDebouncedValue(issueSearch, SEARCH_DEBOUNCE_MS);
  const issuesQuery = useListIssues(
    orgSlug,
    projectSlug,
    {
      page,
      pageSize,
      q: deferredIssueSearch.trim().length > 0 ? deferredIssueSearch : undefined,
      level: levelFilter !== "all" ? levelFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      assignedUserId: assignedUserFilter !== "all" ? assignedUserFilter : undefined,
      environment: environmentFilter !== "all" ? environmentFilter : undefined,
      release: releaseFilter !== "all" ? releaseFilter : undefined,
      isRegressed: regressedFilter === "all" ? undefined : regressedFilter === "true",
      sortBy,
      sortDir,
    } as never,
    { query: { placeholderData: keepPreviousData } },
  );
  const issuesErrorMessage = issuesQuery.isError ? getErrorMessage(issuesQuery.error) : null;
  // The API rejects a malformed search with a message meant for the person typing it.
  const searchError = issuesErrorMessage?.startsWith("Invalid search") ? issuesErrorMessage : null;
  const membersQuery = useListOrganizationMembers(orgSlug);
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

  const projectEnvironments = environmentsQuery.data?.data ?? [];
  const projectReleases = releasesQuery.data?.data ?? [];
  const issuesPage = issuesQuery.data?.data;
  const issues = useMemo(() => issuesPage?.items ?? [], [issuesPage]);
  const savedSearches = useMemo(
    () => (savedSearchesQuery.data?.data ?? []) as SavedIssueSearch[],
    [savedSearchesQuery.data],
  );
  const totalIssues = issuesPage?.total ?? 0;
  const members = useMemo(() => membersQuery.data?.data ?? [], [membersQuery.data]);
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const selectedIssueIdSet = useMemo(() => new Set(selectedIssueIds), [selectedIssueIds]);
  const visibleIssueIds = useMemo(
    () => (issuesPage?.items ?? []).map((issue) => issue.id),
    [issuesPage],
  );
  const activeSecondaryFilterCount = [
    assignedUserFilter !== "all",
    environmentFilter !== "all",
    releaseFilter !== "all",
    regressedFilter !== "all",
  ].filter(Boolean).length;
  const hasActiveFilters =
    activeSecondaryFilterCount > 0 ||
    issueSearch.trim().length > 0 ||
    levelFilter !== "all" ||
    statusFilter !== "open";
  const totalIssuePages = issuesPage ? Math.max(1, Math.ceil(totalIssues / pageSize)) : page;
  // Missing or retained data is not a response for the requested page yet.
  const safePage =
    !issuesPage || issuesQuery.isPlaceholderData ? page : Math.min(page, totalIssuePages);
  const currentFilterSnapshot = useMemo<IssueFilterSnapshot>(
    () => ({
      q: issueSearch,
      status: statusFilter,
      level: levelFilter,
      assignedUserId: assignedUserFilter,
      environment: environmentFilter,
      release: releaseFilter,
      isRegressed: regressedFilter,
      sortBy,
      sortDir,
      pageSize,
    }),
    [
      assignedUserFilter,
      environmentFilter,
      issueSearch,
      levelFilter,
      pageSize,
      regressedFilter,
      releaseFilter,
      sortBy,
      sortDir,
      statusFilter,
    ],
  );

  // Applied filters only: a half-typed search does not count until the list shows its results.
  const listContext = issueListContext(searchParams);
  if (deferredIssueSearch.trim()) listContext.set("q", deferredIssueSearch);
  else listContext.delete("q");
  const listContextKey = listContext.toString();
  const allMatchingSelected = allMatchingContext === listContextKey && totalIssues > 0;
  const effectiveSelectedIdSet = allMatchingSelected
    ? new Set(visibleIssueIds)
    : selectedIssueIdSet;
  const issueHref = (issueId: string) =>
    withIssueListContext(`/orgs/${orgSlug}/projects/${projectSlug}/issues/${issueId}`, listContext);

  // Clamp an out-of-range page during render so the URL and query only ever see the safe page.
  if (page !== safePage) {
    setPage(safePage);
  }

  // Drop selected issues that are no longer visible when the page of results changes.
  const [selectionVisibleIssueIds, setSelectionVisibleIssueIds] = useState(visibleIssueIds);
  if (selectionVisibleIssueIds !== visibleIssueIds) {
    setSelectionVisibleIssueIds(visibleIssueIds);
    setSelectedIssueIds((current) =>
      current.filter((issueId) => visibleIssueIds.includes(issueId)),
    );
  }

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (issueSearch.trim().length > 0) {
      nextParams.set("q", issueSearch);
    } else {
      nextParams.delete("q");
    }

    if (statusFilter !== "open") {
      nextParams.set("status", statusFilter);
    } else {
      nextParams.delete("status");
    }

    if (assignedUserFilter !== "all") {
      nextParams.set("assignedUserId", assignedUserFilter);
    } else {
      nextParams.delete("assignedUserId");
    }

    if (environmentFilter !== "all") {
      nextParams.set("environment", environmentFilter);
    } else {
      nextParams.delete("environment");
    }

    if (releaseFilter !== "all") {
      nextParams.set("release", releaseFilter);
    } else {
      nextParams.delete("release");
    }

    if (regressedFilter !== "all") {
      nextParams.set("isRegressed", regressedFilter);
    } else {
      nextParams.delete("isRegressed");
    }

    if (sortBy !== "lastSeenAt") {
      nextParams.set("sortBy", sortBy);
    } else {
      nextParams.delete("sortBy");
    }

    if (sortDir !== "desc") {
      nextParams.set("sortDir", sortDir);
    } else {
      nextParams.delete("sortDir");
    }

    if (page > 1) {
      nextParams.set("page", String(page));
    } else {
      nextParams.delete("page");
    }

    if (pageSize !== 25) {
      nextParams.set("pageSize", String(pageSize));
    } else {
      nextParams.delete("pageSize");
    }

    if (levelFilter !== "all") {
      nextParams.set("level", levelFilter);
    } else {
      nextParams.delete("level");
    }

    const current = searchParams.toString();
    const next = nextParams.toString();

    if (current !== next) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    assignedUserFilter,
    environmentFilter,
    issueSearch,
    levelFilter,
    page,
    pageSize,
    regressedFilter,
    releaseFilter,
    searchParams,
    setSearchParams,
    sortBy,
    sortDir,
    statusFilter,
  ]);

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
    const visibleIds = issues.map((issue) => issue.id);
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

  const updateSearch = (value: string) => {
    setIssueSearch(value);
    setPage(1);
  };

  const updateStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const updateLevelFilter = (value: string) => {
    setLevelFilter(value);
    setPage(1);
  };

  const updateAssignedUserFilter = (value: string) => {
    setAssignedUserFilter(value);
    setPage(1);
  };

  const updateRegressedFilter = (value: string) => {
    setRegressedFilter(value);
    setPage(1);
  };

  const updateEnvironmentFilter = (value: string) => {
    setEnvironmentFilter(value);
    setPage(1);
  };

  const updateReleaseFilter = (value: string) => {
    setReleaseFilter(value);
    setPage(1);
  };

  const updateSortBy = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const updateSortDir = (value: string) => {
    setSortDir(value);
    setPage(1);
  };

  const toggleSort = (nextSortBy: string) => {
    if (sortBy === nextSortBy) {
      updateSortDir(sortDir === "desc" ? "asc" : "desc");
      return;
    }

    setSortBy(nextSortBy);
    setSortDir("desc");
    setPage(1);
  };

  const updatePageSize = (value: string) => {
    const nextPageSize = Number(value);
    if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) {
      return;
    }

    setPageSize(nextPageSize);
    setPage(1);
  };

  const applySavedSearch = (search: SavedIssueSearch) => {
    setIssueSearch(search.filters.q);
    setStatusFilter(search.filters.status);
    setLevelFilter(search.filters.level);
    setAssignedUserFilter(search.filters.assignedUserId);
    setEnvironmentFilter(search.filters.environment);
    setReleaseFilter(search.filters.release);
    setRegressedFilter(search.filters.isRegressed);
    setSortBy(search.filters.sortBy);
    setSortDir(search.filters.sortDir);
    setPageSize(search.filters.pageSize);
    setPage(1);
  };

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

  const clearIssueFilters = () => {
    setIssueSearch("");
    setStatusFilter("open");
    setLevelFilter("all");
    setAssignedUserFilter("all");
    setEnvironmentFilter("all");
    setReleaseFilter("all");
    setRegressedFilter("all");
    setSortBy("lastSeenAt");
    setSortDir("desc");
    setPageSize(25);
    setPage(1);
  };

  const applyInboxPreset = (preset: "incoming" | "unassigned" | "regressed" | "resolved") => {
    setIssueSearch("");
    setLevelFilter("all");
    setEnvironmentFilter("all");
    setReleaseFilter("all");
    setSortBy("lastSeenAt");
    setSortDir("desc");
    setPage(1);

    if (preset === "incoming") {
      setStatusFilter("open");
      setAssignedUserFilter("all");
      setRegressedFilter("all");
      return;
    }

    if (preset === "unassigned") {
      setStatusFilter("open");
      setAssignedUserFilter("__unassigned__");
      setRegressedFilter("all");
      return;
    }

    if (preset === "regressed") {
      setStatusFilter("open");
      setAssignedUserFilter("all");
      setRegressedFilter("true");
      return;
    }

    setStatusFilter("resolved");
    setAssignedUserFilter("all");
    setRegressedFilter("all");
  };

  return {
    activeSecondaryFilterCount,
    allMatchingSelected,
    canSelectAllMatching: totalIssues <= MAX_BULK_MATCHING_ISSUES,
    applyInboxPreset,
    applySavedSearch,
    assignedUserFilter,
    bulkAssigneeValue,
    bulkSetAssignee,
    bulkSetStatus,
    bulkUpdateIssueAssigneeMutation,
    bulkUpdateIssueStatusMutation,
    clearIssueFilters,
    clearSelection,
    currentFilterSnapshot,
    environmentFilter,
    hasActiveFilters,
    isFetchingIssues: issuesQuery.isFetching && issuesQuery.isPlaceholderData,
    isLoadingIssues: issuesQuery.isLoading,
    issueHref,
    issueSearch,
    issues,
    issuesError: issuesQuery.isError && !issuesPage && !searchError ? issuesQuery.error : null,
    levelFilter,
    memberByUserId,
    members,
    navigate,
    pageSize,
    projectEnvironments,
    projectReleases,
    regressedFilter,
    searchError,
    releaseFilter,
    removeSavedSearch,
    retryIssues: () => void issuesQuery.refetch(),
    safePage,
    saveCurrentSearch,
    savedSearchName,
    savedSearches,
    saveSearchOpen,
    selectedIssueIds,
    allVisibleSelected,
    selectAllMatching,
    selectedCount,
    selectedIssueIdSet: effectiveSelectedIdSet,
    setBulkAssigneeValue,
    setPage,
    setSavedSearchName,
    setSaveSearchOpen,
    sortBy,
    sortDir,
    statusFilter,
    toggleIssueSelection,
    toggleSort,
    toggleVisibleIssues,
    totalIssuePages,
    totalIssues,
    updateAssignedUserFilter,
    updateEnvironmentFilter,
    updateLevelFilter,
    updatePageSize,
    updateRegressedFilter,
    updateReleaseFilter,
    updateSearch,
    updateSortBy,
    updateSortDir,
    updateStatusFilter,
  };
}

export { useProjectIssues };
