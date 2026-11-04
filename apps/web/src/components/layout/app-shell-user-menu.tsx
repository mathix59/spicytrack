import { ChevronsUpDown, LogOut, Monitor, Moon, Shield, Sun, UserCog } from "lucide-react";

import type { MeResponseDto } from "@/generated/api";
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

export { AppShellUserMenu };
