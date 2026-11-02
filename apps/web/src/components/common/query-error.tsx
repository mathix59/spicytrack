import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

/** Inline error state for a failed query, with an optional retry. */
function QueryError({
  title = "Could not load this data",
  error,
  onRetry,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center"
      role="alert"
    >
      <AlertTriangle className="size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {error ? (
          <p className="mt-0.5 text-muted-foreground [overflow-wrap:anywhere]">
            {getErrorMessage(error)}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="secondary">
          <RotateCw />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export { QueryError };
