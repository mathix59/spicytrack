import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

type AuthMode = "login" | "register" | "forgot";

function useAuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) return;
    setError("SSO authentication failed. Please try again or contact your administrator.");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url);
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setForgotSent(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      name: String(formData.get("name") ?? ""),
    };

    if (mode === "forgot") {
      try {
        setIsPending(true);
        const result = await authClient.requestPasswordReset({
          email: payload.email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Unable to request password reset");
        }
        setForgotSent(true);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      } finally {
        setIsPending(false);
      }
      return;
    }

    try {
      setIsPending(true);
      const result = await (mode === "login"
        ? authClient.signIn.email({
            email: payload.email,
            password: payload.password,
          })
        : authClient.signUp.email({
            email: payload.email,
            password: payload.password,
            name: payload.name,
          }));

      if (result.error) {
        throw new Error(result.error.message ?? "Authentication failed");
      }

      onAuthenticated();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  const signInWithSso = async (providerId: string) => {
    setError(null);
    try {
      setIsPending(true);
      const result = await authClient.signIn.oauth2({
        providerId,
        callbackURL: window.location.origin,
        errorCallbackURL: window.location.origin,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "SSO authentication failed");
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setIsPending(false);
    }
  };

  return {
    mode,
    error,
    forgotSent,
    isPending,
    switchMode,
    signInWithSso,
    submit,
  };
}

export { useAuthForm };
