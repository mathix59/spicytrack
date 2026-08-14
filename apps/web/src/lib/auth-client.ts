import { createAuthClient } from "better-auth/react";
import { genericOAuthClient, twoFactorClient } from "better-auth/client/plugins";
import { resolveApiBaseUrl } from "./api-base-url";

const apiBaseUrl = resolveApiBaseUrl();

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl}/better-auth`,
  plugins: [
    genericOAuthClient(),
    twoFactorClient({
      twoFactorPage: "/two-factor",
    }),
  ],
});
