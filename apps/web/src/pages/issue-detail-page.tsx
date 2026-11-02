import { QueryError } from "@/components/common/query-error";
import { Skeleton } from "@/components/ui/skeleton";

import { IssueCommentsCard } from "./issue-detail-page/issue-comments-card";
import { IssueDetailHeader } from "./issue-detail-page/issue-detail-header";
import { IssueEventsPanel } from "./issue-detail-page/issue-events-panel";
import { IssueSidebar } from "./issue-detail-page/issue-sidebar";
import { useIssueDetailPage } from "./issue-detail-page/use-issue-detail-page";

function IssueDetailSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading issue" className="grid gap-6">
      <div className="grid gap-3 border-b border-border pb-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </section>
  );
}

function IssueDetailPage() {
  const page = useIssueDetailPage();

  if (page.issueQuery.isLoading) {
    return <IssueDetailSkeleton />;
  }

  if (!page.issue || !page.issueDetail) {
    return (
      <QueryError
        error={page.issueQuery.error}
        onRetry={page.issueQuery.refetch}
        title="Could not load this issue"
      />
    );
  }

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6">
      <IssueDetailHeader
        actions={page.actions}
        culprit={page.issue.culprit}
        firstSeenAt={page.issue.firstSeenAt}
        lastSeenAt={page.issue.lastSeenAt}
        level={page.issue.level}
        navigation={page.navigation}
        orgSlug={page.orgSlug}
        projectName={page.projectName}
        projectSlug={page.projectSlug}
        status={page.issue.status}
        title={page.issue.title}
        totalEvents={page.events.totalEvents}
        trend={page.trend}
      />

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <IssueEventsPanel events={page.events} />
          <IssueCommentsCard
            comments={page.comments}
            memberByUserId={page.sidebar.memberByUserId}
          />
        </div>

        <IssueSidebar
          issue={page.issue}
          issueId={page.issueId}
          orgSlug={page.orgSlug}
          projectSlug={page.projectSlug}
          sidebar={page.sidebar}
        />
      </div>
    </section>
  );
}

export { IssueDetailPage };
