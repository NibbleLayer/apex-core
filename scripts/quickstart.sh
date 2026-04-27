#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(git rev-parse --show-toplevel)"

# Load .env if present
source "${ROOT_DIR}/scripts/load-env.sh" 2>/dev/null || true

API_BASE="http://localhost:3000"

# Check if pnpm dev is running
if ! curl -sSf "${API_BASE}/health" >/dev/null 2>&1; then
  echo -e "${YELLOW}Apex API is not running. Start it first with:${NC}"
  echo "  export DATABASE_URL='postgresql://apex:apex_dev@localhost:5433/apex_dev'"
  echo "  pnpm dev"
  exit 1
fi

# Read the API key from seed file
API_KEY_FILE="${ROOT_DIR}/.apex-seed-key"
if [[ ! -f "$API_KEY_FILE" ]]; then
  echo -e "${YELLOW}No API key found. Run 'pnpm seed' first.${NC}"
  exit 1
fi
API_KEY="$(<"$API_KEY_FILE")"

echo -e "${BLUE}=== Apex Quickstart Demo ===${NC}"
echo "Creating a demo service with pricing, wallet, and SDK token..."

# Helper function
api() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" -d "$body" "${API_BASE}${path}"
  else
    curl -sS -X "$method" -H "Authorization: Bearer ${API_KEY}" "${API_BASE}${path}"
  fi
}

# Create service
SERVICE="$(api POST /services '{"name":"Demo Weather API","slug":"demo-weather","description":"Quickstart demo service"}')"
SERVICE_ID="$(echo "$SERVICE" | jq -r '.id')"

# Create environment
ENV="$(api POST "/services/${SERVICE_ID}/environments" '{"mode":"test","network":"eip155:84532","facilitatorUrl":"https://x402.org/facilitator"}')"
ENV_ID="$(echo "$ENV" | jq -r '.id')"

# Create wallet
api POST "/services/${SERVICE_ID}/wallets" "{\"environmentId\":\"${ENV_ID}\",\"address\":\"0x1234567890abcdef1234567890abcdef12345678\",\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"network\":\"eip155:84532\",\"label\":\"Demo wallet\"}" >/dev/null

# Create route
ROUTE="$(api POST "/services/${SERVICE_ID}/routes" '{"method":"GET","path":"/weather","description":"Get weather data","enabled":true}')"
ROUTE_ID="$(echo "$ROUTE" | jq -r '.id')"

# Create pricing
api POST "/routes/${ROUTE_ID}/pricing" '{"scheme":"exact","amount":"$0.01","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","network":"eip155:84532"}' >/dev/null

# Create SDK token
TOKEN_RESPONSE="$(api POST "/services/${SERVICE_ID}/sdk-tokens" '{"environment":"test","label":"Demo SDK","scopes":["manifest:read","events:write"]}')"
SDK_TOKEN="$(echo "$TOKEN_RESPONSE" | jq -r '.token')"

echo ""
echo -e "${GREEN}\u2705 Demo setup complete!${NC}"
echo ""
echo -e "${BLUE}Service ID:${NC}  ${SERVICE_ID}"
echo -e "${BLUE}Route:${NC}       GET /weather"
echo -e "${BLUE}Price:${NC}       $0.01"
echo -e "${BLUE}SDK Token:${NC}   ${SDK_TOKEN}"
echo ""
echo "Open the dashboard to see your service:"
echo "  http://localhost:5173/services/${SERVICE_ID}"
echo ""
echo "Example SDK usage:"
echo "  import { apex } from '@nibblelayer/apex-hono';"
echo "  app.use('/weather', apex({ token: '${SDK_TOKEN}', apexUrl: 'http://localhost:3000' }));"
