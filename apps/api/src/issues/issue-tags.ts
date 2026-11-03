/** Recent events a tag breakdown reads, so a huge issue costs the same as a large one. */
export const TAG_BREAKDOWN_SAMPLE = 10_000;
const MAX_KEYS = 20;
const MAX_VALUES = 5;
/** Shown first, in this order, when present. */
const LEADING_KEYS = [
  "environment",
  "release",
  "level",
  "browser",
  "os",
  "runtime",
  "device",
  "url",
  "transaction",
  "server_name",
];
/**
 * User keys identify one person each (the user count covers them); `*.name` keys repeat their
 * parent without the version. Both stay searchable.
 */
const HIDDEN_KEYS = new Set([
  "user.id",
  "user.email",
  "user.username",
  "browser.name",
  "os.name",
  "runtime.name",
]);

export type TagCountRow = { key: string; value: string; count: number };

export function summarizeTagCounts(rows: TagCountRow[], sampledEvents: number) {
  const byKey = new Map<string, { value: string; count: number }[]>();
  for (const row of rows) {
    if (HIDDEN_KEYS.has(row.key)) continue;
    const values = byKey.get(row.key) ?? [];
    values.push({ value: row.value, count: Number(row.count) });
    byKey.set(row.key, values);
  }

  const keys = [...byKey.entries()].map(([key, values]) => {
    values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return {
      key,
      total: values.reduce((sum, entry) => sum + entry.count, 0),
      uniqueValues: values.length,
      values: values.slice(0, MAX_VALUES),
    };
  });

  const rank = (key: string) => {
    const index = LEADING_KEYS.indexOf(key);
    return index === -1 ? LEADING_KEYS.length : index;
  };
  keys.sort((a, b) => rank(a.key) - rank(b.key) || b.total - a.total || a.key.localeCompare(b.key));

  return { sampledEvents, keys: keys.slice(0, MAX_KEYS) };
}
