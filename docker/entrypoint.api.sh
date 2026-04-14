#!/bin/sh
set -e

# ==========================================================================
# Apex API entrypoint
# 1. Wait for PostgreSQL (schema already pushed by init-db service)
# 2. Execute the API server (CMD)
# ==========================================================================

PG_HOST="${PGHOST:-postgres}"
PG_PORT="${PGPORT:-5432}"

echo "=== Apex API ==="

# ---- 1. Wait for PostgreSQL ----
echo "[api] Waiting for PostgreSQL at ${PG_HOST}:${PG_PORT} ..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if node -e "
      const net = require('net');
      const sock = net.createConnection(${PG_PORT}, '${PG_HOST}', () => { sock.end(); process.exit(0); });
      sock.on('error', () => { process.exit(1); });
      sock.setTimeout(2000, () => { sock.destroy(); process.exit(1); });
    " 2>/dev/null; then
        echo "[api] PostgreSQL is reachable."
        break
    fi
    attempt=$((attempt + 1))
    echo "[api] Attempt ${attempt}/${max_attempts} — retrying in 2s ..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "[api] ERROR: PostgreSQL not reachable after ${max_attempts} attempts."
    exit 1
fi

# ---- 2. Exec CMD ----
echo "[api] Starting API server ..."
exec "$@"
