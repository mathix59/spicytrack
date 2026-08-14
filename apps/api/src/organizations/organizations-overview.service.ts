import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  alertRules,
  environments,
  events,
  issues,
  organizationMembers,
  projectKeys,
  releases,
  teams,
} from "../database/schema";
import { ProjectsService } from "../projects/projects.service";

type OverviewProject = Awaited<ReturnType<ProjectsService["listAccessible"]>>[number];

type OrganizationOverviewProject = {
  id: string;
  name: string;
  slug: string;
  platform: string | null;
  status: string;
  visibility: string;
  hasActiveKey: boolean;
  environmentCount: number;
  releaseCount: number;
  openIssueCount: number;
  regressedIssueCount: number;
  eventCount24h: number;
  newIssueCount24h: number;
  resolvedIssueCount24h: number;
  activeAlertCount: number;
  lastIssueSeenAt: string | null;
  lastEventAt: string | Date | null;
};

type OrganizationOverview = {
  memberCount: number;
  teamCount: number;
  projectCount: number;
  connectedProjectCount: number;
  openIssueCount: number;
  regressedIssueCount: number;
  eventCount24h: number;
  newIssueCount24h: number;
  resolvedIssueCount24h: number;
  topRegressions: Array<{
    id: string;
    projectSlug: string;
    title: string;
    timesSeen: number;
    lastSeenAt: string | Date;
  }>;
  projects: OrganizationOverviewProject[];
};

@Injectable()
export class OrganizationsOverviewService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly projectsService: ProjectsService,
  ) {}

  async getOverview(input: { organizationId: string; userId: string; role: string }) {
    const accessibleProjects = await this.projectsService.listAccessible(input);
    const counts = await this.loadOrganizationCounts(input.organizationId);

    if (accessibleProjects.length === 0) {
      return this.buildEmptyOverview(counts);
    }

    const projectStats = await this.loadProjectStats(accessibleProjects);
    const projects = this.buildProjectOverview(accessibleProjects, projectStats);

    return this.buildOverviewSummary(
      counts,
      projects,
      accessibleProjects,
      projectStats.topRegressionRows,
    );
  }

  private async loadOrganizationCounts(organizationId: string) {
    const [memberCountRows, teamCountRows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, organizationId))
        .limit(1),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(teams)
        .where(eq(teams.organizationId, organizationId))
        .limit(1),
    ]);

    return {
      memberCount: memberCountRows[0]?.count ?? 0,
      teamCount: teamCountRows[0]?.count ?? 0,
    };
  }

  private buildEmptyOverview(counts: {
    memberCount: number;
    teamCount: number;
  }): OrganizationOverview {
    return {
      ...counts,
      projectCount: 0,
      connectedProjectCount: 0,
      openIssueCount: 0,
      regressedIssueCount: 0,
      eventCount24h: 0,
      newIssueCount24h: 0,
      resolvedIssueCount24h: 0,
      topRegressions: [],
      projects: [],
    };
  }

  private async loadProjectStats(projects: OverviewProject[]) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const projectIds = projects.map((project) => project.id);
    const [
      keyRows,
      environmentRows,
      releaseRows,
      issueRows,
      eventRows,
      newIssueRows,
      resolvedIssueRows,
      alertRows,
      topRegressionRows,
    ] = await Promise.all([
      this.db
        .select({
          projectId: projectKeys.projectId,
          activeCount: sql<number>`sum(case when ${projectKeys.isActive} then 1 else 0 end)::int`,
        })
        .from(projectKeys)
        .where(inArray(projectKeys.projectId, projectIds))
        .groupBy(projectKeys.projectId),
      this.db
        .select({
          projectId: environments.projectId,
          count: sql<number>`count(*)::int`,
        })
        .from(environments)
        .where(inArray(environments.projectId, projectIds))
        .groupBy(environments.projectId),
      this.db
        .select({
          projectId: releases.projectId,
          count: sql<number>`count(*)::int`,
        })
        .from(releases)
        .where(inArray(releases.projectId, projectIds))
        .groupBy(releases.projectId),
      this.db
        .select({
          projectId: issues.projectId,
          openIssueCount: sql<number>`count(*)::int`,
          regressedIssueCount: sql<number>`sum(case when ${issues.isRegressed} then 1 else 0 end)::int`,
          lastIssueSeenAt: sql<string | null>`max(${issues.lastSeenAt})`,
        })
        .from(issues)
        .where(and(inArray(issues.projectId, projectIds), eq(issues.status, "open")))
        .groupBy(issues.projectId),
      this.db
        .select({
          projectId: events.projectId,
          eventCount24h: sql<number>`count(*)::int`,
          lastEventAt: sql<string | null>`max(${events.timestamp})`,
        })
        .from(events)
        .where(and(inArray(events.projectId, projectIds), sql`${events.timestamp} >= ${since24h}`))
        .groupBy(events.projectId),
      this.db
        .select({
          projectId: issues.projectId,
          newIssueCount24h: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(
          and(inArray(issues.projectId, projectIds), sql`${issues.firstSeenAt} >= ${since24h}`),
        )
        .groupBy(issues.projectId),
      this.db
        .select({
          projectId: issues.projectId,
          resolvedIssueCount24h: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(
          and(
            inArray(issues.projectId, projectIds),
            sql`${issues.resolvedAt} is not null`,
            sql`${issues.resolvedAt} >= ${since24h}`,
          ),
        )
        .groupBy(issues.projectId),
      this.db
        .select({
          projectId: alertRules.projectId,
          activeAlertCount: sql<number>`sum(case when ${alertRules.isActive} then 1 else 0 end)::int`,
        })
        .from(alertRules)
        .where(inArray(alertRules.projectId, projectIds))
        .groupBy(alertRules.projectId),
      this.db
        .select({
          id: issues.id,
          projectId: issues.projectId,
          title: issues.title,
          timesSeen: issues.timesSeen,
          lastSeenAt: issues.lastSeenAt,
        })
        .from(issues)
        .where(
          and(
            inArray(issues.projectId, projectIds),
            eq(issues.status, "open"),
            eq(issues.isRegressed, true),
          ),
        )
        .orderBy(desc(issues.timesSeen), desc(issues.lastSeenAt))
        .limit(5),
    ]);

    return {
      activeKeyCountByProjectId: new Map(keyRows.map((row) => [row.projectId, row.activeCount])),
      environmentCountByProjectId: new Map(
        environmentRows.map((row) => [row.projectId, row.count]),
      ),
      releaseCountByProjectId: new Map(releaseRows.map((row) => [row.projectId, row.count])),
      issueStatsByProjectId: new Map(
        issueRows.map((row) => [
          row.projectId,
          {
            openIssueCount: row.openIssueCount,
            regressedIssueCount: row.regressedIssueCount,
            lastIssueSeenAt: row.lastIssueSeenAt,
          },
        ]),
      ),
      eventStatsByProjectId: new Map(
        eventRows.map((row) => [
          row.projectId,
          {
            eventCount24h: row.eventCount24h,
            lastEventAt: row.lastEventAt,
          },
        ]),
      ),
      newIssueCountByProjectId: new Map(
        newIssueRows.map((row) => [row.projectId, row.newIssueCount24h]),
      ),
      resolvedIssueCountByProjectId: new Map(
        resolvedIssueRows.map((row) => [row.projectId, row.resolvedIssueCount24h]),
      ),
      activeAlertCountByProjectId: new Map(
        alertRows.map((row) => [row.projectId, row.activeAlertCount]),
      ),
      topRegressionRows,
    };
  }

  private buildProjectOverview(
    accessibleProjects: OverviewProject[],
    projectStats: Awaited<ReturnType<OrganizationsOverviewService["loadProjectStats"]>>,
  ) {
    return accessibleProjects.map((project) => {
      const activeKeyCount = projectStats.activeKeyCountByProjectId.get(project.id) ?? 0;
      const issueStats = projectStats.issueStatsByProjectId.get(project.id);
      const eventStats = projectStats.eventStatsByProjectId.get(project.id);

      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        platform: project.platform,
        status: project.status,
        visibility: project.visibility,
        hasActiveKey: activeKeyCount > 0,
        environmentCount: projectStats.environmentCountByProjectId.get(project.id) ?? 0,
        releaseCount: projectStats.releaseCountByProjectId.get(project.id) ?? 0,
        openIssueCount: issueStats?.openIssueCount ?? 0,
        regressedIssueCount: issueStats?.regressedIssueCount ?? 0,
        eventCount24h: eventStats?.eventCount24h ?? 0,
        newIssueCount24h: projectStats.newIssueCountByProjectId.get(project.id) ?? 0,
        resolvedIssueCount24h: projectStats.resolvedIssueCountByProjectId.get(project.id) ?? 0,
        activeAlertCount: projectStats.activeAlertCountByProjectId.get(project.id) ?? 0,
        lastIssueSeenAt: issueStats?.lastIssueSeenAt ?? null,
        lastEventAt: eventStats?.lastEventAt ?? project.lastEventAt ?? null,
      };
    });
  }

  private buildOverviewSummary(
    counts: { memberCount: number; teamCount: number },
    projects: OrganizationOverviewProject[],
    accessibleProjects: OverviewProject[],
    topRegressionRows: Array<{
      id: string;
      projectId: string;
      title: string;
      timesSeen: number;
      lastSeenAt: Date;
    }>,
  ): OrganizationOverview {
    return {
      ...counts,
      projectCount: accessibleProjects.length,
      connectedProjectCount: projects.filter(
        (project) =>
          project.hasActiveKey &&
          accessibleProjects.find((accessibleProject) => accessibleProject.id === project.id)
            ?.firstEventAt,
      ).length,
      openIssueCount: projects.reduce((total, project) => total + project.openIssueCount, 0),
      regressedIssueCount: projects.reduce(
        (total, project) => total + project.regressedIssueCount,
        0,
      ),
      eventCount24h: projects.reduce((total, project) => total + project.eventCount24h, 0),
      newIssueCount24h: projects.reduce((total, project) => total + project.newIssueCount24h, 0),
      resolvedIssueCount24h: projects.reduce(
        (total, project) => total + project.resolvedIssueCount24h,
        0,
      ),
      topRegressions: topRegressionRows.flatMap((issue) => {
        const project = accessibleProjects.find((candidate) => candidate.id === issue.projectId);
        return project
          ? [
              {
                id: issue.id,
                projectSlug: project.slug,
                title: issue.title,
                timesSeen: issue.timesSeen,
                lastSeenAt: issue.lastSeenAt,
              },
            ]
          : [];
      }),
      projects,
    };
  }
}
