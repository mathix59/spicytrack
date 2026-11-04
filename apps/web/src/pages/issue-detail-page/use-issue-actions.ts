import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getGetIssueQueryKey,
  getListIssueActivityQueryKey,
  getListIssueAutofixRunsQueryKey,
  getListIssueCommentsQueryKey,
  useCreateIssueComment,
  useTriggerAutofix,
  useUpdateIssueAssignee,
  useUpdateIssuePriority,
  useUpdateIssueStatus,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

import type { MemberByUserId } from "./types";
import { statusToastLabel } from "./utils";

type IssueActionsOptions = {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  /** The issue's current status, restored by the status toast's Undo. */
  issueStatus: string | undefined;
  memberByUserId: MemberByUserId;
};

/** Autofix, status, assignee, priority and comment mutations of the issue detail page. */
function useIssueActions({
  orgSlug,
  projectSlug,
  issueId,
  issueStatus,
  memberByUserId,
}: IssueActionsOptions) {
  const queryClient = useQueryClient();
  const [commentError, setCommentError] = useState<string | null>(null);

  const triggerAutofixMutation = useTriggerAutofix({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getListIssueAutofixRunsQueryKey(orgSlug, projectSlug, issueId),
        ]);
      },
    },
  });
  const updateIssueStatusMutation = useUpdateIssueStatus({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getGetIssueQueryKey(orgSlug, projectSlug, issueId),
          getListIssueActivityQueryKey(orgSlug, projectSlug, issueId),
        ]);
      },
    },
  });
  const updateIssueAssigneeMutation = useUpdateIssueAssignee({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getGetIssueQueryKey(orgSlug, projectSlug, issueId),
          getListIssueActivityQueryKey(orgSlug, projectSlug, issueId),
        ]);
      },
    },
  });
  const updateIssuePriorityMutation = useUpdateIssuePriority({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getGetIssueQueryKey(orgSlug, projectSlug, issueId),
        ]);
      },
    },
  });
  const createCommentMutation = useCreateIssueComment({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getListIssueCommentsQueryKey(orgSlug, projectSlug, issueId),
          getListIssueActivityQueryKey(orgSlug, projectSlug, issueId),
        ]);
      },
    },
  });

  const triggerAutofix = async () => {
    try {
      await triggerAutofixMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
      });
      toast.success("Root-cause analysis started", {
        description: "It reads your code without changing it. You decide on the fix next.",
      });
    } catch (error) {
      toast.error("Could not start Autofix", { description: getErrorMessage(error) });
    }
  };

  const updateStatus = async (
    status: string,
    ignoredUntil?: string | null,
    {
      undoable = true,
      resolution,
    }: { undoable?: boolean; resolution?: "now" | "next_release" } = {},
  ) => {
    const previousStatus = issueStatus;

    try {
      await updateIssueStatusMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { status, ignoredUntil, ...(resolution ? { resolution } : {}) },
      });
      const label =
        resolution === "next_release"
          ? "Issue resolved in the next release"
          : statusToastLabel(status, ignoredUntil);
      toast.success(label, {
        action:
          undoable && previousStatus && previousStatus !== status
            ? {
                label: "Undo",
                onClick: () => void updateStatus(previousStatus, null, { undoable: false }),
              }
            : undefined,
      });
    } catch (error) {
      toast.error("Could not update the issue status", { description: getErrorMessage(error) });
    }
  };

  const updateAssignee = async (assignedUserId: string) => {
    try {
      await updateIssueAssigneeMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { assignedUserId: assignedUserId.length > 0 ? assignedUserId : null },
      });
      const member = memberByUserId.get(assignedUserId);
      toast.success(member ? `Assigned to ${member.name || member.email}` : "Issue unassigned");
    } catch (error) {
      toast.error("Could not update the assignee", { description: getErrorMessage(error) });
    }
  };

  const updatePriority = async (priority: string) => {
    try {
      await updateIssuePriorityMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { priority: priority as never },
      });
    } catch (error) {
      toast.error("Could not update the priority", { description: getErrorMessage(error) });
    }
  };

  const createComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCommentError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      await createCommentMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { body: String(formData.get("body") ?? "") },
      });
      form.reset();
    } catch (error) {
      setCommentError(getErrorMessage(error));
    }
  };

  return {
    commentError,
    createComment,
    triggerAutofix,
    updateAssignee,
    updatePriority,
    updateStatus,
    isSubmittingComment: createCommentMutation.isPending,
    isTriggeringAutofix: triggerAutofixMutation.isPending,
    isUpdatingAssignee: updateIssueAssigneeMutation.isPending,
    isUpdatingPriority: updateIssuePriorityMutation.isPending,
    isUpdatingStatus: updateIssueStatusMutation.isPending,
  };
}

export { useIssueActions };
