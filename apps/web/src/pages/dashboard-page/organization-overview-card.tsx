import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EventVolumeChart } from "@/components/charts/event-volume-chart";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type OrganizationListItemDto, useGetOrganizationOverview } from "@/generated/api";
import { cn } from "@/lib/utils";

import { NeedsAttentionPanel } from "./needs-attention-panel";
import { compareProjectActivity } from "./project-activity";
import { ProjectOverviewRow } from "./project-overview-row";

/** The dashboard lists the busiest projects; the organization page lists them all. */
const DASHBOARD_PROJECT_LIMIT = 8;

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

function OrganizationOverviewCard({ organization }: { organization: OrganizationListItemDto }) {
  const overviewQuery = useGetOrganizationOverview(organization.slug);
  const overview = overviewQuery.data?.data;
  const projects = [...(overview?.projects ?? [])].sort(compareProjectActivity);
  const visibleProjects = projects.slice(0, DASHBOARD_PROJECT_LIMIT);
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
            <Metric label="Events · 24h" value={overview.eventCount24h} />
            <Metric
              hint={`${overview.newIssueCount24h.toLocaleString()} new · ${overview.resolvedIssueCount24h.toLocaleString()} resolved in 24h`}
              label="Open issues"
              value={overview.openIssueCount}
            />
            <Metric
              hint="Resolved issues that came back"
              label="Regressions"
              tone="warning"
              value={overview.regressedIssueCount}
            />
            <Metric
              hint={`${overview.connectedProjectCount} receiving events`}
              label="Projects"
              value={overview.projectCount}
            />
          </dl>

          <CardContent className="grid items-start gap-6 pt-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <EventVolumeChart counts={overview.eventTrend14d} label="Events · last 14 days" />

            <NeedsAttentionPanel
              organizationId={organization.id}
              orgPath={orgPath}
              overview={overview}
            />
          </CardContent>

          <CardContent className="grid gap-2 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                {projects.length > DASHBOARD_PROJECT_LIMIT ? "Most active projects" : "Projects"}
              </h3>
              {projects.length > DASHBOARD_PROJECT_LIMIT ? (
                <Link
                  className="text-xs font-medium text-primary-accent hover:underline"
                  to={`${orgPath}?tab=projects`}
                >
                  View all {projects.length} projects
                </Link>
              ) : null}
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects yet.{" "}
                <Link className="font-medium text-primary-accent hover:underline" to={orgPath}>
                  Create one
                </Link>
              </p>
            ) : (
              <ul className="-mx-3 grid">
                {visibleProjects.map((project) => (
                  <ProjectOverviewRow
                    key={project.id}
                    orgSlug={organization.slug}
                    project={project}
                    stats={project}
                  />
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
