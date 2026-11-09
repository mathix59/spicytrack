import { createHash } from "node:crypto";

/**
 * Bounded least-recently-used cache of resolved stack frames, shared by every request of the process.
 *
 * Resolving a frame downloads and parses its source map (often several megabytes per chunk). The
 * result only depends on the frame, the SDK family and the release's artifacts, so it is cached under
 * those: events of the same issue share their frames and reopen without touching storage. Uploading
 * or deleting an artifact changes the release fingerprint, so stale results are never served.
 */
export class ResolvedFrameCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // Re-insert so the Map's insertion order doubles as recency order.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }
}

/** Identifies one state of a release's artifacts: any upload, replacement or deletion changes it. */
export function artifactsFingerprint(artifacts: { id: string; storageKey: string }[]): string {
  const hash = createHash("sha1");
  for (const artifact of [...artifacts].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(artifact.id).update("\0").update(artifact.storageKey).update("\n");
  }
  return hash.digest("base64url");
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
