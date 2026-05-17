#!/usr/bin/env python3
"""Static hub server with CORS proxy for /economics/ (Morning Macro).

Usage: python3 scripts/serve-hub.py
       PORT=8000 python3 scripts/serve-hub.py

Proxy: GET /economics/proxy?url=<https://...>  (also /proxy?url= for legacy)
"""
from __future__ import annotations

import os
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
)


class HubHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/proxy", "/economics/proxy"):
            self._proxy()
            return
        if path.startswith("/.well-known/"):
            self.send_error(404)
            return
        super().do_GET()

    def _proxy(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        url = qs.get("url", [""])[0]
        if not url:
            self.send_error(400, "Missing url parameter")
            return
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            self.send_error(400, "Invalid url")
            return
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
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read()
                ct = resp.headers.get("Content-Type", "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and "/proxy?" in args[0]:
            return
        super().log_message(fmt, *args)


def main():
    os.chdir(ROOT)
    httpd = HTTPServer((BIND, PORT), HubHandler)
    print(f"Anthemic hub: http://{BIND}:{PORT}/")
    print(f"Morning Macro: http://{BIND}:{PORT}/economics/")
    print(f"CORS proxy:    http://{BIND}:{PORT}/economics/proxy?url=…\n")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
