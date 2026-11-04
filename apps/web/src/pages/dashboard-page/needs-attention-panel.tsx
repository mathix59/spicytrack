import { RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import type { OrganizationOverviewDto } from "@/generated/api";
import { cn, formatRelativeTime } from "@/lib/utils";

type AttentionIssue = {
  id: string;
  projectSlug: string;
  title: string;
  timesSeen: number;
  /** The time shown next to the issue: first seen for new issues, last seen for regressions. */
  at: string;
};

/** Distinct project slugs in first-appearance order, for the "open in" links. */
function projectSlugsOf(issues: AttentionIssue[]) {
  return [...new Set(issues.map((issue) => issue.projectSlug))];
}

function AttentionSection({
  id,
  icon: Icon,
  iconClassName,
  title,
  emptyText,
  issues,
  orgPath,
  projectListQuery,
  projectListLabel,
}: {
  id: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClassName: string;
  title: string;
  emptyText: string;
  issues: AttentionIssue[];
  orgPath: string;
  /** Issue list filter that matches this section, e.g. `isRegressed=true`. */
  projectListQuery: string;
  projectListLabel: string;
}) {
  const projectSlugs = projectSlugsOf(issues);

  return (
    <section aria-labelledby={id} className="grid content-start gap-1">
      <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground" id={id}>
        <Icon aria-hidden className={cn("size-3.5", iconClassName)} />
        {title}
      </h4>
      {issues.length === 0 ? (
        <p className="py-1.5 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <ul className="-mx-2 grid">
            {issues.map((issue) => (
              <li key={issue.id}>
                <Link
                  className="grid gap-0.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  to={`${orgPath}/projects/${issue.projectSlug}/issues/${issue.id}`}
                >
                  <span className="truncate text-sm">{issue.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {issue.projectSlug} · {issue.timesSeen.toLocaleString()}{" "}
                    {issue.timesSeen === 1 ? "event" : "events"} · {formatRelativeTime(issue.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{projectListLabel}</span>
            {projectSlugs.map((slug) => (
              <Link
                className="font-medium text-primary-accent hover:underline"
                key={slug}
                to={`${orgPath}/projects/${slug}?${projectListQuery}`}
              >
                {slug}
              </Link>
            ))}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * What changed recently and deserves a look: issues first seen in the last 24 hours and
 * regressions, five of each, with links to each project's matching issue list.
 */
function NeedsAttentionPanel({
  organizationId,
  orgPath,
  overview,
}: {
  organizationId: string;
  orgPath: string;
  overview: Pick<OrganizationOverviewDto, "topNewIssues" | "topRegressions">;
}) {
  // An older API omits new issues; treat that as none rather than failing the card.
  const newIssues = (overview.topNewIssues ?? []).map((issue) => ({
    ...issue,
    at: issue.firstSeenAt,
  }));
  const regressions = overview.topRegressions.map((issue) => ({ ...issue, at: issue.lastSeenAt }));
  const headingId = `${organizationId}-attention`;

  return (
    <section aria-labelledby={headingId} className="grid content-start gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium" id={headingId}>
        <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
        Needs attention
      </h3>
      {newIssues.length === 0 && regressions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No new issues or regressions in the last 24 hours.
        </p>
      ) : (
        <>
          <AttentionSection
            emptyText="No new issues in the last 24 hours."
            icon={Sparkles}
            iconClassName="text-primary-accent"
            id={`${organizationId}-new-issues`}
            issues={newIssues}
            orgPath={orgPath}
            projectListLabel="Newest first in"
            projectListQuery="sortBy=firstSeenAt"
            title="New issues · 24h"
          />
          <AttentionSection
            emptyText="No regressions."
            icon={RotateCcw}
            iconClassName="text-warning"
            id={`${organizationId}-regressions`}
            issues={regressions}
            orgPath={orgPath}
            projectListLabel="All regressions in"
            projectListQuery="isRegressed=true"
            title="Regressions"
          />
        </>
      )}
    </section>
  );
}

export { NeedsAttentionPanel };
