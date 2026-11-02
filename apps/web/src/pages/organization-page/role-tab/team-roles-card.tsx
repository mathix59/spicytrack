import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import type { TeamDto, TeamRoleDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";

import type { QueryStatus } from "../types";
import { TeamRoleDialogs } from "./team-role-dialogs";
import { useTeamRoles, type TeamRolesState } from "./use-team-roles";

function TeamRolesCard({
  orgSlug,
  teams,
  teamsStatus,
  canManageRoles,
}: {
  orgSlug: string;
  teams: TeamDto[];
  teamsStatus: QueryStatus;
  canManageRoles: boolean;
}) {
  const state = useTeamRoles({ orgSlug, teams });
  const { team, roles } = state;
  const isLoading = teamsStatus.isLoading || state.rolesQuery.isLoading;

  return (
    <Card>
      <OrganizationSectionHeader
        action={
          canManageRoles && team ? (
            <Button onClick={() => state.setCreateOpen(true)} size="sm" type="button">
              <Plus className="size-4" />
              New role
            </Button>
          ) : null
        }
        count={isLoading || !team ? undefined : roles.length}
        description="Team roles apply only to members of the selected team and its projects."
        title="Team roles"
      >
        {teams.length > 0 ? (
          <Field label="Team" className="max-w-sm">
            <Select
              onChange={(event) => state.selectTeam(event.target.value)}
              value={team?.slug ?? ""}
            >
              {teams.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </OrganizationSectionHeader>
      <CardContent>
        {isLoading ? (
          <SkeletonRows rows={3} />
        ) : teamsStatus.error ? (
          <QueryError
            error={teamsStatus.error}
            onRetry={teamsStatus.refetch}
            title="Could not load teams"
          />
        ) : !team ? (
          <EmptyState
            title="No teams yet"
            description="Create a team before configuring roles and permissions."
          />
        ) : state.rolesQuery.error ? (
          <QueryError
            error={state.rolesQuery.error}
            onRetry={state.rolesQuery.refetch}
            title="Could not load team roles"
          />
        ) : roles.length === 0 ? (
          <EmptyState
            title="No team roles yet"
            description="Create a team role to set access for this team."
          />
        ) : (
          <div className="grid gap-3">
            {roles.map((role) => (
              <TeamRoleItem
                canManage={canManageRoles}
                key={role.id}
                role={role}
                state={state}
                teamName={team.name}
              />
            ))}
          </div>
        )}
      </CardContent>

      <TeamRoleDialogs state={state} teams={teams} />
    </Card>
  );
}

function TeamRoleItem({
  role,
  teamName,
  canManage,
  state,
}: {
  role: TeamRoleDto;
  teamName: string;
  canManage: boolean;
  state: TeamRolesState;
}) {
  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{role.name}</h3>
            {role.isSystem ? <Badge variant="muted">Built-in</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {role.permissions.length} permission
            {role.permissions.length === 1 ? "" : "s"}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button
              onClick={() => state.setDuplicateRole(role)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Copy className="size-4" />
              Duplicate to team
            </Button>
            {!role.isSystem ? (
              <>
                <Button
                  aria-label={`Edit ${role.name}`}
                  onClick={() => state.setEditRole(role)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDialog
                  confirmLabel="Delete role"
                  description={`This permanently removes the custom role from ${teamName}. Members using it must be reassigned first.`}
                  onConfirm={() => state.removeRole(role)}
                  successMessage="Team role deleted"
                  title={`Delete ${role.name}?`}
                  trigger={
                    <Button
                      aria-label={`Delete ${role.name}`}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {role.permissions.map((permission) => (
          <Badge key={permission} variant="accent">
            {permission.replaceAll("_", " ")}
          </Badge>
        ))}
      </div>
    </article>
  );
}

export { TeamRolesCard };
