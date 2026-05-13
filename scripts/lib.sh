#!/usr/bin/env bash

if [[ -n "${APEX_SCRIPT_LIB_LOADED:-}" ]]; then
  return 0
fi
APEX_SCRIPT_LIB_LOADED=1

resolve_apex_root() {
  local source_path script_dir root_dir
  source_path="${BASH_SOURCE[0]:-$0}"
  script_dir="$(cd -- "$(dirname -- "$source_path")" && pwd)"
  root_dir="$(cd -- "${script_dir}/.." && pwd)"

  if [[ -d "${root_dir}/scripts" ]]; then
    printf '%s' "$root_dir"
    return 0
  fi

  if command -v git >/dev/null 2>&1; then
    git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null && return 0
  fi

  pwd
}

APEX_ROOT_DIR="${APEX_ROOT_DIR:-$(resolve_apex_root)}"
APEX_RUNTIME_DIR="${APEX_RUNTIME_DIR:-${APEX_ROOT_DIR}/.apex-runtime}"

BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { printf '%b\n' "$1"; }
info() { log "${BLUE}$1${NC}"; }
success() { log "${GREEN}$1${NC}"; }
warn() { log "${YELLOW}$1${NC}"; }
error() { log "${RED}$1${NC}"; }

load_repo_env() {
  source "${APEX_ROOT_DIR}/scripts/load-env.sh" 2>/dev/null || true
}

force_load_repo_env() {
  local env_file="${APEX_ROOT_DIR}/.env"
  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

detect_direct_runtime() {
  if command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
    printf '%s' 'podman'
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    printf '%s' 'docker'
    return 0
  fi
  return 1
}

detect_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    printf '%s' 'docker compose'
    return 0
  fi
  if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    printf '%s' 'podman compose'
    return 0
  fi
  return 1
}

wait_for_port() {
  local host="$1" port="$2" attempts="${3:-30}" current=1
  while [[ "$current" -le "$attempts" ]]; do
    if node -e "const net=require('node:net');const s=net.createConnection({host:'${host}',port:${port}},()=>{s.end();process.exit(0);});s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>{s.destroy();process.exit(1);});" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    current=$((current + 1))
  done
  return 1
}

wait_for_http_ok() {
  local url="$1" attempts="${2:-30}" current=1
  while [[ "$current" -le "$attempts" ]]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    current=$((current + 1))
  done
  return 1
}

json_get() {
  local json="$1" path="$2"
  JSON_INPUT="$json" JSON_PATH="$path" node <<'EOF'
const data = process.env.JSON_INPUT;
const path = (process.env.JSON_PATH || '').split('.').filter(Boolean);
let value;
try {
  value = JSON.parse(data || 'null');
  for (const key of path) value = value?.[key];
} catch {
  process.exit(1);
}
if (value === undefined || value === null) process.exit(1);
if (typeof value === 'object') {
  process.stdout.write(JSON.stringify(value));
} else {
  process.stdout.write(String(value));
}
EOF
}

db_url_field() {
  local field="$1"
  DATABASE_URL_INPUT="${DATABASE_URL:-}" DATABASE_URL_FIELD="$field" node <<'EOF'
const raw = process.env.DATABASE_URL_INPUT || '';
const field = process.env.DATABASE_URL_FIELD || '';
if (!raw) process.exit(1);
let url;
try {
  url = new URL(raw);
} catch {
  process.exit(1);
}
const values = {
  protocol: url.protocol.replace(/:$/, ''),
  username: decodeURIComponent(url.username || ''),
  password: decodeURIComponent(url.password || ''),
  host: url.hostname || '',
  port: url.port || '',
  database: url.pathname.replace(/^\//, ''),
};
const value = values[field];
if (!value) process.exit(1);
process.stdout.write(value);
EOF
}

is_local_database_url() {
  local host port protocol
  host="$(db_url_field host 2>/dev/null || true)"
  port="$(db_url_field port 2>/dev/null || true)"
  protocol="$(db_url_field protocol 2>/dev/null || true)"

  [[ "$protocol" == 'postgres' || "$protocol" == 'postgresql' ]] || return 1
  [[ "$host" == 'localhost' || "$host" == '127.0.0.1' || "$host" == '::1' ]] || return 1
  [[ "$port" == '5433' ]] || return 1
  return 0
}

confirm() {
  local prompt="$1"
  if [[ "${APEX_ASSUME_YES:-0}" == '1' ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    return 1
  fi
  local reply
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]([Ee][Ss])?$ ]]
}

print_local_env_preview() {
  cat <<'EOF'
DATABASE_URL=postgresql://apex:apex_dev@localhost:5433/apex_dev
POSTGRES_PASSWORD=apex_dev
POSTGRES_USER=apex
POSTGRES_DB=apex_dev
EOF
}

write_local_env_file() {
  cat >"${APEX_ROOT_DIR}/.env" <<'EOF'
DATABASE_URL=postgresql://apex:apex_dev@localhost:5433/apex_dev
POSTGRES_PASSWORD=apex_dev
POSTGRES_USER=apex
POSTGRES_DB=apex_dev
EOF
}

ensure_local_runtime_available() {
  detect_direct_runtime >/dev/null 2>&1 || detect_compose >/dev/null 2>&1
}
