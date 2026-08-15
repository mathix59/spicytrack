<div align="center">

# SpicyTrack

Production-ready, source-available error tracking with a Sentry-compatible ingestion API.

![Monorepo](https://img.shields.io/badge/monorepo-pnpm-1f6feb?style=for-the-badge)
![Backend](https://img.shields.io/badge/backend-NestJS-ea2845?style=for-the-badge)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-6366f1?style=for-the-badge)
![Database](https://img.shields.io/badge/database-PostgreSQL-0f766e?style=for-the-badge)
![Linting](https://img.shields.io/badge/linting-oxlint-4f46e5?style=for-the-badge)

</div>

## About

SpicyTrack is a production-ready, self-hosted error tracking platform built around a pragmatic goal:
accept events from existing Sentry SDKs, group them into useful issues, and give teams a clean product workflow around triage, releases, alerts, and audit trails.

SpicyTrack is source-available under the Functional Source License 1.1. Each released version
converts to the Apache License 2.0 two years after its release date.

> **Coming shortly:** The SpicyTrack website and hosted documentation will be available within
> 24 hours.

## Production Status

> **Stable release.** SpicyTrack 1.0 is ready for self-hosted production deployments.

Production-oriented Docker Compose, PaaS, and Kubernetes deployment paths are included alongside
health checks, database migrations, persistent object storage, backup tooling, and end-to-end
deployment coverage. Operators remain responsible for capacity planning, external service
availability, backups, monitoring, and validating upgrades in their own environment.

It is designed for teams that want:

- Sentry-style ingestion compatibility
- a lightweight self-hosted stack
- clear multi-tenant organization and project management
- a modern TypeScript codebase that is easy to extend

## What It Includes

- Sentry-compatible ingestion endpoints
- issue and event tracking
- organizations, teams, and projects
- instance administration for registrations, SMTP, and super admins
- organization-wide and team-scoped custom roles
- releases and artifacts
- alert rules and delivery tracking
- daily error digests and top-regression visibility
- Generic OAuth/OIDC SSO with invitation-gated provisioning and optional domain auto-join
- active-session management and detailed readiness checks
- audit logs for sensitive actions
- React frontend for day-to-day product workflows

## Stack

### Backend

- NestJS
- TypeScript
- Drizzle
- PostgreSQL

### Frontend

- React
- Vite
- TypeScript
- TanStack Query
- Tailwind CSS

### Tooling

- `pnpm`
- `oxlint`
- `oxfmt`

## Quick Start

Create the local environment file and install dependencies:

```bash
cp .env.example .env
pnpm install
```

Start PostgreSQL and object storage, apply migrations, then run the monorepo:

```bash
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d postgres rustfs
pnpm db:migrate
pnpm dev
```

The web app is available at `http://localhost:5173`, the API at
`http://localhost:3000`, and the interactive API documentation at
`http://localhost:3000/docs`.

Useful commands:

```bash
pnpm lint
pnpm format:check
pnpm build
pnpm test
pnpm api:sync-client
```

Run the complete isolated end-to-end suite (Docker Compose, Chromium, and API tests):

```bash
pnpm test:e2e
```

This command creates and removes its own containers and volumes.

### Browser SDK origins

Browser ingestion CORS is configured per project under **Project settings → Allowed browser
origins**. Enter one exact HTTP(S) origin per line for production, staging, or local frontends.
An empty list allows every browser origin for backward compatibility. This setting applies only to
the public `store` and `envelope` ingestion endpoints, never to the authenticated product API, and
does not enable cookies or replace project-key and quota controls.

When the backend OpenAPI contract changes, regenerate the frontend client with:

```bash
pnpm api:sync-client
```

When `pnpm --filter` is not reliable on the current machine, use the repo-local validation shortcuts:

```bash
pnpm lint:local
pnpm format:check:local
pnpm typecheck
pnpm build:local
pnpm test:api:local
pnpm test:api:e2e:local
```

`test:api:e2e` expects the local infra stack to be available on the repository defaults:

- PostgreSQL on `localhost:5433`
- RustFS on `localhost:9002`
- Mailpit on `localhost:8025`

Start the development-only host bindings with:

```bash
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d postgres rustfs mailpit
```

## Local Docker

Use `pnpm docker:dev` to start the development stack and `pnpm docker:dev:down` to stop it.

## Server Install

A production-oriented compose stack is available in [docker-compose.release.yml](docker-compose.release.yml).
It does not bundle Mailpit; configure the SMTP provider after sign-in from **Instance administration**.

On a fresh installation, the first account created becomes the instance super-admin and public
registration is then disabled automatically. Keep the instance access-restricted until this first
account has been created.

For a deployment on Coolify, Dokploy, or another Compose-capable open-source PaaS, use
[docker-compose.paas.yml](docker-compose.paas.yml) with [.env.paas.example](.env.paas.example).

## Kubernetes

The Helm chart in [charts/spicytrack](charts/spicytrack) supports application-only, hybrid, and
self-contained installations. PostgreSQL and RustFS can be enabled independently, while the
application-only mode accepts credentials for any external S3-compatible service;
SMTP is configured directly from **Instance administration**. API, ingestion, worker, and web
components remain independently scalable.

Run the real K3s deployment and upgrade test with:

```bash
pnpm test:e2e:k3s
```

See the [Helm chart README](charts/spicytrack/README.md) for deployment modes, Secrets,
persistence, migrations, upgrades, and health checks.

An install script is available at [scripts/install.sh](scripts/install.sh). It is designed to be pipeable in the same style as tools like Coolify:

```bash
curl -fsSL https://spicytrack.io/install.sh | sudo bash
```

The installer starts a direct HTTP deployment by default; it does not configure DNS or TLS.
Internet-facing installations should terminate HTTPS at a reverse proxy or load balancer and set
the public `APP_SCHEME`, `APP_HOSTNAME`, and `APP_PORT` values accordingly.

Useful install-time environment variables:

- `APP_HOSTNAME`
- `APP_SCHEME`
- `APP_PORT`
- `INSTALL_DIR`
- `IMAGE_REPOSITORY_PREFIX`
- `VERSION`
- `INSTALL_BASE_URL`

## Documentation

- [Releasing](RELEASING.md)
- [API development](apps/api/README.md)
- [Web development](apps/web/README.md)
- [Kubernetes and Helm deployment](charts/spicytrack/README.md)

## Contributing

Contributors and coding agents should follow the conventions in [AGENTS.md](AGENTS.md).

## License

SpicyTrack is licensed under the [Functional Source License 1.1 with an Apache 2.0 future license](LICENSE).

You may self-host and use SpicyTrack internally, including within a company. You may not use it to offer a competing commercial hosted service. Each released version converts to Apache-2.0 two years after its release.

The SpicyTrack name and logo are not granted by this license. See [TRADEMARKS.md](TRADEMARKS.md). For commercial licensing, contact the copyright holder.
