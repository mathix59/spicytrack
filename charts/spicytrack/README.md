# SpicyTrack Helm chart

The chart defaults to an application-only deployment with external PostgreSQL and external
S3-compatible storage credentials. PostgreSQL and bundled RustFS can also be installed independently
in the same release. SMTP remains configured from SpicyTrack's instance administration, and
observability remains external.

## Installation

Create separate least-privilege Secrets for each backend. The public web pod intentionally receives
no Secret. The exact keys depend on enabled features; this minimal example shows the required
boundaries:

```sh
kubectl create namespace spicytrack

kubectl -n spicytrack create secret generic spicytrack-api-web \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=BETTER_AUTH_SECRET='...' \
  --from-literal=SECRETS_ENCRYPTION_KEY='...' \
  --from-literal=STORAGE_ENDPOINT='https://s3.example.com' \
  --from-literal=STORAGE_ACCESS_KEY_ID='...' \
  --from-literal=STORAGE_SECRET_ACCESS_KEY='...' \
  --from-literal=STORAGE_BUCKET='spicytrack-artifacts' \
  --from-literal=WEB_ORIGIN='https://spicytrack.example.com' \
  --from-literal=PUBLIC_BASE_URL='https://spicytrack.example.com' \
  --from-literal=WEB_BASE_URL='https://spicytrack.example.com' \
  --from-literal=BETTER_AUTH_URL='https://spicytrack.example.com/api/better-auth'

kubectl -n spicytrack create secret generic spicytrack-api-ingest \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=BETTER_AUTH_SECRET='...' \
  --from-literal=SECRETS_ENCRYPTION_KEY='...' \
  --from-literal=STORAGE_ENDPOINT='https://s3.example.com' \
  --from-literal=STORAGE_ACCESS_KEY_ID='...' \
  --from-literal=STORAGE_SECRET_ACCESS_KEY='...' \
  --from-literal=STORAGE_BUCKET='spicytrack-artifacts' \
  --from-literal=INGEST_PROJECT_EVENTS_PER_HOUR='10000' \
  --from-literal=INGEST_ORGANIZATION_EVENTS_PER_HOUR='50000'

kubectl -n spicytrack create secret generic spicytrack-worker-admin \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=BETTER_AUTH_SECRET='...' \
  --from-literal=SECRETS_ENCRYPTION_KEY='...' \
  --from-literal=STORAGE_ENDPOINT='https://s3.example.com' \
  --from-literal=STORAGE_ACCESS_KEY_ID='...' \
  --from-literal=STORAGE_SECRET_ACCESS_KEY='...' \
  --from-literal=STORAGE_BUCKET='spicytrack-artifacts'

helm upgrade --install spicytrack ./charts/spicytrack \
  --namespace spicytrack --create-namespace \
  --set ingress.host=spicytrack.example.com \
  --set images.apiWeb.digest='sha256:...' \
  --set images.apiIngest.digest='sha256:...' \
  --set images.workerAdmin.digest='sha256:...' \
  --set images.web.digest='sha256:...'
```

`--create-namespace` asks Helm to create `spicytrack` when it does not exist. The chart never creates
or selects a namespace by itself, so the release can be installed in any namespace.

## Deployment modes

The default is **application only**: keep `postgresql.enabled=false` and
`objectStorage.enabled=false`, then provide `DATABASE_URL` and the `STORAGE_*` values through the
three application Secrets shown above. The external storage may be AWS S3 or any compatible
provider; configure its endpoint, region, credentials, bucket, and path-style mode in those Secrets.

An external PostgreSQL read replica is optional. Add `DATABASE_READ_REPLICA_URL` to the
`apiWeb.existingSecret` to route ordinary Drizzle `SELECT` queries to it. Writes, transactions,
authentication and authorization checks, and migrations continue to use `DATABASE_URL`. The
replica is part of readiness while configured, so Kubernetes stops routing traffic to a pod that
cannot serve reads. Replication is asynchronous: interfaces can briefly observe stale data
immediately after a write, depending on provider lag. Usually leave the variable absent from ingest
and worker Secrets: those components are write-oriented and gain little from replica routing.

For a disposable compact installation, either bundled service can be enabled independently. Prefer
existing Kubernetes Secrets for production as documented below:

```sh
helm upgrade --install spicytrack ./charts/spicytrack \
  --namespace spicytrack --create-namespace \
  --set postgresql.enabled=true \
  --set-string postgresql.auth.password='replace-me' \
  --set objectStorage.enabled=true \
  --set-string objectStorage.auth.accessKey='replace-me' \
  --set-string objectStorage.auth.secretKey='replace-me-too' \
  --set ingress.host=spicytrack.example.com \
  --set images.apiWeb.digest='sha256:...' \
  --set images.apiIngest.digest='sha256:...' \
  --set images.workerAdmin.digest='sha256:...' \
  --set images.web.digest='sha256:...'
```

When a bundled service is enabled, its connection values override the corresponding values from
the application Secrets. Persistence is enabled by default and can be configured with
`postgresql.persistence` and `objectStorage.persistence`. Disable it only for disposable tests.

Avoid credentials on the command line in production. Both services support an existing Secret:

```yaml
postgresql:
  enabled: true
  auth:
    existingSecret: spicytrack-postgresql
    passwordKey: password
    databaseUrlKey: database-url

objectStorage:
  enabled: true
  auth:
    existingSecret: spicytrack-rustfs
    accessKeyKey: access-key
    secretKeyKey: secret-key
```

The PostgreSQL Secret must contain both the server password and the complete internal
`database-url`. The RustFS Secret contains the access and secret keys. The bundled services
are single-replica conveniences; use managed or properly operated external services for highly
available production installations.

Application image digests are mandatory so a deployment cannot silently move when a registry tag
changes. Published release digests are available from the signed GHCR artifacts. Verify their
Cosign signatures before deployment. Bundled PostgreSQL and RustFS use configurable tags by
default; their optional `image.digest` takes precedence when an immutable pin is desired.

Optional variables include `DATABASE_READ_REPLICA_URL`, `INGEST_BASE_URL`, `STORAGE_REGION`,
`STORAGE_FORCE_PATH_STYLE`, `VCS_ALLOWED_HOSTS`, and the Autofix variables documented in
[.env.example](../../.env.example). Configure SMTP from instance administration after installation.
Keep each optional value only in the Secret of the component that consumes it.

Generic OAuth/OIDC login can be enabled through the same Secret with `OIDC_DISCOVERY_URL`,
`OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`. Additional provider, account-creation, callback, and
password-fallback settings are listed in [.env.example](../../.env.example) at the repository root.

## Scaling

`apiWeb`, `apiIngest`, `web`, and `workerAdmin` each have their own `replicaCount`, `resources`, and `autoscaling` values. HPA is off by default. For workers, use queue-depth metrics (for example KEDA) rather than CPU alone when possible.

The web pod routes `/api/:projectId/store` and `/api/:projectId/envelope` internally to the ingestion API, and all other `/api` requests to the product API. This keeps the public Ingress portable across ingress controllers.

## Migrations

With an external database, the migration Job runs as a `pre-install` and `pre-upgrade` Helm hook.
With bundled PostgreSQL, the chart creates one migration Job per release revision and the application
pods wait for its completion marker before starting. Set `migrations.enabled=false` only when another
deployment process owns schema migrations; in that mode the chart does not add the migration wait
init container.

## K3s end-to-end test

The repository includes an isolated K3s test powered by k3d. It builds the four local images, pushes
them by digest to an ephemeral registry, enables the chart's bundled PostgreSQL and storage, installs
and upgrades this chart, waits for the real probes, and checks the frontend, ingress routing, API
readiness, storage, database, and disabled-until-configured SMTP state.

Install Docker, kubectl, Helm, and k3d, then run from the repository root:

```sh
pnpm test:e2e:k3s
```

The cluster and registry are removed automatically. Set `K3S_E2E_KEEP_CLUSTER=true` to retain them
for diagnosis after a run. Set `K3S_E2E_BUNDLED_SERVICES=false` to exercise the application-only
mode against the external test fixtures. Ports, names, timeout, and K3s image can be overridden with
the `K3S_E2E_*` variables declared at the top of `scripts/k3s-e2e.sh`.
