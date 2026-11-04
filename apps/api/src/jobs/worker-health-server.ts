import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Pool } from "pg";
import { bearerMatches, gauge, jobDuration, processMetrics } from "../common/metrics";
import type { JobsRunnerService } from "./jobs-runner.service";
import type { JobsService } from "./jobs.service";

export const DEFAULT_WORKER_HEALTH_PORT = 3002;
const CHECK_TIMEOUT_MS = 2_000;

type WorkerHealthDependencies = {
  runner: Pick<JobsRunnerService, "stuckReason">;
  jobs: Pick<JobsService, "getQueueSummary" | "getOldestDueAgeSeconds">;
  pool: Pick<Pool, "query">;
};

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), CHECK_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function send(response: ServerResponse, status: number, body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type":
      typeof body === "string"
        ? "text/plain; version=0.0.4; charset=utf-8"
        : "application/json; charset=utf-8",
  });
  response.end(text);
}

export async function workerMetrics(deps: WorkerHealthDependencies): Promise<string> {
  const summary = await deps.jobs.getQueueSummary();
  const lines = [
    ...processMetrics(),
    ...jobDuration.render(),
    "# HELP spicytrack_jobs Number of jobs by queue state.",
    "# TYPE spicytrack_jobs gauge",
    `spicytrack_jobs{status="pending"} ${summary.pending}`,
    `spicytrack_jobs{status="running"} ${summary.running}`,
    `spicytrack_jobs{status="failed"} ${summary.failed}`,
    `spicytrack_jobs{status="due"} ${summary.due}`,
    ...gauge(
      "spicytrack_jobs_oldest_due_seconds",
      "Age of the oldest job waiting past its run time; 0 when none is late.",
      await deps.jobs.getOldestDueAgeSeconds(),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * The worker has no HTTP API, so this small server gives orchestrators probes and Prometheus a
 * scrape target: live fails when job polling stops or a drain stops making progress, ready
 * fails when PostgreSQL does not answer.
 */
export async function handleWorkerHealthRequest(
  request: Pick<IncomingMessage, "method" | "url" | "headers">,
  response: ServerResponse,
  deps: WorkerHealthDependencies,
) {
  const path = (request.url ?? "/").split("?")[0];
  if (request.method !== "GET") return send(response, 405, { status: "error" });

  if (path === "/health/live") {
    const reason = deps.runner.stuckReason();
    return send(response, reason ? 503 : 200, {
      status: reason ? "error" : "ok",
      service: "worker-admin",
      ...(reason ? { reason } : {}),
    });
  }

  if (path === "/health/ready") {
    const database = await withTimeout(deps.pool.query("SELECT 1")).then(
      () => "ok",
      () => "error",
    );
    return send(response, database === "ok" ? 200 : 503, {
      status: database,
      service: "worker-admin",
      dependencies: { database },
    });
  }

  if (path === "/metrics") {
    const token = process.env.METRICS_TOKEN;
    if (token && !bearerMatches(request.headers.authorization, token)) {
      return send(response, 404, { status: "error" });
    }
    try {
      return send(response, 200, await workerMetrics(deps));
    } catch {
      return send(response, 503, { status: "error" });
    }
  }

  return send(response, 404, { status: "error" });
}

/** Listens on WORKER_HEALTH_PORT (3002 by default); `0` turns the server off. */
export function startWorkerHealthServer(deps: WorkerHealthDependencies): Server | null {
  const raw = process.env.WORKER_HEALTH_PORT?.trim();
  const port = raw ? Number(raw) : DEFAULT_WORKER_HEALTH_PORT;
  if (port === 0) return null;
  const server = createServer((request, response) => {
    void handleWorkerHealthRequest(request, response, deps);
  });
  server.listen(port, process.env.WORKER_HEALTH_HOST?.trim() || "0.0.0.0");
  return server;
}
