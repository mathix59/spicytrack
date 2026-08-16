#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-spicytrack}"
INSTALL_DIR="${INSTALL_DIR:-/opt/${APP_NAME}}"
ENV_FILE="${INSTALL_DIR}/.env"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.release.yml"
INSTALL_BASE_URL="${INSTALL_BASE_URL:-https://raw.githubusercontent.com/mathix59/spicytrack/main}"
IMAGE_REPOSITORY_PREFIX="${IMAGE_REPOSITORY_PREFIX:-ghcr.io/mathix59/spicytrack}"
VERSION="${VERSION:-latest}"
APP_SCHEME="${APP_SCHEME:-http}"
APP_HOSTNAME="${APP_HOSTNAME:-$(hostname -f 2>/dev/null || hostname)}"
APP_PORT="${APP_PORT:-80}"
POSTGRES_DB="${POSTGRES_DB:-spicytrack}"
POSTGRES_USER="${POSTGRES_USER:-spicytrack}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run this script as root or with sudo."
  exit 1
fi

log() {
  echo "[${APP_NAME}] $1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1
}

install_packages() {
  local packages=(curl openssl ca-certificates)

  if require_command apt-get; then
    apt-get update -y >/dev/null
    apt-get install -y "${packages[@]}" >/dev/null
    return
  fi

  if require_command dnf; then
    dnf install -y "${packages[@]}" >/dev/null
    return
  fi

  if require_command yum; then
    yum install -y "${packages[@]}" >/dev/null
    return
  fi

  if require_command apk; then
    apk add --no-cache "${packages[@]}" >/dev/null
    return
  fi

  if require_command zypper; then
    zypper install -y "${packages[@]}" >/dev/null
    return
  fi

  echo "Unsupported package manager. Please install curl and openssl manually."
  exit 1
}

ensure_docker() {
  if require_command docker; then
    return
  fi

  log "Docker not found. Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
}

ensure_compose() {
  if docker compose version >/dev/null 2>&1; then
    return
  fi

  echo "Docker Compose plugin is required but not available after Docker installation."
  exit 1
}

ensure_docker_running() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  if require_command systemctl; then
    systemctl enable docker >/dev/null 2>&1 || true
    systemctl start docker
  elif require_command service; then
    service docker start
  fi

  docker info >/dev/null 2>&1
}

public_base_url() {
  if [[ "${APP_SCHEME}" == "http" && "${APP_PORT}" == "80" ]]; then
    printf "%s://%s" "${APP_SCHEME}" "${APP_HOSTNAME}"
    return
  fi

  if [[ "${APP_SCHEME}" == "https" && "${APP_PORT}" == "443" ]]; then
    printf "%s://%s" "${APP_SCHEME}" "${APP_HOSTNAME}"
    return
  fi

  printf "%s://%s:%s" "${APP_SCHEME}" "${APP_HOSTNAME}" "${APP_PORT}"
}

random_hex() {
  openssl rand -hex "$1"
}

random_b64() {
  openssl rand -base64 "$1" | tr -d '\n'
}

upsert_env() {
  local key="$1"
  local value="$2"

  if [[ -f "${ENV_FILE}" ]] && grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i.bak "s#^${key}=.*#${key}=${value}#g" "${ENV_FILE}"
    rm -f "${ENV_FILE}.bak"
    return
  fi

  printf "%s=%s\n" "${key}" "${value}" >>"${ENV_FILE}"
}

ensure_env_value() {
  local key="$1"
  local generator="$2"

  if [[ -f "${ENV_FILE}" ]]; then
    local existing
    existing="$(grep "^${key}=" "${ENV_FILE}" | tail -n1 | cut -d "=" -f2- || true)"
    if [[ -n "${existing}" ]]; then
      return
    fi
  fi

  upsert_env "${key}" "$(eval "${generator}")"
}

main() {
  log "Installing prerequisites..."
  install_packages
  ensure_docker
  ensure_docker_running
  ensure_compose

  mkdir -p "${INSTALL_DIR}"

  log "Downloading release compose file..."
  curl -fsSL "${INSTALL_BASE_URL}/docker-compose.release.yml" -o "${COMPOSE_FILE}"

  touch "${ENV_FILE}"

  local base_url
  base_url="$(public_base_url)"

  ensure_env_value "POSTGRES_PASSWORD" "random_hex 24"
  ensure_env_value "BETTER_AUTH_SECRET" "random_hex 32"
  ensure_env_value "SECRETS_ENCRYPTION_KEY" "random_b64 32"
  ensure_env_value "STORAGE_SECRET_ACCESS_KEY" "random_hex 24"

  upsert_env "IMAGE_REPOSITORY_PREFIX" "${IMAGE_REPOSITORY_PREFIX}"
  upsert_env "VERSION" "${VERSION}"
  upsert_env "APP_PORT" "${APP_PORT}"
  upsert_env "POSTGRES_DB" "${POSTGRES_DB}"
  upsert_env "POSTGRES_USER" "${POSTGRES_USER}"
  upsert_env "PUBLIC_BASE_URL" "${base_url}"
  upsert_env "WEB_ORIGIN" "${base_url}"
  upsert_env "WEB_BASE_URL" "${base_url}"
  upsert_env "BETTER_AUTH_URL" "${base_url}/api/better-auth"
  upsert_env "STORAGE_REGION" "us-east-1"
  upsert_env "STORAGE_ACCESS_KEY_ID" "spicytrack"
  upsert_env "STORAGE_BUCKET" "spicytrack-artifacts"
  upsert_env "AUTOFIX_WORKDIR" "/tmp/spicytrack-autofix"
  upsert_env "CODEBASE_MEMORY_MCP_BIN" "codebase-memory-mcp"
  upsert_env "CODEBASE_MEMORY_MCP_AUTO_INSTALL" "true"
  upsert_env "AUTOFIX_JOB_TIMEOUT_MS" "900000"

  log "Pulling images..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

  log "Starting stack..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

  log "Install complete."
  echo ""
  echo "Application URL: ${base_url}"
  echo "Configure SMTP after sign-in from Instance administration."
  echo "Config directory: ${INSTALL_DIR}"
}

main "$@"
