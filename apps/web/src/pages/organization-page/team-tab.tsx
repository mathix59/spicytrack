import { Plus } from "lucide-react";

import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { TeamCard } from "@/components/organizations/team-card";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { OrganizationTeamsState } from "./types";

function OrganizationTeamTab({
  orgSlug,
  state,
}: {
  orgSlug: string;
  state: OrganizationTeamsState;
}) {
  return (
    <Card>
      <OrganizationSectionHeader
        action={
          state.canManageTeams ? (
            <Dialog onOpenChange={state.setTeamOpen} open={state.teamOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  New team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New team</DialogTitle>
                  <DialogDescription>
                    Group members together to simplify project permissions.
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={state.createTeam}>
                  <Field label="Team name">
                    <Input name="name" required />
                  </Field>
                  <Field label="Description">
                    <Input name="description" />
                  </Field>
                  {state.teamError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{state.teamError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <FormDialogActions isPending={state.isCreatingTeam} submitLabel="Create team" />
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
        count={state.teams.length}
        title="Teams"
      />
      <CardContent>
        {state.teams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Create a team to group members and simplify project permissions."
          />
        ) : (
          <div className="grid gap-2">
            {state.teams.map((team) => (
              <TeamCard
                canManage={state.canManageTeams}
                key={team.id}
                members={state.members}
                orgSlug={orgSlug}
                projects={state.projects}
                team={team}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { OrganizationTeamTab };
