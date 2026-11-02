import { BellRing, Bug, GitBranch, KeyRound, Plug, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

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
    <nav aria-label="Project sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {PROJECT_TABS.map(({ value, label, icon: Icon }) => {
          const active = value === activeTab;
          return (
            <li key={value}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-primary-accent font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                to={`/orgs/${orgSlug}/projects/${projectSlug}?tab=${value}`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { ProjectTabsNav };
