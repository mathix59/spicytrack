import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function CopyButton({
  value,
  label = "Copy",
  showLabel = false,
  successMessage,
  className,
  variant = "ghost",
}: {
  value: string;
  label?: string;
  showLabel?: boolean;
  successMessage?: string;
  className?: string;
  variant?: "ghost" | "secondary" | "outline";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const Icon = copied ? Check : Copy;

  return (
    <Button
      aria-label={showLabel ? undefined : label}
      className={cn(copied && "text-success", className)}
      onClick={async () => setCopied(await copyToClipboard(value, successMessage))}
      size={showLabel ? "sm" : "icon-sm"}
      title={label}
      type="button"
      variant={variant}
    >
      <Icon />
      {showLabel ? (copied ? "Copied" : label) : null}
    </Button>
  );
}

export { CopyButton, copyToClipboard };
