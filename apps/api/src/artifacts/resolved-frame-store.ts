import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { resolvedStackFrames } from "../database/schema";

// Keeps each insert well under PostgreSQL's bind-parameter limit.
const INSERT_BATCH_SIZE = 500;

const hash = (...parts: string[]) => {
  const digest = createHash("sha1");
  for (const part of parts) digest.update(part).update("\0");
  return digest.digest("base64url");
};

/** Identifies one state of a release's artifacts: any upload, replacement or deletion changes it. */
export function artifactsFingerprint(artifacts: { id: string; storageKey: string }[]): string {
  return hash(
    ...[...artifacts]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((artifact) => `${artifact.id}:${artifact.storageKey}`),
  );
}

/** Identifies a raw frame as the resolver sees it, for one SDK family. */
export function frameKey(family: string, frame: unknown): string {
  return hash(family, JSON.stringify(frame));
}

/** Runs `task` over `items` with at most `limit` in flight, keeping results in input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Frames resolved against a release's artifacts, shared by every API and worker process and kept
 * across deploys. Reads only match the current artifacts fingerprint.
 */
@Injectable()
export class ResolvedFrameStore {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async get<T>(releaseId: string, fingerprint: string, keys: string[]): Promise<Map<string, T>> {
    if (keys.length === 0) return new Map();
    const rows = await this.db
      .select({ frameKey: resolvedStackFrames.frameKey, frame: resolvedStackFrames.frame })
      .from(resolvedStackFrames)
      .where(
        and(
          eq(resolvedStackFrames.releaseId, releaseId),
          eq(resolvedStackFrames.artifactsFingerprint, fingerprint),
          inArray(resolvedStackFrames.frameKey, [...new Set(keys)]),
        ),
      );
    return new Map(rows.map((row) => [row.frameKey, row.frame as T]));
  }

  async save(releaseId: string, fingerprint: string, frames: Map<string, object>): Promise<void> {
    const rows = [...frames].map(([key, frame]) => ({
      releaseId,
      artifactsFingerprint: fingerprint,
      frameKey: key,
      frame: frame as Record<string, unknown>,
    }));
    for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
      await this.db
        .insert(resolvedStackFrames)
        .values(rows.slice(start, start + INSERT_BATCH_SIZE))
        .onConflictDoNothing();
    }
  }

  /** Drops the release's frames once its artifacts change: they can never be read again. */
  async clearRelease(releaseId: string): Promise<void> {
    await this.db.delete(resolvedStackFrames).where(eq(resolvedStackFrames.releaseId, releaseId));
  }
}
