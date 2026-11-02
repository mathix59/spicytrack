import { useListIssues } from "@/generated/api";

import type { FirstEventStatus } from "./types";

const POLL_INTERVAL_MS = 10_000;

/**
 * Tells whether the project has received any event yet, by probing the first page of its
 * issues. While nothing has arrived it polls, so the setup flow flips once the SDK reports.
 */
function useFirstEventStatus(orgSlug: string, projectSlug: string): FirstEventStatus {
  const issuesQuery = useListIssues(
    orgSlug,
    projectSlug,
    { page: 1, pageSize: 1 },
    {
      query: {
        refetchInterval: (query) =>
          (query.state.data?.data.total ?? 0) > 0 ? false : POLL_INTERVAL_MS,
      },
    },
  );

  if (issuesQuery.isLoading) return { state: "loading" };
  if (issuesQuery.isError || !issuesQuery.data) return { state: "unknown" };

  const page = issuesQuery.data.data;
  if (page.total === 0) return { state: "waiting" };

  return { state: "received", lastSeenAt: page.items[0]?.lastSeenAt ?? null };
}

export { useFirstEventStatus };
