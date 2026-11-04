/** Setup Autofix needs before a run can start, in setup order. */
type AutofixRequirement = "repository" | "ai_key" | "enabled";

/** What the viewer may do about Autofix, and what the project still lacks. */
type AutofixAccess = {
  missing: AutofixRequirement[];
  canRun: boolean;
  canManageAutofix: boolean;
  canManageIntegrations: boolean;
  canManageOrganizationSettings: boolean;
};

type AutofixBlocker = {
  /** One sentence, also used as the button's title. */
  message: string;
  /** The setting that unblocks it, for people who can change it. */
  action: { label: string; href: string } | null;
};

/** Why the viewer cannot start Autofix here, or null when they can. */
function autofixBlocker(
  access: AutofixAccess,
  orgSlug: string,
  projectSlug: string,
): AutofixBlocker | null {
  if (!access.canRun) {
    return {
      message: "You don't have permission to run Autofix in this project.",
      action: null,
    };
  }
  const integrations = `/orgs/${orgSlug}/projects/${projectSlug}?tab=integrations`;
  switch (access.missing[0]) {
    case "repository":
      return access.canManageIntegrations
        ? {
            message: "Autofix needs a repository connected to this project.",
            action: {
              label: "Connect a repository in project integrations",
              href: `${integrations}&integration=repository`,
            },
          }
        : {
            message:
              "Autofix needs a repository connected to this project. Ask a project admin to connect one.",
            action: null,
          };
    case "ai_key":
      return access.canManageOrganizationSettings
        ? {
            message: "Autofix needs an AI provider key for this organization.",
            action: {
              label: "Add an AI key in organization settings",
              href: `/orgs/${orgSlug}?tab=settings&section=ai`,
            },
          }
        : {
            message:
              "Autofix needs an AI provider key for this organization. Ask an organization admin to add one.",
            action: null,
          };
    case "enabled":
      return access.canManageAutofix
        ? {
            message: "Autofix is turned off for this project.",
            action: {
              label: "Enable Autofix in project integrations",
              href: `${integrations}&integration=autofix`,
            },
          }
        : {
            message: "Autofix is turned off for this project. Ask a project admin to enable it.",
            action: null,
          };
    default:
      return null;
  }
}

export { autofixBlocker };
export type { AutofixAccess, AutofixBlocker, AutofixRequirement };
