import { Search } from "lucide-react";

import type {
  OrganizationMemberDto,
  ProjectEnvironmentDto,
  ProjectReleaseDto,
} from "@/generated/api";
import type { IssueFilterSnapshot, SavedIssueSearch } from "@/features/issues/saved-searches";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";

import { ActiveFilterChips } from "./active-filter-chips";
import { activeInboxPreset, INBOX_PRESETS, type InboxPreset } from "./inbox-presets";
import { IssueFiltersPopover } from "./issue-filters-popover";
import { SaveViewDialog } from "./save-view-dialog";
import { SavedViewsMenu } from "./saved-views-menu";
import { SearchSyntaxHelp } from "./search-syntax-help";

function InboxToolbar({
  statusFilter,
  assignedUserFilter,
  regressedFilter,
  issueSearch,
  applyInboxPreset,
  savedSearches,
  applySavedSearch,
  removeSavedSearch,
  clearIssueFilters,
  setSaveSearchOpen,
  activeSecondaryFilterCount,
  updateSearch,
  searchError,
  updateStatusFilter,
  levelFilter,
  updateLevelFilter,
  members,
  updateAssignedUserFilter,
  environmentFilter,
  updateEnvironmentFilter,
  projectEnvironments,
  releaseFilter,
  updateReleaseFilter,
  projectReleases,
  updateRegressedFilter,
  sortBy,
  updateSortBy,
  sortDir,
  updateSortDir,
  pageSize,
  updatePageSize,
  saveSearchOpen,
  currentFilterSnapshot,
  savedSearchName,
  setSavedSearchName,
  saveCurrentSearch,
}: {
  statusFilter: string;
  assignedUserFilter: string;
  regressedFilter: string;
  issueSearch: string;
  applyInboxPreset: (preset: InboxPreset) => void;
  savedSearches: SavedIssueSearch[];
  applySavedSearch: (search: SavedIssueSearch) => void;
  removeSavedSearch: (id: string) => void;
  clearIssueFilters: () => void;
  setSaveSearchOpen: (open: boolean) => void;
  activeSecondaryFilterCount: number;
  updateSearch: (value: string) => void;
  searchError: string | null;
  updateStatusFilter: (value: string) => void;
  levelFilter: string;
  updateLevelFilter: (value: string) => void;
  members: OrganizationMemberDto[];
  updateAssignedUserFilter: (value: string) => void;
  environmentFilter: string;
  updateEnvironmentFilter: (value: string) => void;
  projectEnvironments: ProjectEnvironmentDto[];
  releaseFilter: string;
  updateReleaseFilter: (value: string) => void;
  projectReleases: ProjectReleaseDto[];
  updateRegressedFilter: (value: string) => void;
  sortBy: string;
  updateSortBy: (value: string) => void;
  sortDir: string;
  updateSortDir: (value: string) => void;
  pageSize: number;
  updatePageSize: (value: string) => void;
  saveSearchOpen: boolean;
  currentFilterSnapshot: IssueFilterSnapshot;
  savedSearchName: string;
  setSavedSearchName: (value: string) => void;
  saveCurrentSearch: () => void;
}) {
  const activePreset = activeInboxPreset({
    statusFilter,
    assignedUserFilter,
    regressedFilter,
    issueSearch,
  });

  return (
    <>
      <div className="grid gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <SegmentedControl<InboxPreset>
            className="min-w-0"
            label="Issue views"
            onChange={applyInboxPreset}
            options={INBOX_PRESETS}
            value={activePreset}
          />
          <SavedViewsMenu
            applySavedSearch={applySavedSearch}
            clearIssueFilters={clearIssueFilters}
            removeSavedSearch={removeSavedSearch}
            savedSearches={savedSearches}
            setSaveSearchOpen={setSaveSearchOpen}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-start">
          <div className="col-span-2 w-full sm:min-w-[220px] sm:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-describedby={searchError ? "issue-search-error" : undefined}
                aria-invalid={searchError ? true : undefined}
                aria-label="Search issues"
                className="pr-9 pl-9"
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search issues, or filter: is:unresolved user.email:…"
                value={issueSearch}
              />
              <SearchSyntaxHelp
                onInsert={(term) =>
                  updateSearch(issueSearch.trim() ? `${issueSearch.trim()} ${term}` : term)
                }
              />
            </div>
            {searchError ? (
              <p className="mt-1 text-xs text-destructive" id="issue-search-error" role="alert">
                {searchError}
              </p>
            ) : null}
          </div>
          <div className="w-full sm:w-[150px]">
            <Select
              aria-label="Status"
              onChange={(event) => updateStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </Select>
          </div>
          <div className="w-full sm:w-[140px]">
            <Select
              aria-label="Level"
              onChange={(event) => updateLevelFilter(event.target.value)}
              value={levelFilter}
            >
              <option value="all">All levels</option>
              <option value="fatal">Fatal</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </Select>
          </div>
          <IssueFiltersPopover
            activeSecondaryFilterCount={activeSecondaryFilterCount}
            assignedUserFilter={assignedUserFilter}
            environmentFilter={environmentFilter}
            members={members}
            pageSize={pageSize}
            projectEnvironments={projectEnvironments}
            projectReleases={projectReleases}
            regressedFilter={regressedFilter}
            releaseFilter={releaseFilter}
            sortBy={sortBy}
            sortDir={sortDir}
            updateAssignedUserFilter={updateAssignedUserFilter}
            updateEnvironmentFilter={updateEnvironmentFilter}
            updatePageSize={updatePageSize}
            updateRegressedFilter={updateRegressedFilter}
            updateReleaseFilter={updateReleaseFilter}
            updateSortBy={updateSortBy}
            updateSortDir={updateSortDir}
          />
        </div>
      </div>

      {activeSecondaryFilterCount > 0 ? (
        <ActiveFilterChips
          assignedUserFilter={assignedUserFilter}
          clearIssueFilters={clearIssueFilters}
          environmentFilter={environmentFilter}
          members={members}
          regressedFilter={regressedFilter}
          releaseFilter={releaseFilter}
          updateAssignedUserFilter={updateAssignedUserFilter}
          updateEnvironmentFilter={updateEnvironmentFilter}
          updateRegressedFilter={updateRegressedFilter}
          updateReleaseFilter={updateReleaseFilter}
        />
      ) : null}

      <SaveViewDialog
        currentFilterSnapshot={currentFilterSnapshot}
        saveCurrentSearch={saveCurrentSearch}
        savedSearchName={savedSearchName}
        saveSearchOpen={saveSearchOpen}
        setSavedSearchName={setSavedSearchName}
        setSaveSearchOpen={setSaveSearchOpen}
      />
    </>
  );
}

export { InboxToolbar };
