import { Bookmark, BookmarkPlus, FilterX, Search, SlidersHorizontal } from "lucide-react";

import type {
  OrganizationMemberDto,
  ProjectEnvironmentDto,
  ProjectReleaseDto,
} from "@/generated/api";
import {
  buildSuggestedSavedSearchName,
  describeFilterSnapshot,
  type IssueFilterSnapshot,
  type SavedIssueSearch,
} from "@/features/issues/saved-searches";
import { InboxPresetChip } from "@/components/projects/issue-table-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { renderNullableText } from "@/lib/utils";

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
  applyInboxPreset: (preset: "incoming" | "unassigned" | "regressed" | "resolved") => void;
  savedSearches: SavedIssueSearch[];
  applySavedSearch: (search: SavedIssueSearch) => void;
  removeSavedSearch: (id: string) => void;
  clearIssueFilters: () => void;
  setSaveSearchOpen: (open: boolean) => void;
  activeSecondaryFilterCount: number;
  updateSearch: (value: string) => void;
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
  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-0.5 pb-1 sm:flex-nowrap sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
          <InboxPresetChip
            active={
              statusFilter === "open" &&
              assignedUserFilter === "all" &&
              regressedFilter === "all" &&
              issueSearch.length === 0
            }
            label="Incoming"
            onClick={() => applyInboxPreset("incoming")}
          />
          <InboxPresetChip
            active={statusFilter === "open" && assignedUserFilter === "__unassigned__"}
            label="Unassigned"
            onClick={() => applyInboxPreset("unassigned")}
          />
          <InboxPresetChip
            active={statusFilter === "open" && regressedFilter === "true"}
            label="Regressions"
            onClick={() => applyInboxPreset("regressed")}
          />
          <InboxPresetChip
            active={statusFilter === "resolved"}
            label="Resolved"
            onClick={() => applyInboxPreset("resolved")}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Saved views" size="sm" type="button" variant="ghost">
                <Bookmark className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {savedSearches.length > 0 ? (
                <>
                  <DropdownMenuLabel>Saved views</DropdownMenuLabel>
                  {savedSearches.map((search) => (
                    <DropdownMenuItem
                      className="flex items-center gap-3"
                      key={search.id}
                      onClick={() => applySavedSearch(search)}
                    >
                      <span className="min-w-0 flex-1 truncate">{search.name}</span>
                      <button
                        aria-label={`Remove saved view ${search.name}`}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeSavedSearch(search.id);
                        }}
                        type="button"
                      >
                        <FilterX className="size-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem onClick={() => setSaveSearchOpen(true)}>
                <BookmarkPlus className="size-4" />
                Save current view
              </DropdownMenuItem>
              <DropdownMenuItem onClick={clearIssueFilters}>
                <FilterX className="size-4" />
                Reset filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative col-span-2 w-full sm:min-w-[220px] sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search issues"
              className="pl-9"
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search issues"
              value={issueSearch}
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <Select
              aria-label="Status"
              onChange={(event) => updateStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="open">open</option>
              <option value="resolved">resolved</option>
              <option value="ignored">ignored</option>
            </Select>
          </div>
          <div className="w-full sm:w-[140px]">
            <Select
              aria-label="Level"
              onChange={(event) => updateLevelFilter(event.target.value)}
              value={levelFilter}
            >
              <option value="all">All levels</option>
              <option value="fatal">fatal</option>
              <option value="error">error</option>
              <option value="warning">warning</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="col-span-2 w-full sm:w-auto" type="button" variant="secondary">
                <SlidersHorizontal className="size-4" />
                Filters
                {activeSecondaryFilterCount > 0 ? (
                  <Badge variant="accent">{activeSecondaryFilterCount}</Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="grid w-72 gap-3 p-3">
              <Field label="Assignee">
                <Select
                  onChange={(event) => updateAssignedUserFilter(event.target.value)}
                  value={assignedUserFilter}
                >
                  <option value="all">All assignees</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {renderNullableText(member.name, member.email)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Environment">
                <Select
                  onChange={(event) => updateEnvironmentFilter(event.target.value)}
                  value={environmentFilter}
                >
                  <option value="all">All environments</option>
                  {projectEnvironments.map((environment) => (
                    <option key={environment.id} value={environment.name}>
                      {environment.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Release">
                <Select
                  onChange={(event) => updateReleaseFilter(event.target.value)}
                  value={releaseFilter}
                >
                  <option value="all">All releases</option>
                  {projectReleases.map((release) => (
                    <option key={release.id} value={release.version}>
                      {release.version}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Regression">
                <Select
                  onChange={(event) => updateRegressedFilter(event.target.value)}
                  value={regressedFilter}
                >
                  <option value="all">All issues</option>
                  <option value="true">Regressed only</option>
                  <option value="false">No regression</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sort by">
                  <Select onChange={(event) => updateSortBy(event.target.value)} value={sortBy}>
                    <option value="lastSeenAt">Last seen</option>
                    <option value="firstSeenAt">First seen</option>
                    <option value="timesSeen">Times seen</option>
                  </Select>
                </Field>
                <Field label="Order">
                  <Select onChange={(event) => updateSortDir(event.target.value)} value={sortDir}>
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </Select>
                </Field>
              </div>
              <Field label="Page size">
                <Select
                  onChange={(event) => updatePageSize(event.target.value)}
                  value={String(pageSize)}
                >
                  <option value="10">10 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </Select>
              </Field>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog onOpenChange={setSaveSearchOpen} open={saveSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>{describeFilterSnapshot(currentFilterSnapshot)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="View name">
              <Input
                onChange={(event) => setSavedSearchName(event.target.value)}
                placeholder={buildSuggestedSavedSearchName(currentFilterSnapshot)}
                value={savedSearchName}
              />
            </Field>
          </div>
          <FormDialogActions
            buttonType="button"
            isPending={savedSearchName.trim().length === 0}
            onSubmitClick={saveCurrentSearch}
            submitLabel="Save view"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export { InboxToolbar };
