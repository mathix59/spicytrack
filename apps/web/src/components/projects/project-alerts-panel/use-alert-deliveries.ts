import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { getListProjectAlertDeliveriesQueryKey, listProjectAlertDeliveries } from "@/generated/api";

import type { DeliveryStatusFilter } from "./types";

const DELIVERY_PAGE_SIZE = 25;

/** Alert deliveries newest first, a page at a time, optionally only the failed ones. */
function useAlertDeliveries(orgSlug: string, projectSlug: string) {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>("all");
  const status = statusFilter === "failed" ? ("failed" as const) : undefined;

  const query = useInfiniteQuery({
    // Under the generated key, so invalidating the deliveries list refreshes every page.
    queryKey: [...getListProjectAlertDeliveriesQueryKey(orgSlug, projectSlug), "pages", { status }],
    queryFn: async ({ pageParam, signal }) =>
      (
        await listProjectAlertDeliveries(
          orgSlug,
          projectSlug,
          { limit: DELIVERY_PAGE_SIZE, status, cursor: pageParam },
          { signal },
        )
      ).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    // Deliveries are sent by the worker; keep polling while some are still in flight.
    refetchInterval: (current) =>
      current.state.data?.pages.some((page) =>
        page.items.some(
          (delivery) => delivery.status === "pending" || delivery.status === "retrying",
        ),
      )
        ? 5_000
        : false,
  });

  const deliveries = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return { query, deliveries, statusFilter, setStatusFilter };
}

export { useAlertDeliveries };
