import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AuditEntryPageDto, AuditFacetsDto } from "@/generated/api";
import { downloadApiFile } from "@/lib/download";
import { getErrorMessage } from "@/lib/utils";

import { auditActionLabel } from "./audit-labels";

type AuditFilterState = {
  action: string;
  actorUserId: string;
  projectId: string;
  targetType: string;
  /** yyyy-mm-dd from a date input, in the viewer's time zone. */
  from: string;
  to: string;
};

type AuditQueryParams = {
  action?: string;
  actorUserId?: string;
  projectId?: string;
  targetType?: string;
  from?: string;
  to?: string;
};

/** Where an audit log comes from: an organization, a project, or the instance. */
type AuditLogSource = {
  queryKey: readonly unknown[];
  fetchPage: (params: AuditQueryParams & { cursor?: string }) => Promise<AuditEntryPageDto>;
  facets: AuditFacetsDto | undefined;
  exportPath: string;
  exportBaseName: string;
};

const EMPTY_FILTERS: AuditFilterState = {
  action: "",
  actorUserId: "",
  projectId: "",
  targetType: "",
  from: "",
  to: "",
};

function dayBoundary(day: string, end: boolean) {
  if (!day) return undefined;
  const date = new Date(`${day}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toQueryParams(filters: AuditFilterState): AuditQueryParams {
  return {
    action: filters.action || undefined,
    actorUserId: filters.actorUserId || undefined,
    projectId: filters.projectId || undefined,
    targetType: filters.targetType || undefined,
    from: dayBoundary(filters.from, false),
    to: dayBoundary(filters.to, true),
  };
}

/** "team.created", "team.deleted" → a "team.*" option ahead of the exact actions. */
function actionOptions(actions: string[]) {
  const groups = new Map<string, number>();
  for (const action of actions) {
    const prefix = action.split(".", 1)[0];
    if (prefix && prefix !== action) groups.set(prefix, (groups.get(prefix) ?? 0) + 1);
  }
  const prefixes = [...groups]
    .filter(([, count]) => count > 1)
    .map(([prefix]) => ({ value: `${prefix}.`, label: `${prefix}.*` }));
  return [
    ...prefixes,
    ...actions.map((action) => ({ value: action, label: auditActionLabel(action) })),
  ];
}

function useAuditLog(source: AuditLogSource) {
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_FILTERS);
  const [isExporting, setIsExporting] = useState(false);
  const params = useMemo(() => toQueryParams(filters), [filters]);

  const query = useInfiniteQuery({
    queryKey: [...source.queryKey, params],
    queryFn: ({ pageParam }) => source.fetchPage({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const entries = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const isFiltered = Object.values(filters).some(Boolean);

  function setFilter(key: keyof AuditFilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function exportLog(format: "csv" | "json") {
    setIsExporting(true);
    try {
      const { truncated } = await downloadApiFile(
        source.exportPath,
        { ...params, format },
        `${source.exportBaseName}-audit.${format}`,
      );
      if (truncated) {
        toast.warning("Export limited to the 10,000 most recent entries", {
          description: "Narrow the date range to export older entries.",
        });
      }
    } catch (error) {
      toast.error("Could not export the audit log", { description: getErrorMessage(error) });
    } finally {
      setIsExporting(false);
    }
  }

  return {
    query,
    entries,
    filters,
    isFiltered,
    setFilter,
    clearFilters: () => setFilters(EMPTY_FILTERS),
    actionOptions: actionOptions(source.facets?.actions ?? []),
    targetTypes: source.facets?.targetTypes ?? [],
    isExporting,
    exportLog,
  };
}

export { useAuditLog };
export type { AuditLogSource, AuditQueryParams };
