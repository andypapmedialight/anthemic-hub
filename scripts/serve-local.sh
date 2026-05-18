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

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ -z "${FRED_API_KEY:-}" ]]; then
  echo "Tip: export FRED_API_KEY=… (or add to $ROOT/.env) for faster /economics/ valuation loads."
fi

if command -v python3 >/dev/null 2>&1; then
  export PORT BIND=127.0.0.1
  exec python3 "$ROOT/scripts/serve-hub.py"
elif command -v python >/dev/null 2>&1; then
  export PORT BIND=127.0.0.1
  exec python "$ROOT/scripts/serve-hub.py"
else
  echo "error: need python3 or python on PATH" >&2
  exit 1
fi
