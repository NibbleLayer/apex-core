#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
export DATABASE_URL="postgresql://apex:apex_dev@localhost:5433/apex_dev"

BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { printf '%b\n' "$1"; }

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

check_postgres_protocol() {
  (cd "${ROOT_DIR}/packages/api" && node -e "(async()=>{const pg=require('pg');const pool=new pg.Pool({connectionString:'${DATABASE_URL}'});await pool.query('select 1');await pool.end();})().catch((err)=>{console.error(err.message);process.exit(1);});")
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
    else
      log "${BLUE}Creating PostgreSQL container (${runtime})...${NC}"
      "$runtime" run -d \
        --name apex-postgres \
        -e POSTGRES_USER=apex \
        -e POSTGRES_PASSWORD=apex_dev \
        -e POSTGRES_DB=apex_dev \
        -p 5433:5432 \
        docker.io/library/postgres:16-alpine >/dev/null
    fi
  else
    if ! compose="$(detect_compose)"; then
      log "${RED}ERROR:${NC} podman, docker, or compose is required for PostgreSQL."
      exit 1
    fi
    log "${BLUE}Starting PostgreSQL with compose fallback...${NC} (${compose})"
    bash -lc "${compose} -f \"${ROOT_DIR}/compose.yaml\" up -d postgres"
  fi

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

ensure_schema() {
  log "${BLUE}Pushing database schema...${NC}"
  pnpm --dir "$ROOT_DIR" db:push
  log "${GREEN}Schema up to date.${NC}"
}

bootstrap_data() {
  log "${BLUE}Bootstrapping initial organization...${NC}"
  # Check if org already exists
  local hasOrg
  hasOrg=$(cd "${ROOT_DIR}/packages/api" && node -e "
    const pg = require('pg');
    const pool = new pg.Pool({ connectionString: '${DATABASE_URL}' });
    pool.query('SELECT COUNT(*) FROM organizations').then(({ rows }) => {
      console.log(rows[0].count);
      pool.end();
    }).catch(() => { console.log('0'); pool.end(); });
  " 2>/dev/null || echo "0")

  if [[ "$hasOrg" -gt 0 ]]; then
    log "${GREEN}Organization already exists — skipping bootstrap.${NC}"
    return 0
  fi

  log "${YELLOW}Creating initial organization and API key...${NC}"
  pnpm --dir "${ROOT_DIR}" seed 2>&1

  if [[ -f "${ROOT_DIR}/.apex-seed-key" ]]; then
    log "${GREEN}Bootstrap complete. API key written to ${ROOT_DIR}/.apex-seed-key${NC}"
  else
    log "${YELLOW}Warning: API key file not found after bootstrap.${NC}"
  fi
}

log "${BLUE}=== Apex dev environment ===${NC}"
log "pnpm dev starts Postgres + schema + API + Dashboard."
log "Use pnpm stop --volumes to reset the DB."

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

cleanup() {
  log "${YELLOW}Shutting down...${NC}"
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$DASH_PID" ]] && kill "$DASH_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  log "${GREEN}Stopped.${NC}"
  exit 0
}

trap cleanup INT TERM

pnpm --dir "$ROOT_DIR" dev:api &
API_PID=$!

pnpm --dir "$ROOT_DIR" dev:dashboard &
DASH_PID=$!

wait
