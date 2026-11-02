import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getGetMeQueryKey } from "@/generated/api";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

type TwoFactorSetup = { totpUri: string; secret: string; backupCodes: string[] };

function readTotpSecret(uri: string) {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function useTwoFactor() {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setIsPending(true);
    try {
      await action();
      return true;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return false;
    } finally {
      setIsPending(false);
    }
  };

  const startSetup = (password: string) =>
    run(async () => {
      const result = await authClient.twoFactor.enable({ password, method: "totp" });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to enable two-factor authentication");
      }
      const data = result.data && "totpURI" in result.data ? result.data : null;
      if (!data?.totpURI) {
        throw new Error("The server did not return an authenticator setup key. Try again.");
      }
      setSetup({
        totpUri: data.totpURI,
        secret: readTotpSecret(data.totpURI),
        backupCodes: data.backupCodes ?? [],
      });
    });

  const verifySetup = (code: string) =>
    run(async () => {
      const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        throw new Error(result.error.message ?? "Invalid authenticator code");
      }
      await invalidateProfile();
      setSetup(null);
      toast.success("Two-factor authentication enabled");
    });

  const cancelSetup = () => {
    setSetup(null);
    setError(null);
  };

  /** Throws on failure so the confirmation dialog can show the error. */
  const disable = async (password: string) => {
    if (!password) throw new Error("Enter your current password to continue.");
    const result = await authClient.twoFactor.disable({ password });
    if (result.error) {
      throw new Error(result.error.message ?? "Unable to disable two-factor authentication");
    }
    await invalidateProfile();
  };

  return { setup, error, isPending, startSetup, verifySetup, cancelSetup, disable };
}

export { useTwoFactor };
export type { TwoFactorSetup };
