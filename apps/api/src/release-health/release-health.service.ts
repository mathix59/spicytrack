import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { releaseHealthBuckets, releaseHealthUsers, releases } from "../database/schema";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const RELEASE_HEALTH_PERIODS = {
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "14d": 14 * DAY_MS,
  "30d": 30 * DAY_MS,
};
export type ReleaseHealthPeriod = keyof typeof RELEASE_HEALTH_PERIODS;

const RELEASE_LIMIT = 50;

type Filters = { period?: string; environment?: string };

type Counts = { sessions: number; errored: number; abnormal: number; crashed: number };

export function parseHealthFilters(filters: Filters) {
  const period = (filters.period ?? "24h") as ReleaseHealthPeriod;
  if (!(period in RELEASE_HEALTH_PERIODS)) {
    throw new BadRequestException(
      `period must be one of ${Object.keys(RELEASE_HEALTH_PERIODS).join(", ")}`,
    );
  }
  const environment = filters.environment?.trim() || null;
  return { period, environment };
}

/** Share of sessions or users that did not crash, or null when there is nothing to measure. */
export function crashFreeRate(total: number, crashed: number) {
  return total > 0 ? Math.max(0, (total - crashed) / total) : null;
}

/** Start of the period, aligned so the first hour or day bucket is complete. */
export function periodStart(period: ReleaseHealthPeriod, now = new Date()) {
  const step = period === "24h" ? HOUR_MS : DAY_MS;
  return new Date(Math.floor(now.getTime() / step) * step - RELEASE_HEALTH_PERIODS[period] + step);
}

function healthFigures(counts: Counts, users: { users: number; crashedUsers: number }) {
  return {
    ...counts,
    healthy: Math.max(0, counts.sessions - counts.errored - counts.abnormal - counts.crashed),
    crashFreeSessions: crashFreeRate(counts.sessions, counts.crashed),
    users: users.users,
    crashFreeUsers: crashFreeRate(users.users, users.crashedUsers),
  };
}

const countColumns = {
  sessions: sql<number>`coalesce(sum(${releaseHealthBuckets.sessions}), 0)::int`,
  errored: sql<number>`coalesce(sum(${releaseHealthBuckets.errored}), 0)::int`,
  abnormal: sql<number>`coalesce(sum(${releaseHealthBuckets.abnormal}), 0)::int`,
  crashed: sql<number>`coalesce(sum(${releaseHealthBuckets.crashed}), 0)::int`,
};

const userColumns = {
  users: sql<number>`count(distinct ${releaseHealthUsers.userHash})::int`,
  crashedUsers: sql<number>`count(distinct ${releaseHealthUsers.userHash}) filter (where ${releaseHealthUsers.crashed})::int`,
};

@Injectable()
export class ReleaseHealthService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  /** Health of the project's releases over a period, busiest first. */
  async summary(projectId: string, filters: Filters, now = new Date()) {
    const { period, environment } = parseHealthFilters(filters);
    const since = periodStart(period, now);
    const bucketWhere = this.bucketWhere(projectId, since, environment);
    const userWhere = this.userWhere(projectId, since, environment);

    const [totals, [totalUsers], perRelease, environments] = await Promise.all([
      this.db.select(countColumns).from(releaseHealthBuckets).where(bucketWhere),
      this.db.select(userColumns).from(releaseHealthUsers).where(userWhere),
      this.db
        .select({
          releaseId: releaseHealthBuckets.releaseId,
          version: releases.version,
          ...countColumns,
        })
        .from(releaseHealthBuckets)
        .innerJoin(releases, eq(releases.id, releaseHealthBuckets.releaseId))
        .where(bucketWhere)
        .groupBy(releaseHealthBuckets.releaseId, releases.version)
        .orderBy(desc(countColumns.sessions))
        .limit(RELEASE_LIMIT),
      this.db
        .selectDistinct({ environment: releaseHealthBuckets.environment })
        .from(releaseHealthBuckets)
        .where(this.bucketWhere(projectId, since, null))
        .orderBy(releaseHealthBuckets.environment),
    ]);

    const releaseIds = perRelease.map((row) => row.releaseId);
    const usersByRelease = new Map(
      releaseIds.length === 0
        ? []
        : (
            await this.db
              .select({ releaseId: releaseHealthUsers.releaseId, ...userColumns })
              .from(releaseHealthUsers)
              .where(and(userWhere, inArray(releaseHealthUsers.releaseId, releaseIds)))
              .groupBy(releaseHealthUsers.releaseId)
          ).map((row) => [row.releaseId, row]),
    );
    const total = totals[0] ?? { sessions: 0, errored: 0, abnormal: 0, crashed: 0 };

    return {
      period,
      environment,
      since: since.toISOString(),
      environments: environments.map((row) => row.environment).filter(Boolean),
      totals: healthFigures(total, totalUsers ?? { users: 0, crashedUsers: 0 }),
      releases: perRelease.map(({ releaseId, version, ...counts }) => ({
        version,
        ...healthFigures(counts, usersByRelease.get(releaseId) ?? { users: 0, crashedUsers: 0 }),
        adoption: total.sessions > 0 ? counts.sessions / total.sessions : null,
      })),
    };
  }

  /** One release's health over a period, with an hourly (24h) or daily series. */
  async release(projectId: string, releaseVersion: string, filters: Filters, now = new Date()) {
    const { period, environment } = parseHealthFilters(filters);
    const [release] = await this.db
      .select({ id: releases.id, version: releases.version })
      .from(releases)
      .where(and(eq(releases.projectId, projectId), eq(releases.version, releaseVersion)))
      .limit(1);
    if (!release) throw new NotFoundException("Release not found");

    const since = periodStart(period, now);
    const step = period === "24h" ? HOUR_MS : DAY_MS;
    const bucketWhere = and(
      this.bucketWhere(projectId, since, environment),
      eq(releaseHealthBuckets.releaseId, release.id),
    );
    const slot = sql<string>`date_trunc(${sql.raw(period === "24h" ? "'hour'" : "'day'")}, ${releaseHealthBuckets.bucketStart}, 'UTC')`;

    const [[counts], [users], [projectTotal], rows] = await Promise.all([
      this.db.select(countColumns).from(releaseHealthBuckets).where(bucketWhere),
      this.db
        .select(userColumns)
        .from(releaseHealthUsers)
        .where(
          and(
            this.userWhere(projectId, since, environment),
            eq(releaseHealthUsers.releaseId, release.id),
          ),
        ),
      this.db
        .select({ sessions: countColumns.sessions })
        .from(releaseHealthBuckets)
        .where(this.bucketWhere(projectId, since, environment)),
      this.db
        .select({ start: slot, ...countColumns })
        .from(releaseHealthBuckets)
        .where(bucketWhere)
        .groupBy(slot),
    ]);

    const bySlot = new Map(rows.map((row) => [new Date(row.start).getTime(), row]));
    const series = [];
    for (let time = since.getTime(); time <= now.getTime(); time += step) {
      const row = bySlot.get(time) ?? { sessions: 0, errored: 0, abnormal: 0, crashed: 0 };
      series.push({
        start: new Date(time).toISOString(),
        sessions: row.sessions,
        errored: row.errored,
        abnormal: row.abnormal,
        crashed: row.crashed,
        crashFreeSessions: crashFreeRate(row.sessions, row.crashed),
      });
    }

    return {
      version: release.version,
      period,
      environment,
      since: since.toISOString(),
      interval: period === "24h" ? ("hour" as const) : ("day" as const),
      totals: {
        ...healthFigures(counts, users),
        adoption: projectTotal.sessions > 0 ? counts.sessions / projectTotal.sessions : null,
      },
      series,
    };
  }

  private bucketWhere(projectId: string, since: Date, environment: string | null): SQL {
    return and(
      eq(releaseHealthBuckets.projectId, projectId),
      gte(releaseHealthBuckets.bucketStart, since),
      environment === null ? undefined : eq(releaseHealthBuckets.environment, environment),
    )!;
  }

  private userWhere(projectId: string, since: Date, environment: string | null): SQL {
    return and(
      eq(releaseHealthUsers.projectId, projectId),
      gte(releaseHealthUsers.day, since.toISOString().slice(0, 10)),
      environment === null ? undefined : eq(releaseHealthUsers.environment, environment),
    )!;
  }
}
