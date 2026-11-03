import { BellRing, Bug, GitBranch, KeyRound, Plug, ScrollText } from "lucide-react";
import { NavTabs } from "@/components/ui/nav-tabs";

import type { ProjectTab } from "./types";

const PROJECT_TABS: { value: ProjectTab; label: string; icon: typeof Bug }[] = [
  { value: "observability", label: "Issues", icon: Bug },
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
}: {
  orgSlug: string;
  projectSlug: string;
  activeTab: ProjectTab;
}) {
  return (
    <NavTabs
      items={PROJECT_TABS.map(({ value, label, icon }) => ({
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
