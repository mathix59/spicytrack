import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const hintId = `${generatedId}-hint`;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-labelledby":
          (children.props as Record<string, unknown>)["aria-labelledby"] ?? labelId,
        ...(hint
          ? {
              "aria-describedby": [
                (children.props as Record<string, unknown>)["aria-describedby"],
                hintId,
              ]
                .filter(Boolean)
                .join(" "),
            }
          : {}),
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="grid gap-1">
        <span className="text-sm font-medium text-foreground" id={labelId}>
          {label}
        </span>
        {hint ? (
          <p className="text-xs text-muted-foreground" id={hintId}>
            {hint}
          </p>
        ) : null}
      </div>
      {control}
    </div>
  );
}

export { Field };
