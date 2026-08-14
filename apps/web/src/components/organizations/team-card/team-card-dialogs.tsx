import type { OrganizationMemberDto, TeamDto, TeamRoleDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { renderNullableText } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

function TeamCardDialogs({
  team,
  error,
  addOpen,
  editOpen,
  deleteOpen,
  availableMembers,
  teamRoles,
  isAddingMember,
  isUpdatingTeam,
  isDeletingTeam,
  onAddOpenChange,
  onEditOpenChange,
  onDeleteOpenChange,
  onSubmitMember,
  onSubmitEdit,
  onDeleteTeam,
}: {
  team: TeamDto;
  error: string | null;
  addOpen: boolean;
  editOpen: boolean;
  deleteOpen: boolean;
  availableMembers: OrganizationMemberDto[];
  teamRoles: TeamRoleDto[];
  isAddingMember: boolean;
  isUpdatingTeam: boolean;
  isDeletingTeam: boolean;
  onAddOpenChange: (open: boolean) => void;
  onEditOpenChange: (open: boolean) => void;
  onDeleteOpenChange: (open: boolean) => void;
  onSubmitMember: React.FormEventHandler<HTMLFormElement>;
  onSubmitEdit: React.FormEventHandler<HTMLFormElement>;
  onDeleteTeam: () => void;
}) {
  return (
    <>
      <Dialog onOpenChange={onAddOpenChange} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to {team.name}</DialogTitle>
            <DialogDescription>Add an existing organization member to this team.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmitMember}>
            <Field label="Member">
              <Select defaultValue="" name="userId" required>
                <option disabled value="">
                  {availableMembers.length > 0 ? "Choose a member" : "No available members"}
                </option>
                {availableMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {renderNullableText(member.name, member.email)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Team role">
              <Select defaultValue={teamRoles[0]?.key ?? "contributor"} name="role" required>
                {teamRoles.map((role) => (
                  <option key={role.id} value={role.key}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FormDialogActions isPending={isAddingMember} submitLabel="Add to team" />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={onEditOpenChange} open={editOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {team.name}</DialogTitle>
            <DialogDescription>Change the team name or description.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmitEdit}>
            <Field label="Name">
              <Input defaultValue={team.name} name="name" required />
            </Field>
            <Field label="Description">
              <Input defaultValue={team.description ?? ""} name="description" />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FormDialogActions isPending={isUpdatingTeam} submitLabel="Save changes" />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={onDeleteOpenChange} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {team.name}?</DialogTitle>
            <DialogDescription>
              Members and roles will be removed. Projects will remain but become unassigned.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormDialogActions
            buttonType="button"
            isPending={isDeletingTeam}
            onSubmitClick={onDeleteTeam}
            submitLabel="Delete team"
            submitVariant="secondary"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export { TeamCardDialogs };
