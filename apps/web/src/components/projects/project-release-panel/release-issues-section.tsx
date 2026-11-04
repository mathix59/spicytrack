import { ArrowRight, ArrowUpRight, PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

import type { IssueDto } from "@/generated/api";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/pluralize";

import { releaseIssuesHref } from "./utils";

function ReleaseIssuesSection({
  orgSlug,
  projectSlug,
  releaseVersion,
  issues,
  total,
  onOpenIssue,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
  /** The most seen issues of the release. */
  issues: IssueDto[];
  /** Every issue of the release, of which `issues` is the top. */
  total: number;
  onOpenIssue: (issueId: string) => void;
}) {
  const hasMore = total > issues.length;

  return (
    <section className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PackageOpen className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Affected issues</h3>
        <Badge variant="muted">{total.toLocaleString("en")}</Badge>
        {hasMore ? (
          <span className="text-xs text-muted-foreground">Top {issues.length} by events</span>
        ) : null}
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
                    {issue.level} · {pluralize(issue.timesSeen, "event")}
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
      {hasMore ? (
        <Link
          className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-primary-accent hover:underline"
          to={releaseIssuesHref(orgSlug, projectSlug, releaseVersion)}
        >
          View all {total.toLocaleString("en")} in Issues
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
    </section>
  );
}

export { ReleaseIssuesSection };
