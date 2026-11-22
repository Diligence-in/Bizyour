#!/bin/bash
# Runs the browser flows against a fresh, throwaway demo database.
# Needs: Node 22+, Python 3 with Playwright (pip install playwright && playwright install chromium).
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$(mktemp -d)"
PORT=4100
SHOTS="${1:-$DATA/shots}"
mkdir -p "$SHOTS"
cd "$ROOT/backend"
BOS_DATA_DIR="$DATA" node seed-demo.js >/dev/null 2>&1
BOS_DATA_DIR="$DATA" node seed-mart-demo.js >/dev/null 2>&1
BOS_DATA_DIR="$DATA" PORT=$PORT RATE_LIMIT_DISABLED=1 node server.js >"$DATA/server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$DATA"' EXIT
for i in $(seq 1 30); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 0.3; done
python3 -I "$ROOT/web/e2e/flows.py" "http://localhost:$PORT" "$SHOTS" && { kill $SRV; rm -f "$DATA"/*.db*; BOS_DATA_DIR="$DATA" node seed-demo.js >/dev/null 2>&1; BOS_DATA_DIR="$DATA" node seed-mart-demo.js >/dev/null 2>&1; BOS_DATA_DIR="$DATA" PORT=$PORT RATE_LIMIT_DISABLED=1 node server.js >>"$DATA/server.log" 2>&1 & SRV=$!; for i in $(seq 1 30); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 0.3; done; python3 -I "$ROOT/web/e2e/mart_flows.py" "http://localhost:$PORT" "$SHOTS" && python3 -I "$ROOT/web/e2e/auth_flows.py" "http://localhost:$PORT" "$SHOTS" "$DATA/server.log" && python3 -I "$ROOT/web/e2e/screens_flows.py" "http://localhost:$PORT" "$SHOTS"; }
