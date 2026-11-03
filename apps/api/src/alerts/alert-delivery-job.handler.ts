import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { alertDeliveries, alertRules } from "../database/schema";
import { JobsRunnerService } from "../jobs/jobs-runner.service";
import type { Job } from "../jobs/jobs.service";

import { ALERT_DELIVERY_JOB_TYPE } from "./alert-delivery-queue.service";
import { AlertsDeliveryService } from "./alerts-delivery.service";
import type { AlertPayload } from "./alerts.types";

const FINISHED_STATUSES = new Set(["success", "failed"]);

export class AlertDeliveryRetryError extends Error {}

@Injectable()
export class AlertDeliveryJobHandler implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly runner: JobsRunnerService,
    private readonly deliveryService: AlertsDeliveryService,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(ALERT_DELIVERY_JOB_TYPE, (job, signal) => this.run(job, signal));
  }

  async run(job: Job, signal?: AbortSignal): Promise<void> {
    const deliveryId = (job.payload as { deliveryId?: unknown }).deliveryId;
    if (typeof deliveryId !== "string") {
      throw new Error("alert_delivery job payload is invalid");
    }

    const [delivery] = await this.db
      .select()
      .from(alertDeliveries)
      .where(eq(alertDeliveries.id, deliveryId))
      .limit(1);
    // Deleted with its organization, or already settled by an earlier run of this job.
    if (!delivery || FINISHED_STATUSES.has(delivery.status)) return;

    const now = new Date();
    const attempts = delivery.attempts + 1;
    const [rule] = await this.db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, delivery.alertRuleId))
      .limit(1);
    if (!rule) {
      await this.settle(deliveryId, {
        status: "failed",
        attempts,
        lastAttemptAt: now,
        responseStatus: null,
        responseBody: "The alert rule was deleted before the alert could be delivered.",
      });
      return;
    }

    const result = await this.deliveryService.deliverToDestination(
      rule,
      delivery.payload as AlertPayload,
      { deliveryId, signal },
    );
    const willRetry =
      result.status === "failed" && result.retryable === true && !this.runner.isFinalAttempt(job);

    await this.settle(deliveryId, {
      status: willRetry ? "retrying" : result.status,
      attempts,
      lastAttemptAt: now,
      responseStatus: result.responseStatus,
      responseBody: result.responseBody,
    });

    if (willRetry) {
      throw new AlertDeliveryRetryError(
        `Alert delivery ${deliveryId} failed (${result.responseStatus ?? "no response"}); retrying`,
      );
    }
  }

  private async settle(
    deliveryId: string,
    values: Pick<
      typeof alertDeliveries.$inferInsert,
      "status" | "attempts" | "lastAttemptAt" | "responseStatus" | "responseBody"
    >,
  ) {
    await this.db.update(alertDeliveries).set(values).where(eq(alertDeliveries.id, deliveryId));
  }
}
