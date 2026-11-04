import {
  Building2,
  Check,
  ChevronsUpDown,
  FolderKanban,
  LayoutGrid,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { MeResponseDto, ProjectDto } from "@/generated/api";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/app-version";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ShellLink } from "./app-shell-links";
import { AppShellUserMenu } from "./app-shell-user-menu";

function AppShellBrand() {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-4">
      <Link
        className="-m-1 flex items-center gap-2 rounded-md p-1 outline-none transition-colors hover:text-primary-accent focus-visible:ring-3 focus-visible:ring-ring/40"
        to="/app"
      >
        <img alt="" className="size-5" src="/logo.svg" />
        <span className="text-sm font-semibold tracking-tight">SpicyTrack</span>
      </Link>
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
        active={isOrgPage && orgTab === "audit"}
        icon={ScrollText}
        label="Audit log"
        to={`/orgs/${currentOrgSlug}?tab=audit`}
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

/** Sidebar footer entry to instance administration; rendered for super-admins only. */
function AppShellAdminLink({ active }: { active: boolean }) {
  return (
    <div className="border-t border-border px-3 py-2">
      <ShellLink active={active} icon={Shield} label="Instance admin" to="/admin" />
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

export {
  AppShellAdminLink,
  AppShellBrand,
  AppShellOrgNav,
  AppShellOrgSwitcher,
  AppShellProjectsNav,
  AppShellUserMenu,
};
