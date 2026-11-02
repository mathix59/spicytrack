import { useSyncExternalStore } from "react";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

// Keep in sync with public/theme-init.js, which applies the theme before first paint.
const STORAGE_KEY = "spicytrack-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") {
    return preference;
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

let preference: ThemePreference = typeof window === "undefined" ? "system" : readPreference();

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(preference);
  for (const listener of listeners) {
    listener();
  }
}

function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // Storage can be blocked; the choice still applies for this page load.
  }
  applyTheme();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (preference === "system") {
      applyTheme();
    }
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

function getSnapshot() {
  return `${preference}:${resolveTheme(preference)}`;
}

function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "system:dark");
  const [currentPreference, resolvedTheme] = snapshot.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];
  return { preference: currentPreference, resolvedTheme, setPreference: setThemePreference };
}

export { setThemePreference, useTheme };
export type { ResolvedTheme, ThemePreference };
