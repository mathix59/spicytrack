---
"api": patch
"web": patch
---

Upgrade dependencies to their latest releases, including NestJS 12 and better-auth 1.7. SSO sign-in now uses the standard social sign-in flow; the historical `/oauth2/callback/:id` redirect URI keeps working, and OIDC providers must expose a JWKS so ID tokens can be verified.
