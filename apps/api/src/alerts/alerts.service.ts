import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { alertDeliveries, alertIssueCooldowns, alertRules } from "../database/schema";
import { loadProjectLinks } from "./alert-links";
import type { DestinationType } from "./alerts.types";
import { AlertsExecutionService } from "./alerts-execution.service";

/**
 * Webhook, Slack, Teams and Discord URLs carry their own credentials, so they are never sent
 * back in full: only the host and the last characters, enough to recognise the destination.
 */
export function maskDestinationTarget(destinationType: string, target: string): string {
  if (destinationType === "email") return target;
  try {
    const url = new URL(target);
    const tail = target.length > 12 ? target.slice(-4) : "";
    return `${url.protocol}//${url.host}/…${tail}`;
  } catch {
    return "…";
  }
}

function serializeRule(rule: typeof alertRules.$inferSelect) {
  const { lastDigestAt: _lastDigestAt, ...publicRule } = rule;
  return {
    ...publicRule,
    destinationTarget: maskDestinationTarget(rule.destinationType, rule.destinationTarget),
    triggerType: rule.triggerTypes[0],
  };
}

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
    private readonly alertsExecutionService: AlertsExecutionService,
  ) {}

  async listRules(projectId: string) {
    const rules = await this.db
      .select()
      .from(alertRules)
      .where(eq(alertRules.projectId, projectId))
      .orderBy(desc(alertRules.createdAt));
    return rules.map(serializeRule);
  }

  async createRule(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    name: string;
    triggerTypes: string[];
    threshold?: number | null;
    thresholdWindowMinutes?: number;
    cooldownMinutes?: number;
    destinationType: string;
    destinationTarget: string;
  }) {
    const [rule] = await this.db
      .insert(alertRules)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        name: input.name,
        triggerTypes: input.triggerTypes,
        threshold: input.threshold ?? null,
        thresholdWindowMinutes: input.thresholdWindowMinutes ?? 60,
        cooldownMinutes: input.cooldownMinutes ?? 30,
        destinationType: input.destinationType,
        destinationTarget: input.destinationTarget,
      })
      .returning();

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "alert_rule.create",
      targetType: "alert_rule",
      targetId: rule.id,
      payload: {
        name: rule.name,
        triggerTypes: rule.triggerTypes,
        threshold: rule.threshold,
        destinationType: rule.destinationType,
      },
    });

    return serializeRule(rule);
  }

  async updateRule(input: {
    organizationId: string;
    projectId: string;
    alertRuleId: string;
    actorUserId: string;
    name?: string;
    isActive?: boolean;
    triggerTypes?: string[];
    threshold?: number | null;
    thresholdWindowMinutes?: number;
    cooldownMinutes?: number;
    /** Resolves the new destination from the rule's current type. */
    destination?: (currentType: DestinationType) => {
      destinationType: DestinationType;
      destinationTarget?: string;
    };
  }) {
    const ruleScope = and(
      eq(alertRules.organizationId, input.organizationId),
      eq(alertRules.projectId, input.projectId),
      eq(alertRules.id, input.alertRuleId),
    );
    let destination: ReturnType<NonNullable<typeof input.destination>> | undefined;

    if (input.destination) {
      const [current] = await this.db
        .select({ destinationType: alertRules.destinationType })
        .from(alertRules)
        .where(ruleScope)
        .limit(1);

      if (!current) {
        throw new NotFoundException("Alert rule not found");
      }

      destination = input.destination(current.destinationType as DestinationType);
    }

    const [rule] = await this.db
      .update(alertRules)
      .set({
        name: input.name,
        isActive: input.isActive,
        triggerTypes: input.triggerTypes,
        threshold: input.threshold,
        thresholdWindowMinutes: input.thresholdWindowMinutes,
        cooldownMinutes: input.cooldownMinutes,
        destinationType: destination?.destinationType,
        destinationTarget: destination?.destinationTarget,
        updatedAt: new Date(),
      })
      .where(ruleScope)
      .returning();

    if (!rule) {
      throw new NotFoundException("Alert rule not found");
    }
    await this.db.delete(alertIssueCooldowns).where(eq(alertIssueCooldowns.alertRuleId, rule.id));

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "alert_rule.update",
      targetType: "alert_rule",
      targetId: rule.id,
      payload: {
        name: input.name,
        isActive: input.isActive,
        triggerTypes: input.triggerTypes,
        threshold: input.threshold,
        thresholdWindowMinutes: input.thresholdWindowMinutes,
        cooldownMinutes: input.cooldownMinutes,
        destinationType: destination?.destinationType,
        destinationTargetChanged: destination?.destinationTarget !== undefined,
      },
    });

    return serializeRule(rule);
  }

  async deleteRule(input: {
    organizationId: string;
    projectId: string;
    alertRuleId: string;
    actorUserId: string;
  }) {
    const [rule] = await this.db
      .delete(alertRules)
      .where(
        and(
          eq(alertRules.organizationId, input.organizationId),
          eq(alertRules.projectId, input.projectId),
          eq(alertRules.id, input.alertRuleId),
        ),
      )
      .returning();

    if (!rule) {
      throw new NotFoundException("Alert rule not found");
    }

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "alert_rule.delete",
      targetType: "alert_rule",
      targetId: rule.id,
      payload: {
        name: rule.name,
      },
    });

    return { success: true };
  }

  async testRule(input: {
    organizationId: string;
    projectId: string;
    alertRuleId: string;
    actorUserId: string;
  }) {
    const [rule] = await this.db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.organizationId, input.organizationId),
          eq(alertRules.projectId, input.projectId),
          eq(alertRules.id, input.alertRuleId),
        ),
      )
      .limit(1);

    if (!rule) {
      throw new NotFoundException("Alert rule not found");
    }

    const links = await loadProjectLinks(this.db, input.projectId);
    const payload = {
      triggerType: "test",
      triggerTypes: ["test"],
      projectId: input.projectId,
      projectName: links.projectName,
      projectUrl: links.projectUrl,
      issueTitle: `Test alert: ${rule.name}`,
      issueStatus: "test",
      timesSeen: 1,
      isTest: true,
    };
    const result = await this.alertsExecutionService.deliverTest(rule, payload);
    const [delivery] = await this.db
      .insert(alertDeliveries)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        alertRuleId: rule.id,
        status: result.status,
        responseStatus: result.responseStatus,
        responseBody: result.responseBody,
        payload,
      })
      .returning();

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "alert_rule.test",
      targetType: "alert_rule",
      targetId: rule.id,
      payload: { status: delivery.status, destinationType: rule.destinationType },
    });

    return delivery;
  }

  async listDeliveries(projectId: string) {
    return this.db
      .select()
      .from(alertDeliveries)
      .where(eq(alertDeliveries.projectId, projectId))
      .orderBy(desc(alertDeliveries.createdAt))
      .limit(100);
  }

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
    return this.alertsExecutionService.handleEvent(input);
  }
}
