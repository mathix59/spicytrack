import type { OrganizationMemberDto } from "@/generated/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime, renderNullableText } from "@/lib/utils";

import type { IssueCommentsState, MemberByUserId } from "./types";
import { formatTimelineDate } from "./utils";

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
        <CardTitle className="text-base">
          Comments
          {comments.comments.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {comments.comments.length}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {comments.comments.length > 0 ? (
          <ol className="grid gap-4">
            {comments.comments.map((comment) => (
              <CommentRow
                comment={comment}
                key={comment.id}
                member={memberByUserId.get(comment.userId)}
              />
            ))}
          </ol>
        ) : null}
        <form className="grid gap-2" onSubmit={comments.createComment}>
          <Textarea
            aria-label="Comment"
            className="min-h-20"
            name="body"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Add a comment..."
            required
          />
          {comments.commentError ? (
            <Alert variant="destructive">
              <AlertDescription>{comments.commentError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <p className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>Enter</Kbd>
              to send
            </p>
            <Button disabled={comments.isSubmitting} size="sm" type="submit">
              Add comment
            </Button>
          </div>
        </form>
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
  const author = renderNullableText(member?.name, member?.email ?? comment.userId);
  return (
    <li className="flex min-w-0 gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">{initials(author)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{author}</span>
          <span
            className="text-xs text-muted-foreground"
            title={formatTimelineDate(comment.createdAt)}
          >
            {formatRelativeTime(comment.createdAt)}
          </span>
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{comment.body}</p>
      </div>
    </li>
  );
}

export { IssueCommentsCard };
