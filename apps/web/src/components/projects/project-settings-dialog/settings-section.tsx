import { type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

/** Titled group of fields inside the project settings dialog. */
function SettingsSection({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "grid gap-4 rounded-lg border p-4",
        danger ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/10",
      )}
    >
      <div className="grid gap-1">
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            danger ? "text-destructive" : "text-muted-foreground",
          )}
          id={headingId}
        >
          {title}
        </h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export { SettingsSection };
