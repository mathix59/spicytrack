import { type FormEvent, useState } from "react";
import { KeySquare, ShieldCheck, ShieldOff } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { UserDto } from "@/generated/api";

import { AccountSection } from "./account-section";
import { TwoFactorSetupPanel } from "./two-factor-setup-panel";
import { useTwoFactor } from "./use-two-factor";

function DisableTwoFactorButton({ onDisable }: { onDisable: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  return (
    <ConfirmDialog
      confirmLabel="Disable 2FA"
      description="Your account will only be protected by your password. Your backup codes will stop working."
      onConfirm={() => onDisable(password)}
      onOpenChange={(open) => {
        if (!open) setPassword("");
      }}
      successMessage="Two-factor authentication disabled"
      title="Disable two-factor authentication?"
      trigger={
        <Button type="button" variant="outline">
          <ShieldOff />
          Disable 2FA
        </Button>
      }
    >
      <Field label="Current password">
        <PasswordInput
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          value={password}
        />
      </Field>
    </ConfirmDialog>
  );
}

function AccountTwoFactorCard({ user }: { user: UserDto | undefined }) {
  const twoFactor = useTwoFactor();
  const [setupPassword, setSetupPassword] = useState("");
  const enabled = Boolean(user?.twoFactorEnabled);

  const startSetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void twoFactor.startSetup(setupPassword).then((ok) => {
      if (ok) setSetupPassword("");
    });
  };

  return (
    <AccountSection
      action={
        user ? (
          <Badge variant={enabled ? "success" : "muted"}>{enabled ? "Enabled" : "Disabled"}</Badge>
        ) : null
      }
      description="Require a code from an authenticator app such as 1Password, Authy, Google Authenticator or Aegis when signing in."
      icon={ShieldCheck}
      title="Two-factor authentication"
    >
      {twoFactor.error ? (
        <Alert variant="destructive">
          <AlertDescription>{twoFactor.error}</AlertDescription>
        </Alert>
      ) : null}

      {enabled ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-medium">Two-factor authentication is on</p>
              <p className="text-xs text-muted-foreground">
                You'll be asked for an authenticator or backup code after entering your password.
              </p>
            </div>
          </div>
          <DisableTwoFactorButton onDisable={twoFactor.disable} />
        </div>
      ) : twoFactor.setup ? (
        <TwoFactorSetupPanel
          isPending={twoFactor.isPending}
          onCancel={twoFactor.cancelSetup}
          onVerify={async (code) => {
            await twoFactor.verifySetup(code);
          }}
          setup={twoFactor.setup}
        />
      ) : (
        <form className="grid max-w-xl gap-4" onSubmit={startSetup}>
          <Field hint="Confirm your identity to generate a new setup key." label="Current password">
            <PasswordInput
              autoComplete="current-password"
              onChange={(event) => setSetupPassword(event.target.value)}
              value={setupPassword}
            />
          </Field>
          <div>
            <Button disabled={twoFactor.isPending || !setupPassword} type="submit">
              <KeySquare />
              {twoFactor.isPending ? "Preparing…" : "Set up authenticator"}
            </Button>
          </div>
        </form>
      )}
    </AccountSection>
  );
}

export { AccountTwoFactorCard };
