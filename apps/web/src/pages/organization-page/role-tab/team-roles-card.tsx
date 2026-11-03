import { ArrowRightLeft, Users } from "lucide-react";

import type { TeamDto } from "@/generated/api";
import { TEAM_PERMISSION_GROUPS } from "@/components/organizations/roles/permission-groups";
import { RoleWorkspace } from "@/components/organizations/roles/role-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

import type { QueryStatus } from "../types";
import { TeamRoleDialogs } from "./team-role-dialogs";
import { useTeamRoles } from "./use-team-roles";

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
  const { team } = state;
  const hasOtherTeams = teams.length > 1;

  return (
    <>
      <RoleWorkspace
        canManage={canManageRoles}
        description="Team roles add project access on top of the organization role, only for the members and projects of one team. Each team keeps its own set."
        empty={
          !teamsStatus.isLoading && !teamsStatus.error && !team ? (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  description="Team roles belong to a team. Create a team first, then give its members a role."
                  icon={Users}
                  title="No teams yet"
                />
              </CardContent>
            </Card>
          ) : undefined
        }
        extraActions={(role) =>
          hasOtherTeams ? (
            <Button
              onClick={() => state.setCopyRole(role)}
              size="sm"
              type="button"
              variant="outline"
            >
              <ArrowRightLeft />
              Copy to team
            </Button>
          ) : null
        }
        groups={TEAM_PERMISSION_GROUPS}
        membersFor={state.membersFor}
        membersHref={`/orgs/${orgSlug}?tab=teams`}
        onCreate={(startFrom) => state.setDialog({ mode: "create", startFrom })}
        onDelete={state.removeRole}
        onEdit={(role) => state.setDialog({ mode: "edit", role })}
        roles={state.roles}
        status={{
          isLoading: teamsStatus.isLoading || state.rolesStatus.isLoading,
          error: teamsStatus.error ?? state.rolesStatus.error,
          refetch: teamsStatus.error ? teamsStatus.refetch : state.rolesStatus.refetch,
        }}
        title={team ? `${team.name} roles` : "Team roles"}
        toolbar={
          teams.length > 0 ? (
            <Field className="w-full max-w-xs" label="Team">
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
          ) : undefined
        }
      />
      <TeamRoleDialogs state={state} teams={teams} />
    </>
  );
}

export { TeamRolesCard };
