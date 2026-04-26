#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
SKIP_COMPOSE_CHECK=0

BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  printf '%b\n' "$1"
}

run_step() {
  local label="$1"
  shift

  log "${YELLOW}==>${NC} ${label}"
  "$@"
}

for arg in "$@"; do
  case "$arg" in
    --skip-compose-check)
      SKIP_COMPOSE_CHECK=1
      ;;
    *)
      log "${RED}ERROR:${NC} unknown argument '$arg'."
      exit 1
      ;;
  esac
done

log "${BLUE}=== Apex release verification ===${NC}"
log "Workspace: ${ROOT_DIR}"

run_step "Build workspace" pnpm --dir "$ROOT_DIR" build
run_step "Run tests" pnpm --dir "$ROOT_DIR" test
run_step "Run type checks" pnpm --dir "$ROOT_DIR" typecheck
run_step "Verify release metadata" pnpm --dir "$ROOT_DIR" release:metadata
run_step "Verify public package tarballs" pnpm --dir "$ROOT_DIR" pack:verify

if [[ "$SKIP_COMPOSE_CHECK" -eq 0 ]]; then
  run_step "Verify compose configuration" pnpm --dir "$ROOT_DIR" compose:verify
fi

log "${GREEN}Release verification completed successfully.${NC}"
