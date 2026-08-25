## 1.1.4

## 1.1.3

### Patch Changes

- aa72fd1: Keep local browser requests same-origin through the Vite development proxy and accept explicit
  loopback host aliases for API CORS and authentication in non-production environments.

## 1.1.2

### Patch Changes

- b3b0cd9: Update GPT-5.6 Sol, Terra, and Luna token pricing while preserving historical rates, and keep
  Claude Sonnet 5 at its permanent introductory price. Synchronize the official pricing catalog
  daily by default so future price changes do not require rebuilding the application.

  Show instance administrators an informational notice when a newer SpicyTrack release is available,
  with links to release notes and upgrade guidance but no automatic update action.

## 1.1.1

### Patch Changes

- 25d7635: fix(release): publish release images after Changesets creates a version tag

## 1.1.0

### Minor Changes

- d2230f2: feat(api): add automatic frontend source map uploads and symbolication support for popular frameworks

## 1.0.11

### Patch Changes

- 84a60a3: feat(api): enhance autofix flow with analysis capability warnings and refactor workflows for improved clarity

## 1.0.10

### Patch Changes

- 0d069a4: api: improve autofix reliability when MCP is unavailable by supporting optional auto-install of codebase-memory-mcp.

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

# api

## 1.0.5

### Patch Changes

- 38ff41f: Remove unsupported installation events from generated GitHub App manifests.

## 1.0.4

### Patch Changes

- ec11242: Install production dependencies on each target architecture so ARM64 images never contain AMD64 native modules.

## 1.0.3

### Patch Changes

- 36586b2: Build API assets on the native builder architecture to prevent QEMU crashes during arm64 image builds.
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
