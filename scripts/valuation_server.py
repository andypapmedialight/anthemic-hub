#!/usr/bin/env python3
"""Loopback-only API for Morning Macro valuation metrics (production systemd)."""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)
from valuation_fetch import METRICS, fetch_valuation_metric  # noqa: E402

BIND = os.environ.get("BIND", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8071"))
ALLOWED_METRICS = frozenset(METRICS)


class ValuationHandler(BaseHTTPRequestHandler):
    server_version = "MMD-Valuation/1.0"

    def log_message(self, fmt: str, *args) -> None:
        if args and isinstance(args[0], str) and args[0].startswith("GET /health"):
            return
        super().log_message(fmt, *args)

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path == "/health":
            self._json({"ok": True})
            return
        if path == "/valuation":
            self._valuation()
            return
        self.send_error(404)

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _valuation(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metric = qs.get("metric", [""])[0]
        if metric not in ALLOWED_METRICS:
            self.send_error(400, "Invalid metric")
            return
        try:
            self._json(fetch_valuation_metric(metric))
        except Exception as exc:
            self._json({"error": str(exc)}, status=502)


def main() -> None:
    httpd = HTTPServer((BIND, PORT), ValuationHandler)
    print(f"mmd-valuation listening on http://{BIND}:{PORT}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
