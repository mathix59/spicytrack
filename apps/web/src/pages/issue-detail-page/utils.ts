import { formatLocalDateTime, renderNullableText } from "@/lib/utils";
import type { IssueActivityDto, IssueCommentDto } from "@/generated/api";

import type { MemberByUserId, TimelineEntry } from "./types";

function formatTimelineDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return formatLocalDateTime(value);
}

function formatActivityLabel(type: string) {
  switch (type) {
    case "issue.status_changed":
      return "Status changed";
    case "issue.assignee_changed":
      return "Assignee changed";
    case "issue.comment_added":
      return "Comment added";
    default:
      return type;
  }
}

function describeActivity(entry: IssueActivityDto, memberByUserId: MemberByUserId) {
  const payload = (entry.payload ?? {}) as Record<string, unknown>;

  if (entry.type === "issue.status_changed" && typeof payload.status === "string") {
    return `Status changed to ${payload.status}`;
  }

  if (entry.type === "issue.assignee_changed") {
    const assignedUserId =
      typeof payload.assignedUserId === "string" ? payload.assignedUserId : null;

    if (!assignedUserId) {
      return "Unassigned";
    }

    const member = memberByUserId.get(assignedUserId);
    return `Assigned to ${renderNullableText(member?.name, member?.email ?? "a member")}`;
  }

  return formatActivityLabel(entry.type);
}

function buildTimelineEntries(
  activity: IssueActivityDto[],
  comments: IssueCommentDto[],
  memberByUserId: MemberByUserId,
): TimelineEntry[] {
  return [
    ...activity
      .filter((entry) => entry.type !== "issue.comment_added")
      .map((entry) => ({
        id: `activity:${entry.id}`,
        createdAt: entry.createdAt,
        label: describeActivity(entry, memberByUserId),
        actor: entry.actorUserId
          ? renderNullableText(
              memberByUserId.get(entry.actorUserId)?.name,
              memberByUserId.get(entry.actorUserId)?.email ?? entry.actorUserId,
            )
          : "system",
        body: null,
      })),
    ...comments.map((comment) => ({
      id: `comment:${comment.id}`,
      createdAt: comment.createdAt,
      label: "Comment",
      actor: renderNullableText(
        memberByUserId.get(comment.userId)?.name,
        memberByUserId.get(comment.userId)?.email ?? comment.userId,
      ),
      body: comment.body,
    })),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export { buildTimelineEntries, formatTimelineDate };
