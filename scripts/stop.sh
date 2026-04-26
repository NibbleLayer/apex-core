#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
COMPOSE_FILE="${ROOT_DIR}/compose.yaml"
REMOVE_VOLUMES=0

BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { printf '%b\n' "$1"; }

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

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$port" 2>/dev/null | xargs --no-run-if-empty kill 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "$port"/tcp 2>/dev/null || true
  fi
}

remove_direct_container() {
  local runtime="$1"
  command -v "$runtime" >/dev/null 2>&1 || return 0

  if ! "$runtime" container inspect apex-postgres >/dev/null 2>&1; then
    return 0
  fi

  if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
    log "Removing apex-postgres with volumes (${runtime})..."
    "$runtime" rm -f -v apex-postgres >/dev/null 2>&1 || true
  else
    log "Removing apex-postgres (${runtime})..."
    "$runtime" rm -f apex-postgres >/dev/null 2>&1 || true
  fi
}

for arg in "$@"; do
  case "$arg" in
    --volumes) REMOVE_VOLUMES=1 ;;
    *)
      log "${RED}ERROR:${NC} unknown argument '$arg'."
      log "Usage: $0 [--volumes]"
      exit 1
      ;;
  esac
done

log "${BLUE}=== Apex shutdown ===${NC}"

# Direct containers are primary. Try both because users may switch runtimes.
remove_direct_container podman
remove_direct_container docker

# Compose cleanup is a best-effort fallback for older local environments.
if [[ -f "$COMPOSE_FILE" ]]; then
  if COMPOSE="$(detect_compose 2>/dev/null)"; then
    DOWN_ARGS=(down)
    [[ "$REMOVE_VOLUMES" -eq 1 ]] && DOWN_ARGS+=(--volumes)

    log "Best-effort compose cleanup: ${COMPOSE} ${DOWN_ARGS[*]}"
    bash -lc "${COMPOSE} -f \"${COMPOSE_FILE}\" ${DOWN_ARGS[*]}" >/dev/null 2>&1 || true
  fi
fi

kill_port 3000
kill_port 5173

if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
  log "${YELLOW}Database container and attached anonymous volumes were removed where discoverable.${NC}"
fi
log "${GREEN}Stopped.${NC}"
