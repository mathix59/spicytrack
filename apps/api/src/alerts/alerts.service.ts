import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { alertDeliveries, alertRules } from "../database/schema";
import { AlertsExecutionService } from "./alerts-execution.service";

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
    private readonly alertsExecutionService: AlertsExecutionService,
  ) {}

  async listRules(projectId: string) {
    return this.db
      .select()
      .from(alertRules)
      .where(eq(alertRules.projectId, projectId))
      .orderBy(desc(alertRules.createdAt));
  }

  async createRule(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    name: string;
    triggerType: string;
    threshold?: number | null;
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
        triggerType: input.triggerType,
        threshold: input.threshold ?? null,
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
        triggerType: rule.triggerType,
        threshold: rule.threshold,
        destinationType: rule.destinationType,
      },
    });

    return rule;
  }

  async updateRule(input: {
    organizationId: string;
    projectId: string;
    alertRuleId: string;
    actorUserId: string;
    name?: string;
    isActive?: boolean;
    triggerType?: string;
    threshold?: number | null;
    cooldownMinutes?: number;
    destinationType?: string;
    destinationTarget?: string;
  }) {
    const [rule] = await this.db
      .update(alertRules)
      .set({
        name: input.name,
        isActive: input.isActive,
        triggerType: input.triggerType,
        threshold: input.threshold,
        cooldownMinutes: input.cooldownMinutes,
        destinationType: input.destinationType,
        destinationTarget: input.destinationTarget,
        updatedAt: new Date(),
      })
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
      action: "alert_rule.update",
      targetType: "alert_rule",
      targetId: rule.id,
      payload: {
        name: input.name,
        isActive: input.isActive,
        triggerType: input.triggerType,
        threshold: input.threshold,
        cooldownMinutes: input.cooldownMinutes,
        destinationType: input.destinationType,
      },
    });

    return rule;
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
