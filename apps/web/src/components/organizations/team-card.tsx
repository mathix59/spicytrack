import { useNavigate } from "react-router-dom";

import { useTeamCard } from "./team-card/use-team-card";
import { TeamCardDialogs } from "./team-card/team-card-dialogs";
import { TeamCardExpanded } from "./team-card/team-card-expanded";
import { TeamCardHeader } from "./team-card/team-card-header";
import type { TeamCardProps } from "./team-card/types";

function TeamCard(props: TeamCardProps) {
  const state = useTeamCard(props);
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-border">
      <TeamCardHeader
        canManage={state.canManage}
        expanded={state.expanded}
        onOpenAdd={() => state.setAddOpen(true)}
        onOpenDelete={() => state.setDeleteOpen(true)}
        onOpenEdit={() => state.setEditOpen(true)}
        onOpenRoles={() => navigate(`/orgs/${props.orgSlug}?tab=roles&team=${props.team.slug}`)}
        onToggleExpanded={state.toggleExpanded}
        team={props.team}
        teamMembersCount={state.teamMembers.length}
        teamProjectsCount={state.teamProjects.length}
      />

      <TeamCardDialogs
        addOpen={state.addOpen}
        availableMembers={state.availableMembers}
        deleteOpen={state.deleteOpen}
        editOpen={state.editOpen}
        error={state.error}
        isAddingMember={state.isAddingMember}
        isDeletingTeam={state.isDeletingTeam}
        isUpdatingTeam={state.isUpdatingTeam}
        onAddOpenChange={state.setAddOpen}
        onDeleteOpenChange={state.setDeleteOpen}
        onEditOpenChange={state.setEditOpen}
        onDeleteTeam={() => void state.deleteTeam()}
        onSubmitEdit={(event) => void state.submitEdit(event)}
        onSubmitMember={(event) => void state.submitMember(event)}
        team={props.team}
        teamRoles={state.teamRoles}
      />

      {state.expanded ? (
        <TeamCardExpanded
          canManage={state.canManage}
          error={state.error}
          isRemovingMember={state.isRemovingMember}
          onRemoveMember={state.removeMember}
          team={props.team}
          teamMembers={state.teamMembers}
          teamRoles={state.teamRoles}
          teamProjects={state.teamProjects}
        />
      ) : null}
    </div>
  );
}

export { TeamCard };
