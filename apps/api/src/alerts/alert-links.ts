import { countDistinct, eq } from "drizzle-orm";

import { webOrigins } from "../auth/web-origins";
import type { DatabaseClient } from "../database/database.provider";
import {
  environments,
  events,
  issues,
  organizations,
  projects,
  releases,
} from "../database/schema";

export type ProjectLinks = { projectName: string; projectUrl: string | undefined };

/** Project name and web URL used to make alert messages readable and clickable. */
export async function loadProjectLinks(
  db: DatabaseClient,
  projectId: string,
): Promise<ProjectLinks> {
  const [row] = await db
    .select({
      projectName: projects.name,
      projectSlug: projects.slug,
      organizationSlug: organizations.slug,
    })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) {
    return { projectName: projectId, projectUrl: undefined };
  }

  const base = webOrigins()[0];
  return {
    projectName: row.projectName,
    projectUrl: base
      ? `${base}/orgs/${row.organizationSlug}/projects/${row.projectSlug}`
      : undefined,
  };
}

export function issueUrl(links: ProjectLinks, issueId: string): string | undefined {
  return links.projectUrl ? `${links.projectUrl}/issues/${issueId}` : undefined;
}

export type IssueAlertContext = {
  level?: string;
  culprit?: string | null;
  environment?: string | null;
  release?: string | null;
  userCount?: number;
};

/** Details shown by rich alerts (Slack, Discord, PagerDuty): the issue and its latest event. */
export async function loadIssueAlertContext(
  db: DatabaseClient,
  issueId: string,
  eventId: string,
): Promise<IssueAlertContext> {
  const [[row], [users]] = await Promise.all([
    db
      .select({
        level: issues.level,
        culprit: issues.culprit,
        environment: environments.name,
        release: releases.version,
      })
      .from(issues)
      .leftJoin(events, eq(events.id, eventId))
      .leftJoin(environments, eq(environments.id, events.environmentId))
      .leftJoin(releases, eq(releases.id, events.releaseId))
      .where(eq(issues.id, issueId))
      .limit(1),
    db
      .select({ value: countDistinct(events.userIdentifier) })
      .from(events)
      .where(eq(events.issueId, issueId)),
  ]);
  return row ? { ...row, userCount: users?.value ?? 0 } : {};
}
