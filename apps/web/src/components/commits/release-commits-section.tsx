import { useQueryClient } from "@tanstack/react-query";
import { GitBranch, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  getListReleaseCommitsQueryKey,
  useListReleaseCommits,
  useSyncReleaseCommits,
} from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/utils";

import { CommitRow } from "./commit-row";

function ReleaseCommitsSection({
  orgSlug,
  projectSlug,
  releaseVersion,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = getListReleaseCommitsQueryKey(orgSlug, projectSlug, releaseVersion);
  const commitsQuery = useListReleaseCommits(orgSlug, projectSlug, releaseVersion, {
    query: {
      refetchInterval: (query) => (query.state.data?.data.status === "pending" ? 3000 : false),
    },
  });
  const sync = useSyncReleaseCommits({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
      onError: (error) =>
        toast.error("Could not refresh commits", { description: getErrorMessage(error) }),
    },
  });
  const data = commitsQuery.data?.data;

  return (
    <section className="grid gap-2" data-testid="release-commits">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Commits</h3>
        {data?.status === "synced" ? (
          <Badge variant="muted">
            {data.commits.length}
            {data.truncated ? "+" : ""}
          </Badge>
        ) : null}
        {data?.commitSha ? (
          <Button
            className="ml-auto"
            disabled={sync.isPending || data.status === "pending"}
            onClick={() => sync.mutate({ orgSlug, projectSlug, releaseVersion })}
            size="sm"
            type="button"
            variant="ghost"
          >
            {sync.isPending || data.status === "pending" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Refresh
          </Button>
        ) : null}
      </div>

      {commitsQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : commitsQuery.error ? (
        <QueryError
          error={commitsQuery.error}
          onRetry={() => void commitsQuery.refetch()}
          title="Could not load commits"
        />
      ) : !data?.commitSha ? (
        <p className="text-sm text-muted-foreground">
          No commit is linked to this release. The SpicyTrack CLI sends it automatically, or use the
          commit SHA as the release version.
        </p>
      ) : data.status === "pending" || data.status === null ? (
        <p className="text-sm text-muted-foreground">Reading commits from the repository…</p>
      ) : data.status === "unavailable" || data.status === "failed" ? (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{data.error}</p>
      ) : data.commits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No new commits since the previous release.</p>
      ) : (
        <>
          <ul className="grid gap-3 rounded-lg border border-border p-3">
            {data.commits.map((commit) => (
              <li key={commit.sha}>
                <CommitRow commit={commit} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {data.baseSha
              ? `Since the previous release (${data.baseSha.slice(0, 7)}).`
              : "Latest commits up to this release: no earlier release has a commit to compare with."}
            {data.truncated ? " Only the newest commits are shown." : ""}
          </p>
        </>
      )}
    </section>
  );
}

export { ReleaseCommitsSection };
