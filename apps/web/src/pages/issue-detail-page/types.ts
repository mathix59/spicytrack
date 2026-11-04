import type { FormEvent } from "react";
import type { AutofixBlocker, AutofixRequirement } from "@/components/autofix/autofix-availability";
import type {
  EventDto,
  IssueCommentDto,
  IssueDetailDto,
  IssueDto,
  OrganizationMemberDto,
} from "@/generated/api";

type MemberByUserId = Map<string, OrganizationMemberDto>;

type TimelineEntry = {
  id: string;
  createdAt: string;
  label: string;
  actor: string;
  body: string | null;
};

/** Links within the list the issue was opened from (same filters and sort). */
type IssueNavigation = {
  listHref: string;
  previousIssueHref: string | null;
  nextIssueHref: string | null;
};

type EventPagerState = {
  selectedEvent: EventDto | undefined;
  selectedEventId: string | null;
  isLoadingEvent: boolean;
  eventError: unknown;
  retryEvent: () => void;
  totalEvents: number;
  globalEventNumber: number | null;
  canGoNewer: boolean;
  canGoOlder: boolean;
  goNewer: () => void;
  goOlder: () => void;
  goNewest: () => void;
  goOldest: () => void;
};

type IssueCommentsState = {
  comments: IssueCommentDto[];
  commentError: string | null;
  createComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
};

type IssueSidebarState = {
  members: OrganizationMemberDto[];
  memberByUserId: MemberByUserId;
  timelineEntries: TimelineEntry[];
  workflowError: string | null;
  updateAssignee: (assignedUserId: string) => Promise<void>;
  updatePriority: (priority: string) => Promise<void>;
  /** Links a ticket by URL (null removes it); rejects with the API error. */
  updateExternalLink: (url: string | null) => Promise<void>;
  mergeIssue: (targetIssueId: string) => Promise<void>;
  unmergeIssue: () => Promise<void>;
  isUpdatingAssignee: boolean;
  isUpdatingPriority: boolean;
  isUpdatingWorkflow: boolean;
  isUpdatingExternalLink: boolean;
};

/** What the current user may do on the issue, and what Autofix still needs in the project. */
type IssueCapabilities = {
  /** Permissions are still loading: actions stay as they were rather than flash as denied. */
  isLoading: boolean;
  canManageIssues: boolean;
  canRunAutofix: boolean;
  canManageAutofix: boolean;
  canManageIntegrations: boolean;
  canManageOrganizationSettings: boolean;
  autofixMissing: AutofixRequirement[];
};

type IssueActionsState = {
  autofixInFlight: boolean;
  /** Why the viewer cannot start Autofix, or null when they can. */
  autofixBlocker: AutofixBlocker | null;
  triggerAutofix: () => Promise<void>;
  updateStatus: (status: string, ignoredUntil?: string | null) => Promise<void>;
  /** Resolves until an event arrives from a release newer than the latest one. */
  resolveInNextRelease: () => Promise<void>;
  isUpdatingStatus: boolean;
  isTriggeringAutofix: boolean;
};

type IssuePageData = {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  /** Daily event counts over the last 14 days, oldest first. */
  trend: number[] | undefined;
  projectName: string;
  issue: IssueDto | undefined;
  issueDetail: IssueDetailDto | undefined;
  issueQuery: { isLoading: boolean; error: unknown; refetch: () => void };
  navigation: IssueNavigation;
  events: EventPagerState;
  comments: IssueCommentsState;
  sidebar: IssueSidebarState;
  actions: IssueActionsState;
  capabilities: IssueCapabilities;
};

export type {
  AutofixRequirement,
  EventPagerState,
  IssueCapabilities,
  IssueActionsState,
  IssueCommentsState,
  IssueNavigation,
  IssuePageData,
  IssueSidebarState,
  MemberByUserId,
  TimelineEntry,
};
