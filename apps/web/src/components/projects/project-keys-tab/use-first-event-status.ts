import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getGetProjectFirstEventQueryKey,
  getGetProjectQueryKey,
  getListIssuesQueryKey,
  getProjectFirstEvent,
} from "@/generated/api";

import type { FirstEventStatus } from "./types";

/** Seconds the API holds each request while no event has arrived. */
const LONG_POLL_SECONDS = 25;

/**
 * Tells whether the project has received its first SDK event. While it has not, the API
 * holds each request until the event arrives (long-poll), so the setup flow flips within
 * about a second instead of waiting for the next poll.
 */
function useFirstEventStatus(orgSlug: string, projectSlug: string): FirstEventStatus {
  const queryClient = useQueryClient();
  // The first request answers at once; the following ones wait for the event.
  const hasAnswered = useRef(false);
  const query = useQuery({
    queryKey: getGetProjectFirstEventQueryKey(orgSlug, projectSlug),
    queryFn: async ({ signal }) => {
      const wait = hasAnswered.current ? LONG_POLL_SECONDS : 0;
      const response = await getProjectFirstEvent(orgSlug, projectSlug, { wait }, { signal });
      hasAnswered.current = true;
      return response.data;
    },
    refetchInterval: (current) => (current.state.data?.firstEventAt ? false : 1_000),
  });

  const firstEventAt = query.data?.firstEventAt ?? null;
  useEffect(() => {
    if (!firstEventAt) return;
    void queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(orgSlug, projectSlug) });
    void queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey(orgSlug, projectSlug) });
  }, [firstEventAt, orgSlug, projectSlug, queryClient]);

  if (query.isPending) return { state: "loading" };
  if (!query.data) return { state: "unknown" };
  if (!firstEventAt) return { state: "waiting" };
  return { state: "received", firstEventAt };
}

export { useFirstEventStatus };
