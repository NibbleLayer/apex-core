#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"
force_load_repo_env

MODE='interactive'
DEMO_CHOICE='ask'
SHOW_HELP=0
EXPLICIT_YES=0

usage() {
  cat <<'EOF'
Usage: pnpm quickstart [--minimal|--demo|--doctor|--reset] [--yes] [--help]

Primary onboarding entrypoint for local Apex development.

Modes:
  --minimal   Start the local stack with the smallest guided flow.
  --demo      Start the local stack and offer demo sample data.
  --doctor    Check onboarding prerequisites without changing anything.
  --reset     Remove local Apex container/database state safely.

Flags:
  --yes       Auto-confirm prompts that are still local-safe.
  --help      Show this help text.
EOF
}

doctor() {
  local ok=1

  info '=== Apex quickstart doctor ==='

  if command -v node >/dev/null 2>&1; then
    success "Node: $(node --version)"
  else
    error 'Node.js is missing.'
    ok=0
  fi

  if command -v pnpm >/dev/null 2>&1; then
    success "pnpm: $(pnpm --version)"
  else
    error 'pnpm is missing.'
    ok=0
  fi

  if ensure_local_runtime_available; then
    success 'Container runtime: available'
  else
    error 'Docker or Podman is required for local PostgreSQL.'
    ok=0
  fi

  if [[ -f "${APEX_ROOT_DIR}/.env" ]]; then
    if is_local_database_url; then
      success '.env: local onboarding database detected'
    else
      warn '.env: present, but DATABASE_URL is not the expected local onboarding target'
    fi
  else
    warn '.env: missing (quickstart can create it)'
  fi

  local missing=()
  [[ -d "${APEX_ROOT_DIR}/packages/contracts/dist" ]] || missing+=('@nibblelayer/apex-contracts')
  [[ -d "${APEX_ROOT_DIR}/packages/control-plane-core/dist" ]] || missing+=('@nibblelayer/apex-control-plane-core')
  [[ -d "${APEX_ROOT_DIR}/packages/core/dist" ]] || missing+=('@nibblelayer/apex-persistence')
  if [[ "${#missing[@]}" -eq 0 ]]; then
    success 'Workspace build artifacts: present'
  else
    warn "Workspace build artifacts missing: ${missing[*]}"
    warn 'Quickstart will build these automatically before startup.'
  fi

  if wait_for_http_ok 'http://localhost:3000/health' 1; then
    success 'API health: already running at http://localhost:3000'
  else
    warn 'API health: not running'
  fi

  if [[ "$ok" -eq 1 ]]; then
    success 'Doctor checks passed.'
    return 0
  fi

  error 'Doctor checks found blocking issues.'
  return 1
}

print_plan() {
  log ''
  info 'Quickstart plan:'
  log '  1. Ensure .env points at local PostgreSQL on localhost:5433.'
  log '  2. Build required workspace artifacts for a fresh checkout.'
  log '  3. Start local PostgreSQL, apply schema, and seed the initial org.'
  log '  4. Launch the API and dashboard.'
  if [[ "$DEMO_CHOICE" != 'never' ]]; then
    log '  5. Optionally add demo sample data after the API is healthy.'
  fi
  log ''
}

ensure_local_env() {
  local env_file backup_file
  env_file="${APEX_ROOT_DIR}/.env"

  if [[ ! -f "$env_file" ]]; then
    info 'Quickstart needs a local .env file before startup.'
    log 'This will create:'
    print_local_env_preview
    if ! confirm 'Create .env with these local onboarding values?'; then
      error 'Quickstart cancelled before creating .env.'
      exit 1
    fi
    write_local_env_file
    force_load_repo_env
    success 'Created .env for local onboarding.'
    return 0
  fi

  if is_local_database_url; then
    success '.env already targets the local onboarding database.'
    return 0
  fi

  warn 'Your current .env does not point at the local quickstart database.'
  log 'Quickstart can replace it with:'
  print_local_env_preview
  log 'A timestamped backup of the current .env will be created first.'

  if ! confirm 'Replace .env with local onboarding values?'; then
    error 'Quickstart only supports local-safe onboarding. Keeping your current .env and stopping here.'
    exit 1
  fi

  backup_file="${env_file}.backup.quickstart.$(date +%Y%m%d%H%M%S)"
  cp "$env_file" "$backup_file"
  write_local_env_file
  force_load_repo_env
  success "Updated .env for local onboarding. Backup saved to ${backup_file}."
}

reset_local_state() {
  force_load_repo_env

  if [[ -z "${DATABASE_URL:-}" ]]; then
    error 'ERROR: DATABASE_URL is not set. Refusing reset without an explicit local target.'
    exit 1
  fi

  if ! is_local_database_url; then
    error "ERROR: Refusing reset because DATABASE_URL is not local-safe (${DATABASE_URL})."
    exit 1
  fi

  info 'Reset plan:'
  log '  - stop local API/dashboard listeners'
  log '  - remove the apex-postgres container and attached anonymous volumes'
  log '  - remove the generated .apex-seed-key file'
  log ''

  if ! confirm 'Proceed with the local reset?'; then
    warn 'Reset cancelled.'
    exit 0
  fi

  bash "${APEX_ROOT_DIR}/scripts/stop.sh" --volumes
  rm -f "${APEX_ROOT_DIR}/.apex-seed-key"
  success 'Local Apex state reset complete.'
}

choose_demo() {
  case "$DEMO_CHOICE" in
    always)
      log ''
      info 'Demo sample data will be created after startup.'
      return 0
      ;;
    never)
      return 1
      ;;
  esac

  log ''
  log 'Optional demo sample data adds a Weather API service, wallet, route pricing, and SDK token.'
  if confirm 'Add the optional demo sample data after startup?'; then
    DEMO_CHOICE='always'
    return 0
  fi

  DEMO_CHOICE='never'
  return 1
}

start_stack() {
  if wait_for_http_ok 'http://localhost:3000/health' 1; then
    success 'Apex API already appears to be running. Reusing the existing stack.'
    log '  Dashboard: http://localhost:5173'
    log '  API:       http://localhost:3000'
    return 0
  fi

  if [[ "$DEMO_CHOICE" == 'always' ]]; then
    export APEX_QUICKSTART_CREATE_DEMO=1
  else
    unset APEX_QUICKSTART_CREATE_DEMO 2>/dev/null || true
  fi

  exec bash "${APEX_ROOT_DIR}/scripts/dev.sh"
}

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --minimal)
      MODE='minimal'
      DEMO_CHOICE='never'
      ;;
    --demo)
      MODE='demo'
      DEMO_CHOICE='always'
      ;;
    --doctor)
      MODE='doctor'
      ;;
    --reset)
      MODE='reset'
      ;;
    --yes)
      EXPLICIT_YES=1
      APEX_ASSUME_YES=1
      export APEX_ASSUME_YES
      ;;
    --help|-h)
      SHOW_HELP=1
      ;;
    *)
      error "ERROR: unknown argument '$arg'."
      usage
      exit 1
      ;;
  esac
done

if [[ "$SHOW_HELP" -eq 1 ]]; then
  usage
  exit 0
fi

case "$MODE" in
  doctor)
    doctor
    exit $? 
    ;;
  reset)
    reset_local_state
    exit 0
    ;;
esac

if [[ "$EXPLICIT_YES" -eq 0 && ! -t 0 ]]; then
  warn 'Non-interactive shell detected. Re-run with --yes or use --doctor first.'
  exit 1
fi

info '=== Apex quickstart ==='
if [[ "$MODE" == 'minimal' ]]; then
  log 'Mode: minimal local onboarding'
elif [[ "$MODE" == 'demo' ]]; then
  log 'Mode: guided onboarding with demo sample data'
else
  log 'Mode: guided local onboarding'
fi

print_plan
ensure_local_env

if [[ "$MODE" == 'interactive' ]]; then
  choose_demo || true
elif [[ "$MODE" == 'demo' ]]; then
  info 'Demo mode selected.'
  if ! confirm 'Confirm demo sample data creation after startup?'; then
    DEMO_CHOICE='never'
  fi
fi

if [[ "$DEMO_CHOICE" == 'always' ]] && wait_for_http_ok 'http://localhost:3000/health' 1; then
  bash "${APEX_ROOT_DIR}/scripts/quickstart-demo.sh"
  exit 0
fi

start_stack
