import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

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
import type { IssueFilterSnapshot, SavedIssueSearch } from "@/features/issues/saved-searches";
import { getErrorMessage } from "@/lib/utils";

type ProjectIssuesOptions = { orgSlug: string; projectSlug: string };

function useProjectIssues({ orgSlug, projectSlug }: ProjectIssuesOptions) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [bulkIssueError, setBulkIssueError] = useState<string | null>(null);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("");
  const [issueSearch, setIssueSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
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
  const [bulkAssigneeValue, setBulkAssigneeValue] = useState("__placeholder__");
  const environmentsQuery = useListProjectEnvironments(orgSlug, projectSlug);
  const releasesQuery = useListProjectReleases(orgSlug, projectSlug);
  const savedSearchesQuery = useListProjectSavedSearches(orgSlug, projectSlug, {
    query: { enabled: true },
  });
  const deferredIssueSearch = useDeferredValue(issueSearch);
  const issuesQuery = useListIssues(orgSlug, projectSlug, {
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
  } as never);
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
    sortBy !== "lastSeenAt",
    sortDir !== "desc",
    pageSize !== 25,
  ].filter(Boolean).length;
  const totalIssuePages = Math.max(1, Math.ceil(totalIssues / pageSize));
  const safePage = Math.min(page, totalIssuePages);
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

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (issueSearch.trim().length > 0) {
      nextParams.set("q", issueSearch);
    } else {
      nextParams.delete("q");
    }

    if (statusFilter !== "all") {
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

  useEffect(() => {
    setSelectedIssueIds((current) =>
      current.filter((issueId) => visibleIssueIds.includes(issueId)),
    );
  }, [visibleIssueIds]);

  const toggleIssueSelection = (issueId: string) => {
    startTransition(() => {
      setSelectedIssueIds((current) =>
        current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId],
      );
    });
  };

  const toggleVisibleIssues = () => {
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
    if (selectedIssueIds.length === 0) {
      return;
    }

    setBulkIssueError(null);
    try {
      await bulkUpdateIssueStatusMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          issueIds: selectedIssueIds,
          status,
        },
      });
    } catch (caughtError) {
      setBulkIssueError(getErrorMessage(caughtError));
    }
  };

  const bulkSetAssignee = async (assignedUserId: string) => {
    if (selectedIssueIds.length === 0) {
      return;
    }

    setBulkIssueError(null);
    try {
      await bulkUpdateIssueAssigneeMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          issueIds: selectedIssueIds,
          assignedUserId: assignedUserId.length > 0 ? assignedUserId : null,
        },
      });
    } catch (caughtError) {
      setBulkIssueError(getErrorMessage(caughtError));
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
    await deleteSavedSearchMutation.mutateAsync({
      orgSlug,
      projectSlug,
      savedSearchId: searchId,
    });
  };

  const saveCurrentSearch = async () => {
    const trimmedName = savedSearchName.trim();

    if (trimmedName.length === 0) {
      return;
    }

    await createSavedSearchMutation.mutateAsync({
      orgSlug,
      projectSlug,
      data: {
        name: trimmedName,
        filters: currentFilterSnapshot,
      },
    });
    setSavedSearchName("");
    setSaveSearchOpen(false);
  };

  const clearIssueFilters = () => {
    setIssueSearch("");
    setStatusFilter("all");
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
    applyInboxPreset,
    applySavedSearch,
    assignedUserFilter,
    bulkAssigneeValue,
    bulkIssueError,
    bulkSetAssignee,
    bulkSetStatus,
    bulkUpdateIssueAssigneeMutation,
    bulkUpdateIssueStatusMutation,
    clearIssueFilters,
    currentFilterSnapshot,
    environmentFilter,
    issueSearch,
    issues,
    levelFilter,
    memberByUserId,
    members,
    navigate,
    pageSize,
    projectEnvironments,
    projectReleases,
    regressedFilter,
    releaseFilter,
    removeSavedSearch,
    safePage,
    saveCurrentSearch,
    savedSearchName,
    savedSearches,
    saveSearchOpen,
    selectedIssueIds,
    selectedIssueIdSet,
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
