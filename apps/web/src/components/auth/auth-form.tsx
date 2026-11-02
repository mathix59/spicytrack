import { Card } from "@/components/ui/card";

import { AuthHeroPanel, AuthModePanel } from "./auth-form-panels";
import { useAuthenticationOptions } from "./use-authentication-options";
import { useAuthForm } from "./use-auth-form";

function AuthForm({
  onAuthenticated,
  invitationToken,
}: {
  onAuthenticated: () => void | Promise<void>;
  invitationToken?: string;
}) {
  const state = useAuthForm({ onAuthenticated, invitationToken });
  const { options } = useAuthenticationOptions();

  return (
    <Card className="mx-auto w-full max-w-4xl overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <AuthHeroPanel />
        <AuthModePanel
          error={state.error}
          forgotSent={state.forgotSent}
          isPending={state.isPending}
          mode={state.mode}
          onSsoSignIn={(providerId) => void state.signInWithSso(providerId)}
          onSubmit={(event) => void state.submit(event)}
          options={{
            ...options,
            registrationsEnabled: Boolean(invitationToken) || options.registrationsEnabled,
          }}
          switchMode={state.switchMode}
        />
      </div>
    </Card>
  );
}

export { AuthForm };
