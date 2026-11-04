import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";

import {
  type EventDto,
  type IssueActivityDto,
  type IssueCommentDto,
  type OrganizationMemberDto,
  useGetEvent,
  useGetIssue,
  useGetProject,
  useListIssueActivity,
  useListIssueAutofixRuns,
  useListIssueComments,
  useGetIssueNeighbors,
  useListOrganizationMembers,
} from "@/generated/api";
import {
  issueListContext,
  issueListContextFilters,
  withIssueListContext,
} from "@/features/issues/issue-list-context";
import { autofixBlocker } from "@/components/autofix/autofix-availability";
import { useIssueTrends } from "@/features/issues/use-issue-trends";
import { useHotkeys } from "@/lib/use-hotkeys";

import { createEventNavigation, type EventPageEdge } from "./event-navigation";
import type { IssuePageData } from "./types";
import { useIssueActions } from "./use-issue-actions";
import { useIssueCapabilities } from "./use-issue-capabilities";
import { useIssueWorkflowActions } from "./use-issue-workflow-actions";
import { buildTimelineEntries } from "./utils";

const EVENT_PAGE_SIZE = 20;
const EMPTY_MEMBERS: OrganizationMemberDto[] = [];
const EMPTY_COMMENTS: IssueCommentDto[] = [];
const EMPTY_ACTIVITY: IssueActivityDto[] = [];
const EMPTY_EVENTS: EventDto[] = [];

function useIssueDetailPage(): IssuePageData {
  const { orgSlug = "", projectSlug = "", issueId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listContextKey = issueListContext(searchParams).toString();
  const listContext = useMemo(() => new URLSearchParams(listContextKey), [listContextKey]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  // Which end of a newly loaded event page to select when no event is selected yet: the last
  // one when stepping or jumping towards older events across a page, the first otherwise.
  const [pageEntryEdge, setPageEntryEdge] = useState<EventPageEdge>("first");

  const projectQuery = useGetProject(orgSlug, projectSlug);
  const membersQuery = useListOrganizationMembers(orgSlug);
  // The previous event page of this issue stays on screen while the next one loads; another
  // issue never shows the previous one's data.
  const issueQuery = useGetIssue(
    orgSlug,
    projectSlug,
    issueId,
    { eventPage, eventPageSize: EVENT_PAGE_SIZE },
    {
      query: {
        placeholderData: (previous) =>
          previous?.data.issue.id === issueId ? keepPreviousData(previous) : undefined,
      },
    },
  );
  const neighborsQuery = useGetIssueNeighbors(
    orgSlug,
    projectSlug,
    issueId,
    issueListContextFilters(listContext),
    // A malformed search only breaks j/k; the list itself reports the error.
    { query: { retry: false } },
  );
  const eventQuery = useGetEvent(orgSlug, projectSlug, selectedEventId ?? "", {
    query: { enabled: Boolean(selectedEventId) },
  });
  const commentsQuery = useListIssueComments(orgSlug, projectSlug, issueId);
  const activityQuery = useListIssueActivity(orgSlug, projectSlug, issueId);
  const autofixRunsQuery = useListIssueAutofixRuns(orgSlug, projectSlug, issueId);
  const capabilities = useIssueCapabilities(orgSlug, projectSlug);

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
  // Missing or retained data is not a response for the requested page yet.
  const eventsSettled = Boolean(issueDetail) && !issueQuery.isPlaceholderData;
  const safeEventPage = eventsSettled ? Math.min(eventPage, totalEventPages) : eventPage;
  const selectedEvent = eventQuery.data?.data;
  const entryEventId = (pageEntryEdge === "last" ? events.at(-1) : events[0])?.id;
  const projectPath = `/orgs/${orgSlug}/projects/${projectSlug}`;
  const issuePath = (id: string) =>
    withIssueListContext(`${projectPath}/issues/${id}`, listContext);
  const neighbors = neighborsQuery.isSuccess ? neighborsQuery.data.data : null;
  const previousIssueHref = neighbors?.previousIssueId
    ? issuePath(neighbors.previousIssueId)
    : null;
  const nextIssueHref = neighbors?.nextIssueId ? issuePath(neighbors.nextIssueId) : null;
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
    (run) => run.status === "queued" || run.status === "running" || run.status === "checking",
  );

  // Keep the selection and page consistent with the loaded events. These adjust state during
  // render (each is guarded, so it settles after at most one extra render) instead of in effects.
  if (eventsSettled && !selectedEventId && entryEventId) {
    setSelectedEventId(entryEventId);
  } else if (eventsSettled && selectedEventId && !hasSelectedEvent) {
    setSelectedEventId(null);
  }

  if (eventPage !== safeEventPage) {
    setEventPage(safeEventPage);
  }

  const { goNewer, goOlder, goNewest, goOldest } = createEventNavigation({
    events,
    selectedEventIndex,
    safeEventPage,
    totalEventPages,
    setSelectedEventId,
    setEventPage,
    setPageEntryEdge,
  });

  const issueActions = useIssueActions({
    orgSlug,
    projectSlug,
    issueId,
    issueStatus: issue?.status,
    memberByUserId,
  });
  const workflowActions = useIssueWorkflowActions({
    orgSlug,
    projectSlug,
    issueId,
    navigate,
    issuePath,
  });

  useHotkeys({
    j: () => nextIssueHref && navigate(nextIssueHref),
    k: () => previousIssueHref && navigate(previousIssueHref),
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
      listHref: withIssueListContext(projectPath, listContext),
      previousIssueHref,
      nextIssueHref,
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
      goNewest,
      goOldest,
    },
    comments: {
      comments,
      commentError: issueActions.commentError,
      createComment: issueActions.createComment,
      isSubmitting: issueActions.isSubmittingComment,
    },
    sidebar: {
      members,
      memberByUserId,
      timelineEntries,
      workflowError: workflowActions.workflowError,
      updateAssignee: issueActions.updateAssignee,
      updatePriority: issueActions.updatePriority,
      updateExternalLink: workflowActions.updateExternalLink,
      mergeIssue: workflowActions.mergeIssue,
      unmergeIssue: workflowActions.unmergeIssue,
      isUpdatingAssignee: issueActions.isUpdatingAssignee,
      isUpdatingPriority: issueActions.isUpdatingPriority,
      isUpdatingWorkflow: workflowActions.isUpdatingWorkflow,
      isUpdatingExternalLink: workflowActions.isUpdatingExternalLink,
    },
    capabilities,
    actions: {
      autofixInFlight,
      autofixBlocker: capabilities.isLoading
        ? null
        : autofixBlocker(
            {
              missing: capabilities.autofixMissing,
              canRun: capabilities.canRunAutofix,
              canManageAutofix: capabilities.canManageAutofix,
              canManageIntegrations: capabilities.canManageIntegrations,
              canManageOrganizationSettings: capabilities.canManageOrganizationSettings,
            },
            orgSlug,
            projectSlug,
          ),
      triggerAutofix: issueActions.triggerAutofix,
      updateStatus: issueActions.updateStatus,
      resolveInNextRelease: () =>
        issueActions.updateStatus("resolved", null, { resolution: "next_release" }),
      isUpdatingStatus: issueActions.isUpdatingStatus,
      isTriggeringAutofix: issueActions.isTriggeringAutofix,
    },
  };
}

export { useIssueDetailPage };
