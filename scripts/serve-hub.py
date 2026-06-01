#!/usr/bin/env python3
"""Static hub server with CORS proxy for /economics/ (Morning Macro).

Usage: python3 scripts/serve-hub.py
       PORT=8000 python3 scripts/serve-hub.py

Proxy: GET /economics/proxy/yahoo?sym=^GSPC&range=5d
       GET /economics/proxy/fred?id=DGS2&start=2026-04-01
       GET /economics/proxy/google?path=AAPL:NASDAQ
       GET /economics/proxy/valuation?metric=margin-debt
       GET /economics/proxy/valuation/health
       GET /economics/proxy/multilateral?metric=oecd-cli-au
       GET /economics/proxy/multilateral/history?metric=imf-gdp-au&days=1825
       GET /economics/proxy/fred/health
"""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)
from multilateral_fetch import (  # noqa: E402
    METRICS as MULTILATERAL_METRICS,
    fetch_multilateral_batch,
    fetch_multilateral_history,
    fetch_multilateral_metric,
    warm_multilateral_cache,
)
from valuation_fetch import (  # noqa: E402
    FRESHNESS_FRED_SERIES,
    METRICS,
    fetch_fred_observations_proxy,
    fetch_freshness_api,
    fetch_valuation_batch,
    fetch_valuation_history,
    fetch_valuation_metric,
    VALUATION_HISTORY_METRICS,
    fred_last_observation,
    warm_mmd_cache,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8000"))
BIND = os.environ.get("BIND", "127.0.0.1")

ALLOWED_HOSTS = (
    "query1.finance.yahoo.com",
    "fred.stlouisfed.org",
    "api.stlouisfed.org",
    "www.google.com",
)

FRED_API_KEY = ""
UPSTREAM_TIMEOUT = int(os.environ.get("MMD_UPSTREAM_TIMEOUT", "45"))
FRED_PROXY_CACHE_TTL = 300
_fred_proxy_cache: dict[tuple[str, str], tuple[float, bytes, str]] = {}


def _parse_dotenv_pair(line: str) -> tuple[str, str] | None:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    if line.startswith("export "):
        line = line[7:].strip()
    if "=" not in line:
        return None
    key, val = line.split("=", 1)
    key = key.strip().lstrip("\ufeff")
    val = val.strip().strip("'\"").strip("\r\n")
    return key, val


def load_hub_env() -> bool:
    """Load FRED_API_KEY from the environment or repo-root .env. Returns True if set."""
    global FRED_API_KEY
    env_key = os.environ.get("FRED_API_KEY", "").strip().strip("\r")
    if env_key:
        FRED_API_KEY = env_key
        return True

    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        FRED_API_KEY = ""
        return False
    try:
        with open(path, encoding="utf-8") as fh:
            for raw in fh:
                pair = _parse_dotenv_pair(raw)
                if not pair or pair[0] != "FRED_API_KEY":
                    continue
                if pair[1]:
                    FRED_API_KEY = pair[1]
                    os.environ["FRED_API_KEY"] = pair[1]
                break
    except OSError:
        FRED_API_KEY = ""
    return bool(FRED_API_KEY)


load_hub_env()

VAL_WARM_FRED_SERIES = (
    "GDP",
    "GDPNOW",
    "NCBEILQ027S",
    "GFDEGDQ188S",
    "GFDEBTN",
    "TCMDO",
    "FGSDODNS",
    "MVMTD027MNFRBDAL",
    "DGS2",
    "DGS10",
)

def _prime_fred_proxy_cache(series_id: str, start: str = "2020-01-01") -> None:
    """Populate FRED proxy cache (same payloads clients request)."""
    cache_key = (series_id, start)
    if cache_key in _fred_proxy_cache:
        cached = _fred_proxy_cache[cache_key]
        if time.time() - cached[0] < FRED_PROXY_CACHE_TTL:
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
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
                ),
                "Accept": "application/json, text/csv, text/plain, */*",
            },
        )
        with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
            body = resp.read()
            ct = resp.headers.get("Content-Type", "application/octet-stream")
        _fred_proxy_cache[cache_key] = (time.time(), body, ct)
    except Exception:
        pass


def _warm_hub_cache() -> None:
    if os.environ.get("MMD_SKIP_WARM", "").strip().lower() in ("1", "true", "yes"):
        return

    def run() -> None:
        try:
            warm_mmd_cache()
            warm_multilateral_cache()
            card_start = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 800 * 86400))
            for sid in VAL_WARM_FRED_SERIES:
                _prime_fred_proxy_cache(sid, card_start)
        except Exception:
            pass

    threading.Thread(target=run, daemon=True, name="hub-warm").start()


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
        if path == "/economics/proxy/fred/health":
            self._send_json({"ok": True})
            return
        if path == "/economics/proxy/fred":
            self._proxy_fred()
            return
        if path == "/economics/proxy/google":
            self._proxy_google()
            return
        if path == "/economics/proxy/valuation/health":
            self._send_json({"ok": True})
            return
        if path == "/economics/proxy/valuation":
            self._proxy_valuation()
            return
        if path == "/economics/proxy/valuation/history":
            self._proxy_valuation_history()
            return
        if path == "/economics/proxy/multilateral/health":
            self._send_json({"ok": True})
            return
        if path == "/economics/proxy/multilateral/history":
            self._proxy_multilateral_history()
            return
        if path == "/economics/proxy/multilateral":
            self._proxy_multilateral()
            return
        if path == "/economics/api/freshness":
            self._freshness_api()
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

    def send_error(self, code, message=None, explain=None):
        try:
            super().send_error(code, message, explain)
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

    def _freshness_api(self) -> None:
        self._send_json(fetch_freshness_api(FRED_API_KEY))

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self._safe_write(body)

    def _proxy_multilateral(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metrics_raw = qs.get("metrics", [""])[0]
        if metrics_raw:
            ids = [m.strip() for m in metrics_raw.split(",") if m.strip()]
            bad = [m for m in ids if m not in MULTILATERAL_METRICS]
            if bad:
                self.send_error(400, f"Invalid metrics: {', '.join(bad)}")
                return
            try:
                self._send_json({"metrics": fetch_multilateral_batch(ids)})
            except Exception as e:
                self._send_json({"error": str(e)}, status=502)
            return
        metric = qs.get("metric", [""])[0]
        if metric not in MULTILATERAL_METRICS:
            self.send_error(400, "Invalid metric")
            return
        try:
            self._send_json(fetch_multilateral_metric(metric))
        except Exception as e:
            self._send_json({"error": str(e)}, status=502)

    def _proxy_multilateral_history(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metric = qs.get("metric", [""])[0]
        if metric not in MULTILATERAL_METRICS:
            self.send_error(400, "Invalid metric")
            return
        days_raw = qs.get("days", ["1825"])[0]
        try:
            days = max(30, min(20 * 365, int(days_raw)))
        except ValueError:
            days = 1825
        try:
            self._send_json({"metric": metric, "series": fetch_multilateral_history(metric, days=days)})
        except Exception as e:
            self._send_json({"error": str(e)}, status=502)

    def _proxy_valuation(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metrics_raw = qs.get("metrics", [""])[0]
        if metrics_raw:
            ids = [m.strip() for m in metrics_raw.split(",") if m.strip()]
            bad = [m for m in ids if m not in METRICS]
            if bad:
                self.send_error(400, f"Invalid metrics: {', '.join(bad)}")
                return
            try:
                self._send_json({"metrics": fetch_valuation_batch(ids)})
            except Exception as e:
                self._send_json({"error": str(e)}, status=502)
            return
        metric = qs.get("metric", [""])[0]
        if metric not in METRICS:
            self.send_error(400, "Invalid metric")
            return
        try:
            data = fetch_valuation_metric(metric)
            self._send_json(data)
        except Exception as e:
            self._send_json({"error": str(e)}, status=502)

    def _proxy_valuation_history(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metric = qs.get("metric", [""])[0]
        if metric not in VALUATION_HISTORY_METRICS:
            self.send_error(400, "Invalid metric")
            return
        days_raw = qs.get("days", ["1825"])[0]
        try:
            days = max(30, min(20 * 365, int(days_raw)))
        except ValueError:
            days = 1825
        try:
            self._send_json({"metric": metric, "series": fetch_valuation_history(metric, days=days)})
        except Exception as e:
            self._send_json({"error": str(e)}, status=502)

    def _send_cached_body(self, body: bytes, content_type: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self._safe_write(body)

    def _proxy_fred(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        series_id = qs.get("id", [""])[0]
        start = qs.get("start", [""])[0] or "2020-01-01"
        limit_raw = qs.get("limit", [""])[0]
        order = qs.get("order", ["asc"])[0] or "asc"
        try:
            limit = max(2, min(5000, int(limit_raw))) if limit_raw else 5000
        except ValueError:
            limit = 5000
        if not series_id or not _FRED_ID_RE.match(series_id):
            self.send_error(400, "Invalid id")
            return

        status, body, ct = fetch_fred_observations_proxy(
            series_id,
            start,
            limit=limit,
            sort_order=order,
        )
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self._safe_write(body)

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and "/economics/proxy/" in args[0]:
            return
        super().log_message(fmt, *args)


def main():
    load_hub_env()
    os.chdir(ROOT)
    env_path = os.path.join(ROOT, ".env")
    httpd = HTTPServer((BIND, PORT), HubHandler)
    print(f"Anthemic hub: http://{BIND}:{PORT}/")
    print(f"Morning Macro: http://{BIND}:{PORT}/economics/")
    print(f"CORS proxy:    http://{BIND}:{PORT}/economics/proxy/yahoo?sym=…")
    print(f"Google proxy:  http://{BIND}:{PORT}/economics/proxy/google?path=AAPL:NASDAQ")
    print(f"Valuation API: http://{BIND}:{PORT}/economics/proxy/valuation?metric=margin-debt")
    print(f"Valuation ping: http://{BIND}:{PORT}/economics/proxy/valuation/health")
    print(f"Multilateral:  http://{BIND}:{PORT}/economics/proxy/multilateral?metric=oecd-cli-au")
    print(f"Multilateral:  http://{BIND}:{PORT}/economics/proxy/multilateral/health")
    if FRED_API_KEY:
        print(f"FRED proxy:    api.stlouisfed.org (key loaded, {len(FRED_API_KEY)} chars)")
    else:
        print(f"FRED proxy:    fredgraph CSV (slow)")
        print(f"               Set FRED_API_KEY in {env_path} or the environment, then restart.")
    print(f"FRED health:   http://{BIND}:{PORT}/economics/proxy/fred/health")
    print(f"Freshness API: http://{BIND}:{PORT}/economics/api/freshness")
    _warm_hub_cache()
    if os.environ.get("MMD_SKIP_WARM", "").strip().lower() not in ("1", "true", "yes"):
        print("Warm cache:    background FRED + valuation prefetch started")
    print()
    httpd.serve_forever()


if __name__ == "__main__":
    main()
