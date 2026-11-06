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

## Beta releases

Betas are cut from a long-lived `beta` branch, so `main` keeps producing stable releases:

```text
develop ──> beta (1.2.0-beta.0, 1.2.0-beta.1, ...) ──> main (1.2.0)
```

### Open a beta cycle

From an up-to-date `develop`, with the changesets of the coming release committed:

```bash
git switch -c beta origin/develop
pnpm changeset:pre:enter:beta
git add .changeset/pre.json
git commit -m "chore(release): enter beta prerelease mode"
git push -u origin beta
```

`.changeset/pre.json` only ever lives on `beta`: the stable release workflow refuses to run on
`main` while it is present.

### Cut a beta

Merge `develop` (or push changes, each with its changeset) into `beta`. CI runs on every push to
`beta` with the full browser and SDK matrices. When it is green and the push brings changesets
that no beta has shipped yet, its last job, `beta-release`, cuts the next beta:

- versions `api` and `web` to the next `1.2.0-beta.N` and commits the changelog to `beta`;
- tags `v1.2.0-beta.N` and publishes it as a GitHub pre-release;
- publishes the images as `1.2.0-beta.N`, `v1.2.0-beta.N` and `beta`.

A push without a new changeset, or after `changeset pre exit`, cuts nothing. Pull the version
commit before pushing to `beta` again.

The root package, Helm chart and OpenAPI versions are only aligned for stable releases.

### Test a beta

A beta image never replaces `latest`, `1` or `1.2`, so installations that follow those tags keep
the stable release. On a test instance, pin the beta in the compose `.env`:

```bash
VERSION=1.2.0-beta.0   # or VERSION=beta to follow the newest beta
```

With Helm, deploy the beta by digest like any release:

```bash
docker buildx imagetools inspect ghcr.io/mathix59/spicytrack-api-web:1.2.0-beta.0
```

Upgrade from a copy of production data, back up first, and time the migrations: they are what
the release notes' maintenance window is based on. Then run the smoke test against the instance:

```bash
SPICYTRACK_API_URL=https://<instance>/api SPICYTRACK_DSN=<project DSN> \
  node scripts/preproduction-smoke.mjs
```

The public proxy does not serve `/api/metrics`. To check metrics too, set
`SPICYTRACK_METRICS_URL` to an address that reaches the API directly, such as
`http://<api-web host>:3000/api/metrics` from inside the cluster or Compose network, and
`SPICYTRACK_METRICS_TOKEN` to the instance's `METRICS_TOKEN` when it has one.

### Release the stable version

```bash
git switch beta
pnpm changeset:pre:exit
git commit -am "chore(release): exit beta prerelease mode"
git push
```

Then open a pull request from `beta` to `main`. After it merges, the normal flow above creates the
release PR for `1.2.0` with the changelog of the whole beta cycle. Bring `main` back into `develop`
afterwards.

Alpha or rc cycles work the same way with `pnpm changeset:pre:enter:alpha` or
`pnpm changeset:pre:enter:rc`; their images are published under the `alpha` or `rc` channel tag.

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
- Docker `latest`, major and minor tags are only published for stable versions like `v1.2.3`;
  prereleases get their exact version and their channel (`alpha`, `beta` or `rc`).
