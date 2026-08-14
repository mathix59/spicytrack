import { MailWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UserDto } from "@/generated/api";

function AccountVerificationCard({
  user,
  verificationSent,
  isSendingVerification,
  requestVerification,
}: {
  user: UserDto | undefined;
  verificationSent: boolean;
  isSendingVerification: boolean;
  requestVerification: () => Promise<void>;
}) {
  if (!user || user.emailVerifiedAt) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <MailWarning className="size-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium">Email not verified</p>
            <p className="text-xs text-muted-foreground">
              {verificationSent
                ? "We've sent a new verification email."
                : "Verify your email to secure your account."}
            </p>
          </div>
        </div>
        <Button
          disabled={isSendingVerification}
          onClick={() => void requestVerification()}
          size="sm"
          type="button"
          variant="secondary"
        >
          Resend email
        </Button>
      </CardContent>
    </Card>
  );
}

export { AccountVerificationCard };
