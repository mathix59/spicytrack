import { Plus } from "lucide-react";

import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { QueryError } from "@/components/common/query-error";
import { MemberAdminTable } from "@/components/organizations/member-admin-table";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";

import { RevokeInvitationDialog } from "./revoke-invitation-dialog";
import type { OrganizationMembersState } from "./types";

function OrganizationMemberTab({
  orgSlug,
  state,
}: {
  orgSlug: string;
  state: OrganizationMembersState;
}) {
  return (
    <Card>
      <OrganizationSectionHeader
        action={
          state.canInviteMembers ? (
            <Dialog onOpenChange={state.setInviteOpen} open={state.inviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  Invite member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a member</DialogTitle>
                  <DialogDescription>
                    Assign an organization role. Team roles are managed separately for each team.
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={state.inviteMember}>
                  <Field label="Email">
                    <Input name="email" required type="email" />
                  </Field>
                  <Field label="Organization role">
                    <Select defaultValue={state.roles[0]?.key ?? ""} name="role">
                      {state.roles.map((role) => (
                        <option key={role.id} value={role.key}>
                          {role.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {state.inviteError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{state.inviteError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <FormDialogActions isPending={state.isInvitingMember} submitLabel="Send invite" />
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
        count={state.membersStatus.isLoading ? undefined : state.members.length}
        description="Organization roles control who can manage this organization. Team roles control project access."
        title="Members"
      />
      <CardContent className="grid gap-6">
        {state.membersStatus.isLoading ? (
          <SkeletonRows rows={4} />
        ) : state.membersStatus.error ? (
          <QueryError
            error={state.membersStatus.error}
            onRetry={state.membersStatus.refetch}
            title="Could not load members"
          />
        ) : (
          <MemberAdminTable
            canManage={state.canManageMembers}
            members={state.members}
            orgSlug={orgSlug}
            roles={state.roles}
          />
        )}
        {state.invitationsStatus.error ? (
          <QueryError
            error={state.invitationsStatus.error}
            onRetry={state.invitationsStatus.refetch}
            title="Could not load pending invitations"
          />
        ) : null}
        {state.invitations.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">Pending invitations</p>
            {state.invitations.map((invitation) => (
              <div
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                key={invitation.id}
              >
                <span className="min-w-0 truncate">{invitation.email}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">
                    {state.roles.find((role) => role.key === invitation.role)?.name ??
                      invitation.role}
                  </Badge>
                  {state.canInviteMembers && (
                    <Button
                      disabled={state.isResendingInvitation}
                      onClick={() => state.resendInvitation(invitation.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Resend
                    </Button>
                  )}
                  {state.canRemoveMembers && (
                    <RevokeInvitationDialog orgSlug={orgSlug} invitation={invitation} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { OrganizationMemberTab };
