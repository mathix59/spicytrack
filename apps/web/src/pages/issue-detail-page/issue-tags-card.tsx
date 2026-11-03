import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetIssueTags, type IssueTagKeyDto } from "@/generated/api";

/** Search term matching one tag value, quoted when it contains spaces or quotes. */
function tagSearchTerm(key: string, value: string) {
  return /[\s"]/.test(value) ? `${key}:"${value.replaceAll('"', "")}"` : `${key}:${value}`;
}

function TagBreakdown({ tag, issuesPath }: { tag: IssueTagKeyDto; issuesPath: string }) {
  const others = tag.total - tag.values.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{tag.key}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {tag.uniqueValues === 1 ? "1 value" : `${tag.uniqueValues} values`}
        </span>
      </div>
      <ul className="grid gap-1">
        {tag.values.map((entry) => {
          const share = tag.total > 0 ? Math.round((entry.count / tag.total) * 100) : 0;
          return (
            <li key={entry.value}>
              <Link
                className="group relative flex items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1 text-xs hover:bg-accent"
                title={`Show issues with ${tag.key} ${entry.value}`}
                to={`${issuesPath}?q=${encodeURIComponent(tagSearchTerm(tag.key, entry.value))}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${share}%` }}
                />
                <span className="relative truncate">{entry.value}</span>
                <span className="relative shrink-0 text-muted-foreground tabular-nums">
                  {share}%
                </span>
              </Link>
            </li>
          );
        })}
        {others > 0 ? (
          <li className="px-2 text-xs text-muted-foreground">
            Other values: {Math.round((others / tag.total) * 100)}%
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function IssueTagsCard({
  orgSlug,
  projectSlug,
  issueId,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const tagsQuery = useGetIssueTags(orgSlug, projectSlug, issueId);
  const tags = tagsQuery.data?.data;
  const issuesPath = `/orgs/${orgSlug}/projects/${projectSlug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tags</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {tagsQuery.isLoading ? (
          <div aria-hidden="true" className="grid gap-2">
            {[0, 1, 2].map((row) => (
              <span className="h-6 animate-pulse rounded bg-muted" key={row} />
            ))}
          </div>
        ) : tagsQuery.isError ? (
          <p className="text-sm text-muted-foreground">Could not load tags.</p>
        ) : !tags || tags.keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags on these events.</p>
        ) : (
          <>
            {tags.keys.map((tag) => (
              <TagBreakdown issuesPath={issuesPath} key={tag.key} tag={tag} />
            ))}
            {tags.sampledEvents >= 10_000 ? (
              <p className="text-xs text-muted-foreground">Based on the latest 10,000 events.</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { IssueTagsCard };
