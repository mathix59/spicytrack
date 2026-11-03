import { eq } from "drizzle-orm";

import { webOrigins } from "../auth/web-origins";
import type { DatabaseClient } from "../database/database.provider";
import { organizations, projects } from "../database/schema";

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
