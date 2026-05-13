#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"
force_load_repo_env

API_BASE="${API_BASE:-http://localhost:3000}"
API_KEY_FILE="${APEX_ROOT_DIR}/.apex-seed-key"

api_request() {
  local method="$1" path="$2" body="${3:-}"
  local response status payload

  if [[ -n "$body" ]]; then
    response="$(curl -sS -X "$method" -H "Authorization: Bearer ${API_KEY}" -H 'Content-Type: application/json' -d "$body" -w $'\n%{http_code}' "${API_BASE}${path}")"
  else
    response="$(curl -sS -X "$method" -H "Authorization: Bearer ${API_KEY}" -w $'\n%{http_code}' "${API_BASE}${path}")"
  fi

  status="${response##*$'\n'}"
  payload="${response%$'\n'*}"

  if [[ ! "$status" =~ ^2 ]]; then
    error "ERROR: Demo API request failed (${status}) for ${method} ${path}."
    log "$payload"
    exit 1
  fi

  printf '%s' "$payload"
}

if ! command -v curl >/dev/null 2>&1; then
  error 'ERROR: curl is required to create demo sample data.'
  exit 1
fi

if ! wait_for_http_ok "${API_BASE}/health" 30; then
  error "ERROR: Apex API is not reachable at ${API_BASE}. Start the stack first."
  exit 1
fi

if [[ ! -f "$API_KEY_FILE" ]]; then
  error "ERROR: ${API_KEY_FILE} is missing. Run the onboarding seed first."
  exit 1
fi

API_KEY="$(<"$API_KEY_FILE")"
SLUG_SUFFIX="$(date +%s)"
SERVICE_NAME="Demo Weather API"
SERVICE_SLUG="demo-weather-${SLUG_SUFFIX}"

info 'Adding optional demo service data...'

SERVICE="$(api_request POST /services "{\"name\":\"${SERVICE_NAME}\",\"slug\":\"${SERVICE_SLUG}\",\"description\":\"Quickstart demo service\"}")"
SERVICE_ID="$(json_get "$SERVICE" id)"

ENVIRONMENT="$(api_request POST "/services/${SERVICE_ID}/environments" '{"mode":"test","networkProfileId":"base-sepolia"}')"
ENV_ID="$(json_get "$ENVIRONMENT" id)"

api_request POST "/services/${SERVICE_ID}/wallets" "{\"environmentId\":\"${ENV_ID}\",\"address\":\"0x1234567890abcdef1234567890abcdef12345678\",\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"network\":\"eip155:84532\",\"label\":\"Demo wallet\"}" >/dev/null

ROUTE="$(api_request POST "/services/${SERVICE_ID}/routes" '{"method":"GET","path":"/weather","description":"Get weather data","enabled":true}')"
ROUTE_ID="$(json_get "$ROUTE" id)"

api_request POST "/routes/${ROUTE_ID}/pricing" '{"scheme":"exact","amount":"$0.01","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","network":"eip155:84532"}' >/dev/null

TOKEN_RESPONSE="$(api_request POST "/services/${SERVICE_ID}/sdk-tokens" '{"environment":"test","label":"Demo SDK","scopes":["manifest:read","events:write"]}')"
SDK_TOKEN="$(json_get "$TOKEN_RESPONSE" token)"

success '✅ Demo sample data is ready.'
log "  ${GREEN}Service:${NC}    ${SERVICE_NAME}"
log "  ${GREEN}Slug:${NC}       ${SERVICE_SLUG}"
log "  ${GREEN}Dashboard:${NC}  http://localhost:5173/services/${SERVICE_ID}"
log "  ${GREEN}SDK token:${NC}  ${SDK_TOKEN}"
