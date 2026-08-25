import { Menu } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import type { MeResponseDto } from "@/generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { APP_VERSION } from "@/lib/app-version";

import {
  AppShellBrand,
  AppShellOrgNav,
  AppShellOrgSwitcher,
  AppShellProjectsNav,
  AppShellUserMenu,
} from "./app-shell-sections";
import { AppUpdateNotice } from "./app-update-notice";
import { useAppShell } from "./use-app-shell";

function AppShell({
  me,
  currentOrgSlug,
  onLogout,
  children,
}: {
  me: MeResponseDto;
  currentOrgSlug?: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const state = useAppShell({ me, currentOrgSlug, onLogout });
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname, location.search]);

  const navigation = (
    <>
      <AppShellBrand />
      <AppShellOrgSwitcher
        currentOrgName={state.currentOrgName}
        currentOrgSlug={currentOrgSlug}
        me={me}
        navigate={state.navigate}
      />

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-3">
        <AppShellOrgNav
          currentOrgSlug={currentOrgSlug}
          isOrgPage={state.isOrgPage}
          orgTab={state.orgTab}
        />
        <AppShellProjectsNav
          activeProjectTab={state.activeProjectTab}
          currentIssueId={state.currentIssueId}
          currentOrgSlug={currentOrgSlug}
          currentProjectSlug={state.currentProjectSlug}
          projects={state.projects}
        />
      </nav>

      <AppUpdateNotice enabled={Boolean((me.user as { isSuperAdmin?: boolean }).isSuperAdmin)} />
      <AppShellUserMenu
        displayName={state.displayName}
        initials={state.initials}
        me={me}
        navigate={state.navigate}
        onLogout={state.handleLogout}
      />
    </>
  );

  return (
    <main className="min-h-screen bg-background text-foreground md:flex">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
        <Button
          aria-label="Open navigation"
          onClick={() => setMobileNavigationOpen(true)}
          ref={mobileNavigationTriggerRef}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Menu className="size-5" />
        </Button>
        <img alt="" className="size-5" src="/logo.svg" />
        <span className="truncate text-sm font-semibold tracking-tight">SpicyTrack</span>
        <span className="ms-2 rounded-full border border-muted-foreground/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {APP_VERSION}
        </span>
      </header>

      <Dialog onOpenChange={setMobileNavigationOpen} open={mobileNavigationOpen}>
        <DialogContent
          className="top-0 left-0 h-dvh w-[min(88vw,20rem)] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 md:hidden"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            mobileNavigationTriggerRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          {navigation}
        </DialogContent>
      </Dialog>

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        {navigation}
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {children}
      </section>
    </main>
  );
}

export { AppShell };
