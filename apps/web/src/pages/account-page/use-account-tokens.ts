import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListPersonalAccessTokensQueryKey,
  useCreatePersonalAccessToken,
  useListPersonalAccessTokens,
  useRevokePersonalAccessToken,
} from "@/generated/api";
import { withReadableApiError } from "@/lib/api-error";
import { runAsyncFormAction } from "@/lib/form-submission";
import { invalidateQueryKeys } from "@/lib/query-utils";

type CreatedToken = { name: string; secret: string };

function useAccountTokens() {
  const queryClient = useQueryClient();
  const tokensQuery = useListPersonalAccessTokens();
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);

  const invalidateTokens = () =>
    invalidateQueryKeys(queryClient, [getListPersonalAccessTokensQueryKey()]);

  const createMutation = useCreatePersonalAccessToken({
    mutation: { onSuccess: invalidateTokens },
  });
  const revokeMutation = useRevokePersonalAccessToken({
    mutation: { onSuccess: invalidateTokens },
  });

  const createToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatedToken(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const expiresInDays = Number(formData.get("expiresInDays") ?? 90);
    const access = String(formData.get("access") ?? "read");
    const organizationId = String(formData.get("organizationId") ?? "");
    if (!name) {
      setCreateError("Give the token a name so you can recognise it later.");
      return;
    }

    await runAsyncFormAction({
      setError: setCreateError,
      action: () =>
        withReadableApiError(() =>
          createMutation.mutateAsync({
            data: {
              name,
              // Scopes are cumulative: the highest one is enough.
              scopes: [access as "read" | "write" | "admin"],
              organizationId: organizationId || null,
              expiresInDays,
            },
          }),
        ),
      onSuccess: (response) => {
        setCreatedToken({ name, secret: response.data.secret });
        form.reset();
      },
    });
  };

  /** Throws a readable error so the confirmation dialog can show it. */
  const revokeToken = (tokenId: string) =>
    withReadableApiError(() => revokeMutation.mutateAsync({ tokenId }));

  return {
    tokensQuery,
    tokens: tokensQuery.data?.data ?? [],
    createError,
    createdToken,
    isCreating: createMutation.isPending,
    createToken,
    dismissCreatedToken: () => setCreatedToken(null),
    revokeToken,
  };
}

export { useAccountTokens };
export type { CreatedToken };
