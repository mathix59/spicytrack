import { ExternalLink, Hash, Layers3, RadioTower } from "lucide-react";

import { AutofixRunsCard } from "@/components/autofix/autofix-runs-card";
import { IssueTriageCard } from "@/components/issues/issue-triage-card";
import { SurfaceRow } from "@/components/issues/issue-metadata";
import { PriorityControl } from "@/components/issues/issue-status-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { renderNullableText } from "@/lib/utils";

import type { IssueDto } from "@/generated/api";

import type { IssueSidebarState } from "./types";
import { formatTimelineDate } from "./utils";

function IssueSidebar({
  orgSlug,
  projectSlug,
  issueId,
  issue,
  totalEvents,
  sidebar,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  issue: IssueDto;
  totalEvents: number;
  sidebar: IssueSidebarState;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Details</CardTitle>
            <span className="text-xs text-muted-foreground">Issue metadata</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5 rounded-lg border border-border bg-muted/15 p-3">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Assignee
            </label>
            <Select
              aria-label="Assignee"
              disabled={sidebar.isUpdatingAssignee}
              onChange={(event) => void sidebar.updateAssignee(event.target.value)}
              value={issue.assignedUserId ?? ""}
            >
              <option value="">Unassigned</option>
              {sidebar.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {renderNullableText(member.name, member.email)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5 rounded-lg border border-border bg-muted/15 p-3">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Priority
            </label>
            <PriorityControl
              disabled={sidebar.isUpdatingPriority}
              onChange={sidebar.updatePriority}
              value={issue.priority}
            />
          </div>
          <div className="grid gap-2 border-t border-border pt-3">
            <SurfaceRow
              icon={RadioTower}
              label="Last seen"
              value={formatTimelineDate(issue.lastSeenAt)}
            />
            <SurfaceRow
              icon={Layers3}
              label="First seen"
              value={formatTimelineDate(issue.firstSeenAt)}
            />
            <SurfaceRow icon={Hash} label="Events" value={String(totalEvents)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="grid gap-2" onSubmit={sidebar.updateExternalLink}>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              External ticket URL
            </label>
            <div className="flex gap-2">
              <Input
                defaultValue={issue.externalIssueUrl ?? ""}
                name="externalIssueUrl"
                placeholder="https://linear.app/..."
                type="url"
              />
              <Button disabled={sidebar.isUpdatingWorkflow} size="sm" type="submit">
                Save
              </Button>
              {issue.externalIssueUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={issue.externalIssueUrl} rel="noreferrer" target="_blank">
                    <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
          </form>
          {issue.mergedIntoIssueId ? (
            <Button
              disabled={sidebar.isUpdatingWorkflow}
              onClick={() => void sidebar.unmergeIssue()}
            >
              Separate future events
            </Button>
          ) : (
            <form className="grid gap-2" onSubmit={sidebar.mergeIssue}>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Merge into issue ID
              </label>
              <div className="flex gap-2">
                <Input aria-label="Merge into issue ID" name="targetIssueId" required />
                <Button disabled={sidebar.isUpdatingWorkflow} type="submit" variant="secondary">
                  Merge
                </Button>
              </div>
            </form>
          )}
          {sidebar.workflowError ? (
            <Alert variant="destructive">
              <AlertDescription>{sidebar.workflowError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <IssueTriageCard issueId={issueId} orgSlug={orgSlug} projectSlug={projectSlug} />

      <AutofixRunsCard issueId={issueId} orgSlug={orgSlug} projectSlug={projectSlug} />

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {sidebar.timelineEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            sidebar.timelineEntries.map((entry) => (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2" key={entry.id}>
                <p className="text-sm">{entry.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.actor} · {formatTimelineDate(entry.createdAt)}
                </p>
                {entry.body ? (
                  <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {entry.body}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { IssueSidebar };
