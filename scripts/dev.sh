#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"
ROOT_DIR="$APEX_ROOT_DIR"
RUNTIME_DIR="$APEX_RUNTIME_DIR"
API_PID_STATE_FILE="${RUNTIME_DIR}/api.pgid"
DASH_PID_STATE_FILE="${RUNTIME_DIR}/dashboard.pgid"
load_repo_env

if [[ -z "${DATABASE_URL:-}" ]]; then
  log "${RED}ERROR:${NC} DATABASE_URL environment variable is not set."
  log "${YELLOW}Hint:${NC} Create a .env file in the repo root:${NC}"
  log "  cp .env.example .env"
  log "  # Edit .env with your PostgreSQL credentials"
  exit 1
fi

check_postgres_protocol() {
  (
    cd "${ROOT_DIR}/packages/api" && \
      DATABASE_URL_INPUT="${DATABASE_URL}" node -e "(async()=>{const pg=require('pg');const pool=new pg.Pool({connectionString:process.env.DATABASE_URL_INPUT});await pool.query('select 1');await pool.end();})().catch((err)=>{console.error(err.message);process.exit(1);});"
  )
}

wait_for_postgres_protocol() {
  local attempts="${1:-30}" current=1
  while [[ "$current" -le "$attempts" ]]; do
    check_postgres_protocol >/dev/null 2>&1 && return 0
    sleep 1
    current=$((current + 1))
  done
  check_postgres_protocol
}

await_postgres_ready() {
  log "Waiting for PostgreSQL TCP port on :5433..."
  if ! wait_for_port '127.0.0.1' '5433' '45'; then
    log "${RED}ERROR:${NC} PostgreSQL did not become reachable on :5433."
    exit 1
  fi

  log "Validating PostgreSQL protocol handshake..."
  if ! wait_for_postgres_protocol 30; then
    log "${RED}ERROR:${NC} PostgreSQL TCP port is open, but protocol check failed."
    exit 1
  fi
  log "${GREEN}PostgreSQL ready.${NC}"
}

ensure_postgres() {
  local runtime compose
  if runtime="$(detect_direct_runtime)"; then
    if "$runtime" container inspect apex-postgres >/dev/null 2>&1; then
      if "$runtime" ps --format '{{.Names}}' | grep -q '^apex-postgres$'; then
        log "${GREEN}PostgreSQL container already running (${runtime}).${NC}"
      else
        log "${BLUE}Starting existing PostgreSQL container (${runtime})...${NC}"
        "$runtime" start apex-postgres >/dev/null
      fi

      # Verify credentials match current DATABASE_URL
      log "Verifying PostgreSQL credentials..."
      if ! check_postgres_protocol >/dev/null 2>&1; then
        log "${YELLOW}Password mismatch detected. Recreating container with new credentials...${NC}"
        "$runtime" stop apex-postgres >/dev/null 2>&1 || true
        "$runtime" rm -f apex-postgres >/dev/null 2>&1 || true
        # Fall through to create below
      else
        log "${GREEN}Credentials verified.${NC}"
        await_postgres_ready
        return 0
      fi
    fi

    # Create new container (either didn't exist or was recreated due to password mismatch)
    log "${BLUE}Creating PostgreSQL container (${runtime})...${NC}"
    local db_user db_password db_name
    db_user="$(db_url_field username 2>/dev/null || true)"
    db_password="$(db_url_field password 2>/dev/null || true)"
    db_name="$(db_url_field database 2>/dev/null || true)"

    if [[ -z "$db_user" || -z "$db_password" || -z "$db_name" ]]; then
      log "${RED}ERROR:${NC} Local DATABASE_URL must include username, password, and database name before creating the PostgreSQL container."
      exit 1
    fi

    "$runtime" run -d \
      --name apex-postgres \
      -e POSTGRES_USER="${db_user}" \
      -e POSTGRES_PASSWORD="${db_password}" \
      -e POSTGRES_DB="${db_name}" \
      -p 5433:5432 \
      docker.io/library/postgres:16-alpine >/dev/null
  else
    if ! compose="$(detect_compose)"; then
      log "${RED}ERROR:${NC} podman, docker, or compose is required for PostgreSQL."
      exit 1
    fi
    log "${BLUE}Starting PostgreSQL with compose fallback...${NC} (${compose})"
    bash -lc "${compose} -f \"${ROOT_DIR}/compose.yaml\" up -d postgres"
  fi

  await_postgres_ready
}

ensure_schema() {
  log "${BLUE}Pushing database schema...${NC}"
  pnpm --dir "$ROOT_DIR" db:push
  log "${GREEN}Schema up to date.${NC}"
}

ensure_workspace_build_artifacts() {
  log "${BLUE}Building required workspace packages...${NC}"
  pnpm --dir "$ROOT_DIR" --filter @nibblelayer/apex-contracts build
  pnpm --dir "$ROOT_DIR" --filter @nibblelayer/apex-control-plane-core build
  pnpm --dir "$ROOT_DIR" --filter @nibblelayer/apex-persistence build
  log "${GREEN}Workspace artifacts ready.${NC}"
}

bootstrap_data() {
  log "${BLUE}Bootstrapping initial organization...${NC}"
  local bootstrap_state has_org api_key_count
  if ! bootstrap_state="$(
    cd "${ROOT_DIR}/packages/api" && \
      DATABASE_URL_INPUT="${DATABASE_URL}" node <<'EOF'
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_INPUT });

async function main() {
  try {
    const { rows: orgRows } = await pool.query('SELECT COUNT(*)::int AS count FROM organizations');
    const { rows: keyRows } = await pool.query('SELECT COUNT(*)::int AS count FROM api_keys');
    process.stdout.write(JSON.stringify({
      organizations: Number(orgRows[0]?.count || 0),
      apiKeys: Number(keyRows[0]?.count || 0),
    }));
  } catch {
    process.stdout.write(JSON.stringify({ organizations: 0, apiKeys: 0 }));
  } finally {
    await pool.end();
  }
}

main().catch(() => process.exit(1));
EOF
  )"; then
    bootstrap_state='{"organizations":0,"apiKeys":0}'
  fi
  has_org="$(json_get "$bootstrap_state" organizations 2>/dev/null || printf '0')"
  api_key_count="$(json_get "$bootstrap_state" apiKeys 2>/dev/null || printf '0')"

  if [[ "$has_org" -gt 0 ]]; then
    if [[ -f "${ROOT_DIR}/.apex-seed-key" ]]; then
      log "${GREEN}Organization already exists — skipping bootstrap.${NC}"
      return 0
    fi

    log "${RED}ERROR:${NC} Local onboarding found an existing organization, but ${ROOT_DIR}/.apex-seed-key is missing."
    if [[ "$api_key_count" -gt 0 ]]; then
      log 'Stored API keys are hashed, so Apex cannot recover the original raw key automatically.'
    fi
    log 'Action required: restore .apex-seed-key from an earlier run, or reset the local onboarding state with:'
    log '  pnpm quickstart -- --reset --yes'
    log 'Then rerun quickstart to create a fresh bootstrap key.'
    exit 1
  fi

  log "${YELLOW}Creating initial organization and API key...${NC}"
  pnpm --dir "${ROOT_DIR}" seed 2>&1

  if [[ -f "${ROOT_DIR}/.apex-seed-key" ]]; then
    log "${GREEN}Bootstrap complete. API key written to ${ROOT_DIR}/.apex-seed-key${NC}"
  else
    log "${YELLOW}Warning: API key file not found after bootstrap.${NC}"
  fi
}

maybe_schedule_demo_data() {
  if [[ "${APEX_QUICKSTART_CREATE_DEMO:-0}" != '1' ]]; then
    return 0
  fi

  (
    if wait_for_http_ok 'http://localhost:3000/health' 45; then
      bash "${ROOT_DIR}/scripts/quickstart-demo.sh"
    else
      warn 'Warning: API never became healthy, so demo sample data was not created.'
    fi
  ) &
}

ensure_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

record_process_group() {
  local name="$1" pid="$2" pgid
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  if [[ -n "$pgid" ]]; then
    printf '%s\n' "$pgid" >"${RUNTIME_DIR}/${name}.pgid"
  else
    rm -f "${RUNTIME_DIR}/${name}.pgid"
  fi
}

clear_runtime_state() {
  rm -f "$API_PID_STATE_FILE" "$DASH_PID_STATE_FILE"
  rmdir "$RUNTIME_DIR" >/dev/null 2>&1 || true
}

terminate_current_job() {
  local pgid="$1"
  if [[ -n "$pgid" ]]; then
    kill -- "-${pgid}" 2>/dev/null || true
  fi
}

log "${BLUE}=== Apex dev environment ===${NC}"
log "pnpm dev starts Postgres + schema + API + Dashboard."
log "Use pnpm stop -- --volumes to reset the DB."

ensure_workspace_build_artifacts
ensure_postgres
ensure_schema
bootstrap_data

echo ""
log "  ${GREEN}API:${NC}        http://localhost:3000"
log "  ${GREEN}Dashboard:${NC}  http://localhost:5173"
log "  ${GREEN}API key:${NC}    ${ROOT_DIR}/.apex-seed-key (written on first boot)"
echo ""

API_PID=""
DASH_PID=""

ensure_runtime_dir

cleanup() {
  log "${YELLOW}Shutting down...${NC}"
  terminate_current_job "$(<"$API_PID_STATE_FILE" 2>/dev/null || true)"
  terminate_current_job "$(<"$DASH_PID_STATE_FILE" 2>/dev/null || true)"
  wait 2>/dev/null || true
  clear_runtime_state
  log "${GREEN}Stopped.${NC}"
  exit 0
}

trap cleanup INT TERM

pnpm --dir "$ROOT_DIR" dev:api &
API_PID=$!
record_process_group api "$API_PID"

pnpm --dir "$ROOT_DIR" dev:dashboard &
DASH_PID=$!
record_process_group dashboard "$DASH_PID"

maybe_schedule_demo_data

wait
