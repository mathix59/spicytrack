import type { PayloadRecord } from "./types";
import { asRecord, toBreadcrumbs } from "./utils";

function timestampSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed / 1000 : null;
}

function failedRequests(payload: PayloadRecord) {
  const eventTime = timestampSeconds(payload.timestamp);
  const groups = new Map<
    string,
    {
      url: string;
      method: string;
      status: number;
      count: number;
      delay: number | null;
    }
  >();
  // Reverse capture order puts the most recently recorded failures first.
  for (const breadcrumb of toBreadcrumbs(payload.breadcrumbs).reverse()) {
    if (breadcrumb.type !== "http" && !["xhr", "fetch"].includes(String(breadcrumb.category)))
      continue;
    const data = asRecord(breadcrumb.data);
    if (typeof data?.url !== "string" || !data.url) continue;
    const rawStatus = data.status_code;
    if (typeof rawStatus !== "number" && typeof rawStatus !== "string") continue;
    if (typeof rawStatus === "string" && !rawStatus.trim()) continue;
    const status = Number(rawStatus);
    if (!Number.isInteger(status) || (status !== 0 && (status < 400 || status > 599))) continue;
    const time = timestampSeconds(breadcrumb.timestamp);
    if (eventTime !== null && time !== null && time > eventTime) continue;
    const method = typeof data.method === "string" ? data.method.toUpperCase() : "HTTP";
    const key = JSON.stringify([method, data.url, status]);
    const existing = groups.get(key);
    const delay =
      eventTime !== null && time !== null ? Math.round((eventTime - time) * 1000) : null;
    if (existing) {
      existing.count += 1;
      if (delay !== null && (existing.delay === null || delay < existing.delay))
        existing.delay = delay;
    } else {
      groups.set(key, { url: data.url, method, status, count: 1, delay });
    }
  }
  return [...groups.values()];
}

function FailedRequests({ rawPayload }: { rawPayload: PayloadRecord }) {
  const requests = failedRequests(rawPayload);
  if (requests.length === 0) return null;

  return (
    <section
      aria-label="Failed outgoing requests"
      className="min-w-0 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <h2 className="text-sm font-semibold">Failed outgoing requests</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Recorded network failures, most recent first. Timing helps relate them to this exception.
      </p>
      <ul className="mt-3 grid min-w-0 gap-3">
        {requests.map((request) => (
          <li
            key={JSON.stringify([request.method, request.url, request.status])}
            className="min-w-0"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="text-destructive">
                {request.status === 0 ? "No HTTP response (status 0)" : `HTTP ${request.status}`}
              </span>
              <span>{request.method}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {request.count} {request.count === 1 ? "failure" : "failures"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs [overflow-wrap:anywhere]">{request.url}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {request.delay === null
                ? "Timing unavailable"
                : `Last failure ${request.delay < 1000 ? `${request.delay} ms` : `${(request.delay / 1000).toFixed(1)} s`} before this event`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { FailedRequests };
