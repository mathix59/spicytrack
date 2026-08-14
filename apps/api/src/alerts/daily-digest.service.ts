import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { alertDeliveries, alertRules, events, issues } from "../database/schema";
import { AlertsDeliveryService } from "./alerts-delivery.service";
import type { AlertPayload } from "./alerts.types";

@Injectable()
export class DailyDigestService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly deliveryService: AlertsDeliveryService,
  ) {}

  async run(now = new Date()) {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rules = await this.db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.isActive, true),
          sql`${alertRules.triggerTypes} @> ARRAY['daily_digest']::text[]`,
        ),
      );

    for (const rule of rules) {
      if (rule.lastTriggeredAt && rule.lastTriggeredAt >= since) continue;
      const [eventCountRows, newIssueCountRows, regressionCountRows, topRegressions] =
        await Promise.all([
          this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(events)
            .where(and(eq(events.projectId, rule.projectId), sql`${events.timestamp} >= ${since}`)),
          this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(issues)
            .where(
              and(eq(issues.projectId, rule.projectId), sql`${issues.firstSeenAt} >= ${since}`),
            ),
          this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(issues)
            .where(
              and(
                eq(issues.projectId, rule.projectId),
                eq(issues.status, "open"),
                eq(issues.isRegressed, true),
              ),
            ),
          this.db
            .select({ title: issues.title, timesSeen: issues.timesSeen })
            .from(issues)
            .where(
              and(
                eq(issues.projectId, rule.projectId),
                eq(issues.status, "open"),
                eq(issues.isRegressed, true),
              ),
            )
            .orderBy(desc(issues.timesSeen), desc(issues.lastSeenAt))
            .limit(5),
        ]);

      const payload: AlertPayload = {
        triggerType: "daily_digest",
        triggerTypes: ["daily_digest"],
        projectId: rule.projectId,
        eventCount24h: eventCountRows[0]?.count ?? 0,
        newIssueCount24h: newIssueCountRows[0]?.count ?? 0,
        openRegressionCount: regressionCountRows[0]?.count ?? 0,
        topRegressions,
      };
      const result = await this.deliveryService.deliverToDestination(rule, payload);
      await this.db.insert(alertDeliveries).values({
        organizationId: rule.organizationId,
        projectId: rule.projectId,
        alertRuleId: rule.id,
        status: result.status,
        responseStatus: result.responseStatus,
        responseBody: result.responseBody,
        payload,
      });
      await this.db
        .update(alertRules)
        .set({ lastTriggeredAt: now, updatedAt: now })
        .where(eq(alertRules.id, rule.id));
    }
  }
}
