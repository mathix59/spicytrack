#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${K3S_E2E_CLUSTER_NAME:-spicytrack-e2e}"
REGISTRY_NAME="${K3S_E2E_REGISTRY_NAME:-spicytrack-e2e-registry.localhost}"
REGISTRY_PORT="${K3S_E2E_REGISTRY_PORT:-55000}"
HTTP_PORT="${K3S_E2E_HTTP_PORT:-58080}"
NAMESPACE="${K3S_E2E_NAMESPACE:-spicytrack-k3s-e2e}"
RELEASE_NAME="${K3S_E2E_RELEASE:-spicytrack}"
INGRESS_HOST="${K3S_E2E_HOST:-spicytrack.test}"
IMAGE_TAG="${K3S_E2E_IMAGE_TAG:-local}"
K3S_IMAGE="${K3S_E2E_K3S_IMAGE:-rancher/k3s:v1.36.3-k3s1}"
KEEP_CLUSTER="${K3S_E2E_KEEP_CLUSTER:-false}"
BUNDLED_SERVICES="${K3S_E2E_BUNDLED_SERVICES:-true}"
TIMEOUT="${K3S_E2E_TIMEOUT:-5m}"

cluster_created=false
registry_created=false
test_succeeded=false

log() {
  printf '[k3s-e2e] %s\n' "$*"
}

fail() {
  printf '[k3s-e2e] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

validate_name() {
  [[ "$2" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || fail "$1 contains unsafe characters: $2"
}

diagnostics() {
  log "collecting Kubernetes diagnostics"
  kubectl -n "$NAMESPACE" get pods,deployments,statefulsets,services,jobs,ingress -o wide || true
  kubectl -n "$NAMESPACE" get events --sort-by=.lastTimestamp || true
  helm -n "$NAMESPACE" status "$RELEASE_NAME" || true
  while IFS= read -r pod; do
    [[ -n "$pod" ]] || continue
    kubectl -n "$NAMESPACE" describe pod "$pod" || true
    kubectl -n "$NAMESPACE" logs "$pod" --all-containers --tail=200 || true
  done < <(kubectl -n "$NAMESPACE" get pods -o name 2>/dev/null | cut -d/ -f2)
}

cleanup() {
  exit_code=$?
  if [[ "$test_succeeded" != true && "$cluster_created" == true ]]; then
    diagnostics
  fi
  if [[ "$KEEP_CLUSTER" == true ]]; then
    log "keeping cluster $CLUSTER_NAME and registry $REGISTRY_NAME"
    return "$exit_code"
  fi
  if [[ "$registry_created" == true ]]; then
    k3d registry delete "$REGISTRY_NAME" >/dev/null || true
  fi
  if [[ "$cluster_created" == true ]]; then
    k3d cluster delete "$CLUSTER_NAME" >/dev/null || true
  fi
  return "$exit_code"
}
trap cleanup EXIT

build_and_push() {
  component="$1"
  dockerfile="$2"
  target="$3"
  external_repository="localhost:${REGISTRY_PORT}/spicytrack-${component}"
  internal_repository="k3d-${REGISTRY_NAME}:5000/spicytrack-${component}"

  log "building ${component}"
  build_args=(-f "$dockerfile" -t "${external_repository}:${IMAGE_TAG}")
  if [[ -n "$target" ]]; then
    build_args+=(--target "$target")
  fi
  docker build "${build_args[@]}" "$ROOT_DIR"

  push_output="$(docker push "${external_repository}:${IMAGE_TAG}" 2>&1)"
  printf '%s\n' "$push_output"
  digest="$(printf '%s\n' "$push_output" | sed -n 's/.*digest: \(sha256:[a-f0-9]\{64\}\).*/\1/p' | tail -n 1)"
  [[ -n "$digest" ]] || fail "could not determine pushed digest for $component"

  printf -v "${component//-/_}_repository" '%s' "$internal_repository"
  printf -v "${component//-/_}_digest" '%s' "$digest"
}

create_application_secrets() {
  if [[ "$BUNDLED_SERVICES" == true ]]; then
    postgresql_service="${RELEASE_NAME}-spicytrack-postgresql"
    object_storage_service="${RELEASE_NAME}-spicytrack-rustfs"
  else
    postgresql_service=postgres
    object_storage_service=rustfs
  fi
  common=(
    --from-literal=DATABASE_URL="postgresql://spicytrack:spicytrack-k3s-e2e@${postgresql_service}:5432/spicytrack"
    --from-literal=DATABASE_READ_REPLICA_URL="postgresql://spicytrack:spicytrack-k3s-e2e@${postgresql_service}:5432/spicytrack?options=-c%20default_transaction_read_only%3Don&application_name=spicytrack-read-replica"
    --from-literal=WEB_ORIGIN="http://${INGRESS_HOST}:${HTTP_PORT}"
    --from-literal=PUBLIC_BASE_URL="http://${INGRESS_HOST}:${HTTP_PORT}"
    --from-literal=WEB_BASE_URL="http://${INGRESS_HOST}:${HTTP_PORT}"
    --from-literal=BETTER_AUTH_URL="http://${INGRESS_HOST}:${HTTP_PORT}/api/better-auth"
    --from-literal=STORAGE_ENDPOINT="http://${object_storage_service}:9000"
    --from-literal=STORAGE_REGION='us-east-1'
    --from-literal=STORAGE_ACCESS_KEY_ID='spicytrack'
    --from-literal=STORAGE_SECRET_ACCESS_KEY='spicytrack-k3s-e2e-secret'
    --from-literal=STORAGE_BUCKET='spicytrack-artifacts'
    --from-literal=STORAGE_FORCE_PATH_STYLE='true'
  )

  kubectl -n "$NAMESPACE" create secret generic spicytrack-api-web \
    "${common[@]}" \
    --from-literal=BETTER_AUTH_SECRET='spicytrack-k3s-e2e-secret-at-least-32-characters' \
    --from-literal=SECRETS_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl -n "$NAMESPACE" create secret generic spicytrack-api-ingest \
    "${common[@]}" \
    --from-literal=BETTER_AUTH_SECRET='spicytrack-k3s-e2e-secret-at-least-32-characters' \
    --from-literal=SECRETS_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' \
    --from-literal=INGEST_MAX_EVENT_BYTES='1000000' \
    --from-literal=INGEST_PROJECT_EVENTS_PER_HOUR='10000' \
    --from-literal=INGEST_ORGANIZATION_EVENTS_PER_HOUR='50000' \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl -n "$NAMESPACE" create secret generic spicytrack-worker-admin \
    "${common[@]}" \
    --from-literal=BETTER_AUTH_SECRET='spicytrack-k3s-e2e-secret-at-least-32-characters' \
    --from-literal=SECRETS_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' \
    --dry-run=client -o yaml | kubectl apply -f -
}

create_external_artifact_bucket() {
  kubectl -n "$NAMESPACE" run create-artifact-bucket \
    --image="${api_web_repository}@${api_web_digest}" \
    --restart=Never \
    --env=STORAGE_ENDPOINT=http://rustfs:9000 \
    --env=STORAGE_REGION=us-east-1 \
    --env=STORAGE_ACCESS_KEY_ID=spicytrack \
    --env=STORAGE_SECRET_ACCESS_KEY=spicytrack-k3s-e2e-secret \
    --env=STORAGE_BUCKET=spicytrack-artifacts \
    --command -- node -e '
      const { S3Client, CreateBucketCommand } = require("/app/apps/api/node_modules/@aws-sdk/client-s3");
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const client = new S3Client({ endpoint: process.env.STORAGE_ENDPOINT, region: process.env.STORAGE_REGION, forcePathStyle: true, credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY } });
      (async () => { for (;;) { try { await client.send(new CreateBucketCommand({ Bucket: process.env.STORAGE_BUCKET })); return; } catch (error) { if (["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name)) return; console.log(`Waiting for RustFS: ${error.message}`); await sleep(2000); } } })().catch((error) => { console.error(error); process.exit(1); });'
  kubectl -n "$NAMESPACE" wait \
    --for=jsonpath='{.status.phase}'=Succeeded pod/create-artifact-bucket --timeout="$TIMEOUT"
}

set_helm_values() {
  helm_values=(
    --set-string "images.apiWeb.repository=${api_web_repository}"
    --set-string "images.apiWeb.digest=${api_web_digest}"
    --set-string "images.apiIngest.repository=${api_ingest_repository}"
    --set-string "images.apiIngest.digest=${api_ingest_digest}"
    --set-string "images.workerAdmin.repository=${api_worker_admin_repository}"
    --set-string "images.workerAdmin.digest=${api_worker_admin_digest}"
    --set-string "images.web.repository=${web_repository}"
    --set-string "images.web.digest=${web_digest}"
    --set images.apiWeb.pullPolicy=Always
    --set images.apiIngest.pullPolicy=Always
    --set images.workerAdmin.pullPolicy=Always
    --set images.web.pullPolicy=Always
    --set apiWeb.replicaCount=1
    --set apiIngest.replicaCount=1
    --set workerAdmin.replicaCount=1
    --set web.replicaCount=1
    --set ingress.enabled=true
    --set ingress.className=traefik
    --set-string "ingress.host=${INGRESS_HOST}"
  )
  if [[ "$BUNDLED_SERVICES" == true ]]; then
    helm_values+=(
      --set postgresql.enabled=true
      --set postgresql.persistence.enabled=false
      --set-string postgresql.auth.password=spicytrack-k3s-e2e
      --set objectStorage.enabled=true
      --set objectStorage.persistence.enabled=false
      --set-string objectStorage.auth.accessKey=spicytrack
      --set-string objectStorage.auth.secretKey=spicytrack-k3s-e2e-secret
    )
  fi
}

smoke_test() {
  base_url="http://127.0.0.1:${HTTP_PORT}"
  curl_args=(-fsS --retry 20 --retry-all-errors --retry-delay 2 -H "Host: ${INGRESS_HOST}")

  root_headers="$(curl "${curl_args[@]}" -D - -o /tmp/spicytrack-k3s-root.html "$base_url/")"
  grep -qi '^Content-Security-Policy:' <<<"$root_headers" || fail "CSP header missing from ingress response"
  grep -qi "^Content-Security-Policy:.*form-action 'self' https://github.com" <<<"$root_headers" \
    || fail "CSP does not allow GitHub App manifest submission"
  grep -q '<div id="root"></div>' /tmp/spicytrack-k3s-root.html || fail "frontend HTML was not returned"

  live="$(curl "${curl_args[@]}" "$base_url/api/health/live")"
  grep -q '"status":"ok"' <<<"$live" || fail "liveness endpoint did not return ok"

  ready="$(curl "${curl_args[@]}" "$base_url/api/health/ready")"
  grep -q '"status":"ok"' <<<"$ready" || fail "readiness endpoint did not return ok"
  grep -q '"database":"ok"' <<<"$ready" || fail "database readiness check did not pass"
  grep -q '"databaseReplica":"ok"' <<<"$ready" || fail "read-replica readiness check did not pass"
  grep -q '"storage":"ok"' <<<"$ready" || fail "storage readiness check did not pass"
  grep -q '"smtp":"disabled"' <<<"$ready" || fail "SMTP should be disabled before instance configuration"

  status="$(curl -sS -o /tmp/spicytrack-k3s-ingest.json -w '%{http_code}' \
    -H "Host: ${INGRESS_HOST}" -H 'Content-Type: application/json' \
    -d '{"message":"k3s routing probe"}' \
    "$base_url/api/unknown-project/store?sentry_key=k3s-routing-probe")"
  if [[ "$status" != 404 ]]; then
    fail "ingest route returned unexpected HTTP $status"
  fi
  grep -q 'Project key not found' /tmp/spicytrack-k3s-ingest.json \
    || fail "ingest route returned an unexpected 404 response"
}

for command in docker k3d kubectl helm curl sed grep; do
  require_command "$command"
done
validate_name cluster "$CLUSTER_NAME"
validate_name registry "$REGISTRY_NAME"
validate_name namespace "$NAMESPACE"
validate_name release "$RELEASE_NAME"
[[ "$REGISTRY_PORT" =~ ^[0-9]+$ ]] || fail "registry port must be numeric"
[[ "$HTTP_PORT" =~ ^[0-9]+$ ]] || fail "HTTP port must be numeric"

cd "$ROOT_DIR"
if k3d cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep -Fxq "$CLUSTER_NAME"; then
  fail "cluster already exists: $CLUSTER_NAME"
fi
if k3d registry list --no-headers 2>/dev/null | awk '{print $1}' | grep -Fxq "k3d-${REGISTRY_NAME}"; then
  fail "registry already exists: $REGISTRY_NAME"
fi

log "creating local registry"
k3d registry create "$REGISTRY_NAME" --port "$REGISTRY_PORT"
registry_created=true

log "creating K3s cluster"
k3d cluster create "$CLUSTER_NAME" \
  --image "$K3S_IMAGE" \
  --registry-use "k3d-${REGISTRY_NAME}:5000" \
  --port "${HTTP_PORT}:80@loadbalancer" \
  --servers 1 --agents 1 --wait
cluster_created=true

build_and_push api-web apps/api/Dockerfile api-web
build_and_push api-ingest apps/api/Dockerfile api-ingest
build_and_push api-worker-admin apps/api/Dockerfile api-worker-admin
build_and_push web apps/web/Dockerfile ''
set_helm_values

kubectl create namespace "$NAMESPACE"
if [[ "$BUNDLED_SERVICES" != true ]]; then
  kubectl -n "$NAMESPACE" apply -f e2e/k3s/dependencies.yaml
  kubectl -n "$NAMESPACE" rollout status deployment/postgres --timeout="$TIMEOUT"
  kubectl -n "$NAMESPACE" rollout status deployment/rustfs --timeout="$TIMEOUT"
  create_external_artifact_bucket
fi
create_application_secrets

log "installing Helm chart"
helm upgrade --install "$RELEASE_NAME" charts/spicytrack \
  --namespace "$NAMESPACE" --wait --timeout "$TIMEOUT" \
  "${helm_values[@]}"
kubectl -n "$NAMESPACE" wait --for=condition=available deployment \
  -l "app.kubernetes.io/instance=${RELEASE_NAME}" --timeout="$TIMEOUT"
sleep 10
  if kubectl -n "$NAMESPACE" get pods \
  -l "app.kubernetes.io/instance=${RELEASE_NAME},app.kubernetes.io/component in (api-web,api-ingest,worker-admin,web)" \
  -o jsonpath='{range .items[*]}{range .status.containerStatuses[*]}{.restartCount}{"\n"}{end}{end}' \
  | awk '$1 > 0 { failed=1 } END { exit failed }'; then
  :
else
  fail "an application container restarted after deployment"
fi
smoke_test

log "validating Helm upgrade path"
helm upgrade "$RELEASE_NAME" charts/spicytrack \
  --namespace "$NAMESPACE" --atomic --wait --timeout "$TIMEOUT" \
  "${helm_values[@]}"
smoke_test

test_succeeded=true
log "K3s Helm end-to-end test passed"
