import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListOrganizationMembersQueryKey,
  type OrganizationMemberDto,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

function useMemberAdminTable({
  orgSlug,
  members,
}: {
  orgSlug: string;
  members: OrganizationMemberDto[];
}) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

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

  const updateRole = async (memberId: string, role: string) => {
    setActionError(null);

    try {
      await updateRoleMutation.mutateAsync({
        orgSlug,
        memberId,
        data: { role },
      });
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  const removeMember = async (memberId: string) => {
    setActionError(null);

    try {
      await removeMemberMutation.mutateAsync({
        orgSlug,
        memberId,
      });
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  return {
    actionError,
    sortedMembers,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending,
    updateRole,
    removeMember,
  };
}

export { useMemberAdminTable };
