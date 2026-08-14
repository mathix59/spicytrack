import { useState } from "react";
import { Shield, Trash2, UserCog } from "lucide-react";

import type { OrganizationMemberDto, OrganizationRoleDto } from "@/generated/api";
import { formatLocalDate, renderNullableText } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

function roleSummary(role: string) {
  switch (role) {
    case "manager":
      return "Can manage members, teams, projects, alerts, releases, and keys.";
    case "developer":
      return "Can investigate issues, events, releases, and artifacts.";
    case "member":
      return "Same read access as developer without management actions.";
    case "viewer":
      return "Read-only access across the organization scope.";
    default:
      return "Organization-level access role.";
  }
}

function MemberAdminRow({
  member,
  canManage,
  actionError,
  isUpdatingRole,
  isRemovingMember,
  onUpdateRole,
  onRemoveMember,
  roles,
}: {
  member: OrganizationMemberDto;
  canManage: boolean;
  actionError: string | null;
  isUpdatingRole: boolean;
  isRemovingMember: boolean;
  onUpdateRole: (memberId: string, role: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  roles: OrganizationRoleDto[];
}) {
  return (
    <TableRow key={member.memberId}>
      <TableCell>
        <div>
          <p className="font-medium">{renderNullableText(member.name, member.email)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge>{roles.find((role) => role.key === member.role)?.name ?? member.role}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex max-w-[340px] items-start gap-2 text-sm text-muted-foreground">
          <Shield className="mt-0.5 size-4 shrink-0" />
          <span>{roleSummary(member.role)}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatLocalDate(member.joinedAt)}</TableCell>
      <TableCell className="text-right">
        {canManage ? (
          <div className="flex justify-end gap-2">
            <MemberRoleDialog
              currentRole={member.role}
              disabled={isUpdatingRole}
              error={actionError}
              onSubmit={(role) => onUpdateRole(member.memberId, role)}
              roles={roles}
            />
            <MemberRemoveDialog
              disabled={isRemovingMember}
              email={member.email}
              error={actionError}
              onConfirm={() => onRemoveMember(member.memberId)}
            />
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function MemberRoleDialog({
  currentRole,
  disabled,
  error,
  onSubmit,
  roles,
}: {
  currentRole: string;
  disabled: boolean;
  error: string | null;
  onSubmit: (role: string) => Promise<void>;
  roles: OrganizationRoleDto[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(currentRole);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="secondary">
          <UserCog className="size-4" />
          Organization role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change organization role</DialogTitle>
          <DialogDescription>
            Adjust this member&apos;s organization-level permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Select onChange={(event) => setRole(event.target.value)} value={role}>
            {roles.map((roleOption) => (
              <option key={roleOption.id} value={roleOption.key}>
                {roleOption.name}
              </option>
            ))}
          </Select>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={async () => {
              try {
                await onSubmit(role);
                setOpen(false);
              } catch {
                // error is rendered above
              }
            }}
            type="button"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberRemoveDialog({
  email,
  disabled,
  error,
  onConfirm,
}: {
  email: string;
  disabled: boolean;
  error: string | null;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="ghost">
          <Trash2 className="size-4" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove member</DialogTitle>
          <DialogDescription>{email} will lose access to this organization.</DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={async () => {
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                // error is rendered above
              }
            }}
            type="button"
            variant="secondary"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { MemberAdminRow };
