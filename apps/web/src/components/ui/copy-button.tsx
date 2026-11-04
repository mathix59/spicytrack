import { type RefObject, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

function CopyButton({
  value,
  label = "Copy",
  showLabel = false,
  successMessage,
  className,
  variant = "ghost",
  selectOnFailure,
}: {
  value: string;
  label?: string;
  showLabel?: boolean;
  successMessage?: string;
  className?: string;
  variant?: "ghost" | "secondary" | "outline";
  /** Element whose text gets selected when the clipboard is unavailable, for a manual copy. */
  selectOnFailure?: RefObject<HTMLElement | null>;
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
      onClick={async () =>
        setCopied(
          await copyToClipboard(value, successMessage, {
            selectOnFailure: selectOnFailure?.current,
          }),
        )
      }
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

export { CopyButton };
