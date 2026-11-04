import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";

import {
  useListIssues,
  useListOrganizationMembers,
  useListProjectEnvironments,
  useListProjectReleases,
} from "@/generated/api";
import { issueListContext, withIssueListContext } from "@/features/issues/issue-list-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getErrorMessage } from "@/lib/utils";

import { MAX_BULK_MATCHING_ISSUES } from "./issue-filters";
import { useIssueFilters } from "./use-issue-filters";
import { useIssueFiltersUrlSync } from "./use-issue-filters-url-sync";
import { useIssueSavedSearches } from "./use-issue-saved-searches";
import { useIssueSelection } from "./use-issue-selection";

const SEARCH_DEBOUNCE_MS = 250;

type ProjectIssuesOptions = { orgSlug: string; projectSlug: string };

function useProjectIssues({ orgSlug, projectSlug }: ProjectIssuesOptions) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useIssueFilters(searchParams);
  const {
    assignedUserFilter,
    environmentFilter,
    issueSearch,
    levelFilter,
    page,
    pageSize,
    regressedFilter,
    releaseFilter,
    setPage,
    sortBy,
    sortDir,
    statusFilter,
  } = filters;
  const savedSearchesState = useIssueSavedSearches({
    orgSlug,
    projectSlug,
    currentFilterSnapshot: filters.currentFilterSnapshot,
  });
  const environmentsQuery = useListProjectEnvironments(orgSlug, projectSlug);
  const releasesQuery = useListProjectReleases(orgSlug, projectSlug);
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

  const projectEnvironments = environmentsQuery.data?.data ?? [];
  const projectReleases = releasesQuery.data?.data ?? [];
  const issuesPage = issuesQuery.data?.data;
  const issues = useMemo(() => issuesPage?.items ?? [], [issuesPage]);
  const totalIssues = issuesPage?.total ?? 0;
  const members = useMemo(() => membersQuery.data?.data ?? [], [membersQuery.data]);
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const visibleIssueIds = useMemo(
    () => (issuesPage?.items ?? []).map((issue) => issue.id),
    [issuesPage],
  );
  const totalIssuePages = issuesPage ? Math.max(1, Math.ceil(totalIssues / pageSize)) : page;
  // Missing or retained data is not a response for the requested page yet.
  const safePage =
    !issuesPage || issuesQuery.isPlaceholderData ? page : Math.min(page, totalIssuePages);

  // Applied filters only: a half-typed search does not count until the list shows its results.
  const listContext = issueListContext(searchParams);
  if (deferredIssueSearch.trim()) listContext.set("q", deferredIssueSearch);
  else listContext.delete("q");
  const listContextKey = listContext.toString();
  const issueHref = (issueId: string) =>
    withIssueListContext(`/orgs/${orgSlug}/projects/${projectSlug}/issues/${issueId}`, listContext);

  // Clamp an out-of-range page during render so the URL and query only ever see the safe page.
  if (page !== safePage) {
    setPage(safePage);
  }

  const selection = useIssueSelection({
    orgSlug,
    projectSlug,
    listContext,
    listContextKey,
    totalIssues,
    visibleIssueIds,
  });

  useIssueFiltersUrlSync({
    searchParams,
    setSearchParams,
    filters: filters.currentFilterSnapshot,
    page,
  });

  return {
    activeSecondaryFilterCount: filters.activeSecondaryFilterCount,
    allMatchingSelected: selection.allMatchingSelected,
    canSelectAllMatching: totalIssues <= MAX_BULK_MATCHING_ISSUES,
    applyInboxPreset: filters.applyInboxPreset,
    applySavedSearch: filters.applySavedSearch,
    assignedUserFilter,
    bulkAssigneeValue: selection.bulkAssigneeValue,
    bulkSetAssignee: selection.bulkSetAssignee,
    bulkSetStatus: selection.bulkSetStatus,
    bulkUpdateIssueAssigneeMutation: selection.bulkUpdateIssueAssigneeMutation,
    bulkUpdateIssueStatusMutation: selection.bulkUpdateIssueStatusMutation,
    clearIssueFilters: filters.clearIssueFilters,
    clearSelection: selection.clearSelection,
    currentFilterSnapshot: filters.currentFilterSnapshot,
    environmentFilter,
    hasActiveFilters: filters.hasActiveFilters,
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
    removeSavedSearch: savedSearchesState.removeSavedSearch,
    retryIssues: () => void issuesQuery.refetch(),
    safePage,
    saveCurrentSearch: savedSearchesState.saveCurrentSearch,
    savedSearchName: savedSearchesState.savedSearchName,
    savedSearches: savedSearchesState.savedSearches,
    saveSearchOpen: savedSearchesState.saveSearchOpen,
    selectedIssueIds: selection.selectedIssueIds,
    allVisibleSelected: selection.allVisibleSelected,
    selectAllMatching: selection.selectAllMatching,
    selectedCount: selection.selectedCount,
    selectedIssueIdSet: selection.selectedIssueIdSet,
    setBulkAssigneeValue: selection.setBulkAssigneeValue,
    setPage,
    setSavedSearchName: savedSearchesState.setSavedSearchName,
    setSaveSearchOpen: savedSearchesState.setSaveSearchOpen,
    sortBy,
    sortDir,
    statusFilter,
    toggleIssueSelection: selection.toggleIssueSelection,
    toggleSort: filters.toggleSort,
    toggleVisibleIssues: selection.toggleVisibleIssues,
    totalIssuePages,
    totalIssues,
    updateAssignedUserFilter: filters.updateAssignedUserFilter,
    updateEnvironmentFilter: filters.updateEnvironmentFilter,
    updateLevelFilter: filters.updateLevelFilter,
    updatePageSize: filters.updatePageSize,
    updateRegressedFilter: filters.updateRegressedFilter,
    updateReleaseFilter: filters.updateReleaseFilter,
    updateSearch: filters.updateSearch,
    updateSortBy: filters.updateSortBy,
    updateSortDir: filters.updateSortDir,
    updateStatusFilter: filters.updateStatusFilter,
  };
}

export { useProjectIssues };
