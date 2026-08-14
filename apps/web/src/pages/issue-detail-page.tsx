import { Alert, AlertDescription } from "@/components/ui/alert";

import { IssueCommentsCard } from "./issue-detail-page/issue-comments-card";
import { IssueDetailHeader } from "./issue-detail-page/issue-detail-header";
import { IssueEventsPanel } from "./issue-detail-page/issue-events-panel";
import { IssueSidebar } from "./issue-detail-page/issue-sidebar";
import { useIssueDetailPage } from "./issue-detail-page/use-issue-detail-page";

function IssueDetailPage() {
  const page = useIssueDetailPage();

  if (!page.issue || !page.issueDetail) {
    return null;
  }

  return (
    <section className="grid gap-6">
      <IssueDetailHeader
        actions={page.actions}
        culprit={page.issue.culprit}
        firstSeenAt={page.issue.firstSeenAt}
        level={page.issue.level}
        navigation={page.navigation}
        orgSlug={page.orgSlug}
        projectName={page.projectName}
        projectSlug={page.projectSlug}
        status={page.issue.status}
        title={page.issue.title}
        totalEvents={page.events.totalEvents}
      />

      {page.actions.autofixError ? (
        <Alert variant="destructive">
          <AlertDescription>{page.actions.autofixError}</AlertDescription>
        </Alert>
      ) : null}
      {page.actions.issueStatusError ? (
        <Alert variant="destructive">
          <AlertDescription>{page.actions.issueStatusError}</AlertDescription>
        </Alert>
      ) : null}
      {page.sidebar.issueAssigneeError ? (
        <Alert variant="destructive">
          <AlertDescription>{page.sidebar.issueAssigneeError}</AlertDescription>
        </Alert>
      ) : null}
      {page.sidebar.issuePriorityError ? (
        <Alert variant="destructive">
          <AlertDescription>{page.sidebar.issuePriorityError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
        <div className="grid gap-4">
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
          totalEvents={page.events.totalEvents}
        />
      </div>
    </section>
  );
}

export { IssueDetailPage };
