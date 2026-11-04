import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import type { AutofixBlocker } from "./autofix-availability";

/** The visible explanation a disabled Autofix action points to with aria-describedby. */
function AutofixBlockerHint({
  id,
  blocker,
  className,
}: {
  id: string;
  blocker: AutofixBlocker;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)} id={id}>
      {blocker.message}{" "}
      {blocker.action ? (
        <Link className="font-medium text-primary-accent hover:underline" to={blocker.action.href}>
          {blocker.action.label}
        </Link>
      ) : null}
    </p>
  );
}

export { AutofixBlockerHint };
