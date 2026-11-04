/** What each audit action reads as in the log. Keys are the actions the API records. */
const ACTION_LABELS: Record<string, string> = {
  "alert_rule.create": "Created alert rule",
  "alert_rule.update": "Updated alert rule",
  "alert_rule.delete": "Deleted alert rule",
  "alert_rule.test": "Sent test alert",
  "alert_rule.signing_secret.rotate": "Rotated alert signing secret",
  "audit.exported": "Exported audit log",
  "autofix.analyzed": "Autofix analyzed issue",
  "autofix.config.updated": "Updated Autofix settings",
  "autofix.failed": "Autofix run failed",
  "autofix.fix_requested": "Requested Autofix fix",
  "autofix.pull_request.auto_merge_failed": "Autofix auto-merge failed",
  "autofix.pull_request.auto_merged": "Auto-merged Autofix pull request",
  "autofix.succeeded": "Autofix run succeeded",
  "autofix.triggered": "Started Autofix",
  "instance.settings.updated": "Updated instance settings",
  "instance.smtp.test_email_sent": "Sent SMTP test email",
  "instance.user.deleted": "Deleted user",
  "instance.user.super_admin_granted": "Granted super admin",
  "instance.user.super_admin_revoked": "Revoked super admin",
  "integration.repo.connected": "Connected repository",
  "integration.repo.disconnected": "Disconnected repository",
  "integration.slack.connected": "Connected Slack",
  "integration.slack.disconnected": "Disconnected Slack",
  "integration.ticket_tracker.created": "Added ticket tracker",
  "integration.ticket_tracker.deleted": "Removed ticket tracker",
  "issue.assignee.update": "Assigned issue",
  "issue.assignee.bulk_update": "Assigned issues",
  "issue.comment.create": "Created comment",
  "issue.external_link.update": "Updated issue link",
  "issue.merge": "Merged issues",
  "issue.unmerge": "Unmerged issue",
  "issue.priority.update": "Changed issue priority",
  "issue.priority.bulk_update": "Changed priority of issues",
  "issue.status.update": "Changed issue status",
  "issue.status.bulk_update": "Changed status of issues",
  "issue.ticket.create": "Created ticket",
  "issue.triage.generated": "Generated AI triage",
  "mcp.credential.created": "Created MCP credential",
  "mcp.credential.revoked": "Revoked MCP credential",
  "mcp.credential.rotated": "Rotated MCP credential",
  "mcp.enabled": "Enabled MCP",
  "mcp.disabled": "Disabled MCP",
  "mcp.tool.called": "Called MCP tool",
  "member.removed": "Removed member",
  "org.ai_pricing_overrides.updated": "Updated AI pricing overrides",
  "org.ai_settings.updated": "Updated AI settings",
  "org.github_app_settings.updated": "Updated GitHub App settings",
  "organization.invitation.created": "Invited member",
  "organization.invitation.revoked": "Revoked invitation",
  "organization.member.removed": "Removed member",
  "organization.member.role_updated": "Changed member role",
  "organization.role.created": "Created role",
  "organization.role.updated": "Updated role",
  "organization.role.deleted": "Deleted role",
  "organization.updated": "Updated organization",
  "project.created": "Created project",
  "project.update": "Updated project settings",
  "project_key.create": "Created key",
  "project_key.update": "Updated key",
  "project_key.rotate": "Rotated key",
  "team.created": "Created team",
  "team.updated": "Updated team",
  "team.deleted": "Deleted team",
  "team.member.added": "Added team member",
  "team.member.removed": "Removed team member",
  "team.role.created": "Created team role",
  "team.role.updated": "Updated team role",
  "team.role.deleted": "Deleted team role",
};

/** Present-tense verbs actions end with, and how they read in the past tense. */
const VERBS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  remove: "Removed",
  rotate: "Rotated",
  revoke: "Revoked",
  test: "Tested",
  merge: "Merged",
  unmerge: "Unmerged",
};

const ACRONYMS: Record<string, string> = { ai: "AI", mcp: "MCP", smtp: "SMTP", sso: "SSO" };

function words(segments: string[]) {
  return segments
    .flatMap((segment) => segment.split("_"))
    .filter(Boolean)
    .map((word) => ACRONYMS[word] ?? word)
    .join(" ");
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "widget.archived" → "Archived widget", "widget.config.update" → "Updated widget config": a
 * readable fallback for actions without a label, putting the verb first when there is one.
 */
function humanizeAuditAction(action: string) {
  const segments = action.split(".").filter(Boolean);
  const last = segments.at(-1) ?? "";
  const verb = VERBS[last] ?? (/^[a-z]+ed$/.test(last) ? capitalize(last) : null);
  if (verb && segments.length > 1) return `${verb} ${words(segments.slice(0, -1))}`;
  return capitalize(words(segments)) || action;
}

function stringField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function isRename(action: string, payload: Record<string, unknown>) {
  const previousName = stringField(payload, "previousName");
  const name = stringField(payload, "name");
  return (
    action.endsWith(".updated") && previousName !== null && name !== null && previousName !== name
  );
}

/** The human label of an audit action, e.g. "Revoked super admin". */
function auditActionLabel(action: string, payload?: unknown) {
  if (action === "organization.updated" && isRename(action, asRecord(payload))) {
    return "Renamed organization";
  }
  return ACTION_LABELS[action] ?? humanizeAuditAction(action);
}

/** Payload fields that name what an action changed, best first. */
const TARGET_FIELDS = ["email", "name", "teamName", "repoIdentifier", "tool", "key", "slug"];

/**
 * What the action was done to, when the entry says so: "Acme → Acme Inc" for a rename,
 * "ana@example.com as admin" for an invitation, a key or rule name otherwise.
 */
function auditTargetLabel(action: string, payload: unknown) {
  const record = asRecord(payload);
  if (isRename(action, record)) {
    return `${stringField(record, "previousName")} → ${stringField(record, "name")}`;
  }
  const target = TARGET_FIELDS.map((field) => stringField(record, field)).find(Boolean) ?? null;
  const role = stringField(record, "role");
  if (role && (action.includes("invitation") || action.includes("role_updated"))) {
    return target ? `${target} as ${role}` : `as ${role}`;
  }
  return target;
}

export { auditActionLabel, auditTargetLabel, humanizeAuditAction };
