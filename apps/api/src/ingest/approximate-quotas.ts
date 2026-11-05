/** A counter row: one quota scope for one owner, over one fixed window. */
export type QuotaKey = { scope: string; scopeId: string; windowMs: number };

/** Units to add to a counter row; the store answers with the row's new total. */
export type QuotaDelta = { scope: string; scopeId: string; windowStartedAt: Date; units: number };
export type QuotaTotal = { scope: string; scopeId: string; windowStartedAt: Date; count: number };
export type QuotaStore = (deltas: QuotaDelta[]) => Promise<QuotaTotal[]>;

export type QuotaReservation =
  | { allowed: true; release: () => void }
  | { allowed: false; retryAfterSeconds: number };

type Entry = {
  scope: string;
  scopeId: string;
  windowStartedAt: Date;
  windowEndsAt: number;
  /** The row's total the last time it was written: other processes only make it grow. */
  known: number;
  /** Units counted here and not written yet. */
  pending: number;
  /** When `known` was read, or null before the first read of this window. */
  readAt: number | null;
  refresh: Promise<void> | null;
};

/** Past this share of a limit, a stale total is read again before letting an event through. */
const NEAR_LIMIT_RATIO = 0.9;
/** How often, at most, a counter near its limit is read again; concurrent callers share a read. */
const NEAR_LIMIT_READ_INTERVAL_MS = 100;

const entryKey = (scope: string, scopeId: string, windowStartedAt: Date) =>
  `${scope}\u0000${scopeId}\u0000${windowStartedAt.getTime()}`;

/**
 * Quotas counted in memory and written in batches, so events of a busy project no longer queue
 * on its counter rows. Each process decides from the last total it read plus what it counted
 * since; `flush` writes those units and reads the totals back.
 *
 * Totals only grow within a window, so a stale total can let an event through but never refuses
 * one wrongly. Far from the limit that is fine; near it (and for a window this process has not
 * read yet) the total is read again first. Across several processes, a window can therefore
 * overshoot by roughly what the others count between two reads; one process alone is exact,
 * give or take concurrent requests.
 */
export class ApproximateQuotas {
  private readonly entries = new Map<string, Entry>();
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly store: QuotaStore,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Counts `units` against `limit` unless that would exceed it. An allowed reservation can be
   * released when a later quota refuses the same event, so it is not counted twice.
   */
  async reserve(key: QuotaKey, limit: number, units = 1): Promise<QuotaReservation> {
    const entry = this.entryFor(key);
    if (this.mustRead(entry, limit, units)) await this.read(entry);

    if (entry.known + entry.pending + units > limit) {
      const seconds = Math.ceil((entry.windowEndsAt - this.now()) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, seconds) };
    }
    entry.pending += units;
    return {
      allowed: true,
      release: () => {
        entry.pending -= units;
      },
    };
  }

  /** Writes every pending unit; units whose write fails stay for the next flush. */
  async flush(): Promise<void> {
    // One write at a time, so a slow write never has a second one subtracting the same units.
    while (this.flushing) await this.flushing;
    this.flushing = this.write([...this.entries.values()].filter((entry) => entry.pending !== 0));
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
      this.dropEndedWindows();
    }
  }

  private entryFor(key: QuotaKey): Entry {
    const now = this.now();
    const windowStart = Math.floor(now / key.windowMs) * key.windowMs;
    const windowStartedAt = new Date(windowStart);
    const id = entryKey(key.scope, key.scopeId, windowStartedAt);
    let entry = this.entries.get(id);
    if (!entry) {
      entry = {
        scope: key.scope,
        scopeId: key.scopeId,
        windowStartedAt,
        windowEndsAt: windowStart + key.windowMs,
        known: 0,
        pending: 0,
        readAt: null,
        refresh: null,
      };
      this.entries.set(id, entry);
    }
    return entry;
  }

  private mustRead(entry: Entry, limit: number, units: number) {
    if (entry.readAt === null) return true;
    const estimate = entry.known + entry.pending + units;
    // Already over: a fresher total could only be higher.
    if (estimate > limit) return false;
    return (
      estimate > limit * NEAR_LIMIT_RATIO &&
      this.now() - entry.readAt >= NEAR_LIMIT_READ_INTERVAL_MS
    );
  }

  /** Writes this entry's pending units, which also reads its total back. */
  private async read(entry: Entry) {
    if (!entry.refresh) {
      entry.refresh = (async () => {
        while (this.flushing) await this.flushing;
        await this.write([entry]);
      })().finally(() => {
        entry.refresh = null;
      });
    }
    await entry.refresh;
  }

  private async write(entries: Entry[]) {
    if (entries.length === 0) return;
    // Rows are written in a fixed order, so two processes never lock them in opposite orders.
    const sorted = [...entries].sort((a, b) =>
      entryKey(a.scope, a.scopeId, a.windowStartedAt).localeCompare(
        entryKey(b.scope, b.scopeId, b.windowStartedAt),
      ),
    );
    const written = sorted.map((entry) => entry.pending);
    const totals = await this.store(
      sorted.map((entry, index) => ({
        scope: entry.scope,
        scopeId: entry.scopeId,
        windowStartedAt: entry.windowStartedAt,
        units: written[index],
      })),
    );
    const readAt = this.now();
    const byKey = new Map(
      totals.map((total) => [entryKey(total.scope, total.scopeId, total.windowStartedAt), total]),
    );
    sorted.forEach((entry, index) => {
      // Units counted while the write was in flight stay pending.
      entry.pending -= written[index];
      const total = byKey.get(entryKey(entry.scope, entry.scopeId, entry.windowStartedAt));
      if (total) entry.known = Math.max(entry.known, total.count);
      entry.readAt = readAt;
    });
  }

  private dropEndedWindows() {
    const now = this.now();
    for (const [id, entry] of this.entries) {
      if (entry.windowEndsAt <= now && entry.pending === 0 && !entry.refresh) {
        this.entries.delete(id);
      }
    }
  }
}
