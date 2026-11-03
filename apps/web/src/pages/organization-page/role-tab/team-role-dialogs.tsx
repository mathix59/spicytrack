import type { FormEvent } from "react";

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
  const { dialog } = state;
  const destinationTeams = teams.filter((item) => item.id !== state.team?.id);

  const copy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void state.copyToTeam(String(new FormData(event.currentTarget).get("teamSlug") ?? ""));
  };

  return (
    <>
      <Dialog onOpenChange={(open) => !open && state.setDialog(null)} open={dialog !== null}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit"
                ? `Edit ${dialog.role.name}`
                : dialog?.startFrom
                  ? `Duplicate ${dialog.startFrom.name}`
                  : `New role for ${state.team?.name ?? "this team"}`}
            </DialogTitle>
            <DialogDescription>
              Team roles only apply to members of {state.team?.name ?? "this team"} and its
              projects.
            </DialogDescription>
          </DialogHeader>
          {dialog ? (
            <RoleForm
              error={state.error}
              groups={TEAM_PERMISSION_GROUPS}
              isPending={state.isSaving}
              key={dialog.mode === "edit" ? dialog.role.id : (dialog.startFrom?.id ?? "new")}
              mode={dialog.mode}
              onSubmit={state.submitRole}
              role={dialog.mode === "edit" ? dialog.role : null}
              roles={state.roles}
              startFrom={dialog.mode === "create" ? dialog.startFrom : null}
              submitLabel={dialog.mode === "edit" ? "Save changes" : "Create role"}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && state.setCopyRole(null)}
        open={Boolean(state.copyRole)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy {state.copyRole?.name} to another team</DialogTitle>
            <DialogDescription>
              Creates the same role, with the same permissions, in the team you choose.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={copy}>
            <Field label="Destination team">
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
            <FormDialogActions isPending={state.isSaving} submitLabel="Copy role" />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { TeamRoleDialogs };
