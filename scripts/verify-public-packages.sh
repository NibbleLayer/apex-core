#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
WORK_DIR="$(mktemp -d)"

BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PUBLIC_PACKAGES=(
  "@nibblelayer/apex-contracts:packages/contracts"
  "@nibblelayer/apex-control-plane-core:packages/control-plane-core"
  "@nibblelayer/apex-hono:packages/sdk-hono"
)

log() {
  printf '%b\n' "$1"
}

cleanup() {
  rm -rf "$WORK_DIR"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "${RED}ERROR:${NC} required command '$1' is missing."
    exit 1
  fi
}

assert_entry_present() {
  local entries="$1"
  local pattern="$2"
  local label="$3"

  if [[ "$entries" != *"$pattern"* ]]; then
    log "${RED}ERROR:${NC} ${label} is missing from the packed tarball."
    exit 1
  fi
}

trap cleanup EXIT

require_cmd pnpm
require_cmd tar

log "${BLUE}=== Apex public package verification ===${NC}"
log "Workspace: ${ROOT_DIR}"

for package_spec in "${PUBLIC_PACKAGES[@]}"; do
  package_name="${package_spec%%:*}"
  package_path="${package_spec#*:}"
  package_dir="${ROOT_DIR}/${package_path}"
  package_work_dir="${WORK_DIR}/$(basename "$package_path")"

  if [[ ! -d "$package_dir" ]]; then
    log "${RED}ERROR:${NC} package directory not found: ${package_dir}"
    exit 1
  fi

  mkdir -p "$package_work_dir"

  log "${YELLOW}Packing ${package_name}${NC}"
  pnpm --dir "$ROOT_DIR" --filter "$package_name" pack --pack-destination "$package_work_dir" >/dev/null

  tarballs=("${package_work_dir}"/*.tgz)
  if [[ ! -e "${tarballs[0]}" ]]; then
    log "${RED}ERROR:${NC} no tarball produced for ${package_name}."
    exit 1
  fi

  tarball="${tarballs[0]}"
  entries="$(tar -tf "$tarball")"

  assert_entry_present "$entries" "package/package.json" "package.json"
  assert_entry_present "$entries" "package/README.md" "README.md"
  assert_entry_present "$entries" "package/dist/" "dist output"

  while IFS= read -r entry; do
    case "$entry" in
      package/src/*|package/test/*|package/node_modules/*|package/.turbo/*|package/tsconfig.json|package/vitest.config.ts|package/tsup.config.ts)
        log "${RED}ERROR:${NC} forbidden publish artifact detected in ${package_name}: ${entry}"
        exit 1
        ;;
    esac
  done <<< "$entries"

  log "${GREEN}PASS:${NC} ${package_name} -> $(basename "$tarball")"
done

log "${GREEN}All public package tarballs are publish-safe.${NC}"
