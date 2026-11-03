import { useSearchParams } from "react-router-dom";

import type { OrganizationMemberDto, OrganizationRoleDto, TeamDto } from "@/generated/api";
import { OrganizationRoleManagement } from "@/components/organizations/organization-role-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { TeamRolesCard } from "./role-tab/team-roles-card";
import type { QueryStatus } from "./types";

type RoleSection = "organization" | "team";

function OrganizationRoleTab({
  orgSlug,
  teams,
  teamsStatus,
  organizationRoles,
  organizationRolesStatus,
  members,
  membersStatus,
  canManageRoles,
}: {
  orgSlug: string;
  teams: TeamDto[];
  teamsStatus: QueryStatus;
  organizationRoles: OrganizationRoleDto[];
  organizationRolesStatus: QueryStatus;
  members: OrganizationMemberDto[];
  membersStatus: QueryStatus;
  canManageRoles: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  // Links to a specific team's roles (?team=...) land on the team roles view.
  const section: RoleSection =
    requestedSection === "team" || requestedSection === "organization"
      ? requestedSection
      : searchParams.has("team")
        ? "team"
        : "organization";

  const selectSection = (next: string) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("section", next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <Tabs className="grid gap-6" onValueChange={selectSection} value={section}>
      <TabsList>
        <TabsTrigger value="organization">Organization roles</TabsTrigger>
        <TabsTrigger value="team">Team roles</TabsTrigger>
      </TabsList>
      <TabsContent value="organization">
        <OrganizationRoleManagement
          canManage={canManageRoles}
          members={members}
          membersStatus={membersStatus}
          orgSlug={orgSlug}
          roles={organizationRoles}
          status={organizationRolesStatus}
        />
      </TabsContent>
      <TabsContent value="team">
        <TeamRolesCard
          canManageRoles={canManageRoles}
          orgSlug={orgSlug}
          teams={teams}
          teamsStatus={teamsStatus}
        />
      </TabsContent>
    </Tabs>
  );
}

export { OrganizationRoleTab };
