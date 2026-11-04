import { describe, expect, it } from "vitest";

import type { IssueActivityDto, IssueCommentDto, OrganizationMemberDto } from "@/generated/api";

import { buildTimelineEntries, statusToastLabel } from "./utils";

const member = (userId: string, name: string | null, email: string): OrganizationMemberDto => ({
  memberId: `m-${userId}`,
  role: "member",
  joinedAt: "2026-01-01T00:00:00Z",
  userId,
  email,
  name,
});

const activity = (
  id: string,
  type: string,
  createdAt: string,
  payload: Record<string, unknown> = {},
  actorUserId: string | null = "u1",
): IssueActivityDto => ({
  id,
  organizationId: "o",
  projectId: "p",
  issueId: "i",
  actorUserId,
  type,
  payload,
  createdAt,
});

const comment = (id: string, userId: string, createdAt: string): IssueCommentDto => ({
  id,
  organizationId: "o",
  projectId: "p",
  issueId: "i",
  userId,
  body: "Looking into it",
  createdAt,
  updatedAt: createdAt,
});

const members = new Map([
  ["u1", member("u1", "Ada", "ada@example.com")],
  ["u2", member("u2", null, "bob@example.com")],
]);

describe("buildTimelineEntries", () => {
  it("merges activity and comments, newest first", () => {
    const entries = buildTimelineEntries(
      [
        activity("a1", "issue.status_changed", "2026-11-01T10:00:00Z", { status: "resolved" }),
        activity("a2", "issue.assignee_changed", "2026-11-01T12:00:00Z", { assignedUserId: "u2" }),
      ],
      [comment("c1", "u2", "2026-11-01T11:00:00Z")],
      members,
    );

    expect(entries.map(({ id, label, actor }) => ({ id, label, actor }))).toEqual([
      { id: "activity:a2", label: "Assigned to bob@example.com", actor: "Ada" },
      { id: "comment:c1", label: "Comment", actor: "bob@example.com" },
      { id: "activity:a1", label: "Status changed to resolved", actor: "Ada" },
    ]);
  });

  it("skips comment activity, which the comments themselves already show", () => {
    const entries = buildTimelineEntries(
      [activity("a1", "issue.comment_added", "2026-11-01T10:00:00Z")],
      [],
      members,
    );

    expect(entries).toEqual([]);
  });

  it("describes unassignment, tickets, unknown types and system actors", () => {
    const entries = buildTimelineEntries(
      [
        activity("a1", "issue.assignee_changed", "2026-11-01T10:00:00Z", {}, null),
        activity("a2", "issue.ticket_created", "2026-11-01T09:00:00Z", { externalKey: "OPS-12" }),
        activity("a3", "issue.merged", "2026-11-01T08:00:00Z", {}, "gone"),
      ],
      [],
      members,
    );

    expect(entries.map(({ label, actor }) => ({ label, actor }))).toEqual([
      { label: "Unassigned", actor: "system" },
      { label: "Ticket OPS-12 created", actor: "Ada" },
      { label: "issue.merged", actor: "gone" },
    ]);
  });
});

describe("statusToastLabel", () => {
  it("describes each status change", () => {
    expect(statusToastLabel("resolved")).toBe("Issue resolved");
    expect(statusToastLabel("open")).toBe("Issue reopened");
    expect(statusToastLabel("ignored", null)).toBe("Issue ignored");
    expect(statusToastLabel("ignored", "2026-11-05T10:00:00Z")).toMatch(/^Issue snoozed until /);
    expect(statusToastLabel("archived")).toBe("Issue updated");
  });
});
