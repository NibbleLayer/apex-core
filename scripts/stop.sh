#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
COMPOSE_FILE="${ROOT_DIR}/compose.yaml"
DRY_RUN=0
REMOVE_VOLUMES=0

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

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    --volumes)
      REMOVE_VOLUMES=1
      ;;
    *)
      log "${RED}ERROR:${NC} unknown argument '$arg'."
      exit 1
      ;;
  esac
done

if [[ ! -f "$COMPOSE_FILE" ]]; then
  log "${RED}ERROR:${NC} compose file not found at ${COMPOSE_FILE}."
  exit 1
fi

if ! COMPOSE="$(detect_compose)"; then
  log "${RED}ERROR:${NC} docker compose or podman compose is required."
  exit 1
fi

DOWN_ARGS=(down)
if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
  DOWN_ARGS+=(--volumes)
fi

log "${BLUE}=== Apex shutdown ===${NC}"
log "Repository: ${ROOT_DIR}"
log "${GREEN}Using compose command:${NC} ${COMPOSE}"

run_cmd bash -lc "${COMPOSE} -f \"${COMPOSE_FILE}\" ${DOWN_ARGS[*]}"

log "${GREEN}Shutdown complete.${NC}"
