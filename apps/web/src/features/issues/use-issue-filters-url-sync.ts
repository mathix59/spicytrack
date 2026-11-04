import { useEffect } from "react";
import type { SetURLSearchParams } from "react-router-dom";

import type { IssueFilterSnapshot } from "@/features/issues/saved-searches";

import { issueFilterSearchParams } from "./issue-filters";

/** Mirrors the issue list's filters and page into the URL, replacing the history entry. */
function useIssueFiltersUrlSync({
  searchParams,
  setSearchParams,
  filters,
  page,
}: {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  filters: IssueFilterSnapshot;
  page: number;
}) {
  useEffect(() => {
    const nextParams = issueFilterSearchParams(searchParams, filters, page);

    const current = searchParams.toString();
    const next = nextParams.toString();

    if (current !== next) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [filters, page, searchParams, setSearchParams]);
}

export { useIssueFiltersUrlSync };
