import { useState } from "react";
import { HeartPulse } from "lucide-react";

import { GetReleaseHealthPeriod, useGetReleaseHealth } from "@/generated/api";
import { SessionHealthChart } from "@/components/charts/session-health-chart";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { formatRate, healthVariant } from "./release-health-utils";

/** Same period as the crash-free rates in the release list, so the two numbers agree. */
const DEFAULT_PERIOD: GetReleaseHealthPeriod = "7d";

const PERIOD_OPTIONS = Object.values(GetReleaseHealthPeriod).map((value) => ({
  value,
  label: value,
}));

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md border border-border px-3 py-2">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-pretty text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function ReleaseHealthSection({
  orgSlug,
  projectSlug,
  releaseVersion,
  environments,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
  /** Environments that reported sessions, for the filter. */
  environments: string[];
}) {
  const [period, setPeriod] = useState<GetReleaseHealthPeriod>(DEFAULT_PERIOD);
  const [environment, setEnvironment] = useState("");
  const healthQuery = useGetReleaseHealth(orgSlug, projectSlug, releaseVersion, {
    period,
    ...(environment ? { environment } : {}),
  });
  const health = healthQuery.data?.data;
  const totals = health?.totals;

  return (
    <section className="grid gap-3" data-testid="release-health">
      <div className="flex flex-wrap items-center gap-2">
        <HeartPulse className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Health</h3>
        {totals && totals.sessions > 0 ? (
          <Badge variant={healthVariant(totals.crashFreeSessions)}>
            {formatRate(totals.crashFreeSessions)} crash-free ({period})
          </Badge>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {environments.length > 0 ? (
            <Select
              aria-label="Environment"
              className="h-8 text-xs"
              onChange={(event) => setEnvironment(event.target.value)}
              value={environment}
            >
              <option value="">All environments</option>
              {environments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          ) : null}
          <SegmentedControl<GetReleaseHealthPeriod>
            label="Health period"
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            value={period}
          />
        </div>
      </div>

      {healthQuery.isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading release health"
          className="grid gap-3"
          role="status"
        >
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : healthQuery.error ? (
        <QueryError
          error={healthQuery.error}
          onRetry={() => void healthQuery.refetch()}
          title="Could not load release health"
        />
      ) : !health || !totals || totals.sessions === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sessions in this period. Release health counts SDK sessions: browser SDKs send them by
          default, server SDKs need session tracking turned on, and every session needs a release.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              hint={`${totals.crashed.toLocaleString()} crashed`}
              label="Crash-free sessions"
              value={formatRate(totals.crashFreeSessions)}
            />
            <Stat
              hint={`${totals.users.toLocaleString()} users`}
              label="Crash-free users"
              value={formatRate(totals.crashFreeUsers)}
            />
            <Stat
              hint={`${totals.errored.toLocaleString()} errored · ${totals.abnormal.toLocaleString()} abnormal`}
              label="Sessions"
              value={totals.sessions.toLocaleString()}
            />
            <Stat
              hint="of all sessions"
              label="Adoption"
              value={totals.adoption === null ? "—" : `${Math.round(totals.adoption * 1000) / 10}%`}
            />
          </dl>
          <SessionHealthChart
            interval={health.interval}
            label={health.interval === "hour" ? "Sessions per hour" : "Sessions per day"}
            points={health.series}
          />
        </>
      )}
    </section>
  );
}

export { ReleaseHealthSection };
