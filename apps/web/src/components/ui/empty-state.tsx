import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function EmptyState({
  title,
  description,
  action,
  icon: Icon = CircleDashed,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-background text-primary">
        <Icon className="size-5" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 max-w-xl leading-6">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
