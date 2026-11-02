import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { resolveApiBaseUrl } from "./api-base-url";

const apiBaseUrl = resolveApiBaseUrl();

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl}/better-auth`,
  plugins: [
    twoFactorClient({
      twoFactorPage: "/two-factor",
    }),
  ],
});
