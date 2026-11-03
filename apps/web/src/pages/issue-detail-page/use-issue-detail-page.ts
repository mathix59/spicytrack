import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  type EventDto,
  type IssueActivityDto,
  type IssueCommentDto,
  type OrganizationMemberDto,
  getGetIssueQueryKey,
  getListIssueActivityQueryKey,
  getListIssueCommentsQueryKey,
  getListIssueAutofixRunsQueryKey,
  useCreateIssueComment,
  useGetEvent,
  useGetIssue,
  useGetProject,
  useListIssueActivity,
  useListIssueAutofixRuns,
  useListIssueComments,
  useListIssues,
  useListOrganizationMembers,
  useTriggerAutofix,
  useUpdateIssueAssignee,
  useUpdateIssuePriority,
  useUpdateIssueStatus,
  useUpdateIssueExternalLink,
  useMergeIssue,
  useUnmergeIssue,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { useIssueTrends } from "@/features/issues/use-issue-trends";
import { useHotkeys } from "@/lib/use-hotkeys";
import { getErrorMessage } from "@/lib/utils";

import type { IssuePageData } from "./types";
import { buildTimelineEntries } from "./utils";

const EVENT_PAGE_SIZE = 20;
const EMPTY_MEMBERS: OrganizationMemberDto[] = [];
const EMPTY_COMMENTS: IssueCommentDto[] = [];
const EMPTY_ACTIVITY: IssueActivityDto[] = [];
const EMPTY_EVENTS: EventDto[] = [];

function useIssueDetailPage(): IssuePageData {
  const { orgSlug = "", projectSlug = "", issueId = "" } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const projectQuery = useGetProject(orgSlug, projectSlug);
  const membersQuery = useListOrganizationMembers(orgSlug);
  const issueQuery = useGetIssue(orgSlug, projectSlug, issueId, {
    eventPage,
    eventPageSize: EVENT_PAGE_SIZE,
  });
  const issueStreamQuery = useListIssues(orgSlug, projectSlug, {
    page: 1,
    pageSize: 100,
    sortBy: "lastSeenAt",
    sortDir: "desc",
  } as never);
  const eventQuery = useGetEvent(orgSlug, projectSlug, selectedEventId ?? "", {
    query: { enabled: Boolean(selectedEventId) },
  });
  const commentsQuery = useListIssueComments(orgSlug, projectSlug, issueId);
  const activityQuery = useListIssueActivity(orgSlug, projectSlug, issueId);
  const autofixRunsQuery = useListIssueAutofixRuns(orgSlug, projectSlug, issueId);

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

  const projectName = projectQuery.data?.data?.name ?? "Project";
  const members = membersQuery.data?.data ?? EMPTY_MEMBERS;
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const comments = commentsQuery.data?.data ?? EMPTY_COMMENTS;
  const activity = activityQuery.data?.data ?? EMPTY_ACTIVITY;
  const issueDetail = issueQuery.data?.data;
  const issue = issueDetail?.issue;
  const events = issueDetail?.events.items ?? EMPTY_EVENTS;
  const totalEvents = issueDetail?.events.total ?? 0;
  const totalEventPages = Math.max(1, Math.ceil(totalEvents / EVENT_PAGE_SIZE));
  const safeEventPage = Math.min(eventPage, totalEventPages);
  const selectedEvent = eventQuery.data?.data;
  const firstEventId = events[0]?.id;
  const issueStream = issueStreamQuery.data?.data.items ?? [];
  const currentIssueIndex = issueStream.findIndex((entry) => entry.id === issueId);
  const previousIssue = currentIssueIndex > 0 ? issueStream[currentIssueIndex - 1] : null;
  const nextIssue =
    currentIssueIndex >= 0 && currentIssueIndex < issueStream.length - 1
      ? issueStream[currentIssueIndex + 1]
      : null;
  const timelineEntries = useMemo(
    () => buildTimelineEntries(activity, comments, memberByUserId),
    [activity, comments, memberByUserId],
  );
  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const hasSelectedEvent = !selectedEventId || eventIds.includes(selectedEventId);
  const selectedEventIndex = events.findIndex((event) => event.id === selectedEventId);
  const globalEventNumber =
    selectedEventIndex >= 0 ? (safeEventPage - 1) * EVENT_PAGE_SIZE + selectedEventIndex + 1 : null;
  const canGoNewer = selectedEventIndex > 0 || safeEventPage > 1;
  const canGoOlder =
    (selectedEventIndex >= 0 && selectedEventIndex < events.length - 1) ||
    safeEventPage < totalEventPages;
  const autofixInFlight = (autofixRunsQuery.data?.data ?? []).some(
    (run) => run.status === "queued" || run.status === "running",
  );

  useEffect(() => {
    if (!selectedEventId && firstEventId) {
      setSelectedEventId(firstEventId);
    }
  }, [firstEventId, selectedEventId]);

  useEffect(() => {
    if (selectedEventId && !hasSelectedEvent) {
      setSelectedEventId(null);
    }
  }, [hasSelectedEvent, selectedEventId]);

  useEffect(() => {
    if (eventPage !== safeEventPage) {
      setEventPage(safeEventPage);
    }
  }, [eventPage, safeEventPage]);

  const goNewer = () => {
    if (selectedEventIndex > 0) {
      setSelectedEventId(events[selectedEventIndex - 1].id);
      return;
    }

    if (safeEventPage > 1) {
      setEventPage(safeEventPage - 1);
      setSelectedEventId(null);
    }
  };

  const goOlder = () => {
    if (selectedEventIndex >= 0 && selectedEventIndex < events.length - 1) {
      setSelectedEventId(events[selectedEventIndex + 1].id);
      return;
    }

    if (safeEventPage < totalEventPages) {
      setEventPage(safeEventPage + 1);
      setSelectedEventId(null);
    }
  };

  const triggerAutofix = async () => {
    try {
      await triggerAutofixMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
      });
      toast.success("Autofix started", {
        description: "Progress appears in the Autofix card.",
      });
    } catch (error) {
      toast.error("Could not start Autofix", { description: getErrorMessage(error) });
    }
  };

  const updateStatus = async (
    status: string,
    ignoredUntil?: string | null,
    { undoable = true }: { undoable?: boolean } = {},
  ) => {
    const previousStatus = issue?.status;

    try {
      await updateIssueStatusMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { status, ignoredUntil },
      });
      toast.success(statusToastLabel(status, ignoredUntil), {
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

  const updateExternalLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorkflowError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await updateExternalLinkMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { externalIssueUrl: String(formData.get("externalIssueUrl") ?? "") || null },
      });
      toast.success("External ticket saved");
    } catch (error) {
      setWorkflowError(getErrorMessage(error));
    }
  };

  const mergeIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorkflowError(null);
    const targetIssueId = String(new FormData(event.currentTarget).get("targetIssueId") ?? "");
    try {
      const response = await mergeIssueMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { targetIssueId },
      });
      toast.success("Issues merged");
      navigate(`/orgs/${orgSlug}/projects/${projectSlug}/issues/${response.data.id}`);
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

  const issuePath = (id: string) => `/orgs/${orgSlug}/projects/${projectSlug}/issues/${id}`;
  useHotkeys({
    j: () => nextIssue && navigate(issuePath(nextIssue.id)),
    k: () => previousIssue && navigate(issuePath(previousIssue.id)),
    "[": goNewer,
    "]": goOlder,
  });

  const trendByIssueId = useIssueTrends({
    orgSlug,
    projectSlug,
    issueIds: issueId ? [issueId] : [],
    period: "14d",
  });

  return {
    orgSlug,
    projectSlug,
    issueId,
    trend: trendByIssueId.get(issueId),
    projectName,
    issue,
    issueDetail,
    issueQuery: {
      isLoading: issueQuery.isLoading,
      error: issueQuery.error,
      refetch: () => void issueQuery.refetch(),
    },
    navigation: {
      previousIssue,
      nextIssue,
    },
    events: {
      selectedEvent,
      selectedEventId,
      isLoadingEvent: eventQuery.isLoading,
      eventError: eventQuery.error,
      retryEvent: () => void eventQuery.refetch(),
      totalEvents,
      globalEventNumber,
      canGoNewer,
      canGoOlder,
      goNewer,
      goOlder,
    },
    comments: {
      comments,
      commentError,
      createComment,
      isSubmitting: createCommentMutation.isPending,
    },
    sidebar: {
      members,
      memberByUserId,
      timelineEntries,
      workflowError,
      updateAssignee,
      updatePriority,
      updateExternalLink,
      mergeIssue,
      unmergeIssue,
      isUpdatingAssignee: updateIssueAssigneeMutation.isPending,
      isUpdatingPriority: updateIssuePriorityMutation.isPending,
      isUpdatingWorkflow:
        updateExternalLinkMutation.isPending ||
        mergeIssueMutation.isPending ||
        unmergeIssueMutation.isPending,
    },
    actions: {
      autofixInFlight,
      triggerAutofix,
      updateStatus,
      isUpdatingStatus: updateIssueStatusMutation.isPending,
      isTriggeringAutofix: triggerAutofixMutation.isPending,
    },
  };
}

export { useIssueDetailPage };

function statusToastLabel(status: string, ignoredUntil?: string | null) {
  if (status === "resolved") return "Issue resolved";
  if (status === "open") return "Issue reopened";
  if (status === "ignored") {
    return ignoredUntil
      ? `Issue snoozed until ${new Date(ignoredUntil).toLocaleString()}`
      : "Issue ignored";
  }
  return "Issue updated";
}
