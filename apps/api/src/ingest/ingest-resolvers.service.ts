import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { environments, releases } from "../database/schema";

import type { ResolveEnvironmentInput, ResolveReleaseInput } from "./ingest.types";
import { LAST_SEEN_RESOLUTION_MS } from "./ingest-limits";

@Injectable()
export class IngestResolversService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async resolveEnvironmentId(input: ResolveEnvironmentInput) {
    if (!input.environmentName) {
      return null;
    }

    const [existing] = await this.db
      .select({ id: environments.id })
      .from(environments)
      .where(
        and(
          eq(environments.projectId, input.projectId),
          eq(environments.name, input.environmentName),
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const [environment] = await this.db
      .insert(environments)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        name: input.environmentName,
      })
      .onConflictDoNothing()
      .returning({ id: environments.id });

    if (environment) {
      return environment.id;
    }

    const [resolved] = await this.db
      .select({ id: environments.id })
      .from(environments)
      .where(
        and(
          eq(environments.projectId, input.projectId),
          eq(environments.name, input.environmentName),
        ),
      )
      .limit(1);

    return resolved?.id ?? null;
  }

  async resolveReleaseId(input: ResolveReleaseInput) {
    if (!input.releaseVersion) {
      return null;
    }

    const [existing] = await this.db
      .select({
        id: releases.id,
        firstSeenAt: releases.firstSeenAt,
        lastSeenAt: releases.lastSeenAt,
      })
      .from(releases)
      .where(
        and(eq(releases.projectId, input.projectId), eq(releases.version, input.releaseVersion)),
      )
      .limit(1);

    if (existing) {
      // Every event of the release would otherwise queue on its row: within
      // LAST_SEEN_RESOLUTION_MS the timestamp is close enough.
      const staleBefore = new Date(input.timestamp.getTime() - LAST_SEEN_RESOLUTION_MS);
      if (!existing.firstSeenAt || !existing.lastSeenAt || existing.lastSeenAt < staleBefore) {
        await this.db
          .update(releases)
          .set({
            firstSeenAt: existing.firstSeenAt ?? input.timestamp,
            lastSeenAt: input.timestamp,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(releases.id, existing.id),
              or(
                isNull(releases.firstSeenAt),
                isNull(releases.lastSeenAt),
                lt(releases.lastSeenAt, staleBefore),
              ),
            ),
          );
      }

      return existing.id;
    }

    const [release] = await this.db
      .insert(releases)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        version: input.releaseVersion,
        firstSeenAt: input.timestamp,
        lastSeenAt: input.timestamp,
      })
      .onConflictDoNothing()
      .returning({ id: releases.id });

    if (release) {
      return release.id;
    }

    const [resolved] = await this.db
      .select({ id: releases.id })
      .from(releases)
      .where(
        and(eq(releases.projectId, input.projectId), eq(releases.version, input.releaseVersion)),
      )
      .limit(1);

    if (resolved) {
      await this.db
        .update(releases)
        .set({
          lastSeenAt: input.timestamp,
          updatedAt: new Date(),
        })
        .where(eq(releases.id, resolved.id));
    }

    return resolved?.id ?? null;
  }
}
