import { useProjectIssues } from "@/features/issues/use-project-issues";
import { Card, CardContent } from "@/components/ui/card";

import { BulkIssueActions } from "./project-observability-tab/bulk-issue-actions";
import { InboxToolbar } from "./project-observability-tab/inbox-toolbar";
import { IssuesTable } from "./project-observability-tab/issues-table";

type ProjectObservabilityTabProps = { orgSlug: string; projectSlug: string };

function ProjectObservabilityTab({ orgSlug, projectSlug }: ProjectObservabilityTabProps) {
  const issues = useProjectIssues({ orgSlug, projectSlug });

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <InboxToolbar
            activeSecondaryFilterCount={issues.activeSecondaryFilterCount}
            applyInboxPreset={issues.applyInboxPreset}
            applySavedSearch={issues.applySavedSearch}
            assignedUserFilter={issues.assignedUserFilter}
            clearIssueFilters={issues.clearIssueFilters}
            currentFilterSnapshot={issues.currentFilterSnapshot}
            environmentFilter={issues.environmentFilter}
            issueSearch={issues.issueSearch}
            levelFilter={issues.levelFilter}
            members={issues.members}
            pageSize={issues.pageSize}
            projectEnvironments={issues.projectEnvironments}
            projectReleases={issues.projectReleases}
            regressedFilter={issues.regressedFilter}
            releaseFilter={issues.releaseFilter}
            removeSavedSearch={issues.removeSavedSearch}
            saveCurrentSearch={issues.saveCurrentSearch}
            savedSearchName={issues.savedSearchName}
            saveSearchOpen={issues.saveSearchOpen}
            savedSearches={issues.savedSearches}
            setSavedSearchName={issues.setSavedSearchName}
            setSaveSearchOpen={issues.setSaveSearchOpen}
            sortBy={issues.sortBy}
            sortDir={issues.sortDir}
            statusFilter={issues.statusFilter}
            updateAssignedUserFilter={issues.updateAssignedUserFilter}
            updateEnvironmentFilter={issues.updateEnvironmentFilter}
            updateLevelFilter={issues.updateLevelFilter}
            updatePageSize={issues.updatePageSize}
            updateRegressedFilter={issues.updateRegressedFilter}
            updateReleaseFilter={issues.updateReleaseFilter}
            updateSearch={issues.updateSearch}
            updateSortBy={issues.updateSortBy}
            updateSortDir={issues.updateSortDir}
            updateStatusFilter={issues.updateStatusFilter}
          />

          <BulkIssueActions
            bulkAssigneeValue={issues.bulkAssigneeValue}
            bulkIssueError={issues.bulkIssueError}
            bulkSetAssignee={issues.bulkSetAssignee}
            bulkSetStatus={issues.bulkSetStatus}
            isUpdatingAssignee={issues.bulkUpdateIssueAssigneeMutation.isPending}
            isUpdatingStatus={issues.bulkUpdateIssueStatusMutation.isPending}
            members={issues.members}
            selectedIssueIds={issues.selectedIssueIds}
            setBulkAssigneeValue={issues.setBulkAssigneeValue}
          />

          <IssuesTable
            issues={issues.issues}
            memberByUserId={issues.memberByUserId}
            navigateToIssue={(issueId) =>
              issues.navigate(`/orgs/${orgSlug}/projects/${projectSlug}/issues/${issueId}`)
            }
            safePage={issues.safePage}
            selectedIssueIdSet={issues.selectedIssueIdSet}
            setPage={issues.setPage}
            sortBy={issues.sortBy}
            sortDir={issues.sortDir}
            toggleIssueSelection={issues.toggleIssueSelection}
            toggleSort={issues.toggleSort}
            toggleVisibleIssues={issues.toggleVisibleIssues}
            totalIssuePages={issues.totalIssuePages}
            totalIssues={issues.totalIssues}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { ProjectObservabilityTab };
