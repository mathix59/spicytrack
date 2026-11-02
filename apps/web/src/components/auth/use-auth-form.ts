import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

type AuthMode = "login" | "register" | "forgot";

function useAuthForm({
  onAuthenticated,
  invitationToken,
}: {
  onAuthenticated: () => void | Promise<void>;
  invitationToken?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(invitationToken ? "register" : "login");
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
      let result = await (mode === "login"
        ? authClient.signIn.email({
            email: payload.email,
            password: payload.password,
          })
        : authClient.signUp.email(
            {
              email: payload.email,
              password: payload.password,
              name: payload.name,
            },
            invitationToken ? { headers: { "x-invitation-token": invitationToken } } : undefined,
          ));

      if (
        invitationToken &&
        mode === "register" &&
        (result.error?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
          (!result.error && !result.data?.token))
      ) {
        // Recover a signup that created the account but did not finish accepting the invitation.
        // An existing account is only used after its password has been authenticated.
        result = await authClient.signIn.email({
          email: payload.email,
          password: payload.password,
        });
        if (result.error) {
          setMode("login");
          throw new Error(
            "An account already exists for this email. Sign in with its password or use Forgot password to continue accepting your invitation.",
          );
        }
      }
      if (result.error) {
        throw new Error(result.error.message ?? "Authentication failed");
      }

      await onAuthenticated();
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
      const result = await authClient.signIn.social({
        provider: providerId,
        callbackURL: window.location.href,
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
