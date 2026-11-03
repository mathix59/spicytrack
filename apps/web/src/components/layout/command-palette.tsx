import {
  BellRing,
  Bug,
  Building2,
  FolderKanban,
  GitBranch,
  KeyRound,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Plug,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import type { MeResponseDto, ProjectDto } from "@/generated/api";
import { type ThemePreference, useTheme } from "@/lib/theme";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const ORG_SECTIONS = [
  { tab: "projects", label: "Projects", icon: FolderKanban },
  { tab: "members", label: "Members", icon: Users },
  { tab: "teams", label: "Teams", icon: UsersRound },
  { tab: "roles", label: "Roles", icon: ShieldCheck },
  { tab: "audit", label: "Audit log", icon: ScrollText },
  { tab: "settings", label: "Organization settings", icon: Settings },
] as const;

const PROJECT_SECTIONS = [
  { tab: "observability", label: "Issues", icon: Bug },
  { tab: "inventory", label: "Releases", icon: GitBranch },
  { tab: "alerting", label: "Alerts", icon: BellRing },
  { tab: "keys", label: "Keys & DSN", icon: KeyRound },
  { tab: "integrations", label: "Integrations", icon: Plug },
  { tab: "audit", label: "Audit", icon: ScrollText },
] as const;

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Use system theme", icon: Monitor },
  { value: "light", label: "Switch to light theme", icon: Sun },
  { value: "dark", label: "Switch to dark theme", icon: Moon },
];

function PaletteItem({
  icon,
  children,
  shortcut,
  keywords,
  onSelect,
}: {
  icon: ReactNode;
  children: string;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}) {
  return (
    <CommandItem
      keywords={keywords}
      onSelect={onSelect}
      value={`${children} ${keywords?.join(" ") ?? ""}`}
    >
      {icon}
      <span className="truncate">{children}</span>
      {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  me,
  currentOrgSlug,
  currentProjectSlug,
  projects,
  navigate,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: MeResponseDto;
  currentOrgSlug?: string;
  currentProjectSlug?: string;
  projects: ProjectDto[];
  navigate: (to: string) => void;
  onLogout: () => void;
}) {
  const { setPreference } = useTheme();
  const currentProject = projects.find((project) => project.slug === currentProjectSlug);
  const isSuperAdmin = Boolean((me.user as { isSuperAdmin?: boolean }).isSuperAdmin);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby="command-palette-description"
        className="top-[12vh] w-[min(94vw,36rem)] translate-y-0 gap-0 overflow-hidden p-0 [&>button:last-child]:hidden"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only" id="command-palette-description">
          Search for pages, projects and actions.
        </DialogDescription>
        <Command loop>
          <CommandInput
            aria-label="Search commands"
            placeholder="Search pages, projects and actions…"
          />
          <CommandList className="max-h-[min(60vh,26rem)]">
            <CommandEmpty>No matching command.</CommandEmpty>

            {currentProject && currentOrgSlug ? (
              <CommandGroup heading={currentProject.name}>
                {PROJECT_SECTIONS.map(({ tab, label, icon: Icon }) => (
                  <PaletteItem
                    icon={<Icon />}
                    key={tab}
                    keywords={[currentProject.name, "project"]}
                    onSelect={() =>
                      run(() =>
                        navigate(
                          `/orgs/${currentOrgSlug}/projects/${currentProject.slug}?tab=${tab}`,
                        ),
                      )
                    }
                  >
                    {label}
                  </PaletteItem>
                ))}
              </CommandGroup>
            ) : null}

            {currentOrgSlug && projects.length > 0 ? (
              <CommandGroup heading="Projects">
                {projects.map((project) => (
                  <PaletteItem
                    icon={<FolderKanban />}
                    key={project.id}
                    keywords={[project.slug, project.platform]}
                    onSelect={() =>
                      run(() => navigate(`/orgs/${currentOrgSlug}/projects/${project.slug}`))
                    }
                  >
                    {project.name}
                  </PaletteItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandGroup heading="Navigation">
              <PaletteItem icon={<LayoutGrid />} onSelect={() => run(() => navigate("/app"))}>
                Dashboard
              </PaletteItem>
              {currentOrgSlug
                ? ORG_SECTIONS.map(({ tab, label, icon: Icon }) => (
                    <PaletteItem
                      icon={<Icon />}
                      key={tab}
                      keywords={["organization"]}
                      onSelect={() => run(() => navigate(`/orgs/${currentOrgSlug}?tab=${tab}`))}
                    >
                      {label}
                    </PaletteItem>
                  ))
                : null}
              <PaletteItem icon={<UserCog />} onSelect={() => run(() => navigate("/account"))}>
                Account settings
              </PaletteItem>
              {isSuperAdmin ? (
                <PaletteItem icon={<Shield />} onSelect={() => run(() => navigate("/admin"))}>
                  Instance administration
                </PaletteItem>
              ) : null}
            </CommandGroup>

            {me.memberships.length > 1 ? (
              <CommandGroup heading="Switch organization">
                {me.memberships
                  .filter((membership) => membership.slug !== currentOrgSlug)
                  .map((membership) => (
                    <PaletteItem
                      icon={<Building2 />}
                      key={membership.slug}
                      keywords={[membership.slug, "organization"]}
                      onSelect={() => run(() => navigate(`/orgs/${membership.slug}`))}
                    >
                      {membership.name}
                    </PaletteItem>
                  ))}
              </CommandGroup>
            ) : null}

            <CommandGroup heading="Preferences">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <PaletteItem
                  icon={<Icon />}
                  key={value}
                  keywords={["theme", "appearance"]}
                  onSelect={() => run(() => setPreference(value))}
                >
                  {label}
                </PaletteItem>
              ))}
              <PaletteItem icon={<LogOut />} onSelect={() => run(onLogout)}>
                Sign out
              </PaletteItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>↑↓ to navigate</span>
            <span>↵ to open</span>
            <span className="ms-auto">esc to close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export { CommandPalette };
