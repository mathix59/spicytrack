import { BellRing, Bug, GitBranch, KeyRound, Plug, Rocket, ScrollText } from "lucide-react";
import { NavTabs } from "@/components/ui/nav-tabs";

import type { ProjectTab } from "./types";

const PROJECT_TABS: { value: ProjectTab; label: string; icon: typeof Bug }[] = [
  { value: "observability", label: "Issues", icon: Bug },
  { value: "setup", label: "Setup", icon: Rocket },
  { value: "inventory", label: "Releases", icon: GitBranch },
  { value: "alerting", label: "Alerts", icon: BellRing },
  { value: "keys", label: "Keys & DSN", icon: KeyRound },
  { value: "integrations", label: "Integrations", icon: Plug },
  { value: "audit", label: "Audit", icon: ScrollText },
];

/** In-page section navigation, so project sections stay reachable without the sidebar. */
function ProjectTabsNav({
  orgSlug,
  projectSlug,
  activeTab,
  showSetup,
}: {
  orgSlug: string;
  projectSlug: string;
  activeTab: ProjectTab;
  /** The setup wizard is listed until the project receives its first event. */
  showSetup: boolean;
}) {
  return (
    <NavTabs
      items={PROJECT_TABS.filter(
        ({ value }) => value !== "setup" || showSetup || activeTab === "setup",
      ).map(({ value, label, icon }) => ({
        to: `/orgs/${orgSlug}/projects/${projectSlug}?tab=${value}`,
        label,
        icon,
        active: value === activeTab,
      }))}
      label="Project sections"
    />
  );
}

export { ProjectTabsNav };
