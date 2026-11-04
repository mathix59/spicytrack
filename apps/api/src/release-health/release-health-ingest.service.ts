import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  releaseHealthBuckets,
  releaseHealthSessions,
  releaseHealthUsers,
} from "../database/schema";
import {
  SESSION_OUTCOME,
  type SessionAggregate,
  type SessionOutcome,
  type SessionUpdate,
  hourStart,
} from "./session-updates";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

type HealthScope = { organizationId: string; projectId: string; releaseId: string };

const OUTCOME_COLUMNS = {
  [SESSION_OUTCOME.errored]: "errored",
  [SESSION_OUTCOME.abnormal]: "abnormal",
  [SESSION_OUTCOME.crashed]: "crashed",
} as const;

type Counts = Partial<Record<"sessions" | "errored" | "abnormal" | "crashed", number>>;

/** Hash of a session's distinct id, so user ids are counted without being stored. */
export function sessionUserHash(projectId: string, distinctId: string) {
  return createHash("sha256").update(`${projectId}:${distinctId}`).digest("hex");
}

function outcomeCounts(outcome: SessionOutcome, delta: number): Counts {
  return outcome === SESSION_OUTCOME.healthy ? {} : { [OUTCOME_COLUMNS[outcome]]: delta };
}

@Injectable()
export class ReleaseHealthIngestService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  /**
   * Counts one session update. A session is counted once, in the hour it started; later
   * updates only move it to a worse outcome (healthy → errored → abnormal → crashed).
   */
  async recordSessionUpdate(scope: HealthScope, update: SessionUpdate) {
    await this.db.transaction(async (tx) => {
      const sessionKey = and(
        eq(releaseHealthSessions.projectId, scope.projectId),
        eq(releaseHealthSessions.sessionId, update.sessionId),
      );
      const lockKnown = async () => {
        const [row] = await tx
          .select()
          .from(releaseHealthSessions)
          .where(sessionKey)
          .for("update")
          .limit(1);
        return row;
      };

      // Locks are always taken in the same order, session row then bucket, so concurrent
      // updates of one session wait for each other instead of deadlocking.
      let known = await lockKnown();
      if (!known) {
        const bucketId = await this.ensureBucket(tx, scope, update);
        // On a concurrent first update of the same session, the insert waits for the other
        // transaction and the session is then handled as already known.
        const inserted = await tx
          .insert(releaseHealthSessions)
          .values({
            projectId: scope.projectId,
            sessionId: update.sessionId,
            bucketId,
            outcome: update.outcome,
          })
          .onConflictDoNothing()
          .returning({ bucketId: releaseHealthSessions.bucketId });
        if (inserted.length > 0) {
          await this.incrementBucket(tx, bucketId, {
            sessions: 1,
            ...outcomeCounts(update.outcome, 1),
          });
        } else {
          known = await lockKnown();
        }
      }

      if (known) {
        const outcome = Math.max(known.outcome, update.outcome) as SessionOutcome;
        await tx
          .update(releaseHealthSessions)
          .set({ outcome, updatedAt: new Date() })
          .where(sessionKey);
        if (outcome > known.outcome) {
          await this.incrementBucket(tx, known.bucketId, {
            ...outcomeCounts(known.outcome as SessionOutcome, -1),
            ...outcomeCounts(outcome, 1),
          });
        }
      }

      if (update.distinctId) {
        await this.recordUser(tx, scope, update, update.outcome === SESSION_OUTCOME.crashed);
      }
    });
  }

  /** Adds pre-aggregated counts; server SDKs send each session once, already finished. */
  async recordAggregate(scope: HealthScope, aggregate: SessionAggregate) {
    await this.db.transaction(async (tx) => {
      await this.addToBucket(tx, scope, aggregate, {
        sessions: aggregate.sessions,
        errored: aggregate.errored,
        abnormal: aggregate.abnormal,
        crashed: aggregate.crashed,
      });
      if (aggregate.distinctId) {
        await this.recordUser(tx, scope, aggregate, aggregate.crashed > 0);
      }
    });
  }

  /** The bucket's id, created empty when missing, without locking an existing bucket. */
  private async ensureBucket(
    tx: TransactionClient,
    scope: HealthScope,
    session: { environment: string; startedAt: Date },
  ) {
    const key = {
      projectId: scope.projectId,
      releaseId: scope.releaseId,
      environment: session.environment,
      bucketStart: hourStart(session.startedAt),
    };
    const [created] = await tx
      .insert(releaseHealthBuckets)
      .values({ organizationId: scope.organizationId, ...key })
      .onConflictDoNothing()
      .returning({ id: releaseHealthBuckets.id });
    if (created) return created.id;
    const [existing] = await tx
      .select({ id: releaseHealthBuckets.id })
      .from(releaseHealthBuckets)
      .where(
        and(
          eq(releaseHealthBuckets.projectId, key.projectId),
          eq(releaseHealthBuckets.releaseId, key.releaseId),
          eq(releaseHealthBuckets.environment, key.environment),
          eq(releaseHealthBuckets.bucketStart, key.bucketStart),
        ),
      )
      .limit(1);
    return existing.id;
  }

  private async addToBucket(
    tx: TransactionClient,
    scope: HealthScope,
    session: { environment: string; startedAt: Date },
    counts: Counts,
  ) {
    const [bucket] = await tx
      .insert(releaseHealthBuckets)
      .values({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        releaseId: scope.releaseId,
        environment: session.environment,
        bucketStart: hourStart(session.startedAt),
        ...counts,
      })
      .onConflictDoUpdate({
        target: [
          releaseHealthBuckets.projectId,
          releaseHealthBuckets.releaseId,
          releaseHealthBuckets.environment,
          releaseHealthBuckets.bucketStart,
        ],
        set: this.incrementSet(counts),
      })
      .returning({ id: releaseHealthBuckets.id });
    return bucket.id;
  }

  private async incrementBucket(tx: TransactionClient, bucketId: string, counts: Counts) {
    await tx
      .update(releaseHealthBuckets)
      .set(this.incrementSet(counts))
      .where(eq(releaseHealthBuckets.id, bucketId));
  }

  private incrementSet(counts: Counts) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [column, delta] of Object.entries(counts)) {
      if (!delta) continue;
      const target = releaseHealthBuckets[column as keyof Counts];
      set[column] = sql`greatest(${target} + ${delta}, 0)`;
    }
    return set;
  }

  private async recordUser(
    tx: TransactionClient,
    scope: HealthScope,
    session: { environment: string; startedAt: Date; distinctId: string | null },
    crashed: boolean,
  ) {
    await tx
      .insert(releaseHealthUsers)
      .values({
        projectId: scope.projectId,
        releaseId: scope.releaseId,
        environment: session.environment,
        day: session.startedAt.toISOString().slice(0, 10),
        userHash: sessionUserHash(scope.projectId, session.distinctId!),
        crashed,
      })
      .onConflictDoUpdate({
        target: [
          releaseHealthUsers.projectId,
          releaseHealthUsers.releaseId,
          releaseHealthUsers.environment,
          releaseHealthUsers.day,
          releaseHealthUsers.userHash,
        ],
        set: { crashed: sql`${releaseHealthUsers.crashed} or excluded.crashed` },
      });
  }
}
