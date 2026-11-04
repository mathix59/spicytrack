import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, ThumbsDown, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import {
  getListIssueActivityQueryKey,
  getListIssueAutofixRunsQueryKey,
  useReviewAutofixRun,
  useStartAutofixFix,
} from "@/generated/api";
import type { AutofixRunDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

import type { AutofixBlocker } from "./autofix-availability";
import { AutofixBlockerHint } from "./autofix-blocker-hint";

type RunScope = { orgSlug: string; projectSlug: string; issueId: string };

/** Generate (or retry) the fix of an analyzed run. */
function GenerateFixAction({
  run,
  scope,
  blocker,
}: {
  run: AutofixRunDto;
  scope: RunScope;
  blocker: AutofixBlocker | null;
}) {
  const queryClient = useQueryClient();
  const hintId = `autofix-fix-unavailable-${run.id}`;
  const startFix = useStartAutofixFix({
    mutation: {
      onSuccess: () => {
        toast.success("Generating the fix", {
          description: "A pull request opens once the repository's CI passes on it.",
        });
        return invalidateQueryKeys(queryClient, [
          getListIssueAutofixRunsQueryKey(scope.orgSlug, scope.projectSlug, scope.issueId),
        ]);
      },
      onError: (error) =>
        toast.error("Could not generate the fix", { description: getErrorMessage(error) }),
    },
  });

  return (
    <div className="grid gap-1.5 border-t border-border pt-2">
      <Button
        aria-describedby={blocker ? hintId : undefined}
        aria-disabled={blocker ? true : undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        disabled={startFix.isPending}
        onClick={() => {
          if (!blocker) {
            startFix.mutate({
              orgSlug: scope.orgSlug,
              projectSlug: scope.projectSlug,
              runId: run.id,
            });
          }
        }}
        size="sm"
        title={blocker?.message}
        type="button"
        variant={run.analysis?.fixable && !blocker ? "default" : "outline"}
      >
        {startFix.isPending ? (
          <LoaderCircle className="motion-safe:animate-spin" />
        ) : (
          <WandSparkles />
        )}
        {run.status === "failed" ? "Retry the fix" : "Generate fix"}
      </Button>
      {blocker ? (
        <AutofixBlockerHint blocker={blocker} className="text-[11px]" id={hintId} />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Pushes a branch, waits for your CI, then opens a pull request if it passes.
        </p>
      )}
    </div>
  );
}

/** Approve or reject a run that opened a pull request; shows the decision once made. */
function ReviewActions({
  run,
  scope,
  canReview,
}: {
  run: AutofixRunDto;
  scope: RunScope;
  canReview: boolean;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const review = useReviewAutofixRun();
  const reviewStatus = run.reviewStatus ?? "pending";

  async function submit(status: "approved" | "rejected") {
    try {
      await review.mutateAsync({
        orgSlug: scope.orgSlug,
        projectSlug: scope.projectSlug,
        runId: run.id,
        data:
          status === "rejected" && comment.trim()
            ? { status, comment: comment.trim() }
            : { status },
      });
    } catch (error) {
      toast.error(
        status === "approved" ? "Could not approve the proposal" : "Could not reject the proposal",
        { description: getErrorMessage(error) },
      );
      throw error;
    }
    setComment("");
    await invalidateQueryKeys(queryClient, [
      getListIssueAutofixRunsQueryKey(scope.orgSlug, scope.projectSlug, scope.issueId),
      getListIssueActivityQueryKey(scope.orgSlug, scope.projectSlug, scope.issueId),
    ]);
  }

  if (reviewStatus !== "pending") {
    return (
      <div className="grid gap-1 border-t border-border pt-2">
        <Badge className="w-fit" variant={reviewStatus === "approved" ? "success" : "muted"}>
          {reviewStatus === "approved" ? "Approved" : "Rejected"}
        </Badge>
        {run.reviewComment ? (
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {run.reviewComment}
          </p>
        ) : null}
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="border-t border-border pt-2">
        <Badge variant="muted">Awaiting review</Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
      <ConfirmDialog
        confirmLabel="Approve"
        description="Marks the proposal approved and records it in the issue activity. It does not merge or change the pull request: merge it on your Git host."
        destructive={false}
        onConfirm={() => submit("approved")}
        successMessage="Proposal approved"
        title="Approve this Autofix proposal?"
        trigger={
          <Button disabled={review.isPending} size="sm" type="button" variant="outline">
            <Check className="size-3.5" /> Approve
          </Button>
        }
      />
      <ConfirmDialog
        confirmLabel="Reject"
        description="Marks the proposal rejected and records it in the issue activity. The pull request stays open: close it on your Git host."
        onConfirm={() => submit("rejected")}
        onOpenChange={(open) => {
          if (!open) setComment("");
        }}
        successMessage="Proposal rejected"
        title="Reject this Autofix proposal?"
        trigger={
          <Button disabled={review.isPending} size="sm" type="button" variant="ghost">
            <ThumbsDown className="size-3.5" /> Reject
          </Button>
        }
      >
        <Field hint="Optional. Shown with the decision." label="Comment">
          <Textarea
            maxLength={2000}
            name="reviewComment"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Why the fix is not right"
            value={comment}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

export { GenerateFixAction, ReviewActions };
export type { RunScope };
