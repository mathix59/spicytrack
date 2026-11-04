import { SlidersHorizontal } from "lucide-react";

import type {
  OrganizationMemberDto,
  ProjectEnvironmentDto,
  ProjectReleaseDto,
} from "@/generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { renderNullableText } from "@/lib/utils";

/** Assignee, environment, release, regression, sort and page size: the filters behind a popover. */
function IssueFiltersPopover({
  activeSecondaryFilterCount,
  members,
  assignedUserFilter,
  updateAssignedUserFilter,
  environmentFilter,
  updateEnvironmentFilter,
  projectEnvironments,
  releaseFilter,
  updateReleaseFilter,
  projectReleases,
  regressedFilter,
  updateRegressedFilter,
  sortBy,
  updateSortBy,
  sortDir,
  updateSortDir,
  pageSize,
  updatePageSize,
}: {
  activeSecondaryFilterCount: number;
  members: OrganizationMemberDto[];
  assignedUserFilter: string;
  updateAssignedUserFilter: (value: string) => void;
  environmentFilter: string;
  updateEnvironmentFilter: (value: string) => void;
  projectEnvironments: ProjectEnvironmentDto[];
  releaseFilter: string;
  updateReleaseFilter: (value: string) => void;
  projectReleases: ProjectReleaseDto[];
  regressedFilter: string;
  updateRegressedFilter: (value: string) => void;
  sortBy: string;
  updateSortBy: (value: string) => void;
  sortDir: string;
  updateSortDir: (value: string) => void;
  pageSize: number;
  updatePageSize: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="col-span-2 w-full sm:w-auto" type="button" variant="secondary">
          <SlidersHorizontal className="size-4" />
          Filters
          {activeSecondaryFilterCount > 0 ? (
            <Badge variant="accent">{activeSecondaryFilterCount}</Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Issue filters" className="grid w-80 gap-3">
        <Field label="Assignee">
          <Combobox
            emptyText="No matching member."
            onChange={updateAssignedUserFilter}
            options={[
              { value: "all", label: "All assignees" },
              { value: "__unassigned__", label: "Unassigned" },
              ...members.map((member) => ({
                value: member.userId,
                label: renderNullableText(member.name, member.email),
                description: member.name ? member.email : undefined,
              })),
            ]}
            searchPlaceholder="Search members…"
            value={assignedUserFilter}
          />
        </Field>
        <Field label="Environment">
          <Select
            onChange={(event) => updateEnvironmentFilter(event.target.value)}
            value={environmentFilter}
          >
            <option value="all">All environments</option>
            {projectEnvironments.map((environment) => (
              <option key={environment.id} value={environment.name}>
                {environment.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Release">
          <Combobox
            emptyText="No matching release."
            onChange={updateReleaseFilter}
            options={[
              { value: "all", label: "All releases" },
              ...projectReleases.map((release) => ({
                value: release.version,
                label: release.version,
              })),
            ]}
            searchPlaceholder="Search releases…"
            value={releaseFilter}
          />
        </Field>
        <Field label="Regression">
          <Select
            onChange={(event) => updateRegressedFilter(event.target.value)}
            value={regressedFilter}
          >
            <option value="all">All issues</option>
            <option value="true">Regressed only</option>
            <option value="false">No regression</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort by">
            <Select onChange={(event) => updateSortBy(event.target.value)} value={sortBy}>
              <option value="lastSeenAt">Last seen</option>
              <option value="firstSeenAt">First seen</option>
              <option value="timesSeen">Times seen</option>
            </Select>
          </Field>
          <Field label="Order">
            <Select onChange={(event) => updateSortDir(event.target.value)} value={sortDir}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </Field>
        </div>
        <Field label="Page size">
          <Select onChange={(event) => updatePageSize(event.target.value)} value={String(pageSize)}>
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </Select>
        </Field>
      </PopoverContent>
    </Popover>
  );
}

export { IssueFiltersPopover };
