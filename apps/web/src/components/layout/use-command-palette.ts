import { useEffect, useState } from "react";

function isPaletteShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
}

/** Opens on ⌘K / Ctrl+K from anywhere in the app shell. */
function useCommandPaletteShortcut(setOpen: (update: (open: boolean) => boolean) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      setOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);
}

function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(setOpen);
  return { open, setOpen };
}

export { useCommandPalette };
