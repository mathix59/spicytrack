import { type ReactNode, useId, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Bordered section with a header that toggles its body. */
function CollapsibleSection({
  title,
  summary,
  actions,
  defaultOpen = true,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex min-h-11 items-center gap-2 px-4">
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {summary ? (
            <span className="truncate text-xs text-muted-foreground/80">{summary}</span>
          ) : null}
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {open ? (
        <div className={cn("border-t border-border", bodyClassName)} id={bodyId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export { CollapsibleSection };
