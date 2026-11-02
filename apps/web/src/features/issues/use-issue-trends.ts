import { useMemo } from "react";

import { type GetProjectIssueTrendsPeriod, useGetProjectIssueTrends } from "@/generated/api";

const EMPTY_TRENDS = new Map<string, number[]>();

/**
 * Batched event counts for the visible issues. Trends are decoration: a failed or pending
 * request simply leaves the sparklines out instead of surfacing an error.
 */
function useIssueTrends({
  orgSlug,
  projectSlug,
  issueIds,
  period,
}: {
  orgSlug: string;
  projectSlug: string;
  issueIds: string[];
  period: GetProjectIssueTrendsPeriod;
}) {
  const ids = issueIds.slice(0, 100).join(",");
  const trendsQuery = useGetProjectIssueTrends(
    orgSlug,
    projectSlug,
    { issueIds: ids, period },
    {
      query: {
        enabled: Boolean(orgSlug && projectSlug && ids),
        placeholderData: (previous) => previous,
        retry: false,
        staleTime: 60_000,
      },
    },
  );
  const items = trendsQuery.data?.status === 200 ? trendsQuery.data.data.items : undefined;

  return useMemo(
    () =>
      items ? new Map(items.map((item) => [item.issueId, item.counts] as const)) : EMPTY_TRENDS,
    [items],
  );
}

export { useIssueTrends };
