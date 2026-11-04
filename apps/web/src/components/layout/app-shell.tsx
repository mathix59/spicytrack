import { Menu, Search } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import type { MeResponseDto } from "@/generated/api";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { APP_VERSION } from "@/lib/app-version";

import {
  AppShellBrand,
  AppShellOrgNav,
  AppShellOrgSwitcher,
  AppShellProjectsNav,
  AppShellUserMenu,
} from "./app-shell-sections";
import { AppUpdateNotice } from "./app-update-notice";
import { CommandPalette } from "./command-palette";
import { useCommandPalette } from "./use-command-palette";
import { useAppShell } from "./use-app-shell";

const IS_APPLE_PLATFORM =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent);

function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="px-3 pt-3">
      <button
        aria-keyshortcuts={IS_APPLE_PLATFORM ? "Meta+K" : "Control+K"}
        className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
        onClick={onOpen}
        type="button"
      >
        <Search aria-hidden="true" className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>{IS_APPLE_PLATFORM ? "⌘K" : "Ctrl K"}</Kbd>
      </button>
    </div>
  );
}

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
  const palette = useCommandPalette();

  // Close the mobile navigation on navigation. A pathname never contains "?", so the
  // concatenation identifies the (pathname, search) pair.
  const locationKey = location.pathname + location.search;
  const [navigationLocationKey, setNavigationLocationKey] = useState(locationKey);
  if (locationKey !== navigationLocationKey) {
    setNavigationLocationKey(locationKey);
    setMobileNavigationOpen(false);
  }

  const navigation = (
    <>
      <AppShellBrand />
      <AppShellOrgSwitcher
        currentOrgName={state.currentOrgName}
        currentOrgSlug={currentOrgSlug}
        me={me}
        navigate={state.navigate}
      />
      <CommandPaletteTrigger onOpen={() => palette.setOpen(() => true)} />

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-3">
        <AppShellOrgNav
          currentOrgSlug={currentOrgSlug}
          isOrgPage={state.isOrgPage}
          orgTab={state.orgTab}
        />
        <AppShellProjectsNav
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
    <div className="min-h-screen bg-background text-foreground md:flex">
      <a
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#main-content"
      >
        Skip to content
      </a>
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
        <Button
          aria-label="Search"
          className="order-last ms-auto"
          onClick={() => palette.setOpen(() => true)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Search className="size-4" />
        </Button>
        <span className="ms-2 rounded-full border border-muted-foreground/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {APP_VERSION}
        </span>
      </header>

      <Sheet onOpenChange={setMobileNavigationOpen} open={mobileNavigationOpen}>
        <SheetContent
          aria-describedby={undefined}
          className="gap-0 md:hidden"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            mobileNavigationTriggerRef.current?.focus();
          }}
          side="left"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {navigation}
        </SheetContent>
      </Sheet>

      <CommandPalette
        currentOrgSlug={currentOrgSlug}
        currentProjectSlug={state.currentProjectSlug}
        me={me}
        navigate={state.navigate}
        onLogout={() => void state.handleLogout()}
        onOpenChange={(open) => palette.setOpen(() => open)}
        open={palette.open}
        projects={state.projects}
      />

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        {navigation}
      </aside>

      <main
        className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
        id="main-content"
        tabIndex={-1}
      >
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}

export { AppShell };
