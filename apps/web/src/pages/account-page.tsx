import { UserCog } from "lucide-react";

import { useAuthenticationOptions } from "@/components/auth/use-authentication-options";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetMe } from "@/generated/api";

import { AccountPasswordCard } from "./account-page/account-password-card";
import { AccountProfileCard } from "./account-page/account-profile-card";
import { AccountSessionsCard } from "./account-page/account-sessions-card";
import { AccountTokenCard } from "./account-page/account-token-card";
import { AccountTwoFactorCard } from "./account-page/account-two-factor-card";

function AccountPage() {
  const user = useGetMe().data?.data.user;
  const { options } = useAuthenticationOptions();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Account"
        icon={UserCog}
        title="Account settings"
        description="Manage your profile, how you sign in, and tokens for the API."
      />

      <Tabs className="grid gap-4" defaultValue="profile">
        <TabsList className="w-fit max-w-full overflow-x-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-0 grid gap-6" value="profile">
          <AccountProfileCard user={user} />
        </TabsContent>

        <TabsContent className="mt-0 grid gap-6" value="security">
          {options.passwordEnabled ? (
            <>
              <AccountPasswordCard />
              <AccountTwoFactorCard user={user} />
            </>
          ) : (
            <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              You sign in through single sign-on. Your password and two-factor settings are managed
              by your identity provider.
            </p>
          )}
          <AccountSessionsCard />
        </TabsContent>

        <TabsContent className="mt-0 grid gap-6" value="api">
          <AccountTokenCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { AccountPage };
