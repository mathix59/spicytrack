import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getListIssuesQueryKey, useSendProjectTestEvent } from "@/generated/api";
import { readApiErrorMessage } from "@/lib/api-error";

/**
 * Sends a sample error through the real ingest pipeline, so users can check grouping,
 * alerts and integrations before wiring the SDK.
 */
function TestEventButton({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  const queryClient = useQueryClient();
  const mutation = useSendProjectTestEvent({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey(orgSlug, projectSlug) }),
    },
  });
  const result = mutation.data?.data;

  return (
    <div className="grid gap-2">
      <Button
        className="justify-self-start"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ orgSlug, projectSlug })}
        type="button"
        variant="secondary"
      >
        <Send />
        {mutation.isPending ? "Sending…" : result ? "Send another test event" : "Send test event"}
      </Button>
      <div aria-live="polite" className="text-sm">
        {mutation.isError ? (
          <p className="flex items-start gap-2 text-destructive">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {readApiErrorMessage(mutation.error)}
          </p>
        ) : result && !result.stored ? (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            The test event was dropped by an inbound filter ({result.reason ?? "filtered"}).
          </p>
        ) : result ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
            Test event stored: ingestion, grouping and alerts work.
            {result.issueId ? (
              <Link
                className="font-medium text-primary-accent underline-offset-4 hover:underline"
                to={`/orgs/${orgSlug}/projects/${projectSlug}/issues/${result.issueId}`}
              >
                View the test issue
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { TestEventButton };
