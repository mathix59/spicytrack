import { AlertDeliveryJobHandler, AlertDeliveryRetryError } from "./alert-delivery-job.handler";
import { isRetryableStatus } from "./alerts-delivery.service";
import type { AlertsDeliveryService } from "./alerts-delivery.service";
import type { JobsRunnerService } from "../jobs/jobs-runner.service";
import type { Job } from "../jobs/jobs.service";

type Row = Record<string, unknown>;

function setup(options: { delivery?: Row; rule?: Row | null; finalAttempt?: boolean }) {
  const delivery: Row = options.delivery ?? {
    id: "delivery-1",
    alertRuleId: "rule-1",
    status: "pending",
    attempts: 0,
    payload: { triggerType: "new_issue", projectId: "project-1" },
  };
  const rule =
    options.rule === undefined ? { id: "rule-1", destinationType: "webhook" } : options.rule;
  const updates: Row[] = [];
  let selectCount = 0;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            selectCount += 1;
            if (selectCount === 1) return [delivery];
            return rule ? [rule] : [];
          },
        }),
      }),
    }),
    update: () => ({
      set: (values: Row) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
  };
  const deliverToDestination = jest.fn();
  const handler = new AlertDeliveryJobHandler(
    db as never,
    { isFinalAttempt: () => options.finalAttempt ?? false } as unknown as JobsRunnerService,
    { deliverToDestination } as unknown as AlertsDeliveryService,
  );
  const job = {
    id: "job-1",
    type: "alert_delivery",
    attempts: 1,
    payload: { deliveryId: "delivery-1" },
  } as unknown as Job;

  return { handler, job, updates, deliverToDestination };
}

describe("AlertDeliveryJobHandler", () => {
  it("sends with the delivery id as idempotency key and records success", async () => {
    const { handler, job, updates, deliverToDestination } = setup({});
    deliverToDestination.mockResolvedValue({
      status: "success",
      responseStatus: 200,
      responseBody: "ok",
    });

    await handler.run(job);

    expect(deliverToDestination).toHaveBeenCalledWith(
      expect.objectContaining({ id: "rule-1" }),
      expect.objectContaining({ triggerType: "new_issue" }),
      expect.objectContaining({ deliveryId: "delivery-1" }),
    );
    expect(updates).toEqual([expect.objectContaining({ status: "success", attempts: 1 })]);
  });

  it("marks a transient failure as retrying and throws so the job is retried", async () => {
    const { handler, job, updates, deliverToDestination } = setup({});
    deliverToDestination.mockResolvedValue({
      status: "failed",
      responseStatus: 503,
      responseBody: "unavailable",
      retryable: true,
    });

    await expect(handler.run(job)).rejects.toBeInstanceOf(AlertDeliveryRetryError);
    expect(updates).toEqual([expect.objectContaining({ status: "retrying", responseStatus: 503 })]);
  });

  it("fails for good on the last attempt or on a permanent error", async () => {
    for (const [result, finalAttempt] of [
      [{ status: "failed", responseStatus: 503, responseBody: "", retryable: true }, true],
      [{ status: "failed", responseStatus: 404, responseBody: "", retryable: false }, false],
    ] as const) {
      const { handler, job, updates, deliverToDestination } = setup({ finalAttempt });
      deliverToDestination.mockResolvedValue(result);

      await expect(handler.run(job)).resolves.toBeUndefined();
      expect(updates).toEqual([expect.objectContaining({ status: "failed" })]);
    }
  });

  it("does not resend a delivery that already settled", async () => {
    const { handler, job, updates, deliverToDestination } = setup({
      delivery: {
        id: "delivery-1",
        alertRuleId: "rule-1",
        status: "success",
        attempts: 1,
        payload: {},
      },
    });

    await handler.run(job);

    expect(deliverToDestination).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("fails the delivery when its rule was deleted", async () => {
    const { handler, job, updates, deliverToDestination } = setup({ rule: null });

    await handler.run(job);

    expect(deliverToDestination).not.toHaveBeenCalled();
    expect(updates).toEqual([
      expect.objectContaining({
        status: "failed",
        responseBody: expect.stringContaining("deleted"),
      }),
    ]);
  });
});

describe("isRetryableStatus", () => {
  it("retries throttling and server errors only", () => {
    expect([408, 425, 429, 500, 503].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 404, 410].some(isRetryableStatus)).toBe(false);
  });
});
