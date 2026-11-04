import { type FormEvent, type ReactNode, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { BackupCodes } from "./backup-codes";
import { TotpQrCode } from "./totp-qr-code";
import type { TwoFactorSetup } from "./use-two-factor";

function groupSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function SetupStep({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-accent"
        >
          {step}
        </span>
        <div className="grid gap-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:pl-9">{children}</div>
    </li>
  );
}

function TwoFactorSetupPanel({
  setup,
  isPending,
  onVerify,
  onCancel,
}: {
  setup: TwoFactorSetup;
  isPending: boolean;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onVerify(code);
  };

  return (
    <div className="grid gap-3">
      <Alert role="note" variant="warning">
        <AlertDescription>
          Two-factor authentication is not active until you confirm a code in step 3.
        </AlertDescription>
      </Alert>
      <ol className="grid gap-3">
        <SetupStep
          description="Scan this QR code with your authenticator app, such as Google Authenticator, 1Password or Authy."
          step={1}
          title="Add SpicyTrack to your authenticator app"
        >
          <TotpQrCode value={setup.totpUri} />
          <p className="text-xs leading-5 text-muted-foreground">
            Can't scan? Enter this key manually: choose to add an account manually (sometimes called
            “Enter a setup key”), then paste it. Pick “time-based” if asked.
          </p>
          {setup.secret ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
              <span className="sr-only">Setup key:</span>
              <code className="min-w-0 flex-1 font-mono text-sm tracking-wider [overflow-wrap:anywhere]">
                {groupSecret(setup.secret)}
              </code>
              <CopyButton
                label="Copy setup key"
                successMessage="Setup key copied"
                value={setup.secret}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <CopyButton
              label="Copy setup link"
              showLabel
              successMessage="Setup link copied"
              value={setup.totpUri}
              variant="outline"
            />
            Some password managers accept the full otpauth:// link instead.
          </div>
        </SetupStep>

        <SetupStep
          description="Store these codes somewhere safe, such as a password manager. Each code signs you in once if you lose your device. They won't be shown again."
          step={2}
          title="Save your backup codes"
        >
          <BackupCodes codes={setup.backupCodes} />
        </SetupStep>

        <SetupStep
          description="Enter the 6-digit code currently shown in your authenticator app."
          step={3}
          title="Confirm the code"
        >
          <form className="grid max-w-sm gap-3" onSubmit={submit}>
            <Field label="Authenticator code">
              <Input
                autoComplete="one-time-code"
                className="font-mono tracking-[0.3em]"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                pattern="[0-9]{6}"
                placeholder="123456"
                value={code}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={isPending || code.length !== 6} type="submit">
                <ShieldCheck />
                {isPending ? "Verifying…" : "Verify and enable"}
              </Button>
              <Button disabled={isPending} onClick={onCancel} type="button" variant="ghost">
                Cancel
              </Button>
            </div>
          </form>
        </SetupStep>
      </ol>
    </div>
  );
}

export { TwoFactorSetupPanel };
