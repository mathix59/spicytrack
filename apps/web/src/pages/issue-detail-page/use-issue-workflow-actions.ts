import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getGetIssueQueryKey,
  getListIssueActivityQueryKey,
  useMergeIssue,
  useUnmergeIssue,
  useUpdateIssueExternalLink,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

type IssueWorkflowActionsOptions = {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  navigate: (to: string) => void;
  /** Link to an issue within the list the page was opened from. */
  issuePath: (id: string) => string;
};

/** Ticket link by URL, merge and unmerge of the issue detail page. */
function useIssueWorkflowActions({
  orgSlug,
  projectSlug,
  issueId,
  navigate,
  issuePath,
}: IssueWorkflowActionsOptions) {
  const queryClient = useQueryClient();
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const invalidateIssueWorkflow = async () => {
    await invalidateQueryKeys(queryClient, [
      getGetIssueQueryKey(orgSlug, projectSlug, issueId),
      getListIssueActivityQueryKey(orgSlug, projectSlug, issueId),
    ]);
  };
  const updateExternalLinkMutation = useUpdateIssueExternalLink({
    mutation: { onSuccess: invalidateIssueWorkflow },
  });
  const mergeIssueMutation = useMergeIssue();
  const unmergeIssueMutation = useUnmergeIssue({
    mutation: { onSuccess: invalidateIssueWorkflow },
  });

  /** Links a ticket by URL (null or empty removes it). Rejects with the API error. */
  const updateExternalLink = async (url: string | null) => {
    await updateExternalLinkMutation.mutateAsync({
      orgSlug,
      projectSlug,
      issueId,
      data: { externalIssueUrl: url || null },
    });
    toast.success(url ? "Ticket linked" : "Linked ticket removed");
  };

  const mergeIssue = async (targetIssueId: string) => {
    setWorkflowError(null);
    try {
      const response = await mergeIssueMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { targetIssueId },
      });
      toast.success("Issues merged");
      navigate(issuePath(response.data.id));
    } catch (error) {
      setWorkflowError(getErrorMessage(error));
    }
  };

  const unmergeIssue = async () => {
    setWorkflowError(null);
    try {
      await unmergeIssueMutation.mutateAsync({ orgSlug, projectSlug, issueId });
      toast.success("Issue split back out with its original events");
    } catch (error) {
      setWorkflowError(getErrorMessage(error));
    }
  };

  return {
    workflowError,
    updateExternalLink,
    mergeIssue,
    unmergeIssue,
    isUpdatingExternalLink: updateExternalLinkMutation.isPending,
    isUpdatingWorkflow: mergeIssueMutation.isPending || unmergeIssueMutation.isPending,
  };
}

export { useIssueWorkflowActions };
