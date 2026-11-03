import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { alertIssueCooldowns, alertRules, events } from "../database/schema";

import { AlertDeliveryQueueService } from "./alert-delivery-queue.service";
import { issueUrl, loadProjectLinks } from "./alert-links";
import type { ProjectLinks } from "./alert-links";
import { AlertsDeliveryService } from "./alerts-delivery.service";
import type { AlertPayload } from "./alerts.types";

type TriggerRule = Pick<typeof alertRules.$inferSelect, "triggerTypes" | "threshold">;
type TriggerInput = {
  issueWasCreated: boolean;
  issueRegressed: boolean;
  /** Events of the issue within the rule's threshold window. */
  recentEventCount: number;
};

export function shouldTriggerAlertRule(rule: TriggerRule, input: TriggerInput) {
  return matchingTriggerTypes(rule, input).length > 0;
}

/** Triggers of the rule satisfied by this event; the per-issue cooldown is applied afterwards. */
export function matchingTriggerTypes(rule: TriggerRule, input: TriggerInput) {
  return rule.triggerTypes.filter((triggerType) => {
    if (triggerType === "new_issue") return input.issueWasCreated;
    if (triggerType === "regression") return input.issueRegressed;
    if (triggerType === "event_threshold") {
      return Boolean(rule.threshold && input.recentEventCount >= rule.threshold);
    }
    return false;
  });
}

function usesThreshold(rule: TriggerRule) {
  return rule.triggerTypes.includes("event_threshold") && Boolean(rule.threshold);
}

@Injectable()
export class AlertsExecutionService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly alertsDeliveryService: AlertsDeliveryService,
    private readonly deliveryQueue: AlertDeliveryQueueService,
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
    const now = new Date();
    let links: ProjectLinks | undefined;

    for (const rule of activeRules) {
      const recentEventCount = usesThreshold(rule)
        ? await this.countRecentEvents(input.issueId, rule, now)
        : 0;
      const triggerTypes = matchingTriggerTypes(rule, { ...input, recentEventCount });
      if (triggerTypes.length === 0) {
        continue;
      }

      links ??= await loadProjectLinks(this.db, input.projectId);
      const payload: AlertPayload = {
        triggerType: triggerTypes[0],
        triggerTypes,
        projectId: input.projectId,
        projectName: links.projectName,
        issueUrl: issueUrl(links, input.issueId),
        issueId: input.issueId,
        eventId: input.eventId,
        issueTitle: input.issueTitle,
        issueStatus: input.issueStatus,
        timesSeen: input.timesSeen,
        ...(triggerTypes.includes("event_threshold")
          ? { recentEventCount, thresholdWindowMinutes: rule.thresholdWindowMinutes }
          : {}),
      };

      // Cooldown, delivery and its job commit together: a retried post-ingest job either finds
      // the cooldown taken (alert already queued) or queues it, never both or neither.
      await this.db.transaction(async (tx) => {
        if (!(await this.claimCooldown(tx, rule, input.issueId, now))) return;

        await this.deliveryQueue.queue(tx, {
          rule,
          payload,
          issueId: input.issueId,
          eventId: input.eventId,
        });
        await tx
          .update(alertRules)
          .set({ lastTriggeredAt: now, updatedAt: now })
          .where(eq(alertRules.id, rule.id));
      });
    }
  }

  async deliverTest(rule: typeof alertRules.$inferSelect, payload: AlertPayload) {
    return this.alertsDeliveryService.deliverToDestination(rule, payload);
  }

  /** Counts up to `threshold` events, which is all the decision needs, using the issue index. */
  private async countRecentEvents(
    issueId: string,
    rule: Pick<typeof alertRules.$inferSelect, "threshold" | "thresholdWindowMinutes">,
    now: Date,
  ) {
    const since = new Date(now.getTime() - rule.thresholdWindowMinutes * 60 * 1000);
    const recent = this.db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.issueId, issueId), gte(events.timestamp, since)))
      .limit(rule.threshold ?? 1)
      .as("recent");
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(recent);

    return row?.count ?? 0;
  }

  /**
   * Atomically starts the cooldown of this rule for this issue. Returns false while a previous
   * alert for the same issue is still cooling down, including when concurrent workers race.
   */
  private async claimCooldown(
    executor: Pick<DatabaseClient, "insert">,
    rule: Pick<typeof alertRules.$inferSelect, "id" | "cooldownMinutes">,
    issueId: string,
    now: Date,
  ) {
    const cutoff = new Date(now.getTime() - rule.cooldownMinutes * 60 * 1000);
    const claimed = await executor
      .insert(alertIssueCooldowns)
      .values({ alertRuleId: rule.id, issueId, lastTriggeredAt: now })
      .onConflictDoUpdate({
        target: [alertIssueCooldowns.alertRuleId, alertIssueCooldowns.issueId],
        set: { lastTriggeredAt: now },
        setWhere: lt(alertIssueCooldowns.lastTriggeredAt, cutoff),
      })
      .returning({ issueId: alertIssueCooldowns.issueId });

    return claimed.length > 0;
  }
}
