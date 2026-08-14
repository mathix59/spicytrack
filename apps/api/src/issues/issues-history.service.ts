import { Inject, Injectable } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { issueActivity } from "../database/schema";

@Injectable()
export class IssuesHistoryService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
  ) {}

  async recordIssueChange(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    activityType: string;
    activityPayload: Record<string, unknown>;
    auditAction: string;
    auditPayload: Record<string, unknown>;
  }) {
    await this.recordIssueActivity({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      type: input.activityType,
      payload: input.activityPayload,
    });
    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: input.auditAction,
      targetType: "issue",
      targetId: input.issueId,
      payload: input.auditPayload,
    });
  }

  async recordBulkIssueChange(input: {
    organizationId: string;
    projectId: string;
    issueIds: string[];
    actorUserId: string;
    activityType: string;
    activityPayload: Record<string, unknown>;
    auditAction: string;
    auditPayload: Record<string, unknown>;
  }) {
    await Promise.all(
      input.issueIds.map((issueId) =>
        this.recordIssueActivity({
          organizationId: input.organizationId,
          projectId: input.projectId,
          issueId,
          actorUserId: input.actorUserId,
          type: input.activityType,
          payload: input.activityPayload,
        }),
      ),
    );
    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: input.auditAction,
      targetType: "issue",
      payload: input.auditPayload,
    });
  }

  async recordCommentCreation(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    commentId: string;
  }) {
    await this.recordIssueActivity({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      type: "issue.comment_added",
      payload: { commentId: input.commentId },
    });
    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "issue.comment.create",
      targetType: "issue_comment",
      targetId: input.commentId,
      payload: { issueId: input.issueId },
    });
  }

  async recordIssueActivity(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId?: string | null;
    type: string;
    payload: Record<string, unknown>;
  }) {
    await this.db.insert(issueActivity).values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      payload: input.payload,
    });
  }
}
