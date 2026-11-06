## 1.2.0

### Minor Changes

- e16e960: Redesign the web app with light and dark themes, a command palette, a reworked issue inbox and issue detail (stack traces with original source context, library frames, an event pager), event trends and charts, project tabs, organization settings, and an SDK onboarding wizard that waits for the first event and can send test events.
  
  Triage issues faster: structured issue search, tag breakdowns and affected users, resolve in the next release, a merge picker, keyboard navigation and bulk selection. Grouping v2 keeps issues stable across deploys and variable messages; existing issues are adopted on their next event.
  
  Connect the tools around the errors: alerts delivered through retried jobs with rich Slack and Discord messages, PagerDuty and signed webhooks; an interactive Slack app to resolve, ignore and assign; GitHub, Linear and Jira tickets created from issues; release commits and suspect commits; sessions and release health; an MCP server; and Autofix, which runs a root-cause analysis and can open a CI-gated pull request within an AI budget.
  
  Administer the instance safely: an organization audit log (and per-project and instance logs) with filters and export, scoped personal access tokens with an organization restriction and an expiry, organization renaming, a QR code in the two-factor setup, roles with descriptions and member counts, and an SMTP test email from the instance settings.
  
  Scale ingestion on Postgres alone: events partitioned by week so retention drops whole weeks, batched issue counters, coalesced alert jobs, hourly quotas counted in memory, quota responses that tell SDKs when to retry, structured JSON logs, and worker health probes and metrics.
- e16e960: Upgrade notes:
  
  - Back up the database first. The migrations attach the events table to a weekly partitioned table in one transaction (about 8 seconds per million events, measured locally), and ingestion waits during that time; plan a maintenance window on large instances. With Helm, the migration hook timeout must cover it (see the chart README).
  - In production, every service now refuses to start without a valid configuration: `SECRETS_ENCRYPTION_KEY` (32 bytes) and `BETTER_AUTH_SECRET` are required, and invalid URLs, numbers or `AI_PRICING_JSON` are reported at startup.
  - Behind Coolify or Dokploy, the PaaS compose file trusts two proxy hops (`TRUST_PROXY=2`) so audit logs record the client address; the Helm chart sets it from the ingress setting.
  - Existing personal access tokens keep their full access; new tokens choose a scope and expire after 90 days by default.
  - Hourly ingestion quotas are approximate when several ingest replicas run: a window can overshoot by about one second of traffic per replica. Per-key limits stay exact.

### Patch Changes

- e334fd9: Upgrade dependencies to their latest releases, including NestJS 12 and better-auth 1.7. SSO sign-in now uses the standard social sign-in flow; the historical `/oauth2/callback/:id` redirect URI keeps working, and OIDC providers must expose a JWKS so ID tokens can be verified.

## 1.2.0-beta.1

No changes in this release.

## 1.2.0-beta.0

### Minor Changes

- e16e960: Redesign the web app with light and dark themes, a command palette, a reworked issue inbox and issue detail (stack traces with original source context, library frames, an event pager), event trends and charts, project tabs, organization settings, and an SDK onboarding wizard that waits for the first event and can send test events.
  
  Triage issues faster: structured issue search, tag breakdowns and affected users, resolve in the next release, a merge picker, keyboard navigation and bulk selection. Grouping v2 keeps issues stable across deploys and variable messages; existing issues are adopted on their next event.
  
  Connect the tools around the errors: alerts delivered through retried jobs with rich Slack and Discord messages, PagerDuty and signed webhooks; an interactive Slack app to resolve, ignore and assign; GitHub, Linear and Jira tickets created from issues; release commits and suspect commits; sessions and release health; an MCP server; and Autofix, which runs a root-cause analysis and can open a CI-gated pull request within an AI budget.
  
  Administer the instance safely: an organization audit log (and per-project and instance logs) with filters and export, scoped personal access tokens with an organization restriction and an expiry, organization renaming, a QR code in the two-factor setup, roles with descriptions and member counts, and an SMTP test email from the instance settings.
  
  Scale ingestion on Postgres alone: events partitioned by week so retention drops whole weeks, batched issue counters, coalesced alert jobs, hourly quotas counted in memory, quota responses that tell SDKs when to retry, structured JSON logs, and worker health probes and metrics.
- e16e960: Upgrade notes:
  
  - Back up the database first. The migrations attach the events table to a weekly partitioned table in one transaction (about 8 seconds per million events, measured locally), and ingestion waits during that time; plan a maintenance window on large instances. With Helm, the migration hook timeout must cover it (see the chart README).
  - In production, every service now refuses to start without a valid configuration: `SECRETS_ENCRYPTION_KEY` (32 bytes) and `BETTER_AUTH_SECRET` are required, and invalid URLs, numbers or `AI_PRICING_JSON` are reported at startup.
  - Behind Coolify or Dokploy, the PaaS compose file trusts two proxy hops (`TRUST_PROXY=2`) so audit logs record the client address; the Helm chart sets it from the ingress setting.
  - Existing personal access tokens keep their full access; new tokens choose a scope and expire after 90 days by default.
  - Hourly ingestion quotas are approximate when several ingest replicas run: a window can overshoot by about one second of traffic per replica. Per-key limits stay exact.

### Patch Changes

- e334fd9: Upgrade dependencies to their latest releases, including NestJS 12 and better-auth 1.7. SSO sign-in now uses the standard social sign-in flow; the historical `/oauth2/callback/:id` redirect URI keeps working, and OIDC providers must expose a JWKS so ID tokens can be verified.

## 1.1.8

### Patch Changes

- Fix issue pagination and prevent long issue titles from overflowing the page. Show original source context and columns from source maps, distinguish library frames, and surface failed outgoing requests with their URLs, status codes, repetition counts, and timing above the stack trace.

  Refresh invitation, password reset, and email verification messages with English SpicyTrack templates, the brand icon, clear action buttons, and plain-text fallbacks. Apply the shared email layout to alert notifications.

## 1.1.7

### Patch Changes

- e5dbb06: Remove automatic SMTP health probes and provide an administrator-only Test connection button that verifies unsaved SMTP settings without sending email.

## 1.1.6

### Patch Changes

- 1a691fd: Recover interrupted invitation signup by authenticating existing accounts before accepting the pending invitation. Preserve registration mode when returning from older invitation login redirects and allow retrying acceptance.

  Keep SMTP verification off the API readiness path, cache bounded background probes, and use successful delivery as health evidence. SMTP diagnostic failures no longer make the API unavailable; TLS verification remains enabled.

## 1.1.5

### Patch Changes

- 1e42067: Fix SMTP settings persistence and connection security, allow owners to delete organizations, and let invited users set a password when public registration is closed. Fix the form reset error after creating a personal access token and show only open issues by default.

  Audit the test suites, remove redundant checks, enforce an independent authorization policy, validate invitation signup against PostgreSQL, and include build-package tests in CI.

## 1.1.4

### Patch Changes

- 280b5d9: Restore the bottom spacing around the update notification in the application sidebar.

## 1.1.3

### Patch Changes

- aa72fd1: Keep local browser requests same-origin through the Vite development proxy and accept explicit
  loopback host aliases for API CORS and authentication in non-production environments.

## 1.1.2

## 1.1.1

## 1.1.0

## 1.0.11

## 1.0.10

## 1.0.9

### Patch Changes

- 52e7188: fix: stabilize web and api release process and UI polish

## 1.0.8

### Patch Changes

- 9beb75a: Fix formatting in GitHub App installation URL construction to satisfy CI `oxfmt --check`.

  ***

  EOF && git add .changeset/fresh-wolves-mix.md && git commit -m "chore: add patch changeset for format fix"

## 1.0.7

### Patch Changes

- aae6209: Fix GitHub repository connection testing in the app for GitHub App mode without requiring a saved connection first.

## 1.0.6

### Patch Changes

- d921ea8: Allow testing GitHub App repository connections without requiring a saved token.
- 5159d8d: Fix GitHub App connection test flow when no repository connection is stored.

# web

## 1.0.5

## 1.0.4

## 1.0.3

### Patch Changes

- 36586b2: Allow the GitHub App manifest form to be submitted to GitHub from production deployments, and wait for the API service DNS records before starting the Kubernetes web pod.
- 61a0e0f: Keep long release identifiers inside release list and detail cards across desktop and mobile layouts.
- b4239eb: Allow alert rules to combine multiple triggers and send an on-demand test delivery from the alerting screen.

## 1.0.2

### Patch Changes

- 8ef480a: Add per-project browser origin allowlists for Sentry-compatible ingestion without broadening authenticated API CORS.

## 1.0.1

### Patch Changes

- 36b8e19: Link identities from the configured OIDC provider to existing verified accounts with the same
  email address. The behavior is enabled by default and can be disabled with
  `OIDC_ACCOUNT_LINKING_ENABLED=false`.

## 1.0.0

### Major Changes

- Publish SpicyTrack 1.0 with the production-ready deployment stack, hardened
  authentication and authorization, flexible Helm dependencies, PostgreSQL read-replica support,
  RustFS object storage, multi-architecture images, and expanded end-to-end coverage.

## 1.0.0-beta.0

### Major Changes

- Publish the first SpicyTrack 1.0 beta with the production-ready deployment stack, hardened
  authentication and authorization, flexible Helm dependencies, PostgreSQL read-replica support,
  RustFS object storage, multi-architecture images, and expanded end-to-end coverage.
