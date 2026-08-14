# AGENTS.md

Instructions for AI coding agents working in this repository.

## Scope

These instructions apply to the whole monorepo.

## Repository Summary

- Monorepo managed with `pnpm`
- Frontend: `apps/web`
- Backend: `apps/api`
- Linting: `oxlint`
- Formatting: `oxfmt`

## Core Expectations

- Keep changes tightly scoped to the user request
- Prefer extraction over broad redesign
- Preserve public API contracts unless the task explicitly requires contract changes
- Follow existing folder and naming patterns before inventing new ones
- Update documentation when introducing a new repeated pattern

## Backend Rules

- Keep controllers thin
- Move repeated parsing into `*-controller.utils.ts`
- Move coherent orchestration into focused `*.service.ts` files
- Use `*.utils.ts` for pure helpers
- Use `*.types.ts` when inline shapes repeat
- Prefer explicit Nest exceptions over generic errors

## Frontend Rules

- Keep route pages thin
- Extract sections, hooks, and helpers before page files become oversized
- Prefer feature-local organization over global abstractions
- Reuse shared form/dialog composition helpers when patterns repeat

## Validation

Run the smallest relevant validation set for the files you changed.

Typical commands:

- repo:
  - `pnpm lint`
  - `pnpm format:check`
  - `node scripts/sync-api-client.mjs` when API contracts change
  - `node scripts/run-checks.mjs lint:fast`
  - `node scripts/run-checks.mjs format:check`
  - `node scripts/run-checks.mjs typecheck`
  - `node scripts/run-checks.mjs build`
  - `node scripts/run-checks.mjs test:api`
  - `node scripts/run-checks.mjs test:api:e2e` when local infra is up
- API:
  - `pnpm --filter api lint`
  - `pnpm --filter api format:check`
  - `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- Web:
  - `pnpm --filter web lint`
  - `pnpm --filter web format:check`
  - `pnpm --filter web exec tsc -b`
  - `pnpm --filter web build`

## Tooling Constraints

- Do not add `eslint` or `prettier`
- Use `oxlint` and `oxfmt`
- Do not perform broad formatting-only rewrites unless explicitly requested

## Refactor Priority

When cleaning up a large file, prefer this order:

1. extract parsing helpers
2. extract pure utils
3. extract dedicated services
4. extract local types

## Commit / PR Hygiene

- Keep diffs readable
- Separate mechanical formatting from behavior changes when possible
- Mention which validations were run
