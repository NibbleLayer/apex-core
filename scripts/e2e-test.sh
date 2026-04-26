#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
API_BASE="${API_BASE:-http://localhost:3000}"
API_KEY="${APEX_API_KEY:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { printf '%b\n' "$1"; }

if [[ -z "${DATABASE_URL:-}" ]]; then
  log "${RED}ERROR:${NC} DATABASE_URL environment variable is not set."
  exit 1
fi

PASSED=0
FAILED=0
SETUP_COMPLETE=0

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "${RED}ERROR:${NC} required command '$1' not found."
    exit 1
  fi
}

assert_status() {
  local label="$1" expected="$2" actual="$3" body_file="$4"
  if [[ "$expected" == "$actual" ]]; then
    log "  ${GREEN}[PASS]${NC} ${label}"
    PASSED=$((PASSED + 1))
  else
    log "  ${RED}[FAIL]${NC} ${label} (expected ${expected}, got ${actual})"
    jq . "$body_file" 2>/dev/null || true
    FAILED=$((FAILED + 1))
  fi
}

assert_status_one_of() {
  local label="$1" actual="$2" body_file="$3"
  shift 3
  local expected
  for expected in "$@"; do
    if [[ "$expected" == "$actual" ]]; then
      log "  ${GREEN}[PASS]${NC} ${label}"
      PASSED=$((PASSED + 1))
      return 0
    fi
  done
  log "  ${RED}[FAIL]${NC} ${label} (expected one of: $*, got ${actual})"
  jq . "$body_file" 2>/dev/null || true
  FAILED=$((FAILED + 1))
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    log "  ${GREEN}[PASS]${NC} ${label}"
    PASSED=$((PASSED + 1))
  else
    log "  ${RED}[FAIL]${NC} ${label} (expected '${expected}', got '${actual}')"
    FAILED=$((FAILED + 1))
  fi
}

assert_ge() {
  local label="$1" minimum="$2" actual="$3"
  if [[ "$actual" =~ ^[0-9]+$ && "$actual" -ge "$minimum" ]]; then
    log "  ${GREEN}[PASS]${NC} ${label}"
    PASSED=$((PASSED + 1))
  else
    log "  ${RED}[FAIL]${NC} ${label} (expected >= ${minimum}, got '${actual}')"
    FAILED=$((FAILED + 1))
  fi
}

api() {
  local method="$1" path="$2" body="${3:-}"
  local tmp status
  tmp="$(mktemp)"
  local auth=()
  [[ -n "$API_KEY" ]] && auth=(-H "Authorization: Bearer ${API_KEY}")

  if [[ -n "$body" ]]; then
    status=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" \
      "${auth[@]}" -H 'Content-Type: application/json' -d "$body" "${API_BASE}${path}") || status="000"
  else
    status=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" \
      "${auth[@]}" "${API_BASE}${path}") || status="000"
  fi

  printf '%s\n%s\n' "$status" "$tmp"
}

api_with_bearer() {
  local token="$1" method="$2" path="$3" body="${4:-}"
  local tmp status
  tmp="$(mktemp)"

  if [[ -n "$body" ]]; then
    status=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' -d "$body" "${API_BASE}${path}") || status="000"
  else
    status=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer ${token}" "${API_BASE}${path}") || status="000"
  fi

  printf '%s\n%s\n' "$status" "$tmp"
}

jf() { jq -r "$2" "$1"; }

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
  local host="$1" port="$2" attempts="${3:-30}" i=1
  while [[ "$i" -le "$attempts" ]]; do
    node -e "const net=require('node:net');const s=net.createConnection({host:'${host}',port:${port}},()=>{s.end();process.exit(0);});s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>{s.destroy();process.exit(1);});" >/dev/null 2>&1 && return 0
    sleep 1
    i=$((i + 1))
  done
  return 1
}

check_port_available() {
  local host="$1" port="$2"
  if node -e "const net=require('node:net');const s=net.createConnection({host:'${host}',port:${port}},()=>{s.end();process.exit(0);});s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>{s.destroy();process.exit(1);});" >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

check_postgres_protocol() {
  (cd "${ROOT_DIR}/packages/api" && node -e "(async()=>{const pg=require('pg');const pool=new pg.Pool({connectionString:'${DATABASE_URL}'});await pool.query('select 1');await pool.end();})().catch((err)=>{console.error(err.message);process.exit(1);});")
}

wait_for_postgres_protocol() {
  local attempts="${1:-30}" i=1
  while [[ "$i" -le "$attempts" ]]; do
    check_postgres_protocol >/dev/null 2>&1 && return 0
    sleep 1
    i=$((i + 1))
  done
  check_postgres_protocol
}

wait_for_health() {
  local i=1
  while [[ "$i" -le 40 ]]; do
    curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}/health" 2>/dev/null | grep -q '200' && return 0
    sleep 1
    i=$((i + 1))
  done
  return 1
}

ensure_postgres() {
  local runtime compose
  if runtime="$(detect_direct_runtime)"; then
    if "$runtime" container inspect apex-postgres >/dev/null 2>&1; then
      if "$runtime" ps --format '{{.Names}}' | grep -q '^apex-postgres$'; then
        log "${GREEN}PostgreSQL container already running (${runtime}).${NC}"
      else
        log "${YELLOW}Starting existing PostgreSQL container (${runtime})...${NC}"
        "$runtime" start apex-postgres >/dev/null
      fi
    else
      log "${YELLOW}Creating PostgreSQL container (${runtime})...${NC}"
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
    log "${YELLOW}Starting PostgreSQL with compose fallback (${compose})...${NC}"
    bash -lc "${compose} -f \"${ROOT_DIR}/compose.yaml\" up -d postgres"
  fi

  log "Waiting for PostgreSQL TCP port on :5433..."
  if ! wait_for_port '127.0.0.1' '5433' '45'; then
    log "${RED}ERROR:${NC} PostgreSQL not reachable on :5433."
    exit 1
  fi

  log "Validating PostgreSQL protocol handshake..."
  if ! wait_for_postgres_protocol 30; then
    log "${RED}ERROR:${NC} PostgreSQL TCP port is open, but protocol check failed."
    exit 1
  fi
  log "${GREEN}PostgreSQL ready.${NC}"
}

API_PID=""

teardown() {
  local status=$?
  trap - EXIT

  if [[ -n "$API_PID" ]]; then
    log "${YELLOW}Stopping API (PID ${API_PID})...${NC}"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi

  echo ""
  log "${CYAN}=== Results ===${NC}"
  log "  Passed: ${GREEN}${PASSED}${NC}   Failed: ${RED}${FAILED}${NC}"

  if [[ "$SETUP_COMPLETE" -ne 1 ]]; then
    log "${RED}E2E FAILED (setup did not complete)${NC}"
    exit 1
  fi
  if [[ "$FAILED" -gt 0 || "$status" -ne 0 ]]; then
    log "${RED}E2E FAILED${NC}"
    exit 1
  fi
  log "${GREEN}E2E PASSED${NC}"
  exit 0
}

trap teardown EXIT

require_cmd curl
require_cmd jq
require_cmd node
require_cmd pnpm

log "${CYAN}=== Apex E2E test ===${NC}"

ensure_postgres

log "${YELLOW}Cleaning previous test state...${NC}"
rm -f "${ROOT_DIR}/.apex-seed-key"
# Truncate organizations and api_keys to ensure clean seed
(cd "${ROOT_DIR}/packages/api" && node -e "
const pg = require('pg');
const pool = new pg.Pool({ connectionString: '${DATABASE_URL}' });
Promise.all([
  pool.query('TRUNCATE TABLE api_keys, organizations CASCADE'),
]).then(() => {
  console.log('Tables truncated');
  pool.end();
}).catch(err => {
  console.error('Truncate failed:', err.message);
  pool.end();
});
" 2>/dev/null) || true

log "${YELLOW}Pushing schema...${NC}"
pnpm --dir "$ROOT_DIR" db:push

log "${YELLOW}Seeding initial organization...${NC}"
pnpm --dir "$ROOT_DIR" seed 2>&1 || true

log "${YELLOW}Building API dependencies...${NC}"
pnpm --filter @nibblelayer/apex-contracts build
pnpm --filter @nibblelayer/apex-persistence build
pnpm --filter @nibblelayer/apex-control-plane-core build

log "${YELLOW}Building API...${NC}"
pnpm --filter @nibblelayer/apex-api build

log "${YELLOW}Starting API...${NC}"
if ! check_port_available '127.0.0.1' 3000; then
  log "${RED}ERROR:${NC} Port 3000 is already in use."
  log "${YELLOW}Hint:${NC} Stop 'pnpm dev' before running E2E tests, or set API_BASE to a different port."
  exit 1
fi
DATABASE_URL="$DATABASE_URL" node "${ROOT_DIR}/packages/api/dist/index.js" &
API_PID=$!

log "Waiting for API health check..."
if ! wait_for_health; then
  log "${RED}ERROR:${NC} API did not become healthy at ${API_BASE}/health."
  exit 1
fi
log "${GREEN}API is healthy.${NC}"

if [[ -z "$API_KEY" ]]; then
  SEED_KEY_FILE="${ROOT_DIR}/.apex-seed-key"
  if [[ -f "$SEED_KEY_FILE" ]]; then
    API_KEY="$(<"$SEED_KEY_FILE")"
  fi
fi
if [[ -z "$API_KEY" ]]; then
  log "${RED}ERROR:${NC} No API key found. Set APEX_API_KEY or run API with auto-seed first."
  exit 1
fi

SETUP_COMPLETE=1

log ""
log "${CYAN}=== Running assertions ===${NC}"

# Auth: invalid key -> 401
readarray -t r < <(api POST /auth/login '{"api_key":"invalid"}')
assert_status 'POST /auth/login (invalid key) → 401' '401' "${r[0]}" "${r[1]}"

# Auth: valid key -> 200
readarray -t r < <(api POST /auth/login "{\"api_key\":\"${API_KEY}\"}")
assert_status 'POST /auth/login (valid key) → 200' '200' "${r[0]}" "${r[1]}"
ORG_ID="$(jf "${r[1]}" '.organizationId')"

# Create service -> 201
SUFFIX="$(date +%s)"
readarray -t r < <(api POST /services "{\"name\":\"E2E Weather\",\"slug\":\"e2e-weather-${SUFFIX}\",\"description\":\"e2e service\"}")
assert_status 'POST /services → 201' '201' "${r[0]}" "${r[1]}"
SERVICE_ID="$(jf "${r[1]}" '.id')"

# Create environment -> 201
readarray -t r < <(api POST "/services/${SERVICE_ID}/environments" '{"mode":"test","network":"eip155:84532","facilitatorUrl":"https://x402.org/facilitator"}')
assert_status 'POST /services/{id}/environments → 201' '201' "${r[0]}" "${r[1]}"
ENV_ID="$(jf "${r[1]}" '.id')"

# Create wallet -> 201
readarray -t r < <(api POST "/services/${SERVICE_ID}/wallets" "{\"environmentId\":\"${ENV_ID}\",\"address\":\"0x1234567890abcdef1234567890abcdef12345678\",\"token\":\"native\",\"network\":\"eip155:84532\",\"label\":\"Primary wallet\"}")
assert_status 'POST /services/{id}/wallets → 201' '201' "${r[0]}" "${r[1]}"

# Create route -> 201
readarray -t r < <(api POST "/services/${SERVICE_ID}/routes" '{"method":"GET","path":"/weather","description":"weather endpoint","enabled":true}')
assert_status 'POST /services/{id}/routes → 201' '201' "${r[0]}" "${r[1]}"
ROUTE_ID="$(jf "${r[1]}" '.id')"

# Create pricing rule -> 201
readarray -t r < <(api POST "/routes/${ROUTE_ID}/pricing" '{"scheme":"exact","amount":"$0.01","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","network":"eip155:84532"}')
assert_status 'POST /routes/{id}/pricing → 201' '201' "${r[0]}" "${r[1]}"

# Gate 6.5 domains: create pending DNS proof and list it
readarray -t r < <(api POST "/services/${SERVICE_ID}/domains" '{"domain":"weather.example.com"}')
assert_status 'POST /services/{id}/domains → 201' '201' "${r[0]}" "${r[1]}"
DOMAIN_ID="$(jf "${r[1]}" '.id')"
DOMAIN_STATUS="$(jf "${r[1]}" '.status')"
DOMAIN_RECORD_NAME="$(jf "${r[1]}" '.dnsRecordName')"
DOMAIN_RECORD_VALUE="$(jf "${r[1]}" '.dnsRecordValue')"
assert_eq 'created domain starts pending' 'pending' "$DOMAIN_STATUS"
assert_eq 'created domain exposes DNS TXT name' '_apex.weather.example.com' "$DOMAIN_RECORD_NAME"
if [[ "$DOMAIN_RECORD_VALUE" == apex-verify=* ]]; then
  log "  ${GREEN}[PASS]${NC} created domain exposes DNS TXT value"
  PASSED=$((PASSED + 1))
else
  log "  ${RED}[FAIL]${NC} created domain exposes DNS TXT value (got '${DOMAIN_RECORD_VALUE}')"
  FAILED=$((FAILED + 1))
fi

readarray -t r < <(api GET "/services/${SERVICE_ID}/domains")
assert_status 'GET /services/{id}/domains → 200' '200' "${r[0]}" "${r[1]}"
DOMAIN_LISTED="$(jq -r --arg id "$DOMAIN_ID" '[.[] | select(.id == $id and .status == "pending")] | length | tostring' "${r[1]}")"
assert_eq 'pending domain appears in domain list' '1' "$DOMAIN_LISTED"

# Gate 6 discovery: incomplete published metadata is rejected with quality errors
readarray -t r < <(api POST "/routes/${ROUTE_ID}/discovery" '{"discoverable":true,"reviewStatus":"published"}')
assert_status 'POST /routes/{id}/discovery (incomplete publish) → 400' '400' "${r[0]}" "${r[1]}"
DISCOVERY_QUALITY_ERRORS="$(jf "${r[1]}" '[(.qualityChecks)[]? | select(.level == "error")] | length')"
assert_ge 'incomplete discovery response includes quality check errors' '1' "$DISCOVERY_QUALITY_ERRORS"

# Gate 6 discovery: complete published metadata is queued for indexing
readarray -t r < <(api POST "/routes/${ROUTE_ID}/discovery" '{"discoverable":true,"category":"weather","tags":["forecast","paid-api"],"description":"Paid weather forecast endpoint for Apex discovery validation.","mimeType":"application/json","docsUrl":"https://docs.example.com/weather","inputSchema":{"type":"object","properties":{"city":{"type":"string"}}},"outputSchema":{"type":"object","properties":{"temperature":{"type":"number"}}},"reviewStatus":"published"}')
assert_status_one_of 'POST /routes/{id}/discovery (complete publish) → 200/201' "${r[0]}" "${r[1]}" '200' '201'
DISCOVERY_REVIEW_STATUS="$(jf "${r[1]}" '.reviewStatus')"
DISCOVERY_INDEXING_STATUS="$(jf "${r[1]}" '.indexingStatus')"
assert_eq 'published discovery review status is published' 'published' "$DISCOVERY_REVIEW_STATUS"
assert_eq 'published discovery indexing status is queued' 'queued' "$DISCOVERY_INDEXING_STATUS"

# Gate 6 discovery: preview reflects route/category and has no blocking errors
readarray -t r < <(api GET "/routes/${ROUTE_ID}/discovery/preview")
assert_status 'GET /routes/{id}/discovery/preview → 200' '200' "${r[0]}" "${r[1]}"
DISCOVERY_PREVIEW_PATH="$(jf "${r[1]}" '.preview.path')"
DISCOVERY_PREVIEW_CATEGORY="$(jf "${r[1]}" '.preview.category')"
DISCOVERY_PREVIEW_ERRORS="$(jf "${r[1]}" '[(.qualityChecks)[]? | select(.level == "error")] | length')"
assert_eq 'discovery preview path is /weather' '/weather' "$DISCOVERY_PREVIEW_PATH"
assert_eq 'discovery preview category is weather' 'weather' "$DISCOVERY_PREVIEW_CATEGORY"
assert_eq 'discovery preview has no quality check errors' '0' "$DISCOVERY_PREVIEW_ERRORS"

# Get manifest -> 200, verify route key
readarray -t r < <(api GET "/services/${SERVICE_ID}/manifest?env=test")
assert_status 'GET /services/{id}/manifest → 200' '200' "${r[0]}" "${r[1]}"
ROUTE_KEY="$(jf "${r[1]}" '.routes | keys[0]')"
assert_eq 'manifest contains "GET /weather" route' 'GET /weather' "$ROUTE_KEY"
PENDING_DOMAIN_LISTED="$(jf "${r[1]}" '.verifiedDomains | index("weather.example.com") != null | tostring')"
assert_eq 'manifest excludes pending domain from verifiedDomains' 'false' "$PENDING_DOMAIN_LISTED"

# Create scoped SDK token -> 201
readarray -t r < <(api POST "/services/${SERVICE_ID}/sdk-tokens" '{"environment":"test","label":"Local SDK","scopes":["manifest:read","events:write","routes:register"]}')
assert_status 'POST /services/{id}/sdk-tokens → 201' '201' "${r[0]}" "${r[1]}"
SDK_TOKEN="$(jf "${r[1]}" '.token')"

# Register SDK route candidate -> 202, verify it remains a disabled draft in admin routes
readarray -t r < <(api_with_bearer "$SDK_TOKEN" POST /sdk/register '{"routes":[{"method":"GET","path":"/auto-weather","description":"auto candidate"}]}')
assert_status 'POST /sdk/register (scoped SDK token) → 202' '202' "${r[0]}" "${r[1]}"
SDK_REGISTER_CREATED="$(jf "${r[1]}" '.created')"
if [[ "$SDK_REGISTER_CREATED" =~ ^[0-9]+$ && "$SDK_REGISTER_CREATED" -ge 1 ]]; then
  log "  ${GREEN}[PASS]${NC} SDK register created at least one route candidate"
  PASSED=$((PASSED + 1))
else
  log "  ${RED}[FAIL]${NC} SDK register created at least one route candidate (got '${SDK_REGISTER_CREATED}')"
  FAILED=$((FAILED + 1))
fi

readarray -t r < <(api GET "/services/${SERVICE_ID}/routes")
assert_status 'GET /services/{id}/routes includes SDK candidate → 200' '200' "${r[0]}" "${r[1]}"
AUTO_ROUTE_STATUS="$(jf "${r[1]}" '.[] | select(.path == "/auto-weather") | .publicationStatus')"
AUTO_ROUTE_ENABLED="$(jf "${r[1]}" '.[] | select(.path == "/auto-weather") | .enabled | tostring')"
assert_eq 'SDK candidate is draft' 'draft' "$AUTO_ROUTE_STATUS"
assert_eq 'SDK candidate is disabled' 'false' "$AUTO_ROUTE_ENABLED"

# Get signed SDK manifest with scoped token -> 200
readarray -t r < <(api_with_bearer "$SDK_TOKEN" GET /sdk/manifest)
assert_status 'GET /sdk/manifest (scoped SDK token) → 200' '200' "${r[0]}" "${r[1]}"
SDK_SIGNATURE_ALG="$(jf "${r[1]}" '.signature.alg')"
SDK_SIGNATURE_KID="$(jf "${r[1]}" '.signature.kid')"
SDK_ROUTE_KEY="$(jf "${r[1]}" '.manifest.routes | keys[0]')"
SDK_DRAFT_PRESENT="$(jf "${r[1]}" '.manifest.routes | has("GET /auto-weather") | tostring')"
assert_eq 'SDK manifest signature alg is HS256' 'HS256' "$SDK_SIGNATURE_ALG"
if [[ -n "$SDK_SIGNATURE_KID" && "$SDK_SIGNATURE_KID" != "null" ]]; then
  log "  ${GREEN}[PASS]${NC} SDK manifest signature kid is present"
  PASSED=$((PASSED + 1))
else
  log "  ${RED}[FAIL]${NC} SDK manifest signature kid is present"
  FAILED=$((FAILED + 1))
fi
assert_eq 'SDK manifest contains "GET /weather" route' 'GET /weather' "$SDK_ROUTE_KEY"
assert_eq 'SDK manifest excludes draft SDK candidate' 'false' "$SDK_DRAFT_PRESENT"

# Create webhook -> 201
readarray -t r < <(api POST "/services/${SERVICE_ID}/webhooks" '{"url":"https://example.com/hooks/apex","enabled":true}')
assert_status 'POST /services/{id}/webhooks → 201' '201' "${r[0]}" "${r[1]}"

# Ingest event -> 202
readarray -t r < <(api POST /events "{\"serviceId\":\"${SERVICE_ID}\",\"routeId\":\"${ROUTE_ID}\",\"type\":\"payment.settled\",\"requestId\":\"req-${SUFFIX}\",\"paymentIdentifier\":\"pay-${SUFFIX}\",\"amount\":\"$0.01\",\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"network\":\"eip155:84532\",\"settlementReference\":\"0xsettled\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
assert_status 'POST /events → 202' '202' "${r[0]}" "${r[1]}"

# Verify settlements -> 200
readarray -t r < <(api GET "/services/${SERVICE_ID}/settlements")
assert_status 'GET /services/{id}/settlements → 200' '200' "${r[0]}" "${r[1]}"
TOTAL="$(jf "${r[1]}" '.total | tostring')"
assert_eq 'settlement count >= 1' '1' "$TOTAL"

# Verify webhook delivery visibility -> 200 and at least one lifecycle status
readarray -t r < <(api GET "/services/${SERVICE_ID}/webhook-deliveries")
assert_status 'GET /services/{id}/webhook-deliveries → 200' '200' "${r[0]}" "${r[1]}"
DELIVERY_STATUS="$(jf "${r[1]}" '.deliveries[0].status // empty')"
case "$DELIVERY_STATUS" in
  pending|failed|dead_lettered|delivered)
    log "  ${GREEN}[PASS]${NC} webhook delivery status is observable (${DELIVERY_STATUS})"
    PASSED=$((PASSED + 1))
    ;;
  *)
    log "  ${RED}[FAIL]${NC} webhook delivery status is observable"
    FAILED=$((FAILED + 1))
    ;;
esac
