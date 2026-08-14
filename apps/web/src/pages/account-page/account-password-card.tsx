import { LockKeyhole } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { AccountPageData } from "./types";

function AccountPasswordCard({
  passwordError,
  passwordSaved,
  revokeOtherSessions,
  isChangingPassword,
  changePassword,
  setRevokeOtherSessions,
}: Pick<
  AccountPageData,
  | "passwordError"
  | "passwordSaved"
  | "revokeOtherSessions"
  | "isChangingPassword"
  | "changePassword"
  | "setRevokeOtherSessions"
>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {passwordError ? (
          <Alert variant="destructive">
            <AlertDescription>{passwordError}</AlertDescription>
          </Alert>
        ) : null}

        {passwordSaved ? (
          <Alert>
            <AlertDescription>Password updated.</AlertDescription>
          </Alert>
        ) : null}

        <form className="grid gap-4" onSubmit={changePassword}>
          <Field label="Current password">
            <Input
              autoComplete="current-password"
              name="currentPassword"
              required
              type="password"
            />
          </Field>

          <Field hint="Minimum 8 characters." label="New password">
            <Input autoComplete="new-password" name="newPassword" required type="password" />
          </Field>

          <Field label="Confirm new password">
            <Input autoComplete="new-password" name="confirmPassword" required type="password" />
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Revoke other sessions</p>
              <p className="text-xs text-muted-foreground">
                Sign out other devices after the password change.
              </p>
            </div>
            <Switch
              aria-label="Revoke other sessions"
              checked={revokeOtherSessions}
              onCheckedChange={setRevokeOtherSessions}
            />
          </div>

          <div>
            <Button disabled={isChangingPassword} type="submit">
              <LockKeyhole className="size-4" />
              {isChangingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export { AccountPasswordCard };
