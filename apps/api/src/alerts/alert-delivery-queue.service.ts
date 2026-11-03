import { Injectable } from "@nestjs/common";

import type { DatabaseClient } from "../database/database.provider";
import { alertDeliveries } from "../database/schema";
import { JobsService } from "../jobs/jobs.service";

import type { AlertPayload, AlertRuleRecord } from "./alerts.types";

export const ALERT_DELIVERY_JOB_TYPE = "alert_delivery";

type Executor = Pick<DatabaseClient, "insert">;

/**
 * Records a pending delivery and its job in the caller's transaction. The worker sends it with
 * retries, and the delivery id doubles as the idempotency key seen by the receiver.
 */
@Injectable()
export class AlertDeliveryQueueService {
  constructor(private readonly jobsService: JobsService) {}

  async queue(
    executor: Executor,
    input: {
      rule: Pick<AlertRuleRecord, "id" | "organizationId" | "projectId">;
      payload: AlertPayload;
      issueId?: string;
      eventId?: string;
    },
  ): Promise<string> {
    const [delivery] = await executor
      .insert(alertDeliveries)
      .values({
        organizationId: input.rule.organizationId,
        projectId: input.rule.projectId,
        alertRuleId: input.rule.id,
        issueId: input.issueId ?? null,
        eventId: input.eventId ?? null,
        status: "pending",
        payload: input.payload,
      })
      .returning({ id: alertDeliveries.id });

    await this.jobsService.enqueue(
      ALERT_DELIVERY_JOB_TYPE,
      { deliveryId: delivery.id },
      new Date(),
      {
        dedupeKey: `${ALERT_DELIVERY_JOB_TYPE}:${delivery.id}`,
        organizationId: input.rule.organizationId,
        projectId: input.rule.projectId,
        executor,
      },
    );

    return delivery.id;
  }
}
