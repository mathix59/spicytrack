import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AuditLogView } from "@/components/audit/audit-log-view";
import type { AuditLogSource } from "@/components/audit/use-audit-log";

import {
  fetchInstanceAudit,
  fetchInstanceAuditFacets,
  instanceAdminKeys,
} from "./instance-admin-api";

function AuditTab() {
  const facetsQuery = useQuery({
    queryKey: instanceAdminKeys.auditFacets,
    queryFn: fetchInstanceAuditFacets,
  });
  const source = useMemo<AuditLogSource>(
    () => ({
      queryKey: instanceAdminKeys.audit,
      fetchPage: fetchInstanceAudit,
      facets: facetsQuery.data,
      exportPath: "/instance-admin/audit/export",
      exportBaseName: "instance",
    }),
    [facetsQuery.data],
  );

  return (
    <AuditLogView
      description="Instance administrator actions: settings changes, granted or revoked administrator access, and deleted users. Actions inside an organization appear in that organization's audit log."
      source={source}
    />
  );
}

export { AuditTab };
