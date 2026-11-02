import { toast } from "sonner";

/** Copies text and reports the outcome with a toast; resolves to whether it succeeded. */
async function copyToClipboard(value: string, successMessage = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("Could not access the clipboard. Copy the value manually.");
    return false;
  }
}

export { copyToClipboard };
