import {
  BellRing,
  Bug,
  Building2,
  Check,
  ChevronsUpDown,
  FolderKanban,
  GitBranch,
  KeyRound,
  LayoutGrid,
  LogOut,
  Plug,
  ScrollText,
  Shield,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { MeResponseDto, ProjectDto } from "@/generated/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ProjectSectionLink, ShellLink } from "./app-shell-links";

function AppShellBrand() {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-4">
      <img alt="" className="size-5" src="/logo.svg" />
      <span className="text-sm font-semibold tracking-tight">SpicyTrack</span>
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
        icon={Shield}
        label="Roles"
        to={`/orgs/${currentOrgSlug}?tab=roles`}
      />
      <ShellLink
        active={isOrgPage && orgTab === "settings"}
        icon={Shield}
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
  activeProjectTab,
}: {
  currentOrgSlug?: string;
  projects: ProjectDto[];
  currentProjectSlug?: string;
  currentIssueId?: string;
  activeProjectTab: string;
}) {
  if (!currentOrgSlug || projects.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 grid gap-0.5">
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Projects
      </p>
      {projects.map((project) => {
        const isCurrent = currentProjectSlug === project.slug;

        return (
          <div key={project.id}>
            <Link
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isCurrent && !currentIssueId
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              to={`/orgs/${currentOrgSlug}/projects/${project.slug}`}
            >
              <FolderKanban className="size-4 shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
            {isCurrent ? (
              <div className="ml-4 grid gap-0.5 border-l border-border pl-2 pt-0.5">
                <ProjectSectionLink
                  active={Boolean(currentIssueId) || activeProjectTab === "observability"}
                  icon={Bug}
                  label="Issues"
                  to={`/orgs/${currentOrgSlug}/projects/${project.slug}?tab=observability`}
                />
                <ProjectSectionLink
                  active={activeProjectTab === "inventory"}
                  icon={GitBranch}
                  label="Releases"
                  to={`/orgs/${currentOrgSlug}/projects/${project.slug}?tab=inventory`}
                />
                <ProjectSectionLink
                  active={activeProjectTab === "alerting"}
                  icon={BellRing}
                  label="Alerts"
                  to={`/orgs/${currentOrgSlug}/projects/${project.slug}?tab=alerting`}
                />
                <ProjectSectionLink
                  active={activeProjectTab === "keys"}
                  icon={KeyRound}
                  label="Keys"
                  to={`/orgs/${currentOrgSlug}/projects/${project.slug}?tab=keys`}
                />
                <ProjectSectionLink
                  active={activeProjectTab === "integrations"}
                  icon={Plug}
                  label="Integrations"
                  to={`/orgs/${currentOrgSlug}/projects/${project.slug}?tab=integrations`}
                />
                <ProjectSectionLink
                  active={activeProjectTab === "audit"}
                  icon={ScrollText}
                  label="Audit"
                  to={`/orgs/${currentOrgSlug}/projects/${project.slug}?tab=audit`}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
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
