#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"

BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  printf '%b\n' "$1"
}

run_cmd() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "${YELLOW}[dry-run]${NC} $*"
    return 0
  fi

  "$@"
}

detect_compose() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    printf '%s' 'docker compose'
    return 0
  fi

  if command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    printf '%s' 'podman compose'
    return 0
  fi

  return 1
}

detect_existing_postgres_runtime() {
  if command -v podman >/dev/null 2>&1 && podman container inspect apex-postgres >/dev/null 2>&1; then
    printf '%s' 'podman'
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker container inspect apex-postgres >/dev/null 2>&1; then
    printf '%s' 'docker'
    return 0
  fi

  return 1
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local attempts="${3:-30}"
  local current=1

  while [[ "$current" -le "$attempts" ]]; do
    if node -e "const net=require('node:net'); const socket=net.createConnection({host:'${host}', port:${port}},()=>{socket.end(); process.exit(0);}); socket.on('error',()=>process.exit(1)); socket.setTimeout(1000,()=>{socket.destroy(); process.exit(1);});" >/dev/null 2>&1; then
      return 0
    fi

    sleep 1
    current=$((current + 1))
  done

  return 1
}

log "${BLUE}=== Apex local setup ===${NC}"
log "Repository: ${ROOT_DIR}"

if ! command -v pnpm >/dev/null 2>&1; then
  log "${RED}ERROR:${NC} pnpm is required for local setup."
  exit 1
fi

if ! COMPOSE="$(detect_compose)"; then
  log "${RED}ERROR:${NC} docker compose or podman compose is required."
  exit 1
fi

log "${GREEN}Using compose command:${NC} ${COMPOSE}"

if EXISTING_RUNTIME="$(detect_existing_postgres_runtime)"; then
  run_cmd "$EXISTING_RUNTIME" start apex-postgres
else
  run_cmd bash -lc "${COMPOSE} -f \"${ROOT_DIR}/compose.yaml\" up -d postgres"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  log "${GREEN}Waiting for PostgreSQL on localhost:5433...${NC}"
  if ! wait_for_port '127.0.0.1' '5433' '45'; then
    log "${RED}ERROR:${NC} PostgreSQL did not become reachable on localhost:5433."
    exit 1
  fi
fi

run_cmd pnpm --dir "$ROOT_DIR" install --frozen-lockfile
run_cmd pnpm --dir "$ROOT_DIR" db:push

log "${GREEN}Setup complete.${NC}"
log "Next steps:"
log "  1. pnpm --dir \"${ROOT_DIR}\" seed -- --name \"My Org\" --slug \"my-org\" --label \"Admin Key\""
log "  2. pnpm --dir \"${ROOT_DIR}\" dev:api"
log "  3. pnpm --dir \"${ROOT_DIR}\" dev:dashboard"
