import type { OrganizationMemberDto } from "@/generated/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { renderNullableText } from "@/lib/utils";

import type { IssueCommentsState, MemberByUserId } from "./types";
import { formatTimelineDate } from "./utils";

function IssueCommentsCard({
  comments,
  memberByUserId,
}: {
  comments: IssueCommentsState;
  memberByUserId: MemberByUserId;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-3" onSubmit={comments.createComment}>
          <textarea
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            name="body"
            placeholder="Add a comment..."
            required
          />
          {comments.commentError ? (
            <Alert variant="destructive">
              <AlertDescription>{comments.commentError}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button disabled={comments.isSubmitting} size="sm" type="submit" variant="secondary">
              Add comment
            </Button>
          </div>
        </form>
        {comments.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          comments.comments.map((comment) => (
            <CommentRow
              comment={comment}
              key={comment.id}
              member={memberByUserId.get(comment.userId)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CommentRow({
  comment,
  member,
}: {
  comment: IssueCommentsState["comments"][number];
  member: OrganizationMemberDto | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">
          {renderNullableText(member?.name, member?.email ?? comment.userId)}
        </p>
        <p className="shrink-0 text-xs text-muted-foreground">
          {formatTimelineDate(comment.createdAt)}
        </p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>
    </div>
  );
}

export { IssueCommentsCard };
