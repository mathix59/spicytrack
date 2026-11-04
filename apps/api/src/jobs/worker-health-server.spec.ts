import type { ServerResponse } from "node:http";
import { handleWorkerHealthRequest } from "./worker-health-server";

function response() {
  const result = { status: 0, body: "" };
  const res = {
    writeHead: (status: number) => {
      result.status = status;
    },
    end: (body: string) => {
      result.body = body;
    },
  } as unknown as ServerResponse;
  return { res, result };
}

function deps(overrides: { stuck?: string | null; database?: "ok" | "down" } = {}) {
  return {
    runner: { stuckReason: () => overrides.stuck ?? null },
    jobs: {
      getQueueSummary: async () => ({ pending: 3, running: 1, failed: 0, due: 2 }),
      getOldestDueAgeSeconds: async () => 42,
    },
    pool: {
      query: async () => {
        if (overrides.database === "down") throw new Error("down");
        return {};
      },
    },
  } as never;
}

const get = async (url: string, dependencies = deps(), headers = {}) => {
  const { res, result } = response();
  await handleWorkerHealthRequest({ method: "GET", url, headers }, res, dependencies);
  return result;
};

describe("worker health server", () => {
  afterEach(() => delete process.env.METRICS_TOKEN);

  it("reports liveness from the job runner", async () => {
    expect((await get("/health/live")).status).toBe(200);
    const stuck = await get("/health/live", deps({ stuck: "job polling stopped" }));
    expect(stuck.status).toBe(503);
    expect(JSON.parse(stuck.body)).toMatchObject({ reason: "job polling stopped" });
  });

  it("reports readiness from PostgreSQL", async () => {
    expect((await get("/health/ready")).status).toBe(200);
    const down = await get("/health/ready", deps({ database: "down" }));
    expect(down.status).toBe(503);
    expect(JSON.parse(down.body)).toMatchObject({ dependencies: { database: "error" } });
  });

  it("serves metrics, behind METRICS_TOKEN when set", async () => {
    const metrics = await get("/metrics");
    expect(metrics.status).toBe(200);
    expect(metrics.body).toContain('spicytrack_jobs{status="due"} 2');
    expect(metrics.body).toContain("spicytrack_jobs_oldest_due_seconds 42");

    process.env.METRICS_TOKEN = "secret";
    expect((await get("/metrics")).status).toBe(404);
    expect((await get("/metrics", deps(), { authorization: "Bearer secret" })).status).toBe(200);
    expect((await get("/nope")).status).toBe(404);
  });
});
