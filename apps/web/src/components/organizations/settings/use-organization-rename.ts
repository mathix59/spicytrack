import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getGetMeQueryKey,
  getGetOrganizationQueryKey,
  getListOrganizationsQueryKey,
  type OrganizationDto,
  useUpdateOrganization,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { invalidateQueryKeys } from "@/lib/query-utils";

/** Matches the API limit on organization names. */
const ORGANIZATION_NAME_MAX_LENGTH = 100;

/** Draft, validation and submission for renaming an organization; the slug never changes. */
function useOrganizationRename(organization: Pick<OrganizationDto, "name" | "slug">) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateOrganization();
  const trimmed = name.trim();
  const canSubmit =
    trimmed.length > 0 &&
    trimmed.length <= ORGANIZATION_NAME_MAX_LENGTH &&
    trimmed !== organization.name &&
    !mutation.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    await runAsyncFormAction({
      setError,
      action: () => mutation.mutateAsync({ orgSlug: organization.slug, data: { name: trimmed } }),
      onSuccess: async () => {
        setName(trimmed);
        toast.success("Organization renamed.");
        // The page header, sidebar and organization switcher read these.
        await invalidateQueryKeys(queryClient, [
          getGetOrganizationQueryKey(organization.slug),
          getListOrganizationsQueryKey(),
          getGetMeQueryKey(),
        ]);
      },
    });
  };

  return {
    name,
    setName,
    error,
    canSubmit,
    isPending: mutation.isPending,
    submit,
  };
}

export { ORGANIZATION_NAME_MAX_LENGTH, useOrganizationRename };
