import { LockKeyhole } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "@/components/auth/password-policy";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

import { AccountSection } from "./account-section";
import { useChangePassword } from "./use-change-password";

function AccountPasswordCard() {
  const { error, isPending, revokeOtherSessions, setRevokeOtherSessions, changePassword } =
    useChangePassword();

  return (
    <AccountSection
      description="Use a long, unique password that you don't reuse on other sites."
      icon={LockKeyhole}
      title="Password"
    >
      <form aria-busy={isPending} className="grid max-w-xl gap-4" onSubmit={changePassword}>
        <Field label="Current password">
          <PasswordInput autoComplete="current-password" name="currentPassword" required />
        </Field>

        <Field hint={PASSWORD_HINT} label="New password">
          <PasswordInput
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="newPassword"
            required
          />
        </Field>

        <Field label="Confirm new password">
          <PasswordInput autoComplete="new-password" name="confirmPassword" required />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Sign out other sessions</p>
            <p className="text-xs text-muted-foreground">
              Sign out every other device after the password change.
            </p>
          </div>
          <Switch
            aria-label="Sign out other sessions"
            checked={revokeOtherSessions}
            onCheckedChange={setRevokeOtherSessions}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <Button disabled={isPending} type="submit">
            <LockKeyhole />
            {isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </AccountSection>
  );
}

export { AccountPasswordCard };
