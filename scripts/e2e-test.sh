#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
API_BASE="${API_BASE:-http://localhost:3000}"
CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-}"
CONTAINER_NAME="${CONTAINER_NAME:-apex-api}"
API_KEY="${APEX_API_KEY:-}"
REQUEST_MODE="host"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  printf '%b\n' "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "${RED}ERROR:${NC} required command '$1' is missing."
    exit 1
  fi
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_header=()

  if [[ -n "$API_KEY" ]]; then
    auth_header=(-H "Authorization: Bearer ${API_KEY}")
  fi

  local response_file
  response_file="$(mktemp)"

  local status
  if [[ "$REQUEST_MODE" == "container" ]]; then
    local runtime
    runtime="$(detect_runtime)"
    local auth_value=""
    if [[ ${#auth_header[@]} -gt 0 ]]; then
      auth_value="Authorization: Bearer ${API_KEY}"
    fi

    status=$(
      "$runtime" exec \
        -e APEX_METHOD="$method" \
        -e APEX_URL="${url/localhost/127.0.0.1}" \
        -e APEX_BODY="$body" \
        -e APEX_AUTH_HEADER="$auth_value" \
        "$CONTAINER_NAME" \
        node -e "const headers={}; if (process.env.APEX_AUTH_HEADER) headers.Authorization=process.env.APEX_AUTH_HEADER.replace(/^Authorization:\\s*/, ''); if (process.env.APEX_BODY) headers['Content-Type']='application/json'; const options={method:process.env.APEX_METHOD, headers}; if (process.env.APEX_BODY) options.body=process.env.APEX_BODY; const response=await fetch(process.env.APEX_URL, options); const text=await response.text(); process.stdout.write(String(response.status)+'\\n'+text);" \
        > "$response_file"
    ) || status="000"

    if [[ "$status" == "000" ]]; then
      printf '000\n%s\n' "$response_file"
      return
    fi

    local actual_status
    actual_status="$(sed -n '1p' "$response_file")"
    local payload_file
    payload_file="$(mktemp)"
    sed '1d' "$response_file" > "$payload_file"
    rm -f "$response_file"
    printf '%s\n%s\n' "$actual_status" "$payload_file"
    return
  fi

  if [[ -n "$body" ]]; then
    status=$(curl -sS -o "$response_file" -w '%{http_code}' -X "$method" "${auth_header[@]}" -H 'Content-Type: application/json' -d "$body" "$url") || status="000"
  else
    status=$(curl -sS -o "$response_file" -w '%{http_code}' -X "$method" "${auth_header[@]}" "$url") || status="000"
  fi

  printf '%s\n%s\n' "$status" "$response_file"
}

expect_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  local response_file="$4"

  if [[ "$expected" != "$actual" ]]; then
    log "${RED}FAIL:${NC} ${label} (expected ${expected}, got ${actual})"
    jq . "$response_file" || true
    exit 1
  fi

  log "${GREEN}PASS:${NC} ${label}"
}

detect_runtime() {
  if [[ -n "$CONTAINER_RUNTIME" ]]; then
    printf '%s' "$CONTAINER_RUNTIME"
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    printf '%s' 'docker'
    return 0
  fi

  if command -v podman >/dev/null 2>&1 && podman container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    printf '%s' 'podman'
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    printf '%s' 'docker'
    return 0
  fi

  if command -v podman >/dev/null 2>&1; then
    printf '%s' 'podman'
    return 0
  fi

  return 1
}

resolve_api_key() {
  if [[ -n "$API_KEY" ]]; then
    return 0
  fi

  local runtime
  runtime="$(detect_runtime)"
  API_KEY="$($runtime logs "$CONTAINER_NAME" 2>&1 | sed -n 's/.*\(apex_[a-f0-9]\+\).*/\1/p' | head -n 1)"

  if [[ -z "$API_KEY" ]]; then
    log "${RED}ERROR:${NC} could not resolve an API key from ${CONTAINER_NAME} logs."
    log "${YELLOW}Tip:${NC} export APEX_API_KEY explicitly and retry."
    exit 1
  fi
}

wait_for_api() {
  local attempt=1
  while [[ "$attempt" -le 30 ]]; do
    if curl -sS -o /tmp/apex-e2e-health.json -w '%{http_code}' "${API_BASE}/health" >/dev/null 2>&1; then
      rm -f /tmp/apex-e2e-health.json
      REQUEST_MODE="host"
      return 0
    fi

    if runtime=$(detect_runtime 2>/dev/null); then
      if "$runtime" exec "$CONTAINER_NAME" node -e "const response=await fetch('http://127.0.0.1:3000/health'); process.exit(response.ok ? 0 : 1);" >/dev/null 2>&1; then
        REQUEST_MODE="container"
        return 0
      fi
    fi

    sleep 1
    attempt=$((attempt + 1))
  done

  return 1
}

json_field() {
  local file="$1"
  local expr="$2"
  jq -r "$expr" "$file"
}

cleanup_file() {
  rm -f "$1"
}

require_cmd curl
require_cmd jq
require_cmd sed
require_cmd head

log "${CYAN}Apex minimal self-host e2e${NC}"
log "Workspace: ${ROOT_DIR}"

if ! wait_for_api; then
  log "${RED}ERROR:${NC} API did not become reachable via host or container transport."
  exit 1
fi

log "Using ${REQUEST_MODE} request transport."

readarray -t login_result < <(request_json POST "${API_BASE}/auth/login" '{"api_key":"invalid"}')
expect_status 'auth endpoint is reachable' '401' "${login_result[0]}" "${login_result[1]}"
cleanup_file "${login_result[1]}"

resolve_api_key

readarray -t auth_result < <(request_json POST "${API_BASE}/auth/login" "{\"api_key\":\"${API_KEY}\"}")
expect_status 'login succeeds with resolved API key' '200' "${auth_result[0]}" "${auth_result[1]}"
ORG_ID="$(json_field "${auth_result[1]}" '.organization_id')"
cleanup_file "${auth_result[1]}"

SUFFIX="$(date +%s)"

readarray -t service_result < <(request_json POST "${API_BASE}/services" "{\"name\":\"E2E Weather\",\"slug\":\"e2e-weather-${SUFFIX}\",\"description\":\"minimal e2e service\"}")
expect_status 'service creation succeeds' '201' "${service_result[0]}" "${service_result[1]}"
SERVICE_ID="$(json_field "${service_result[1]}" '.id')"
cleanup_file "${service_result[1]}"

readarray -t env_result < <(request_json POST "${API_BASE}/services/${SERVICE_ID}/environments" '{"mode":"test","network":"eip155:84532","facilitatorUrl":"https://x402.org/facilitator"}')
expect_status 'test environment creation succeeds' '201' "${env_result[0]}" "${env_result[1]}"
ENV_ID="$(json_field "${env_result[1]}" '.id')"
cleanup_file "${env_result[1]}"

readarray -t wallet_result < <(request_json POST "${API_BASE}/services/${SERVICE_ID}/wallets" "{\"environmentId\":\"${ENV_ID}\",\"address\":\"0x1234567890abcdef1234567890abcdef12345678\",\"token\":\"native\",\"network\":\"eip155:84532\",\"label\":\"Primary wallet\"}")
expect_status 'wallet creation succeeds' '201' "${wallet_result[0]}" "${wallet_result[1]}"
cleanup_file "${wallet_result[1]}"

readarray -t route_result < <(request_json POST "${API_BASE}/services/${SERVICE_ID}/routes" '{"method":"GET","path":"/weather","description":"weather endpoint","enabled":true}')
expect_status 'route creation succeeds' '201' "${route_result[0]}" "${route_result[1]}"
ROUTE_ID="$(json_field "${route_result[1]}" '.id')"
cleanup_file "${route_result[1]}"

readarray -t pricing_result < <(request_json POST "${API_BASE}/routes/${ROUTE_ID}/pricing" '{"scheme":"exact","amount":"\u00240.01","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","network":"eip155:84532"}')
expect_status 'price rule creation succeeds' '201' "${pricing_result[0]}" "${pricing_result[1]}"
cleanup_file "${pricing_result[1]}"

readarray -t manifest_result < <(request_json GET "${API_BASE}/services/${SERVICE_ID}/manifest?env=test")
expect_status 'manifest generation succeeds' '200' "${manifest_result[0]}" "${manifest_result[1]}"
expect_status 'manifest contains generated route' 'GET /weather' "$(json_field "${manifest_result[1]}" '.routes | keys[0]')" "${manifest_result[1]}"
cleanup_file "${manifest_result[1]}"

readarray -t webhook_result < <(request_json POST "${API_BASE}/services/${SERVICE_ID}/webhooks" '{"url":"https://example.com/hooks/apex","enabled":true}')
expect_status 'webhook creation succeeds' '201' "${webhook_result[0]}" "${webhook_result[1]}"
cleanup_file "${webhook_result[1]}"

readarray -t event_result < <(request_json POST "${API_BASE}/events" "{\"serviceId\":\"${SERVICE_ID}\",\"routeId\":\"${ROUTE_ID}\",\"type\":\"payment.settled\",\"requestId\":\"req-${SUFFIX}\",\"amount\":\"\\u00240.01\",\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"network\":\"eip155:84532\",\"settlementReference\":\"0xsettled\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
expect_status 'event ingestion succeeds' '202' "${event_result[0]}" "${event_result[1]}"
cleanup_file "${event_result[1]}"

readarray -t settlements_result < <(request_json GET "${API_BASE}/services/${SERVICE_ID}/settlements")
expect_status 'settlement listing succeeds' '200' "${settlements_result[0]}" "${settlements_result[1]}"
expect_status 'settlement count is positive' '1' "$(json_field "${settlements_result[1]}" '.total | tostring')" "${settlements_result[1]}"
cleanup_file "${settlements_result[1]}"

log "${GREEN}Minimal self-host e2e completed successfully for organization ${ORG_ID}.${NC}"
