import { toast } from "sonner";

/**
 * Legacy copy for plain-HTTP self-hosted instances, where `navigator.clipboard` does not exist
 * outside secure contexts: copies from a hidden, temporarily focused textarea.
 */
function copyWithTextarea(value: string) {
  if (typeof document === "undefined" || !document.body) return false;

  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previousFocus?.focus?.();
  }
}

/** Selects the text of an input, textarea or any element so the user can copy it by hand. */
function selectText(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.select();
    return;
  }

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  element.focus?.();
}

async function writeText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Permission denied or insecure context: try the legacy path below.
    }
  }
  return copyWithTextarea(value);
}

/**
 * Copies text and reports the outcome with a toast; resolves to whether it succeeded. When both
 * clipboard paths fail, `selectOnFailure` gets its text selected so the user can copy it manually.
 */
async function copyToClipboard(
  value: string,
  successMessage = "Copied to clipboard",
  options: { selectOnFailure?: HTMLElement | null } = {},
) {
  if (await writeText(value)) {
    toast.success(successMessage);
    return true;
  }

  if (options.selectOnFailure) {
    selectText(options.selectOnFailure);
    toast.error("Could not access the clipboard. The value is selected: copy it manually.");
  } else {
    toast.error("Could not access the clipboard. Copy the value manually.");
  }
  return false;
}

export { copyToClipboard };
