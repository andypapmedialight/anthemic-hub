#!/usr/bin/env bash
# Serve anthemic-hub static files over HTTP so paths like /bass/ behave like production.
# Usage: ./scripts/serve-local.sh
#        PORT=9000 ./scripts/serve-local.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8000}"
cd "$ROOT"

echo "Anthemic hub root: $ROOT"
echo "Open http://127.0.0.1:${PORT}/  (Ctrl+C to stop)"

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server -b 127.0.0.1 "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server -b 127.0.0.1 "$PORT"
else
  echo "error: need python3 or python on PATH" >&2
  exit 1
fi
