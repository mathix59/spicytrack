import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { MIN_PASSWORD_LENGTH } from "@/components/auth/password-policy";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

function useChangePassword() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password confirmation does not match.");
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to change password");
      }
      form.reset();
      toast.success("Password updated", {
        description: revokeOtherSessions ? "Your other sessions were signed out." : undefined,
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  return { error, isPending, revokeOtherSessions, setRevokeOtherSessions, changePassword };
}

export { useChangePassword };
