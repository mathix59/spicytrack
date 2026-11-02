import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListOrganizationMembersQueryKey,
  type OrganizationMemberDto,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";

function useMemberAdminTable({
  orgSlug,
  members,
}: {
  orgSlug: string;
  members: OrganizationMemberDto[];
}) {
  const queryClient = useQueryClient();

  const refreshMembers = async () => {
    await invalidateQueryKeys(queryClient, [getListOrganizationMembersQueryKey(orgSlug)]);
  };

  const updateRoleMutation = useUpdateOrganizationMemberRole({
    mutation: {
      onSuccess: refreshMembers,
    },
  });
  const removeMemberMutation = useRemoveOrganizationMember({
    mutation: {
      onSuccess: refreshMembers,
    },
  });

  const sortedMembers = useMemo(
    () =>
      [...members].sort((left, right) =>
        left.email.localeCompare(right.email, "en", { sensitivity: "base" }),
      ),
    [members],
  );

  // Both actions rethrow so the calling dialog can show the error inline.
  const updateRole = async (memberId: string, role: string) => {
    await updateRoleMutation.mutateAsync({ orgSlug, memberId, data: { role } });
  };

  const removeMember = async (memberId: string) => {
    await removeMemberMutation.mutateAsync({ orgSlug, memberId });
  };

  return {
    sortedMembers,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending,
    updateRole,
    removeMember,
  };
}

export { useMemberAdminTable };
