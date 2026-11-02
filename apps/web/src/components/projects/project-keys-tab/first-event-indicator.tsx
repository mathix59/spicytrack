import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { formatLocalDateTime } from "@/lib/utils";

import type { FirstEventStatus } from "./types";

/** Live "waiting for / received first event" feedback at the end of the setup flow. */
function FirstEventIndicator({
  status,
  issuesHref,
}: {
  status: FirstEventStatus;
  issuesHref: string;
}) {
  if (status.state === "loading" || status.state === "unknown") {
    return null;
  }

  if (status.state === "waiting") {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-info/30 bg-info/5 px-3 py-2.5 text-sm"
        role="status"
      >
        <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-info" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Waiting for the first event…</span>
          <span className="block text-xs text-muted-foreground">
            This updates automatically once your SDK reports.
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-sm"
      role="status"
    >
      <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">First event received</span>
        {status.lastSeenAt ? (
          <span className="block text-xs text-muted-foreground">
            Latest issue seen {formatLocalDateTime(status.lastSeenAt)}
          </span>
        ) : null}
      </span>
      <Button asChild size="sm" variant="secondary">
        <Link to={issuesHref}>
          View issues
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

export { FirstEventIndicator };
