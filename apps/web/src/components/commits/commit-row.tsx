import { ExternalLink, GitCommitHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import type { ReleaseCommitDto } from "@/generated/api";
import { formatLocalDateTime } from "@/lib/utils";

/** One commit: short SHA (linked to the repository), title, author and date. */
function CommitRow({ commit, children }: { commit: ReleaseCommitDto; children?: ReactNode }) {
  const author = commit.authorLogin ?? commit.authorName ?? "Unknown author";
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex min-w-0 items-start gap-2">
        <GitCommitHorizontal
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
          {commit.title}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-xs text-muted-foreground">
        {commit.url ? (
          <a
            className="inline-flex items-center gap-1 font-mono text-primary-accent underline-offset-2 hover:underline"
            href={commit.url}
            rel="noreferrer"
            target="_blank"
          >
            {commit.shortSha}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        ) : (
          <span className="font-mono">{commit.shortSha}</span>
        )}
        <span className="min-w-0 truncate">{author}</span>
        {commit.committedAt ? <span>{formatLocalDateTime(commit.committedAt)}</span> : null}
      </div>
      {children ? <div className="pl-6">{children}</div> : null}
    </div>
  );
}

export { CommitRow };
