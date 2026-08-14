# Releasing SpicyTrack

This repository uses Changesets for the API and web version bumps and changelog generation.

Both applications are versioned together in one fixed release group:

- `api`
- `web`

## Normal flow

1. Add your code changes.
2. Create a changeset:

```bash
pnpm changeset
```

3. Choose the release type:

- `patch`
- `minor`
- `major`

4. Commit the generated `.changeset/*.md` file with your PR.
5. After merge to `main`, the `Version Packages` GitHub Action creates or updates a release PR.
6. Merge the release PR.
7. Before tagging, align the root package version, `charts/spicytrack/Chart.yaml` (`version` and
   `appVersion`), and the OpenAPI version with the released application version. Regenerate the
   frontend client with `pnpm api:sync-client` if the OpenAPI document changed.
8. Create the git tag from the versioned commit:

```bash
pnpm release:tag
git push origin <tag>
```

Or directly:

```bash
pnpm release:tag:push
```

That tag triggers Docker image publication to GHCR. Every application image is published as an OCI
multi-architecture index containing both `linux/amd64` and `linux/arm64`. CI also builds every
component for both platforms, and the publication workflow rejects a pushed index when either
architecture is missing.

Published images include a BuildKit SBOM, maximum-level provenance, and a keyless Sigstore
signature bound to the GitHub Actions identity. Verify a release image with:

```bash
cosign verify \
  --certificate-identity-regexp '^https://github.com/mathix59/spicytrack/.github/workflows/docker-publish.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/mathix59/spicytrack-web@sha256:<digest>
```

Always verify or deploy by digest when the deployment requires a cryptographic identity guarantee.
The signed digest is the multi-architecture index digest, so Kubernetes selects the matching child
manifest for AMD64 or ARM64 nodes while preserving one release identity.

Inspect the platforms of a published release with:

```bash
docker buildx imagetools inspect ghcr.io/mathix59/spicytrack-api-web:<version>
docker buildx imagetools inspect ghcr.io/mathix59/spicytrack-api-ingest:<version>
docker buildx imagetools inspect ghcr.io/mathix59/spicytrack-api-worker-admin:<version>
docker buildx imagetools inspect ghcr.io/mathix59/spicytrack-web:<version>
```

## Pre-releases

Changesets pre-release mode is repository-wide. Enter or exit it in a dedicated PR.

### Enter alpha

```bash
pnpm changeset:pre:enter:alpha
```

### Enter beta

```bash
pnpm changeset:pre:enter:beta
```

### Enter rc

```bash
pnpm changeset:pre:enter:rc
```

This creates `.changeset/pre.json`. Commit it and merge it to `main`.

From that point, release PRs will produce versions like:

- `1.2.0-alpha.0`
- `1.2.0-beta.0`
- `1.2.0-rc.0`

When ready to go back to stable releases:

```bash
pnpm changeset:pre:exit
```

Commit the updated `.changeset/pre.json` state and merge it.

## Useful commands

```bash
pnpm changeset
pnpm changeset:status
pnpm changeset:version
pnpm changeset:pre:enter:alpha
pnpm changeset:pre:enter:beta
pnpm changeset:pre:enter:rc
pnpm changeset:pre:exit
pnpm release:tag
pnpm release:tag:push
```

## Notes

- Changelogs are generated automatically by Changesets in each versioned package.
- Changesets versions `api` and `web`; the root package, Helm chart, and OpenAPI metadata must be
  kept aligned as part of the release commit.
- The release PR is the place where you review the exact version bump and changelog output before tagging.
- Docker `latest` is only published for stable tags like `v1.2.3`, not for `-alpha`, `-beta`, or `-rc`.
