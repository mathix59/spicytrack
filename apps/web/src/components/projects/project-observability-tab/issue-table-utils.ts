import type { IssueDto, OrganizationMemberDto } from "@/generated/api";
import { renderNullableText } from "@/lib/utils";

/** The assignee's display name, or null when the issue is unassigned. */
function assigneeName(issue: IssueDto, memberByUserId: Map<string, OrganizationMemberDto>) {
  if (!issue.assignedUserId) return null;
  const member = memberByUserId.get(issue.assignedUserId);
  return renderNullableText(member?.name, member?.email ?? issue.assignedUserId);
}

export { assigneeName };
