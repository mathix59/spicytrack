import { AppService } from "./app.service";

describe("AppService health", () => {
  const summary = { pending: 1, running: 0, failed: 0, due: 1 };

  it("reports ready dependencies and the queue summary", async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const storage = { checkHealth: jest.fn().mockResolvedValue(undefined) };
    const email = { checkHealth: jest.fn().mockResolvedValue("disabled") };
    const jobs = { getQueueSummary: jest.fn().mockResolvedValue(summary) };
    const service = new AppService(pool as never, storage as never, email as never, jobs as never);

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: "ok",
      dependencies: { database: "ok", storage: "ok", smtp: "disabled", jobs: "ok" },
      jobs: summary,
    });
    expect(jobs.getQueueSummary).toHaveBeenCalledTimes(1);
  });

  it("reports an error when a required dependency fails", async () => {
    const service = new AppService(
      { query: jest.fn().mockRejectedValue(new Error("database unavailable")) } as never,
      { checkHealth: jest.fn().mockResolvedValue(undefined) } as never,
      { checkHealth: jest.fn().mockResolvedValue("ok") } as never,
    );

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: "error",
      dependencies: { database: "error", storage: "ok", smtp: "ok", jobs: "disabled" },
    });
  });

  it("checks an optional read replica as a readiness dependency", async () => {
    const replica = { query: jest.fn().mockRejectedValue(new Error("replica unavailable")) };
    const service = new AppService(
      { query: jest.fn().mockResolvedValue({ rows: [] }) } as never,
      { checkHealth: jest.fn().mockResolvedValue(undefined) } as never,
      { checkHealth: jest.fn().mockResolvedValue("ok") } as never,
      undefined,
      replica as never,
    );

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: "error",
      dependencies: { database: "ok", databaseReplica: "error", storage: "ok", smtp: "ok" },
    });
  });

  it("exports lightweight Prometheus process and job metrics", async () => {
    const jobs = { getQueueSummary: jest.fn().mockResolvedValue(summary) };
    const service = new AppService(
      { query: jest.fn() } as never,
      { checkHealth: jest.fn() } as never,
      { checkHealth: jest.fn() } as never,
      jobs as never,
    );

    const metrics = await service.getMetrics();
    expect(metrics).toContain("# TYPE spicytrack_process_uptime_seconds gauge");
    expect(metrics).toContain('spicytrack_jobs{status="pending"} 1');
    expect(metrics.endsWith("\n")).toBe(true);
  });
});
