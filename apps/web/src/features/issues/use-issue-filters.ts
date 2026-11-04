import { useMemo, useState } from "react";

import type { IssueFilterSnapshot, SavedIssueSearch } from "@/features/issues/saved-searches";

import { positiveNumberParam } from "./issue-filters";

type InboxPreset = "incoming" | "unassigned" | "regressed" | "resolved";

/** The issue list's filters, sort and page, initialized from the URL. */
function useIssueFilters(searchParams: URLSearchParams) {
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
  const [page, setPage] = useState(() => positiveNumberParam(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = useState(() =>
    positiveNumberParam(searchParams.get("pageSize"), 25),
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

  const applyInboxPreset = (preset: InboxPreset) => {
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
    applyInboxPreset,
    applySavedSearch,
    assignedUserFilter,
    clearIssueFilters,
    currentFilterSnapshot,
    environmentFilter,
    hasActiveFilters,
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
    toggleSort,
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

export { useIssueFilters };
