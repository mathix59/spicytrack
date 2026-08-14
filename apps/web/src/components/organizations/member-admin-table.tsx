import type { OrganizationMemberDto, OrganizationRoleDto } from "@/generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { MemberAdminRow } from "./member-admin-table-rows";
import { useMemberAdminTable } from "./member-admin-table/use-member-admin-table";

function MemberAdminTable({
  orgSlug,
  members,
  canManage,
  roles,
}: {
  orgSlug: string;
  members: OrganizationMemberDto[];
  canManage: boolean;
  roles: OrganizationRoleDto[];
}) {
  const state = useMemberAdminTable({ orgSlug, members });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(state.sortedMembers.length / pageSize));
  const visibleMembers = state.sortedMembers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Member</TableHead>
            <TableHead>Organization role</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[160px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleMembers.map((member) => (
            <MemberAdminRow
              actionError={state.actionError}
              canManage={canManage}
              isRemovingMember={state.isRemovingMember}
              isUpdatingRole={state.isUpdatingRole}
              key={member.memberId}
              member={member}
              onRemoveMember={state.removeMember}
              onUpdateRole={state.updateRole}
              roles={roles}
            />
          ))}
        </TableBody>
      </Table>
      {state.sortedMembers.length > pageSize ? (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
          <span>{state.sortedMembers.length} members</span>
          <div className="flex gap-2">
            <Button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={page === pageCount}
              onClick={() => setPage((current) => current + 1)}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { MemberAdminTable };
