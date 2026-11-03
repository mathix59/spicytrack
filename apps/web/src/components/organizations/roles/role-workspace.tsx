import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

import type { PermissionGroup } from "./permission-groups";
import { RoleDetail } from "./role-detail";
import { RoleList } from "./role-list";
import { RoleMatrix } from "./role-matrix";
import type { RoleItem, RoleMember } from "./types";

type RoleView = "roles" | "compare";

const VIEW_OPTIONS: { value: RoleView; label: string }[] = [
  { value: "roles", label: "Roles" },
  { value: "compare", label: "Compare" },
];

/** Built-in roles from most to least privileged; custom roles follow, by name. */
const BUILT_IN_ORDER = [
  "owner",
  "admin",
  "manager",
  "maintainer",
  "developer",
  "contributor",
  "member",
  "viewer",
];

function sortRoles(roles: RoleItem[]) {
  const rank = (role: RoleItem) => {
    const position = BUILT_IN_ORDER.indexOf(role.key);
    return role.isSystem && position >= 0 ? position : BUILT_IN_ORDER.length;
  };
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** View and selected role live in the URL (?view=compare, ?role=key) so links are shareable. */
function useRoleView(roles: RoleItem[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: RoleView = searchParams.get("view") === "compare" ? "compare" : "roles";
  const requested = searchParams.get("role");
  const selected = roles.find((role) => role.key === requested) ?? roles[0];

  const update = (changes: Record<string, string | null>) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  return {
    view,
    selected,
    setView: (next: RoleView) => update({ view: next === "roles" ? null : next }),
    openRole: (key: string) => update({ role: key, view: null }),
  };
}

function RoleWorkspace({
  title,
  description,
  roles: unsortedRoles,
  groups,
  status,
  canManage,
  membersFor,
  membersHref,
  toolbar,
  empty,
  onCreate,
  onEdit,
  onDelete,
  extraActions,
}: {
  title: string;
  description: string;
  roles: RoleItem[];
  groups: PermissionGroup[];
  status: { isLoading: boolean; error: unknown; refetch: () => void };
  canManage: boolean;
  membersFor: (role: RoleItem) => RoleMember[] | undefined;
  membersHref?: string;
  /** Controls shown before the view switch, e.g. the team picker. */
  toolbar?: ReactNode;
  /** Replaces the content when there is nothing to show roles for (e.g. no team yet). */
  empty?: ReactNode;
  onCreate: (startFrom?: RoleItem) => void;
  onEdit: (role: RoleItem) => void;
  onDelete: (role: RoleItem) => Promise<unknown>;
  extraActions?: (role: RoleItem) => ReactNode;
}) {
  const roles = sortRoles(unsortedRoles);
  const { view, selected, setView, openRole } = useRoleView(roles);
  const showContent = !empty && !status.isLoading && !status.error;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-prose gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {title}
            {showContent ? <Badge variant="muted">{roles.length}</Badge> : null}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {canManage && !empty ? (
          <Button onClick={() => onCreate()} size="sm" type="button">
            <Plus />
            New role
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {toolbar ?? <span />}
        {showContent && roles.length > 1 ? (
          <SegmentedControl<RoleView>
            label="Role view"
            onChange={setView}
            options={VIEW_OPTIONS}
            value={view}
          />
        ) : null}
      </div>

      {empty ? (
        empty
      ) : status.isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading roles"
          className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]"
        >
          <Card>
            <CardContent className="pt-4">
              <SkeletonRows rows={4} />
            </CardContent>
          </Card>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : status.error ? (
        <QueryError error={status.error} onRetry={status.refetch} title="Could not load roles" />
      ) : view === "compare" ? (
        <RoleMatrix
          caption={`${title}: permissions granted by each role`}
          groups={groups}
          onOpenRole={openRole}
          roles={roles}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <Card className="p-2 lg:sticky lg:top-4">
            <RoleList label={title} onSelect={openRole} roles={roles} selectedKey={selected?.key} />
          </Card>
          {selected ? (
            <RoleDetail
              canManage={canManage}
              extraActions={extraActions?.(selected)}
              groups={groups}
              key={selected.id}
              members={membersFor(selected)}
              membersHref={membersHref}
              onDelete={() => onDelete(selected)}
              onDuplicate={() => onCreate(selected)}
              onEdit={() => onEdit(selected)}
              role={selected}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export { RoleWorkspace };
