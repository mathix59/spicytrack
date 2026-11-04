import { describe, expect, it } from "vitest";

import { auditActionLabel, auditTargetLabel, humanizeAuditAction } from "./audit-labels";

describe("auditActionLabel", () => {
  it("labels known actions", () => {
    expect(auditActionLabel("instance.user.super_admin_revoked")).toBe("Revoked super admin");
    expect(auditActionLabel("instance.user.deleted")).toBe("Deleted user");
    expect(auditActionLabel("issue.comment.create")).toBe("Created comment");
    expect(auditActionLabel("project_key.rotate")).toBe("Rotated key");
  });

  it("calls an organization update that changed the name a rename", () => {
    expect(
      auditActionLabel("organization.updated", { previousName: "Acme", name: "Acme Inc" }),
    ).toBe("Renamed organization");
    expect(auditActionLabel("organization.updated", { previousName: "Acme", name: "Acme" })).toBe(
      "Updated organization",
    );
    expect(auditActionLabel("organization.updated")).toBe("Updated organization");
  });

  it("humanizes unknown actions instead of showing the key", () => {
    expect(auditActionLabel("widget.archived")).toBe("Archived widget");
  });
});

describe("humanizeAuditAction", () => {
  it("puts a trailing verb first, in the past tense", () => {
    expect(humanizeAuditAction("release.artifact.delete")).toBe("Deleted release artifact");
    expect(humanizeAuditAction("org.sso_settings.updated")).toBe("Updated org SSO settings");
  });

  it("reads actions without a verb as words", () => {
    expect(humanizeAuditAction("mcp.tool_call")).toBe("MCP tool call");
    expect(humanizeAuditAction("login")).toBe("Login");
    expect(humanizeAuditAction("")).toBe("");
  });
});

describe("auditTargetLabel", () => {
  it("names the target from the payload", () => {
    expect(
      auditTargetLabel("project_key.create", { name: "Browser", rateLimitPerMinute: 60 }),
    ).toBe("Browser");
    expect(auditTargetLabel("integration.repo.connected", { repoIdentifier: "acme/web" })).toBe(
      "acme/web",
    );
    expect(auditTargetLabel("team.created", { slug: "platform" })).toBe("platform");
  });

  it("shows renames and invitation roles", () => {
    expect(
      auditTargetLabel("organization.updated", { previousName: "Acme", name: "Acme Inc" }),
    ).toBe("Acme → Acme Inc");
    expect(
      auditTargetLabel("organization.invitation.created", { email: "ana@acme.dev", role: "admin" }),
    ).toBe("ana@acme.dev as admin");
    expect(auditTargetLabel("organization.member.role_updated", { role: "viewer" })).toBe(
      "as viewer",
    );
  });

  it("returns null without a usable field", () => {
    expect(auditTargetLabel("instance.user.deleted", {})).toBeNull();
    expect(auditTargetLabel("instance.user.deleted", null)).toBeNull();
    expect(auditTargetLabel("issue.comment.create", { issueId: "1" })).toBeNull();
    expect(auditTargetLabel("project.created", ["x"])).toBeNull();
  });
});
