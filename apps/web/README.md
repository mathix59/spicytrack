# SpicyTrack Web

This application is the SpicyTrack frontend.

It provides:

- organization and project navigation
- issue and event exploration
- releases, teams, and settings views
- authentication flows

## Stack

- React
- Vite
- TypeScript
- TanStack Query
- Tailwind CSS

## Development

From the repository root:

```bash
pnpm --filter web dev
```

Useful commands:

```bash
pnpm --filter web lint
pnpm --filter web format:check
pnpm --filter web exec tsc -b
pnpm --filter web build
pnpm --filter web generate:api
```

If the backend contract changed, regenerate `src/generated/api.ts` from the repository root with:

```bash
node scripts/sync-api-client.mjs
```

If `pnpm --filter web ...` is unstable locally, equivalent repo-root checks exist:

```bash
node scripts/run-checks.mjs lint:fast
node scripts/run-checks.mjs format:check
node scripts/run-checks.mjs typecheck
node scripts/run-checks.mjs build
```

## Conventions

See [AGENTS.md](../../AGENTS.md).

## Notes

- route pages should stay thin
- large pages should be split into sections, hooks, utils, and local types
- shared UI belongs in reusable components, not feature-specific abstractions
