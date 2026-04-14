#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
COMPOSE_FILE="${ROOT_DIR}/compose.yaml"

BLUE='\033[1;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  printf '%b\n' "$1"
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

if [[ ! -f "$COMPOSE_FILE" ]]; then
  log "${RED}ERROR:${NC} compose file not found at ${COMPOSE_FILE}."
  exit 1
fi

if ! COMPOSE="$(detect_compose)"; then
  log "${RED}ERROR:${NC} docker compose or podman compose is required."
  exit 1
fi

log "${BLUE}=== Apex compose verification ===${NC}"
log "Workspace: ${ROOT_DIR}"
log "${GREEN}Using compose command:${NC} ${COMPOSE}"

bash -lc "${COMPOSE} -f \"${COMPOSE_FILE}\" config -q"

log "${GREEN}Compose configuration is valid.${NC}"
