import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { formatRelativeTime } from "@/lib/utils";

type ProjectOverviewStats = {
  eventCount24h: number;
  openIssueCount: number;
  eventTrend14d: number[];
  lastEventAt?: string | null;
};

/**
 * One project with its recent activity: 14-day sparkline, events in the last 24 hours and open
 * issues. Shared by the dashboard and the organization's project list. Without `stats` (still
 * loading, or not reported) the numbers show as dashes.
 */
function ProjectOverviewRow({
  orgSlug,
  project,
  stats,
}: {
  orgSlug: string;
  project: { name: string; slug: string; platform: string | null; status: string };
  stats?: ProjectOverviewStats;
}) {
  const total = stats?.eventTrend14d.reduce((sum, count) => sum + count, 0) ?? 0;
  const lastEventAt = stats?.lastEventAt;
  const isArchived = project.status !== "active";

  return (
    <li>
      <Link
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5rem_5rem_1rem]"
        to={`/orgs/${orgSlug}/projects/${project.slug}`}
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{project.name}</span>
            {isArchived ? <Badge variant="muted">{project.status}</Badge> : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {project.platform}
            {lastEventAt ? ` · last event ${formatRelativeTime(lastEventAt)}` : ""}
          </span>
        </span>
        {stats ? (
          <Sparkline
            className="hidden h-7 sm:block"
            label={`${total} events in the last 14 days`}
            tone={total === 0 ? "muted" : "primary"}
            values={stats.eventTrend14d}
            variant="area"
          />
        ) : (
          <span aria-hidden="true" className="hidden sm:block" />
        )}
        <span className="hidden text-right text-sm tabular-nums sm:block">
          {stats ? stats.eventCount24h.toLocaleString() : "—"}
          <span className="block text-xs text-muted-foreground">24h</span>
        </span>
        <span className="text-right text-sm tabular-nums">
          {stats ? stats.openIssueCount.toLocaleString() : "—"}
          <span className="block text-xs text-muted-foreground">open</span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
        />
      </Link>
    </li>
  );
}

export { ProjectOverviewRow, type ProjectOverviewStats };
