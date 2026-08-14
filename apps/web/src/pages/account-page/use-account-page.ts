import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListPersonalAccessTokensQueryKey,
  type PersonalAccessTokenDto,
  useCreatePersonalAccessToken,
  useGetMe,
  useListPersonalAccessTokens,
  useRevokePersonalAccessToken,
} from "@/generated/api";
import { authClient } from "@/lib/auth-client";
import { runAsyncFormAction } from "@/lib/form-submission";
import { invalidateQueryKeys } from "@/lib/query-utils";

import type { AccountPageData } from "./types";

const EMPTY_TOKENS: PersonalAccessTokenDto[] = [];

function useAccountPage(): AccountPageData {
  const queryClient = useQueryClient();
  const meQuery = useGetMe();
  const tokensQuery = useListPersonalAccessTokens();
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);

  const invalidateTokens = async () => {
    await invalidateQueryKeys(queryClient, [getListPersonalAccessTokensQueryKey()]);
  };

  const createTokenMutation = useCreatePersonalAccessToken({
    mutation: { onSuccess: invalidateTokens },
  });
  const revokeTokenMutation = useRevokePersonalAccessToken({
    mutation: { onSuccess: invalidateTokens },
  });

  const user = meQuery.data?.data.user;
  const tokens = tokensQuery.data?.data ?? EMPTY_TOKENS;

  const createToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatedSecret(null);
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const expiresInDaysRaw = String(formData.get("expiresInDays") ?? "");

    if (!name) {
      return;
    }

    await runAsyncFormAction({
      setError: setTokenError,
      action: () =>
        createTokenMutation.mutateAsync({
          data: {
            name,
            expiresInDays: expiresInDaysRaw ? Number(expiresInDaysRaw) : null,
          },
        }),
      onSuccess: async (response) => {
        setCreatedSecret(response.data.secret);
        event.currentTarget.reset();
      },
    });
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new password confirmation does not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await runAsyncFormAction({
        setError: setPasswordError,
        action: async () => {
          const result = await authClient.changePassword({
            currentPassword,
            newPassword,
            revokeOtherSessions,
          });

          if (result.error) {
            throw new Error(result.error.message ?? "Unable to change password");
          }

          return result;
        },
        onSuccess: async () => {
          setPasswordSaved(true);
          event.currentTarget.reset();
        },
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      await revokeTokenMutation.mutateAsync({ tokenId });
    } catch {
      // revoke failures surface via mutation state
    }
  };

  const requestVerification = async () => {
    if (!user) {
      return;
    }

    setIsSendingVerification(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: `${window.location.origin}/verify-email`,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to send verification email");
      }
      setVerificationSent(true);
    } finally {
      setIsSendingVerification(false);
    }
  };

  return {
    user,
    tokens,
    tokenError,
    passwordError,
    verificationSent,
    createdSecret,
    passwordSaved,
    isSendingVerification,
    isCreatingToken: createTokenMutation.isPending,
    isRevokingToken: revokeTokenMutation.isPending,
    isChangingPassword,
    revokeOtherSessions,
    requestVerification,
    createToken,
    changePassword,
    revokeToken,
    setRevokeOtherSessions,
  };
}

export { useAccountPage };
