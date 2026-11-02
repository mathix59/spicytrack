import { ArrowUpRight, PackageOpen } from "lucide-react";

import type { IssueDto } from "@/generated/api";
import { Badge } from "@/components/ui/badge";

function ReleaseIssuesSection({
  issues,
  onOpenIssue,
}: {
  issues: IssueDto[];
  onOpenIssue: (issueId: string) => void;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center gap-2">
        <PackageOpen className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Affected issues</h3>
        <Badge variant="muted">{issues.length}</Badge>
      </div>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues linked to this release yet.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {issues.map((issue) => (
            <li className="border-b border-border last:border-b-0" key={issue.id}>
              <button
                className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                onClick={() => onOpenIssue(issue.id)}
                type="button"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{issue.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {issue.level} · {issue.timesSeen} events
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">{issue.status}</span>
                  <ArrowUpRight className="size-3.5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { ReleaseIssuesSection };
