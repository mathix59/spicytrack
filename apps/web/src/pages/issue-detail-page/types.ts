import type { FormEvent } from "react";
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

type IssueNavigation = {
  previousIssue: IssueDto | null;
  nextIssue: IssueDto | null;
};

type EventPagerState = {
  selectedEvent: EventDto | undefined;
  selectedEventId: string | null;
  totalEvents: number;
  globalEventNumber: number | null;
  canGoNewer: boolean;
  canGoOlder: boolean;
  goNewer: () => void;
  goOlder: () => void;
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
  issueAssigneeError: string | null;
  issuePriorityError: string | null;
  workflowError: string | null;
  updateAssignee: (assignedUserId: string) => Promise<void>;
  updatePriority: (priority: string) => Promise<void>;
  updateExternalLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  mergeIssue: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  unmergeIssue: () => Promise<void>;
  isUpdatingAssignee: boolean;
  isUpdatingPriority: boolean;
  isUpdatingWorkflow: boolean;
};

type IssueActionsState = {
  issueStatusError: string | null;
  autofixError: string | null;
  autofixInFlight: boolean;
  triggerAutofix: () => Promise<void>;
  updateStatus: (status: string, ignoredUntil?: string | null) => Promise<void>;
  isUpdatingStatus: boolean;
  isTriggeringAutofix: boolean;
};

type IssuePageData = {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  projectName: string;
  issue: IssueDto | undefined;
  issueDetail: IssueDetailDto | undefined;
  navigation: IssueNavigation;
  events: EventPagerState;
  comments: IssueCommentsState;
  sidebar: IssueSidebarState;
  actions: IssueActionsState;
};

export type {
  EventPagerState,
  IssueActionsState,
  IssueCommentsState,
  IssueNavigation,
  IssuePageData,
  IssueSidebarState,
  MemberByUserId,
  TimelineEntry,
};
