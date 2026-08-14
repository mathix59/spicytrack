import { useEffect, useState } from "react";
import { UserCog } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orvalFetch } from "@/lib/orval-fetch";

import { AccountPasswordCard } from "./account-page/account-password-card";
import { AccountSessionsCard } from "./account-page/account-sessions-card";
import { AccountTokenCard } from "./account-page/account-token-card";
import { AccountTwoFactorCard } from "./account-page/account-two-factor-card";
import { AccountVerificationCard } from "./account-page/account-verification-card";
import { useAccountPage } from "./account-page/use-account-page";

function AccountPage() {
  const page = useAccountPage();
  const [passwordEnabled, setPasswordEnabled] = useState(true);

  useEffect(() => {
    void orvalFetch<{ data: { passwordEnabled: boolean } }>("/auth/registration-status", {
      method: "GET",
    }).then((result) => setPasswordEnabled(result.data.passwordEnabled));
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Account"
        icon={UserCog}
        title="Account settings"
        description="Email verification and personal access tokens for the API."
      />

      <Tabs className="grid gap-4" defaultValue="security">
        <TabsList className="w-fit">
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-0 grid gap-6" value="security">
          <AccountVerificationCard
            isSendingVerification={page.isSendingVerification}
            requestVerification={page.requestVerification}
            user={page.user}
            verificationSent={page.verificationSent}
          />

          {passwordEnabled ? (
            <AccountPasswordCard
              changePassword={page.changePassword}
              isChangingPassword={page.isChangingPassword}
              passwordError={page.passwordError}
              passwordSaved={page.passwordSaved}
              revokeOtherSessions={page.revokeOtherSessions}
              setRevokeOtherSessions={page.setRevokeOtherSessions}
            />
          ) : null}

          {passwordEnabled ? <AccountTwoFactorCard user={page.user} /> : null}

          <AccountSessionsCard />
        </TabsContent>

        <TabsContent className="mt-0" value="api">
          <AccountTokenCard
            createToken={page.createToken}
            createdSecret={page.createdSecret}
            isCreatingToken={page.isCreatingToken}
            isRevokingToken={page.isRevokingToken}
            revokeToken={page.revokeToken}
            tokenError={page.tokenError}
            tokens={page.tokens}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { AccountPage };
