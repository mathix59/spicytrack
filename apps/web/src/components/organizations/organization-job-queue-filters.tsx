import type { Dispatch, SetStateAction } from "react";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type OrganizationJobFilters = {
  status: "" | "pending" | "running" | "failed";
  type: string;
  projectId: string;
  limit: string;
};

function OrganizationJobQueueFilters({
  filters,
  setFilters,
}: {
  filters: OrganizationJobFilters;
  setFilters: Dispatch<SetStateAction<OrganizationJobFilters>>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Field label="Status">
        <Select
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value as OrganizationJobFilters["status"],
            }))
          }
          value={filters.status}
        >
          <option value="">Any active/failed</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
        </Select>
      </Field>
      <Field label="Type">
        <Input
          onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
          placeholder="autofix"
          value={filters.type}
        />
      </Field>
      <Field label="Project ID">
        <Input
          onChange={(event) =>
            setFilters((current) => ({ ...current, projectId: event.target.value }))
          }
          placeholder="uuid"
          value={filters.projectId}
        />
      </Field>
      <Field label="Limit">
        <Select
          onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
          value={filters.limit}
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </Select>
      </Field>
    </div>
  );
}

export { OrganizationJobQueueFilters, type OrganizationJobFilters };
