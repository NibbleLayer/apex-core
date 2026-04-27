#!/usr/bin/env bash
# Helper to load .env file into current shell environment
# Usage: source ./scripts/load-env.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
  # Read .env and export variables, ignoring comments and empty lines
  while IFS='=' read -r key value <&3; do
    # Skip comments and empty lines
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    # Remove leading/trailing whitespace and quotes from value
    key="$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    # Only export if not already set in environment
    if [[ -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done 3<"$ENV_FILE"
fi
