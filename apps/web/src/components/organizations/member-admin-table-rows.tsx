import { useState } from "react";
import { Shield, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationMemberDto, OrganizationRoleDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { formatLocalDate, getErrorMessage, renderNullableText } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

function MemberAdminRow({
  member,
  canManage,
  isUpdatingRole,
  isRemovingMember,
  onUpdateRole,
  onRemoveMember,
  roles,
}: {
  member: OrganizationMemberDto;
  canManage: boolean;
  isUpdatingRole: boolean;
  isRemovingMember: boolean;
  onUpdateRole: (memberId: string, role: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  roles: OrganizationRoleDto[];
}) {
  const memberRole = roles.find((role) => role.key === member.role);
  const roleName = memberRole?.name ?? member.role;
  const displayName = renderNullableText(member.name, member.email);

  return (
    <TableRow>
      <TableCell className="max-w-[14rem] sm:max-w-none">
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
          <Badge className="mt-2 sm:hidden">{roleName}</Badge>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge>{roleName}</Badge>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="flex max-w-[340px] items-start gap-2 text-sm text-muted-foreground">
          <Shield className="mt-0.5 size-4 shrink-0" />
          <span className="line-clamp-2">
            {memberRole?.description || "Custom organization role."}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {formatLocalDate(member.joinedAt)}
      </TableCell>
      <TableCell className="text-right">
        {canManage ? (
          <div className="flex justify-end gap-1 sm:gap-2">
            <MemberRoleDialog
              currentRole={member.role}
              disabled={isUpdatingRole}
              memberLabel={displayName}
              onSubmit={(role) => onUpdateRole(member.memberId, role)}
              roles={roles}
            />
            <ConfirmDialog
              confirmLabel="Remove member"
              description={`${member.email} will lose access to this organization and all of its projects.`}
              onConfirm={() => onRemoveMember(member.memberId)}
              successMessage="Member removed"
              title="Remove member"
              trigger={
                <Button
                  aria-label={`Remove ${displayName}`}
                  disabled={isRemovingMember}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4 text-destructive" />
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              }
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
  memberLabel,
  onSubmit,
  roles,
}: {
  currentRole: string;
  disabled: boolean;
  memberLabel: string;
  onSubmit: (role: string) => Promise<void>;
  roles: OrganizationRoleDto[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(currentRole);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await onSubmit(role);
      toast.success("Organization role updated");
      setOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRole(currentRole);
          setError(null);
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button
          aria-label={`Change organization role for ${memberLabel}`}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UserCog className="size-4" />
          <span className="hidden sm:inline">Organization role</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change organization role</DialogTitle>
          <DialogDescription>
            Adjust organization-level permissions for {memberLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field
            hint={roles.find((roleOption) => roleOption.key === role)?.description ?? undefined}
            label="Organization role"
          >
            <Select onChange={(event) => setRole(event.target.value)} value={role}>
              {roles.map((roleOption) => (
                <option key={roleOption.id} value={roleOption.key}>
                  {roleOption.name}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={disabled || role === currentRole}
            onClick={() => void save()}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MemberAdminRow };
