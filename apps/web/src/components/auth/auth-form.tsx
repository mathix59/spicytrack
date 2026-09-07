import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { orvalFetch } from "@/lib/orval-fetch";

import { AuthHeroPanel, AuthModePanel } from "./auth-form-panels";
import { useAuthForm } from "./use-auth-form";

type AuthenticationOptions = {
  registrationsEnabled: boolean;
  passwordEnabled: boolean;
  sso: { providerId: string; providerName: string } | null;
};

function AuthForm({
  onAuthenticated,
  invitationToken,
}: {
  onAuthenticated: () => void;
  invitationToken?: string;
}) {
  const state = useAuthForm({ onAuthenticated, invitationToken });
  const [options, setOptions] = useState<AuthenticationOptions>({
    registrationsEnabled: false,
    passwordEnabled: true,
    sso: null,
  });

  useEffect(() => {
    void orvalFetch<{ data: AuthenticationOptions }>("/auth/registration-status", {
      method: "GET",
    }).then((result) => setOptions(result.data));
  }, []);

  return (
    <Card className="w-full max-w-2xl overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <AuthHeroPanel />
        <AuthModePanel
          error={state.error}
          forgotSent={state.forgotSent}
          isPending={state.isPending}
          mode={state.mode}
          passwordEnabled={options.passwordEnabled}
          registrationsEnabled={Boolean(invitationToken) || options.registrationsEnabled}
          sso={options.sso}
          onSsoSignIn={(providerId) => void state.signInWithSso(providerId)}
          onSubmit={(event) => void state.submit(event)}
          switchMode={state.switchMode}
        />
      </div>
    </Card>
  );
}

export { AuthForm };
