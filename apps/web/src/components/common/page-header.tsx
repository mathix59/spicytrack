import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary">
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
          {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
