import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

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
  const [issueStatusError, setIssueStatusError] = useState<string | null>(null);
  const [issueAssigneeError, setIssueAssigneeError] = useState<string | null>(null);
  const [issuePriorityError, setIssuePriorityError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [autofixError, setAutofixError] = useState<string | null>(null);
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
    setAutofixError(null);

    try {
      await triggerAutofixMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
      });
    } catch (error) {
      setAutofixError(getErrorMessage(error));
    }
  };

  const updateStatus = async (status: string, ignoredUntil?: string | null) => {
    setIssueStatusError(null);

    try {
      await updateIssueStatusMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { status, ignoredUntil },
      });
    } catch (error) {
      setIssueStatusError(getErrorMessage(error));
    }
  };

  const updateAssignee = async (assignedUserId: string) => {
    setIssueAssigneeError(null);

    try {
      await updateIssueAssigneeMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { assignedUserId: assignedUserId.length > 0 ? assignedUserId : null },
      });
    } catch (error) {
      setIssueAssigneeError(getErrorMessage(error));
    }
  };

  const updatePriority = async (priority: string) => {
    setIssuePriorityError(null);

    try {
      await updateIssuePriorityMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { priority: priority as never },
      });
    } catch (error) {
      setIssuePriorityError(getErrorMessage(error));
    }
  };

  const createComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCommentError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await createCommentMutation.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: { body: String(formData.get("body") ?? "") },
      });
      event.currentTarget.reset();
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
      navigate(`/orgs/${orgSlug}/projects/${projectSlug}/issues/${response.data.id}`);
    } catch (error) {
      setWorkflowError(getErrorMessage(error));
    }
  };

  const unmergeIssue = async () => {
    setWorkflowError(null);
    try {
      await unmergeIssueMutation.mutateAsync({ orgSlug, projectSlug, issueId });
    } catch (error) {
      setWorkflowError(getErrorMessage(error));
    }
  };

  return {
    orgSlug,
    projectSlug,
    issueId,
    projectName,
    issue,
    issueDetail,
    navigation: {
      previousIssue,
      nextIssue,
    },
    events: {
      selectedEvent,
      selectedEventId,
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
      issueAssigneeError,
      issuePriorityError,
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
      issueStatusError,
      autofixError,
      autofixInFlight,
      triggerAutofix,
      updateStatus,
      isUpdatingStatus: updateIssueStatusMutation.isPending,
      isTriggeringAutofix: triggerAutofixMutation.isPending,
    },
  };
}

export { useIssueDetailPage };
