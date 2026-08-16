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
