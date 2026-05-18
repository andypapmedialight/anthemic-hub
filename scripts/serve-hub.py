#!/usr/bin/env python3
"""Static hub server with CORS proxy for /economics/ (Morning Macro).

Usage: python3 scripts/serve-hub.py
       PORT=8000 python3 scripts/serve-hub.py

Proxy: GET /economics/proxy/yahoo?sym=^GSPC&range=5d
       GET /economics/proxy/fred?id=DGS2&start=2026-04-01
       GET /economics/proxy/google?path=AAPL:NASDAQ
"""
from __future__ import annotations

import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8000"))
BIND = os.environ.get("BIND", "127.0.0.1")

ALLOWED_HOSTS = (
    "query1.finance.yahoo.com",
    "fred.stlouisfed.org",
    "api.stlouisfed.org",
    "www.google.com",
)

FRED_API_KEY = os.environ.get("FRED_API_KEY", "").strip()
UPSTREAM_TIMEOUT = int(os.environ.get("MMD_UPSTREAM_TIMEOUT", "25"))

_SYM_RE = re.compile(r"^[%^A-Za-z0-9=.\-]+$")
_FRED_ID_RE = re.compile(r"^[A-Z0-9]+$")
_GF_PATH_RE = re.compile(r"^[A-Za-z0-9.^=:\-]+$")


class HubHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/economics/proxy/yahoo":
            self._proxy_yahoo()
            return
        if path == "/economics/proxy/fred":
            self._proxy_fred()
            return
        if path == "/economics/proxy/google":
            self._proxy_google()
            return
        if path.startswith("/.well-known/"):
            self.send_error(404)
            return
        super().do_GET()

    def _send_upstream(self, url: str) -> None:
        parsed = urllib.parse.urlparse(url)
        if parsed.hostname not in ALLOWED_HOSTS:
            self.send_error(403, "Host not allowed")
            return
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
                    ),
                    "Accept": "application/json, text/csv, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "no-cache",
                },
            )
            with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
                body = resp.read()
                ct = resp.headers.get("Content-Type", "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self._safe_write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self._safe_write(body)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self._safe_write(msg)

    def _safe_write(self, data: bytes) -> None:
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _proxy_yahoo(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        sym = qs.get("sym", [""])[0]
        yrange = qs.get("range", ["5d"])[0] or "5d"
        interval = qs.get("interval", ["1d"])[0] or "1d"
        if not sym or not _SYM_RE.match(sym):
            self.send_error(400, "Invalid sym")
            return
        if interval not in ("1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"):
            interval = "1d"
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{urllib.parse.quote(sym, safe='')}"
            f"?interval={urllib.parse.quote(interval, safe='')}"
            f"&range={urllib.parse.quote(yrange, safe='')}"
        )
        self._send_upstream(url)

    def _proxy_google(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        gf_path = qs.get("path", [""])[0]
        if not gf_path or not _GF_PATH_RE.match(gf_path):
            self.send_error(400, "Invalid path")
            return
        url = f"https://www.google.com/finance/quote/{urllib.parse.quote(gf_path, safe='')}"
        self._send_upstream(url)

    def _proxy_fred(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        series_id = qs.get("id", [""])[0]
        start = qs.get("start", [""])[0] or "2020-01-01"
        if not series_id or not _FRED_ID_RE.match(series_id):
            self.send_error(400, "Invalid id")
            return
        if FRED_API_KEY:
            url = (
                "https://api.stlouisfed.org/fred/series/observations"
                f"?series_id={urllib.parse.quote(series_id)}"
                f"&file_type=json&sort_order=asc"
                f"&observation_start={urllib.parse.quote(start)}"
                f"&api_key={urllib.parse.quote(FRED_API_KEY)}"
            )
        else:
            url = (
                "https://fred.stlouisfed.org/graph/fredgraph.csv"
                f"?id={urllib.parse.quote(series_id)}&observation_start={urllib.parse.quote(start)}"
            )
        self._send_upstream(url)

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and "/economics/proxy/" in args[0]:
            return
        super().log_message(fmt, *args)


def main():
    os.chdir(ROOT)
    httpd = HTTPServer((BIND, PORT), HubHandler)
    print(f"Anthemic hub: http://{BIND}:{PORT}/")
    print(f"Morning Macro: http://{BIND}:{PORT}/economics/")
    print(f"CORS proxy:    http://{BIND}:{PORT}/economics/proxy/yahoo?sym=…")
    print(f"Google proxy:  http://{BIND}:{PORT}/economics/proxy/google?path=AAPL:NASDAQ")
    if FRED_API_KEY:
        print("FRED proxy:    api.stlouisfed.org (FRED_API_KEY set)")
    else:
        print(
            "FRED proxy:    fredgraph CSV (slow; set FRED_API_KEY for reliable valuation data)"
        )
    print()
    httpd.serve_forever()


if __name__ == "__main__":
    main()
