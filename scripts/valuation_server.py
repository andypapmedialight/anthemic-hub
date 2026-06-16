#!/usr/bin/env python3
"""Loopback-only API for Morning Macro valuation metrics (production systemd)."""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)
from valuation_fetch import (  # noqa: E402
    METRICS,
    MULTILATERAL_METRICS,
    fetch_fred_observations_proxy,
    fetch_freshness_api,
    fetch_freshness_deploy_probe,
    fetch_multilateral_batch,
    fetch_multilateral_history,
    fetch_multilateral_metric,
    fetch_valuation_batch,
    fetch_valuation_history,
    fetch_valuation_metric,
    VALUATION_HISTORY_METRICS,
    warm_mmd_cache,
    warm_multilateral_cache,
)

BIND = os.environ.get("BIND", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8071"))
ALLOWED_METRICS = frozenset(METRICS)
ALLOWED_MULTILATERAL = frozenset(MULTILATERAL_METRICS)

from treasury_fetch import TREASURY_METRICS, fetch_treasury_metric  # noqa: E402

ALLOWED_TREASURY = frozenset(TREASURY_METRICS)


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


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
        if path == "/freshness":
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            deploy = qs.get("deploy", [""])[0].strip().lower() in ("1", "true", "yes")
            if deploy:
                self._json(fetch_freshness_deploy_probe())
                return
            force = qs.get("force", [""])[0].strip().lower() in ("1", "true", "yes")
            core_only = qs.get("core", [""])[0].strip().lower() in ("1", "true", "yes")
            self._json(fetch_freshness_api(force=force, core_only=core_only))
            return
        if path == "/fred":
            self._fred_observations()
            return
        if path == "/valuation":
            self._valuation()
            return
        if path == "/valuation/history":
            self._valuation_history()
            return
        if path == "/multilateral/health":
            self._json({"ok": True})
            return
        if path == "/multilateral/history":
            self._multilateral_history()
            return
        if path == "/multilateral":
            self._multilateral()
            return
        if path == "/treasury/health":
            self._json({"ok": True})
            return
        if path == "/treasury":
            self._treasury()
            return
        self.send_error(404)

    def _fred_observations(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        series_id = qs.get("id", [""])[0].strip()
        start = qs.get("start", ["2020-01-01"])[0].strip() or "2020-01-01"
        limit_raw = qs.get("limit", ["5000"])[0].strip()
        order = qs.get("order", ["asc"])[0].strip() or "asc"
        try:
            limit = int(limit_raw) if limit_raw else 5000
        except ValueError:
            limit = 5000
        status, body, ct = fetch_fred_observations_proxy(
            series_id,
            start,
            limit=limit,
            sort_order=order,
        )
        self.send_response(status)
        self.send_header("Content-Type", ct)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

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

    def _multilateral(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metrics_raw = qs.get("metrics", [""])[0]
        if metrics_raw:
            ids = [m.strip() for m in metrics_raw.split(",") if m.strip()]
            bad = [m for m in ids if m not in ALLOWED_MULTILATERAL]
            if bad:
                self.send_error(400, f"Invalid metrics: {', '.join(bad)}")
                return
            try:
                self._json({"metrics": fetch_multilateral_batch(ids)})
            except Exception as exc:
                self._json({"error": str(exc)}, status=502)
            return
        metric = qs.get("metric", [""])[0]
        if metric not in ALLOWED_MULTILATERAL:
            self.send_error(400, "Invalid metric")
            return
        try:
            self._json(fetch_multilateral_metric(metric))
        except Exception as exc:
            self._json({"error": str(exc)}, status=502)

    def _multilateral_history(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metric = qs.get("metric", [""])[0]
        if metric not in ALLOWED_MULTILATERAL:
            self.send_error(400, "Invalid metric")
            return
        days_raw = qs.get("days", ["1825"])[0]
        try:
            days = max(30, min(20 * 365, int(days_raw)))
        except ValueError:
            days = 1825
        try:
            self._json({"metric": metric, "series": fetch_multilateral_history(metric, days=days)})
        except Exception as exc:
            self._json({"error": str(exc)}, status=502)

    def _valuation(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metrics_raw = qs.get("metrics", [""])[0]
        if metrics_raw:
            ids = [m.strip() for m in metrics_raw.split(",") if m.strip()]
            bad = [m for m in ids if m not in ALLOWED_METRICS]
            if bad:
                self.send_error(400, f"Invalid metrics: {', '.join(bad)}")
                return
            try:
                self._json({"metrics": fetch_valuation_batch(ids)})
            except Exception as exc:
                self._json({"error": str(exc)}, status=502)
            return
        metric = qs.get("metric", [""])[0]
        if metric not in ALLOWED_METRICS:
            self.send_error(400, "Invalid metric")
            return
        try:
            self._json(fetch_valuation_metric(metric))
        except Exception as exc:
            self._json({"error": str(exc)}, status=502)

    def _treasury(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        metric = qs.get("metric", [""])[0]
        if metric not in ALLOWED_TREASURY:
            self.send_error(400, "Invalid metric")
            return
        try:
            self._json(fetch_treasury_metric(metric))
        except Exception as exc:
            self._json({"error": str(exc)}, status=502)

    def _valuation_history(self) -> None:
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
            self._json({"metric": metric, "series": fetch_valuation_history(metric, days=days)})
        except Exception as exc:
            self._json({"error": str(exc)}, status=502)


def _start_warm_cache() -> None:
    if os.environ.get("MMD_SKIP_WARM", "").strip().lower() in ("1", "true", "yes"):
        print("mmd-valuation: warm cache disabled (MMD_SKIP_WARM)")
        return

    def run() -> None:
        # Let /health respond before BIS batch warm competes for upstream/network.
        time.sleep(10)
        try:
            warm_mmd_cache()
            warm_multilateral_cache()
            print("mmd-valuation: warm cache ready", flush=True)
        except Exception as exc:
            print(f"mmd-valuation: warm cache failed: {exc}", flush=True)

    threading.Thread(target=run, daemon=True, name="mmd-warm").start()
    print("mmd-valuation: warm cache started (background)")


def main() -> None:
    _start_warm_cache()
    httpd = ThreadingHTTPServer((BIND, PORT), ValuationHandler)
    print(f"mmd-valuation listening on http://{BIND}:{PORT}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
