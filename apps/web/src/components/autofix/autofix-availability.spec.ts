import { describe, expect, it } from "vitest";

import { type AutofixAccess, autofixBlocker } from "./autofix-availability";

const ADMIN: AutofixAccess = {
  missing: [],
  canRun: true,
  canManageAutofix: true,
  canManageIntegrations: true,
  canManageOrganizationSettings: true,
};

describe("autofixBlocker", () => {
  it("does not block a viewer who can run Autofix in a ready project", () => {
    expect(autofixBlocker(ADMIN, "acme", "web")).toBeNull();
  });

  it("explains a missing permission before any setup", () => {
    expect(
      autofixBlocker({ ...ADMIN, canRun: false, missing: ["enabled"] }, "acme", "web"),
    ).toEqual({
      message: "You don't have permission to run Autofix in this project.",
      action: null,
    });
  });

  it("points managers at the first missing setting", () => {
    expect(
      autofixBlocker({ ...ADMIN, missing: ["ai_key", "enabled"] }, "acme", "web")?.action,
    ).toEqual({
      label: "Add an AI key in organization settings",
      href: "/orgs/acme?tab=settings&section=ai",
    });
    expect(autofixBlocker({ ...ADMIN, missing: ["enabled"] }, "acme", "web")?.action).toEqual({
      label: "Enable Autofix in project integrations",
      href: "/orgs/acme/projects/web?tab=integrations&integration=autofix",
    });
  });

  it("asks people who cannot change the setting to ask an admin", () => {
    const blocker = autofixBlocker(
      { ...ADMIN, canManageAutofix: false, missing: ["enabled"] },
      "acme",
      "web",
    );
    expect(blocker?.action).toBeNull();
    expect(blocker?.message).toContain("Ask a project admin");
  });
});
