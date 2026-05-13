#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"
ROOT_DIR="$APEX_ROOT_DIR"
COMPOSE_FILE="${ROOT_DIR}/compose.yaml"
RUNTIME_DIR="$APEX_RUNTIME_DIR"
REMOVE_VOLUMES=0

usage() {
  cat <<'EOF'
Usage: pnpm stop [-- --volumes] [-- --help]

Stops Apex-owned local dev processes recorded by scripts/dev.sh and removes the local apex-postgres container.

Options:
  --volumes   Remove attached anonymous Postgres volumes too.
  --help, -h  Show this help text (`pnpm stop --help` works too).
EOF
}

process_matches_repo() {
  local pgid="$1" args
  args="$(ps -o args= -p "$pgid" 2>/dev/null || true)"
  [[ -n "$args" && "$args" == *"$ROOT_DIR"* ]]
}

stop_recorded_process() {
  local name="$1" state_file pgid
  state_file="${RUNTIME_DIR}/${name}.pgid"

  [[ -f "$state_file" ]] || return 0

  pgid="$(<"$state_file")"
  if [[ -z "$pgid" ]] || ! kill -0 "$pgid" 2>/dev/null; then
    rm -f "$state_file"
    return 0
  fi

  if ! process_matches_repo "$pgid"; then
    warn "Skipping stale ${name} process group ${pgid} because it no longer looks Apex-owned."
    rm -f "$state_file"
    return 0
  fi

  log "Stopping Apex ${name} process group (${pgid})..."
  kill -- "-${pgid}" 2>/dev/null || true
  rm -f "$state_file"
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
    --) ;;
    --volumes) REMOVE_VOLUMES=1 ;;
    --help|-h|help)
      usage
      exit 0
      ;;
    *)
      log "${RED}ERROR:${NC} unknown argument '$arg'."
      usage
      exit 1
      ;;
  esac
done

log "${BLUE}=== Apex shutdown ===${NC}"

stop_recorded_process api
stop_recorded_process dashboard

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

if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
  log "${YELLOW}Database container and attached anonymous volumes were removed where discoverable.${NC}"
fi
rmdir "$RUNTIME_DIR" >/dev/null 2>&1 || true
log "${GREEN}Stopped.${NC}"
