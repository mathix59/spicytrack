# Test audit — 2026-09-07

Scope: all 56 test files present at the start of this audit in the SpicyTrack monorepo, including the uncommitted regression tests from the preceding fixes. Also reviewed: Jest and Playwright discovery/configuration, the CI workflow, Docker E2E orchestration, K3s smoke checks, SDK fixtures, and Keycloak SQL assertions. Application fixes already in the working tree were preserved.

The review considered what each test actually executes, whether its expected result is independent of the implementation, overlap with other suites, failure paths, and test isolation. Mocking an external dependency does not by itself make a test unnecessary. An HTTP test and a unit test are retained together when they protect different boundaries.

## Changes

| File / check | Decision and reason |
| --- | --- |
| `apps/api/src/app.controller.spec.ts` | Deleted: three direct controller calls merely returned configured service mock responses. Real health aggregation remains in `app.service.spec.ts`; HTTP routing, readiness and metrics remain exercised by the integration/deployment suites. |
| `apps/api/src/ingest/error-flow.integration.spec.ts` | Deleted: its single test manually chained three pure helpers, without executing the production ingestion/alert orchestration. The same helper cases remain in `ingest-policies.spec.ts` and `alerts-execution.service.spec.ts`; deployed issue regression remains in Playwright. This deleted test never proved delivery of a regression alert. |
| `apps/api/src/rbac/permission.service.spec.ts` | Replaced expectations computed from production `ROLE_PERMISSIONS` with an independent, typed policy. All 6 × 32 combinations still exercise both permission lookup and assertion, grouped into six role tests. Unknown-role denial remains. Removed the duplicate-entry check: duplicate entries do not affect membership-based authorization. |
| `apps/api/src/rbac/permission.guard.spec.ts` | Replaced its second implementation-derived 192-case role matrix with ten explicit allow/deny boundary cases. Retained custom-role, missing-membership, system-role precedence, team capability, and denial tests. Removed the static team-read mapping assertion already covered by nine behavioral mapping cases. |
| `apps/api/src/rbac/permission-metadata.spec.ts` | Removed the fixed endpoint count. Representative public, organization and project routes prevent vacuous discovery results; route uniqueness and all security metadata checks remain. |
| `apps/api/test/endpoint-authentication.e2e-spec.ts` | Removed the fixed protected-route count. Representative actual registered routes prevent an empty discovery result; anonymous requests still run against every discovered session-protected route and must return 401. |
| `apps/api/src/auth/invitation-signup.spec.ts` | Removed SQL substring assertions. Kept hashing, email normalization, preservation of the request body, delegation and refusal behavior. Renamed the mocked rejection test to describe its actual scope. |
| `apps/api/test/auth-flow.e2e-spec.ts` | Added a replacement PostgreSQL scenario: wrong token, wrong email, expired/accepted/revoked invitations and missing roles are rejected; a valid mixed-case email can sign up with registration closed, verify email, sign in with the chosen password, and accept the invitation. Cleanup restores registration configuration. |
| `apps/api/test/organization-jobs.e2e-spec.ts` | Retained all scenarios; restricted cleanup of jobs and organizations to the two fixture organizations. Previously it deleted both whole tables. |
| `apps/api/test/mcp.e2e-spec.ts` | Retained all scenarios; restricted credential/project-link cleanup to this suite's credentials. Previously it deleted every credential/project link. |
| `packages/build/test/cli.test.js` | Retained subprocess tests. Replaced the hardcoded package version with the package's current version: the contract is that generated configuration installs this CLI version. Renamed the failure test to the exit-code behavior it actually asserts. |
| `.github/workflows/ci.yml` | Added the six build-package tests, which were absent from the explicit CI validation steps. API unit tests added during the preceding work remain enabled. |
| `e2e/web/critical-workflows.spec.ts` | Retained all workflows. Extended the existing resolve/regression scenario to check that a resolved issue disappears from the default list and remains accessible with `status=resolved`, including after refresh. |

## Mutation experiment

Temporarily granting `org.settings.manage` to `viewer` produced these results when running only the PermissionService suite:

- Original tests: passed, because expected permissions were derived from the changed production constant.
- Revised tests: failed on the viewer's administrative permission.
- Production constant and current test were restored in `finally`; the complete unit suite passed afterward.

This is one targeted experiment, not a repository-wide mutation score.

## Complete test-file inventory

Paths in the first table are relative to `apps/api/src/`.

| Unit test file | Decision / behavior protected |
| --- | --- |
| `ai-usage/ai-pricing-sync.service.spec.ts` | Keep: configuration, disabling and retry after remote-fetch failure. |
| `alerts/alerts-execution.service.spec.ts` | Keep: trigger combinations, cooldown and thresholds. |
| `alerts/daily-digest-job.handler.spec.ts` | Keep: daily UTC scheduling boundary. |
| `alerts/webhook-url-policy.spec.ts` | Keep: unsafe URLs, private addresses and DNS-based SSRF rejection. |
| `app.controller.spec.ts` | Delete: forwarding mocks; see above. |
| `app.service.spec.ts` | Keep: readiness aggregation, dependency failure, replica health and Prometheus output. |
| `artifacts/artifact-upload-limits.spec.ts` | Keep: configuration defaults, overrides and invalid limits. |
| `artifacts/sourcemap-resolver.service.spec.ts` | Keep: real source-map parsing, build-path normalization, ambiguous paths, missing artifacts, ProGuard and Dart resolution. |
| `auth/auth.guard.spec.ts` | Keep: PAT authentication, expiration, revocation and missing-user rejection. |
| `auth/invitation-signup.spec.ts` | Refine: request-boundary behavior; SQL semantics moved to PostgreSQL coverage. |
| `auth/oidc-config.spec.ts` | Keep: provider configuration, access/linking policies, invalid and insecure configuration. |
| `auth/web-origins.spec.ts` | Keep: development aliases versus exact production origins. |
| `autofix/autofix-worker.module.spec.ts` | Keep: actual handler registration on the slow lane and job dispatch. |
| `autofix/autofix.service.spec.ts` | Keep: safe defaults and branch prerequisite. |
| `autofix/mcp-client.spec.ts` | Keep: graceful behavior when the external MCP process cannot start. |
| `autofix/prompt.spec.ts` | Keep: issue/stack/tag inputs and required reporting instruction, including absent stack. |
| `bootstrap-http.spec.ts` | Keep: trusted URL construction, gzip decoding and expanded-body limits. |
| `common/event-payload-redaction.spec.ts` | Keep: sensitive fields removed while safe nested data survives. |
| `common/grouping.spec.ts` | Keep: alternative SDK exception shapes and stack fallback. |
| `common/secrets.spec.ts` | Keep: real encryption/decryption, randomized ciphertext, tamper detection and configuration validation. |
| `database/database.provider.spec.ts` | Keep: idle-error containment, factory wiring and primary/replica routing. Factory wiring is distinct from the helper's own behavior. |
| `email/smtp-options.spec.ts` | Keep: implicit TLS, explicit security override and authentication-free relay configuration. |
| `ingest/browser-ingest-cors.service.spec.ts` | Keep: request-scoped origin policy and bypass for unrelated routes. |
| `ingest/browser-ingest-origins.spec.ts` | Keep: origin normalization, deduplication and rejection. |
| `ingest/error-flow.integration.spec.ts` | Delete: manual helper chaining; see above. |
| `ingest/ingest-limits.spec.ts` | Keep: limit parsing, defaults and invalid configuration. |
| `ingest/ingest-policies.spec.ts` | Keep: filtering, fingerprinting, configured scrubbing, ownership and issue reopening. |
| `instance-admin/instance-admin.service.spec.ts` | Keep: administrative authorization, validation, secret omission and password preservation. Persistence dependency is mocked. |
| `instance-admin/update-check.service.spec.ts` | Keep: update manifest, cache, disabling and invalid responses. |
| `integrations/integrations.service.spec.ts` | Keep: credential reuse constraints on endpoint changes, GitHub App token acquisition and non-persistence of transient credentials. |
| `integrations/vcs/vcs-providers.spec.ts` | Keep: distinct GitHub/GitLab protocols, enterprise endpoints, auth headers, PR/MR payloads and provider failures. |
| `integrations/vcs/vcs-url-policy.spec.ts` | Keep: allowed hosts, enterprise configuration and credential-exfiltration prevention. |
| `jobs/jobs-runner.service.spec.ts` | Keep: asynchronous database claim failure is contained and logged. |
| `rbac/organization-context.guard.spec.ts` | Keep: required context, membership attachment and missing-tenant rejection. |
| `rbac/organization-role-policy.spec.ts` | Keep: role hierarchy, permission implications and escalation prevention. |
| `rbac/permission-metadata.spec.ts` | Refine: all endpoint policy assertions remain; fixed count removed. |
| `rbac/permission.guard.spec.ts` | Refine: behavioral guard coverage retained; duplicated/derived expectations reduced. |
| `rbac/permission.service.spec.ts` | Replace: independent complete typed authorization policy. |
| `rbac/project-context.guard.spec.ts` | Keep: project resolution in the correct organization and incomplete-context rejection. |

Paths below are relative to `apps/api/test/`.

| Integration test file | Decision / behavior protected |
| --- | --- |
| `app.e2e-spec.ts` | Keep: real Nest/Fastify application route binding and root response. |
| `artifacts-resilience.e2e-spec.ts` | Keep: real database metadata after storage upload/replacement failures. Storage is injected to force failure. |
| `auth-flow.e2e-spec.ts` | Extend: real authentication, Mailpit, password reset/session revocation, PAT lifecycle and invitation signup. |
| `endpoint-authentication.e2e-spec.ts` | Refine: anonymous requests on actual registered endpoints. |
| `github-app-settings.e2e-spec.ts` | Keep: persistence, secret masking, manifest state, installation/repository synchronization and tenant-bound webhook signatures. Management guards/provider HTTP are mocked; it is not an authorization matrix or live GitHub certification. |
| `ingest-security.e2e-spec.ts` | Keep: project/key binding, concurrent deduplication, atomic quotas, merge locking, payload limits and rate-counter retention. |
| `mcp.e2e-spec.ts` | Keep and fix cleanup: real protocol negotiation, credential/scope/project constraints, write confirmation, rotation, expiration and distributed quota. Administrative guards are mocked, MCP credential enforcement is real. |
| `oidc-flow.e2e-spec.ts` | Keep: local HTTP provider discovery/callback, auto-join and existing-account linking. Complements real Keycloak coverage with controlled provider responses. |
| `organization-deletion.e2e-spec.ts` | Keep: owner authorization and selective persisted deletion in an isolated migrated schema. |
| `organization-jobs.e2e-spec.ts` | Keep and fix cleanup: filtered results, successful requeue and invalid-state refusal. Guards are mocked. |
| `rbac.e2e-spec.ts` | Keep: real PAT/guard/database authorization, tenant and resource isolation, role escalation, concurrent ownership changes, invitation acceptance and audit lifecycle. |

| Other test file | Decision / behavior protected |
| --- | --- |
| `packages/build/test/cli.test.js` | Refine: generated configuration and subprocess failure propagation. |
| `packages/build/test/detect.test.js` | Keep: framework precedence and supported dependency layouts. |
| `packages/build/test/upload.test.js` | Keep: actual file selection plus release/upload HTTP contract. |
| `scripts/render-release-notes.test.mjs` | Keep: version extraction, deduplication, distinct package notes and CLI arguments. |
| `e2e/web/admin-regressions.spec.ts` | Keep: UI form submission/reset, hydration after refresh, invitation navigation and deletion confirmation. API routes are mocked; these tests alone do not prove server persistence or production SMTP delivery. |
| `e2e/web/critical-workflows.spec.ts` | Keep and extend: deployed workflows, actual browser/React SDKs, CLI artifact upload, source-map layouts, accessibility/responsiveness on three browser engines, Keycloak and deployed MCP. |

## Operational suites retained

- Docker's eight target/platform builds validate packaging and architecture-specific dependencies. They are not duplicates of TypeScript compilation.
- K3s installation and upgrade smoke tests validate Helm, migration/runtime readiness, replica configuration, ingress routing and CSP.
- Docker E2E load and dependency-recovery checks exercise running processes against real PostgreSQL and RustFS outages; unit mocks cannot substitute for these.
- Nine non-browser SDK fixture applications emit actual SDK events. The runner verifies stored events and applicable frame resolution. Browser/React SDK fixtures run through Playwright, giving eleven SDK identities in total.
- Keycloak SQL verifies account linkage, consumed invitation, membership role, SSO audit record and absence of the refused account. Those database effects are not all asserted by the browser UI.
- Release-note tests and build-package tests validate separate distributable/operational behavior.

## Limits and remaining improvement opportunities

- The API integration suites assume a disposable environment: some scenarios change global registration or super-admin state. Use the isolated Docker runner for the full suite.
- Some integration/browser suites are ordered workflows sharing setup and state. Isolated execution of an individual dependent test is not guaranteed. Splitting these workflows is a separate maintenance task, not grounds for deleting their assertions.
- Some integration tests intentionally replace management guards or remote providers. The unmocked RBAC, authentication and deployed suites remain necessary.
- The four admin UI regression tests use mocked APIs. Real PostgreSQL invitation coverage was added here; SMTP option and admin-service tests do not establish that a particular production mail server accepts a real TLS/authenticated connection.
- The frontend-layout matrix uses representative source maps, not full builds of all eight frontend frameworks. Real browser/React builds and the upload CLI are additionally exercised.
- Rust's fixture emits no stack; its matrix assertion covers ingestion, not Rust symbolication.
- Route metadata discovery assumes the repository's current decorator conventions. Removing exact counts does not turn the parser into a general proof that every possible route syntax is discovered.
- No test was skipped or disabled to obtain passing results. No broad coverage percentage or exhaustive mutation score is claimed.
- Graph discovery used project `spicytrack-autofix-e2e`, generation `2026-08-16T06:01:48Z`. It predates current edits. Coverage checks flagged changed/untracked files and partial SQL parsing; the audit used direct current-source reads for the complete test inventory and operational assertions. The graph alone was not treated as an exhaustive current index.

## Validation

All results below were observed locally. Counts refer to runner-reported cases, not the number of individual assertions. In particular, the revised six role cases still evaluate all 192 role/permission combinations.

| Suite | Before audit | After audit |
| --- | --- | --- |
| API unit | 586 tests, 39 suites | 212 tests, 37 suites — passed |
| API integration | 91 tests, 11 suites | 92 tests, 11 suites — passed |
| Playwright | 19 cases across Chromium/Firefox/WebKit | 19 passed |
| Build package | 6 tests, previously absent from CI steps | 6 passed; added to CI |
| Release notes | 4 tests | 4 passed |

Lint, formatting, types and builds were rerun locally. The full isolated Docker E2E run passed: browser scenarios, all nine non-browser SDK applications, Keycloak SQL, artifact upload limit, ingestion load and PostgreSQL/RustFS failure/recovery, followed by all 92 API integration tests. After tightening the default-issues assertion to wait for the actual API response, the deployed error-tracking workflow was rerun successfully in focused mode, together with the SDK and load checks. The temporary stacks and their volumes were removed. Docker platform and K3s checks passed during the preceding verification in this conversation; their unchanged definitions are retained. This audit does not claim a new GitHub Actions run: nothing was pushed.
