import { ArrowRight, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EventVolumeChart } from "@/components/charts/event-volume-chart";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import {
  type OrganizationListItemDto,
  type OrganizationOverviewProjectDto,
  useGetOrganizationOverview,
} from "@/generated/api";
import { cn, formatRelativeTime } from "@/lib/utils";

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="grid content-start gap-1 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tracking-[-0.02em] tabular-nums",
          tone === "warning" && value > 0 && "text-warning",
        )}
      >
        {value.toLocaleString()}
      </dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function ProjectRow({
  orgSlug,
  project,
}: {
  orgSlug: string;
  project: OrganizationOverviewProjectDto;
}) {
  const total = project.eventTrend14d.reduce((sum, count) => sum + count, 0);

  return (
    <li>
      <Link
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5rem_5rem_1rem]"
        to={`/orgs/${orgSlug}/projects/${project.slug}`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{project.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {project.platform}
            {project.lastEventAt ? ` · last event ${formatRelativeTime(project.lastEventAt)}` : ""}
          </span>
        </span>
        <Sparkline
          className="hidden h-7 sm:block"
          label={`${total} events in the last 14 days`}
          tone={total === 0 ? "muted" : "primary"}
          values={project.eventTrend14d}
          variant="area"
        />
        <span className="hidden text-right text-sm tabular-nums sm:block">
          {project.eventCount24h.toLocaleString()}
          <span className="block text-xs text-muted-foreground">24h</span>
        </span>
        <span className="text-right text-sm tabular-nums">
          {project.openIssueCount.toLocaleString()}
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

function OrganizationOverviewCard({ organization }: { organization: OrganizationListItemDto }) {
  const overviewQuery = useGetOrganizationOverview(organization.slug);
  const overview = overviewQuery.data?.data;
  const projects = overview?.projects ?? [];
  const orgPath = `/orgs/${organization.slug}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border py-4">
        <div className="flex min-w-0 items-center gap-3">
          <CardTitle className="truncate">
            <Link className="transition-colors hover:text-primary-accent" to={orgPath}>
              {organization.name}
            </Link>
          </CardTitle>
          <Badge variant="muted">{organization.role}</Badge>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to={orgPath}>
            Open
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>

      {overviewQuery.isLoading ? (
        <CardContent aria-busy="true" aria-label="Loading overview" className="grid gap-4 pt-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton className="h-16" key={index} />
            ))}
          </div>
          <Skeleton className="h-40" />
        </CardContent>
      ) : null}

      {overviewQuery.isError ? (
        <CardContent className="pt-6">
          <QueryError
            error={overviewQuery.error}
            onRetry={() => void overviewQuery.refetch()}
            title="Could not load this organization's overview"
          />
        </CardContent>
      ) : null}

      {overview ? (
        <>
          <dl className="grid grid-cols-2 divide-border border-b border-border md:grid-cols-4 md:divide-x [&>div]:max-md:odd:border-r [&>div]:max-md:nth-[-n+2]:border-b">
            <Metric
              hint={`${overview.newIssueCount24h} new issues`}
              label="Events · 24h"
              value={overview.eventCount24h}
            />
            <Metric
              hint={`${overview.resolvedIssueCount24h} resolved in 24h`}
              label="Open issues"
              value={overview.openIssueCount}
            />
            <Metric label="Regressions" tone="warning" value={overview.regressedIssueCount} />
            <Metric
              hint={`${overview.connectedProjectCount} receiving events`}
              label="Projects"
              value={overview.projectCount}
            />
          </dl>

          <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <EventVolumeChart counts={overview.eventTrend14d} label="Events · last 14 days" />

            <section
              aria-labelledby={`${organization.id}-regressions`}
              className="grid content-start gap-2"
            >
              <h3
                className="flex items-center gap-2 text-sm font-medium"
                id={`${organization.id}-regressions`}
              >
                <RotateCcw aria-hidden="true" className="size-4 text-warning" />
                Top regressions
              </h3>
              {overview.topRegressions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No regressions. Nice.
                </p>
              ) : (
                <ul className="grid">
                  {overview.topRegressions.map((issue) => (
                    <li key={issue.id}>
                      <Link
                        className="grid gap-0.5 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                        to={`${orgPath}/projects/${issue.projectSlug}/issues/${issue.id}`}
                      >
                        <span className="truncate text-sm">{issue.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {issue.projectSlug} · {issue.timesSeen.toLocaleString()} events ·{" "}
                          {formatRelativeTime(issue.lastSeenAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </CardContent>

          <CardContent className="grid gap-2 border-t border-border pt-4">
            <h3 className="px-3 text-xs font-medium text-muted-foreground">Projects</h3>
            {projects.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">
                No projects yet.{" "}
                <Link className="font-medium text-primary-accent hover:underline" to={orgPath}>
                  Create one
                </Link>
              </p>
            ) : (
              <ul className="-mx-3 grid">
                {projects.map((project) => (
                  <ProjectRow key={project.id} orgSlug={organization.slug} project={project} />
                ))}
              </ul>
            )}
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}

export { OrganizationOverviewCard };
