import type { TeamDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { TEAM_PERMISSION_GROUPS } from "@/components/organizations/roles/permission-groups";
import { RoleForm } from "@/components/organizations/roles/role-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

import type { TeamRolesState } from "./use-team-roles";

function TeamRoleDialogs({ state, teams }: { state: TeamRolesState; teams: TeamDto[] }) {
  const destinationTeams = teams.filter((item) => item.id !== state.team?.id);

  return (
    <>
      <Dialog onOpenChange={state.setCreateOpen} open={state.createOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New role for {state.team?.name}</DialogTitle>
            <DialogDescription>
              Choose the permissions granted to members of this team.
            </DialogDescription>
          </DialogHeader>
          <RoleForm
            error={state.error}
            groups={TEAM_PERMISSION_GROUPS}
            isPending={state.isCreating}
            onSubmit={state.createRole}
            submitLabel="Create role"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && state.setDuplicateRole(null)}
        open={Boolean(state.duplicateRole)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate {state.duplicateRole?.name}</DialogTitle>
            <DialogDescription>
              Copy this role and all its permissions to another team.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={state.duplicate}>
            <Field
              hint={
                destinationTeams.length === 0
                  ? "Create another team to duplicate roles."
                  : undefined
              }
              label="Destination team"
            >
              <Select defaultValue="" name="teamSlug" required>
                <option disabled value="">
                  Choose a team
                </option>
                {destinationTeams.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <FormDialogActions
              isPending={state.isCreating || destinationTeams.length === 0}
              submitLabel="Duplicate role"
            />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && state.setEditRole(null)}
        open={Boolean(state.editRole)}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {state.editRole?.name}</DialogTitle>
            <DialogDescription>Update this custom role's name and permissions.</DialogDescription>
          </DialogHeader>
          <RoleForm
            error={state.error}
            groups={TEAM_PERMISSION_GROUPS}
            isPending={state.isUpdating}
            key={state.editRole?.id}
            onSubmit={state.updateRole}
            role={state.editRole}
            submitLabel="Save changes"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export { TeamRoleDialogs };
