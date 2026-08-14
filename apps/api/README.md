# SpicyTrack API

This application is the SpicyTrack backend.

It serves:

- the product API used by the web app
- the Sentry-compatible ingestion API
- authentication and RBAC flows
- issue, event, release, alert, and audit workflows

## Stack

- NestJS
- TypeScript
- Drizzle
- PostgreSQL

## Development

From the repository root:

```bash
pnpm --filter api dev
```

Useful commands:

```bash
pnpm --filter api lint
pnpm --filter api format:check
pnpm --filter api exec tsc -p tsconfig.json --noEmit
pnpm --filter api openapi:generate
```

If you change controllers or OpenAPI DTOs, regenerate the frontend client from the repository root with:

```bash
node scripts/sync-api-client.mjs
```

If `pnpm --filter api ...` is unstable locally, equivalent repo-root checks exist:

```bash
node scripts/run-checks.mjs lint:fast
node scripts/run-checks.mjs format:check
node scripts/run-checks.mjs typecheck
node scripts/run-checks.mjs build
node scripts/run-checks.mjs test:api
node scripts/run-checks.mjs test:api:e2e
```

`test:api:e2e` expects the development infrastructure defaults:

- PostgreSQL on `localhost:5433`
- RustFS on `localhost:9002`
- Mailpit on `localhost:8025`

Start those host bindings from the repository root with:

```bash
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d postgres rustfs mailpit
```

Database utilities:

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:studio
pnpm --filter api seed
```

## Conventions

See [AGENTS.md](../../AGENTS.md).

## Notes

- controllers should stay thin
- repeated HTTP parsing should move to `*-controller.utils.ts`
- orchestration-heavy logic should move into focused services
