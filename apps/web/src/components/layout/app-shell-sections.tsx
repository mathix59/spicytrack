import {
  Building2,
  Check,
  ChevronsUpDown,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { MeResponseDto, ProjectDto } from "@/generated/api";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/app-version";
import { type ThemePreference, useTheme } from "@/lib/theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ShellLink } from "./app-shell-links";

function AppShellBrand() {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-4">
      <img alt="" className="size-5" src="/logo.svg" />
      <span className="text-sm font-semibold tracking-tight">SpicyTrack</span>
      <span className="ms-2 rounded-full border border-muted-foreground/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {APP_VERSION}
      </span>
    </div>
  );
}

function AppShellOrgSwitcher({
  me,
  currentOrgSlug,
  currentOrgName,
  navigate,
}: {
  me: MeResponseDto;
  currentOrgSlug?: string;
  currentOrgName?: string;
  navigate: (to: string) => void;
}) {
  return (
    <div className="border-b border-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            type="button"
          >
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-medium">
              {currentOrgName ?? "Select organization"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {me.memberships.map((membership) => (
            <DropdownMenuItem
              key={membership.slug}
              onClick={() => navigate(`/orgs/${membership.slug}`)}
            >
              <Building2 className="size-4" />
              <span className="flex-1 truncate">{membership.name}</span>
              {membership.slug === currentOrgSlug ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/app")}>
            <LayoutGrid className="size-4" />
            All organizations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AppShellOrgNav({
  currentOrgSlug,
  isOrgPage,
  orgTab,
}: {
  currentOrgSlug?: string;
  isOrgPage: boolean;
  orgTab: string;
}) {
  if (!currentOrgSlug) {
    return null;
  }

  return (
    <div className="grid gap-0.5">
      <ShellLink
        active={isOrgPage && orgTab === "projects"}
        icon={FolderKanban}
        label="Projects"
        to={`/orgs/${currentOrgSlug}?tab=projects`}
      />
      <ShellLink
        active={isOrgPage && orgTab === "members"}
        icon={Users}
        label="Members"
        to={`/orgs/${currentOrgSlug}?tab=members`}
      />
      <ShellLink
        active={isOrgPage && orgTab === "teams"}
        icon={UsersRound}
        label="Teams"
        to={`/orgs/${currentOrgSlug}?tab=teams`}
      />
      <ShellLink
        active={isOrgPage && orgTab === "roles"}
        icon={ShieldCheck}
        label="Roles"
        to={`/orgs/${currentOrgSlug}?tab=roles`}
      />
      <ShellLink
        active={isOrgPage && orgTab === "settings"}
        icon={Settings}
        label="Settings"
        to={`/orgs/${currentOrgSlug}?tab=settings`}
      />
    </div>
  );
}

function AppShellProjectsNav({
  currentOrgSlug,
  projects,
  currentProjectSlug,
  currentIssueId,
}: {
  currentOrgSlug?: string;
  projects: ProjectDto[];
  currentProjectSlug?: string;
  currentIssueId?: string;
}) {
  const [filter, setFilter] = useState("");

  if (!currentOrgSlug || projects.length === 0) {
    return null;
  }

  const normalizedFilter = filter.trim().toLowerCase();
  const visibleProjects = normalizedFilter
    ? projects.filter(
        (project) =>
          project.slug === currentProjectSlug ||
          project.name.toLowerCase().includes(normalizedFilter) ||
          project.slug.includes(normalizedFilter),
      )
    : projects;

  return (
    <div className="mt-6 grid gap-0.5">
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Projects
      </p>
      {projects.length > 8 ? (
        <label className="relative mx-1 mb-1 block">
          <span className="sr-only">Filter projects</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter projects"
            value={filter}
          />
        </label>
      ) : null}
      {visibleProjects.map((project) => {
        const isCurrent = currentProjectSlug === project.slug;

        return (
          <div key={project.id}>
            <Link
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                isCurrent
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={isCurrent ? (currentIssueId ? "location" : "page") : undefined}
              to={`/orgs/${currentOrgSlug}/projects/${project.slug}`}
            >
              <FolderKanban className={cn("size-4 shrink-0", isCurrent && "text-primary-accent")} />
              <span className="truncate">{project.name}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function AppShellThemeOptions() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Theme
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        onValueChange={(value) => setPreference(value as ThemePreference)}
        value={preference}
      >
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem
            className="gap-2"
            key={value}
            onSelect={(event) => event.preventDefault()}
            value={value}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

function AppShellUserMenu({
  me,
  displayName,
  initials,
  navigate,
  onLogout,
}: {
  me: MeResponseDto;
  displayName: string;
  initials: string;
  navigate: (to: string) => void;
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
            type="button"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">
              <span className="block truncate font-medium">{displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{me.user.email}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => navigate("/account")}>
            <UserCog className="size-4" />
            Account settings
          </DropdownMenuItem>
          {(me.user as { isSuperAdmin?: boolean }).isSuperAdmin && (
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <Shield className="size-4" />
              Instance administration
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <AppShellThemeOptions />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => void onLogout()}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export {
  AppShellBrand,
  AppShellOrgNav,
  AppShellOrgSwitcher,
  AppShellProjectsNav,
  AppShellUserMenu,
};
