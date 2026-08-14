import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { alertDeliveries, alertRules } from "../database/schema";

import { AlertsDeliveryService } from "./alerts-delivery.service";
import type { AlertPayload } from "./alerts.types";

export function shouldTriggerAlertRule(
  rule: Pick<
    typeof alertRules.$inferSelect,
    "triggerType" | "threshold" | "cooldownMinutes" | "lastTriggeredAt"
  >,
  input: { issueWasCreated: boolean; issueRegressed: boolean; timesSeen: number },
  now = new Date(),
) {
  const cooldownCutoff = new Date(now.getTime() - rule.cooldownMinutes * 60 * 1000);
  if (rule.lastTriggeredAt && rule.lastTriggeredAt > cooldownCutoff) return false;
  if (rule.triggerType === "new_issue") return input.issueWasCreated;
  if (rule.triggerType === "regression") return input.issueRegressed;
  if (rule.triggerType === "event_threshold") {
    return Boolean(rule.threshold && input.timesSeen >= rule.threshold);
  }
  return false;
}

@Injectable()
export class AlertsExecutionService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly alertsDeliveryService: AlertsDeliveryService,
  ) {}

  async handleEvent(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    eventId: string;
    issueTitle: string;
    issueStatus: string;
    timesSeen: number;
    issueWasCreated: boolean;
    issueRegressed: boolean;
  }) {
    const activeRules = await this.db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.projectId, input.projectId), eq(alertRules.isActive, true)));

    for (const rule of activeRules) {
      if (!shouldTriggerAlertRule(rule, input)) {
        continue;
      }

      const payload: AlertPayload = {
        triggerType: rule.triggerType,
        projectId: input.projectId,
        issueId: input.issueId,
        eventId: input.eventId,
        issueTitle: input.issueTitle,
        issueStatus: input.issueStatus,
        timesSeen: input.timesSeen,
      };

      const { status, responseStatus, responseBody } =
        await this.alertsDeliveryService.deliverToDestination(rule, payload);

      await this.db.insert(alertDeliveries).values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        alertRuleId: rule.id,
        issueId: input.issueId,
        eventId: input.eventId,
        status,
        responseStatus,
        responseBody,
        payload,
      });

      await this.db
        .update(alertRules)
        .set({
          lastTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(alertRules.id, rule.id));
    }
  }
}
