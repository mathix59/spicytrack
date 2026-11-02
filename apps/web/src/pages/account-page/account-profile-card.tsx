import { useState } from "react";
import { MailWarning, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserDto } from "@/generated/api";
import { authClient } from "@/lib/auth-client";
import { formatLocalDate, getErrorMessage } from "@/lib/utils";

import { AccountSection } from "./account-section";

function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function EmailVerificationNotice({ email }: { email: string }) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setIsSending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/verify-email`,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to send verification email");
      }
      setSent(true);
      toast.success("Verification email sent", { description: `Check the inbox for ${email}.` });
    } catch (error) {
      toast.error("Could not send the verification email", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MailWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-medium">Email not verified</p>
          <p className="text-xs text-muted-foreground">
            {sent
              ? "We've sent a new verification email. Follow the link it contains."
              : "Verify your email to secure your account and receive notifications."}
          </p>
        </div>
      </div>
      <Button
        disabled={isSending}
        onClick={() => void resend()}
        size="sm"
        type="button"
        variant="secondary"
      >
        {isSending ? "Sending…" : "Resend email"}
      </Button>
    </div>
  );
}

function AccountProfileCard({ user }: { user: UserDto | undefined }) {
  return (
    <AccountSection
      description="The identity attached to your issues, comments and audit events."
      icon={UserRound}
      title="Profile"
    >
      {!user ? (
        <div aria-busy="true" aria-label="Loading profile" className="grid gap-3" role="status">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-5 w-40" />
        </div>
      ) : (
        <>
          {user.emailVerifiedAt ? null : <EmailVerificationNotice email={user.email} />}
          <dl className="divide-y divide-border">
            <ProfileRow label="Name">
              {user.name || <span className="text-muted-foreground">Not set</span>}
            </ProfileRow>
            <ProfileRow label="Email">
              <span className="flex flex-wrap items-center gap-2">
                {user.email}
                {user.emailVerifiedAt ? (
                  <Badge variant="success">Verified</Badge>
                ) : (
                  <Badge variant="warning">Unverified</Badge>
                )}
              </span>
            </ProfileRow>
            {user.emailVerifiedAt ? (
              <ProfileRow label="Verified on">{formatLocalDate(user.emailVerifiedAt)}</ProfileRow>
            ) : null}
            <ProfileRow label="Two-factor authentication">
              {user.twoFactorEnabled ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <Badge variant="muted">Disabled</Badge>
              )}
            </ProfileRow>
          </dl>
        </>
      )}
    </AccountSection>
  );
}

export { AccountProfileCard };
