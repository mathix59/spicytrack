import { useEffect, useRef } from "react";

type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest("[role='dialog'], [role='menu'], [role='listbox']") !== null
  );
}

/**
 * Single-key shortcuts (`j`, `k`, `/`, ...) that stay inactive while the user types in a
 * field, works in a menu or dialog, or holds a modifier key.
 */
function useHotkeys(hotkeys: HotkeyMap, enabled = true) {
  const handlers = useRef(hotkeys);
  useEffect(() => {
    handlers.current = hotkeys;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const handler = handlers.current[event.key];
      if (!handler) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

export { useHotkeys };
