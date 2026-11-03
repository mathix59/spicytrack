import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import { AutofixRunsCard } from "@/components/autofix/autofix-runs-card";
import { IssueTriageCard } from "@/components/issues/issue-triage-card";
import { PriorityControl } from "@/components/issues/issue-status-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import type { IssueDto } from "@/generated/api";
import { formatRelativeTime, renderNullableText } from "@/lib/utils";

import type { IssueSidebarState } from "./types";
import { formatTimelineDate } from "./utils";

function PropertyRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function IssueSidebar({
  orgSlug,
  projectSlug,
  issueId,
  issue,
  sidebar,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  issue: IssueDto;
  sidebar: IssueSidebarState;
}) {
  return (
    <aside aria-label="Issue properties" className="grid min-w-0 gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <PropertyRow htmlFor="issue-assignee" label="Assignee">
            <Combobox
              disabled={sidebar.isUpdatingAssignee}
              emptyText="No matching member."
              id="issue-assignee"
              onChange={(value) => void sidebar.updateAssignee(value)}
              options={[
                { value: "", label: "Unassigned" },
                ...sidebar.members.map((member) => ({
                  value: member.userId,
                  label: renderNullableText(member.name, member.email),
                  description: member.name ? member.email : undefined,
                })),
              ]}
              searchPlaceholder="Search members…"
              value={issue.assignedUserId ?? ""}
            />
          </PropertyRow>
          <PropertyRow label="Priority">
            <div>
              <PriorityControl
                disabled={sidebar.isUpdatingPriority}
                onChange={sidebar.updatePriority}
                value={issue.priority}
              />
            </div>
          </PropertyRow>
          <form className="grid gap-1.5" onSubmit={sidebar.updateExternalLink}>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="issue-ticket">
              External ticket
            </label>
            <div className="flex gap-2">
              <Input
                defaultValue={issue.externalIssueUrl ?? ""}
                id="issue-ticket"
                key={issue.externalIssueUrl ?? ""}
                name="externalIssueUrl"
                placeholder="https://linear.app/…"
                type="url"
              />
              {issue.externalIssueUrl ? (
                <Button asChild size="icon" variant="secondary">
                  <a
                    aria-label="Open external ticket"
                    href={issue.externalIssueUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
            <Button
              className="justify-self-start"
              disabled={sidebar.isUpdatingWorkflow}
              size="sm"
              type="submit"
              variant="secondary"
            >
              Save link
            </Button>
          </form>
          <details className="group border-t border-border pt-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Merge
            </summary>
            <div className="mt-3">
              {issue.mergedIntoIssueId ? (
                <Button
                  disabled={sidebar.isUpdatingWorkflow}
                  onClick={() => void sidebar.unmergeIssue()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Unmerge issue
                </Button>
              ) : (
                <form className="grid gap-1.5" onSubmit={sidebar.mergeIssue}>
                  <label className="text-xs text-muted-foreground" htmlFor="issue-merge-target">
                    Move this issue's events into another issue of this project.
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="issue-merge-target"
                      name="targetIssueId"
                      placeholder="Target issue ID"
                      required
                    />
                    <Button
                      disabled={sidebar.isUpdatingWorkflow}
                      size="sm"
                      type="submit"
                      variant="secondary"
                    >
                      Merge
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </details>
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
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {sidebar.timelineEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="relative grid gap-4 border-l border-border pl-4">
              {sidebar.timelineEntries.map((entry) => (
                <li className="relative min-w-0" key={entry.id}>
                  <span className="absolute top-1.5 -left-[21px] size-2 rounded-full border-2 border-card bg-muted-foreground" />
                  <p className="text-sm">{entry.label}</p>
                  <p
                    className="mt-0.5 text-xs text-muted-foreground"
                    title={formatTimelineDate(entry.createdAt)}
                  >
                    {entry.actor} · {formatRelativeTime(entry.createdAt)}
                  </p>
                  {entry.body ? (
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {entry.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

export { IssueSidebar };
