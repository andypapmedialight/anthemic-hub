"""Fetch live valuation metrics for Morning Macro (used by serve-hub proxy)."""
from __future__ import annotations

import csv
import io
import json
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

UPSTREAM_TIMEOUT = 25
BIS_OTC_CACHE_TTL = 3600
_bis_otc_cache: tuple[float, list[dict[str, str]]] | None = None

FRED_FRESHNESS_CACHE_TTL = int(os.environ.get("MMD_FRED_FRESHNESS_CACHE_TTL", "300"))
_fred_obs_cache: dict[str, tuple[float, str]] = {}
_fred_freshness_cache: tuple[float, dict] | None = None
_freshness_refresh_lock = threading.Lock()
_freshness_collect_lock = threading.Lock()
_freshness_bg_refresh = False

FINRA_MARGIN_HTML = (
    "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics"
)
FINRA_MARGIN_XLSX = (
    "https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx"
)
BIS_OTC_OUT = (
    "https://stats.bis.org/api/v1/data/BIS,WS_OTC_DERIV2,1.0/.?"
    "detail=dataonly&format=csvdata&startPeriod=2025-S2&endPeriod=2025-S2"
)
BIS_OTC_TURNOVER = (
    "https://stats.bis.org/api/v1/data/BIS,WS_DER_OTC_TOV,1.0/.?"
    "detail=dataonly&format=csvdata&startPeriod=2025&endPeriod=2025"
)
BIS_DEBT_AU = (
    "https://stats.bis.org/api/v1/data/BIS,WS_NA_SEC_DSS,1.0/.?"
    "detail=dataonly&format=csvdata&lastNObservations=4"
)
# Fed Z.1 — broker-dealer margin receivables (FINRA aggregate is often blocked server-side)
FRED_MARGIN_SERIES = "BOGZ1FL663067003Q"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
)
_FRED_ID_RE = re.compile(r"^[A-Z0-9]+$")
FRED_OBS_PROXY_CACHE_TTL = int(os.environ.get("MMD_FRED_OBS_CACHE_TTL", "300"))
_fred_obs_proxy_cache: dict[tuple[str, str, str, str], tuple[float, bytes, str]] = {}
_fred_obs_proxy_lock = threading.Lock()


def _fetch(url: str, timeout: int = UPSTREAM_TIMEOUT) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.finra.org/",
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except (urllib.error.HTTPError, TimeoutError, OSError):
        return _fetch_curl(url, min(timeout, 30))


def fetch_fred_observations_proxy(
    series_id: str,
    start: str = "2020-01-01",
    *,
    limit: int = 5000,
    sort_order: str = "asc",
) -> tuple[int, bytes, str]:
    """Cached FRED observations for /fred (browser proxy via nginx)."""
    if not _FRED_ID_RE.match(series_id):
        return 400, b'{"error":"invalid id"}', "application/json"

    lim = max(2, min(5000, int(limit)))
    order = "desc" if str(sort_order).lower() == "desc" else "asc"
    cache_key = (series_id, start, str(lim), order)
    now = time.time()

    with _fred_obs_proxy_lock:
        cached = _fred_obs_proxy_cache.get(cache_key)
        if cached and now - cached[0] < FRED_OBS_PROXY_CACHE_TTL:
            return 200, cached[1], cached[2]

    api_key = os.environ.get("FRED_API_KEY", "").strip()
    timeout = 18 if lim <= 200 else UPSTREAM_TIMEOUT

    if api_key:
        url = (
            "https://api.stlouisfed.org/fred/series/observations"
            f"?series_id={urllib.parse.quote(series_id)}"
            f"&file_type=json&sort_order={order}&limit={lim}"
            f"&observation_start={urllib.parse.quote(start)}"
            f"&api_key={urllib.parse.quote(api_key)}"
        )
    else:
        url = (
            "https://fred.stlouisfed.org/graph/fredgraph.csv"
            f"?id={urllib.parse.quote(series_id)}"
            f"&observation_start={urllib.parse.quote(start)}"
        )

    try:
        body = _fetch(url, timeout=timeout)
        ct = "application/json" if body[:1] == b"{" else "text/csv; charset=utf-8"
        with _fred_obs_proxy_lock:
            _fred_obs_proxy_cache[cache_key] = (now, body, ct)
        return 200, body, ct
    except urllib.error.HTTPError as exc:
        err = exc.read()
        return exc.code, err, exc.headers.get("Content-Type", "application/json")
    except Exception as exc:
        msg = json.dumps({"error": str(exc)}).encode("utf-8")
        return 502, msg, "application/json"


def _fetch_curl(url: str, timeout: int, *, extra_headers: dict[str, str] | None = None) -> bytes:
    cmd = [
        "curl",
        "-fsSL",
        "--http1.1",
        "-A",
        UA,
        "--max-time",
        str(timeout),
    ]
    for hk, hv in (extra_headers or {}).items():
        cmd.extend(["-H", f"{hk}: {hv}"])
    cmd.append(url)
    proc = subprocess.run(
        cmd,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", "replace").strip() or f"exit {proc.returncode}"
        raise RuntimeError(f"curl fetch failed: {err}")
    return proc.stdout


def _parse_csv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


def format_usd_trillions(millions: float) -> str:
    trillions = millions / 1_000_000
    if trillions >= 100:
        return f"${trillions:.0f}T"
    if trillions >= 10:
        return f"${trillions:.1f}T"
    return f"${trillions:.2f}T"


def format_aud_billions(billions: float) -> str:
    abs_b = abs(billions)
    if abs_b >= 1000:
        return f"A${billions / 1000:.2f}T"
    if abs_b >= 100:
        return f"A${billions:.0f}B"
    if abs_b >= 1:
        return f"A${billions:.1f}B"
    return f"A${billions * 1000:.0f}M"


def format_usd_billions_from_millions(millions: float) -> str:
    return f"${millions / 1000:.1f}B"


def quote_from_pair(current: float, previous: float | None) -> dict:
    change = (current - previous) if previous is not None else None
    pct = (change / previous * 100) if (change is not None and previous) else None
    return {"price": current, "change": change, "pct": pct}


def fetch_finra_margin() -> dict:
    """FINRA aggregate debit balances ($ millions)."""
    try:
        html = _fetch_curl(FINRA_MARGIN_HTML, timeout=12).decode("utf-8", "replace")
        rows = re.findall(
            r"<tr><td>([^<]+)</td><td>([0-9,]+)</td>",
            html,
        )
        parsed = []
        for month, debit in rows:
            if re.match(r"^[A-Za-z]{3}-\d{2}$", month.strip()):
                parsed.append(
                    {"month": month.strip(), "debitMillions": float(debit.replace(",", ""))}
                )
        if len(parsed) >= 2:
            cur, prev = parsed[0], parsed[1]
            q = quote_from_pair(cur["debitMillions"], prev["debitMillions"])
            return {
                **q,
                "display": format_usd_trillions(cur["debitMillions"]),
                "asOf": cur["month"],
                "source": "FINRA",
            }
    except Exception:
        pass

    # Fallback: official Excel (when HTML is blocked)
    try:
        raw = _fetch_curl(FINRA_MARGIN_XLSX, timeout=12)
    except Exception:
        raise RuntimeError("FINRA margin parse failed") from None
    z = zipfile.ZipFile(io.BytesIO(raw))
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        for si in root.findall(".//m:si", ns):
            ss.append("".join(t.text or "" for t in si.findall(".//m:t", ns)))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    data_rows = []
    for row in sheet.findall(".//m:row", ns):
        cells = []
        for c in row.findall("m:c", ns):
            v = c.find("m:v", ns)
            if v is None:
                cells.append("")
            elif c.get("t") == "s":
                cells.append(ss[int(v.text)])
            else:
                cells.append(v.text)
        if len(cells) >= 2 and cells[1]:
            try:
                data_rows.append(float(cells[1]))
            except ValueError:
                continue
    if len(data_rows) >= 2:
        q = quote_from_pair(data_rows[0], data_rows[1])
        return {**q, "display": format_usd_trillions(data_rows[0]), "asOf": "Latest", "source": "FINRA"}
    raise RuntimeError("FINRA margin parse failed")


def _fred_api_observations(series_id: str, start: str, api_key: str) -> list[tuple[str, float]]:
    url = (
        "https://api.stlouisfed.org/fred/series/observations"
        f"?series_id={series_id}&file_type=json&sort_order=asc"
        f"&limit=100000&observation_start={start}&api_key={api_key}"
    )
    body = _fetch(url, timeout=25).decode("utf-8", "replace")
    payload = json.loads(body)
    obs = payload.get("observations") or []
    rows = [
        (o["date"], float(o["value"]))
        for o in obs
        if o.get("value") not in (None, ".", "")
    ]
    if not rows:
        raise RuntimeError("FRED API returned no observations")
    return rows


def _fred_observations(series_id: str, start: str = "2015-01-01") -> list[tuple[str, float]]:
    """FRED API key, then hub proxy, then public CSV."""
    api_key = os.environ.get("FRED_API_KEY", "").strip()
    if api_key:
        try:
            return _fred_api_observations(series_id, start, api_key)
        except Exception:
            pass

    hub = os.environ.get("HUB_ORIGIN", "http://127.0.0.1:8000").rstrip("/")
    try:
        proxy_url = (
            f"{hub}/economics/proxy/fred?"
            f"id={series_id}&start={start}"
        )
        body = _fetch(proxy_url, timeout=20).decode("utf-8", "replace")
        if body.lstrip().startswith("{"):
            payload = json.loads(body)
            obs = payload.get("observations") or []
            rows = [
                (o["date"], float(o["value"]))
                for o in obs
                if o.get("value") not in (None, ".", "")
            ]
            if rows:
                return rows
    except Exception:
        pass

    url = (
        f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
        f"&observation_start={start}"
    )
    text = _fetch_curl(url, timeout=20).decode("utf-8", "replace")
    rows: list[tuple[str, float]] = []
    for line in text.strip().splitlines():
        if line.startswith("observation_date") or not line.strip():
            continue
        date, val = line.split(",", 1)
        try:
            rows.append((date.strip(), float(val)))
        except ValueError:
            continue
    return rows


def fetch_fred_margin() -> dict:
    """Fed Financial Accounts margin receivables (millions USD, quarterly)."""
    rows = _fred_observations(FRED_MARGIN_SERIES)
    if len(rows) < 1:
        raise RuntimeError("FRED margin series empty")
    rows.sort(key=lambda r: r[0])
    cur_date, cur = rows[-1]
    prev = rows[-2][1] if len(rows) > 1 else None
    q = quote_from_pair(cur, prev)
    return {
        **q,
        "display": format_usd_trillions(cur),
        "asOf": cur_date,
        "source": "FRED Z.1",
        "measureLabel": "Broker-dealer margin receivables",
    }


def fetch_margin_debt() -> dict:
    try:
        data = fetch_finra_margin()
        data["measureLabel"] = "FINRA investor debit balances"
        return data
    except Exception:
        return fetch_fred_margin()


def _bis_otc_rows() -> list[dict[str, str]]:
    global _bis_otc_cache
    now = time.time()
    if _bis_otc_cache and now - _bis_otc_cache[0] < BIS_OTC_CACHE_TTL:
        return _bis_otc_cache[1]
    text = _fetch(BIS_OTC_OUT, timeout=60).decode("utf-8", "replace")
    rows = _parse_csv(text)
    _bis_otc_cache = (now, rows)
    return rows


def _bis_match(rows: list[dict[str, str]], **want: str) -> dict[str, str] | None:
    matches = [row for row in rows if all(row.get(k) == v for k, v in want.items())]
    if not matches:
        return None
    total = [m for m in matches if m.get("DER_CURR_LEG1") == "TO1" and m.get("DER_CURR_LEG2") == "TO1"]
    pool = total or matches
    return max(pool, key=lambda r: float(r["OBS_VALUE"]))


def fetch_bis_otc_notional() -> dict:
    rows = _bis_otc_rows()
    row = _bis_match(
        rows,
        DER_BASIS="C",
        DER_TYPE="A",
        DER_INSTR="A",
        DER_RISK="A",
        DER_REP_CTY="5J",
        DER_SECTOR_CPY="A",
        DER_CPC="5J",
        DER_SECTOR_UDL="A",
    )
    if not row:
        raise RuntimeError("BIS notional row not found")
    millions = float(row["OBS_VALUE"])
    period = row.get("TIME_PERIOD", "")
    return {
        "price": millions,
        "change": None,
        "pct": None,
        "display": format_usd_trillions(millions),
        "asOf": period,
        "source": "BIS",
    }


def fetch_bis_otc_gmv() -> dict:
    rows = _bis_otc_rows()
    # BIS headline GMV ≈ USD 21.8tn (reporting dealers, all instruments)
    keys = dict(
        DER_BASIS="A",
        DER_TYPE="A",
        DER_RISK="D",
        DER_REP_CTY="5J",
        DER_SECTOR_CPY="B",
        DER_CPC="5J",
        DER_SECTOR_UDL="A",
    )
    vals = []
    period = ""
    for instr in ("S", "T"):
        row = _bis_match(rows, **keys, DER_INSTR=instr)
        if row:
            vals.append(float(row["OBS_VALUE"]))
            period = row.get("TIME_PERIOD", period)
    if not vals:
        raise RuntimeError("BIS GMV row not found")
    millions = sum(vals) / len(vals)
    return {
        "price": millions,
        "change": None,
        "pct": None,
        "display": format_usd_trillions(millions),
        "asOf": period,
        "source": "BIS",
    }


def fetch_bis_au_turnover() -> dict:
    text = _fetch(BIS_OTC_TURNOVER, timeout=60).decode("utf-8", "replace")
    rows = [r for r in _parse_csv(text) if r.get("DER_REP_CTY") == "AU"]
    if not rows:
        raise RuntimeError("BIS AU turnover not found")
    best = max(rows, key=lambda r: float(r["OBS_VALUE"]))
    millions = float(best["OBS_VALUE"])
    period = best.get("TIME_PERIOD", "2025")
    return {
        "price": millions,
        "change": None,
        "pct": None,
        "display": format_usd_billions_from_millions(millions),
        "asOf": period,
        "source": "BIS",
        "turnoverLabel": "OTC turnover (USD, annual)",
    }


def fetch_au_cgs() -> dict:
    """Commonwealth AGS face value (AOFM monthly positions)."""
    from aus_fetch import fetch_aofm_ags_face

    try:
        return fetch_aofm_ags_face()
    except Exception:
        return _fetch_au_cgs_bis_fallback()


def fetch_au_gdp() -> dict:
    """Nominal GDP annual (ABS preferred; IMF/FRED fallback)."""
    from aus_fetch import fetch_au_gdp_annual

    return fetch_au_gdp_annual()


def _fetch_au_cgs_bis_fallback() -> dict:
    """Legacy BIS debt securities (used only if AOFM fetch fails)."""
    text = _fetch(BIS_DEBT_AU, timeout=90).decode("utf-8", "replace")
    rows = _parse_csv(text)
    candidates = [
        r
        for r in rows
        if r.get("REF_AREA") == "AU"
        and r.get("INSTR_ASSET") == "F3"
        and r.get("ACCOUNTING_ENTRY") == "L"
        and r.get("REF_SECTOR") == "S13"
        and r.get("UNIT_MEASURE") == "AUD"
        and r.get("STO") == "LE"
        and r.get("COUNTERPART_AREA") == "XW"
        and r.get("CURRENCY_DENOM") == "_T"
        and r.get("CUST_BREAKDOWN") == "_T"
        and r.get("CONSOLIDATION") == "N"
        and r.get("MATURITY") == "T"
    ]
    if not candidates:
        raise RuntimeError("BIS AU debt row not found")
    latest = sorted(candidates, key=lambda r: r.get("TIME_PERIOD", ""))[-1]
    billions = float(latest["OBS_VALUE"])
    period = latest.get("TIME_PERIOD", "")
    prev_rows = [r for r in candidates if r.get("TIME_PERIOD", "") < period]
    prev_val = float(prev_rows[-1]["OBS_VALUE"]) if prev_rows else None
    q = quote_from_pair(billions, prev_val)
    return {
        **q,
        "display": format_aud_billions(billions),
        "asOf": period,
        "source": "BIS",
    }


FRESHNESS_FRED_SERIES = (
    "GDP",
    "GDPNOW",
    "GFDEGDQ188S",
    "GFDEBTN",
    "TCMDO",
    "FGSDODNS",
    "MVMTD027MNFRBDAL",
    "NCBEILQ027S",
    "DGS2",
    "DGS10",
)
# Minimum set for cold-start / deploy probes (must finish within ~20s).
FRESHNESS_CORE_SERIES = ("GDP", "GFDEGDQ188S", "NCBEILQ027S")
FRESHNESS_DEPLOY_SERIES = "GDP"


def _last_obs_date_from_fred_json(body: str) -> str | None:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None
    obs = payload.get("observations") or []
    if not obs:
        return None
    for row in reversed(obs):
        if row.get("date") and row.get("value") not in (None, ".", ""):
            return row["date"]
    return None


def _last_obs_date_from_fred_csv(text: str) -> str | None:
    last_date = None
    for line in text.strip().splitlines():
        if line.startswith("observation_date") or not line.strip():
            continue
        parts = line.split(",", 1)
        if len(parts) < 2:
            continue
        date, val = parts[0].strip(), parts[1].strip()
        if date and val and val != ".":
            last_date = date
    return last_date


def fred_last_observation(
    series_id: str,
    api_key: str | None = None,
    *,
    force: bool = False,
    timeout: int = 6,
) -> str | None:
    """Latest non-missing FRED observation date (YYYY-MM-DD)."""
    key = (api_key or os.environ.get("FRED_API_KEY", "")).strip()
    now = time.time()
    if not force:
        cached = _fred_obs_cache.get(series_id)
        if cached and now < cached[0]:
            return cached[1]

    def remember(date: str | None) -> str | None:
        if date:
            _fred_obs_cache[series_id] = (now + FRED_FRESHNESS_CACHE_TTL, date)
        return date

    # FRED API limit=1 is fast. Do not use hub /proxy/fred here — nginx fetches up to 5000 rows.
    if key:
        url = (
            "https://api.stlouisfed.org/fred/series/observations"
            f"?series_id={urllib.parse.quote(series_id)}"
            f"&file_type=json&sort_order=desc&limit=1"
            f"&api_key={urllib.parse.quote(key)}"
        )
        try:
            body = _fetch(url, timeout=timeout).decode("utf-8", "replace")
            date = _last_obs_date_from_fred_json(body)
            if date:
                return remember(date)
        except Exception:
            pass

    try:
        recent_start = time.strftime(
            "%Y-%m-%d",
            time.gmtime(time.time() - 400 * 86400),
        )
        csv_url = (
            f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={urllib.parse.quote(series_id)}"
            f"&observation_start={recent_start}"
        )
        text = _fetch_curl(csv_url, timeout=min(timeout + 4, 12)).decode("utf-8", "replace")
        date = _last_obs_date_from_fred_csv(text)
        if date:
            return remember(date)
    except Exception:
        pass
    return None


def fred_last_observation_fast(
    series_id: str,
    api_key: str | None = None,
    *,
    timeout: int = 4,
) -> str | None:
    """Single-series deploy probe: limit=1 API, then short CSV fallback."""
    key = (api_key or os.environ.get("FRED_API_KEY", "")).strip()
    if key:
        url = (
            "https://api.stlouisfed.org/fred/series/observations"
            f"?series_id={urllib.parse.quote(series_id)}"
            f"&file_type=json&sort_order=desc&limit=1"
            f"&api_key={urllib.parse.quote(key)}"
        )
        try:
            body = _fetch(url, timeout=timeout).decode("utf-8", "replace")
            date = _last_obs_date_from_fred_json(body)
            if date:
                return date
        except Exception:
            pass
    try:
        recent_start = time.strftime(
            "%Y-%m-%d",
            time.gmtime(time.time() - 120 * 86400),
        )
        csv_url = (
            f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={urllib.parse.quote(series_id)}"
            f"&observation_start={recent_start}"
        )
        text = _fetch_curl(csv_url, timeout=min(timeout + 3, 8)).decode("utf-8", "replace")
        return _last_obs_date_from_fred_csv(text)
    except Exception:
        return None


def _freshness_min_gdp_series(key: str | None) -> dict[str, dict]:
    """Guarantee at least GDP vintage when bulk FRED lookups fail (CI / cold start)."""
    api_key = (key or os.environ.get("FRED_API_KEY", "")).strip()
    last = fred_last_observation_fast(FRESHNESS_DEPLOY_SERIES, api_key or None, timeout=8)
    if last:
        return {FRESHNESS_DEPLOY_SERIES: {"lastObservation": last}}
    if api_key:
        start = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 400 * 86400))
        status, body, _ = fetch_fred_observations_proxy(
            FRESHNESS_DEPLOY_SERIES,
            start,
            limit=2,
            sort_order="desc",
        )
        if status == 200:
            last = _last_obs_date_from_fred_json(body.decode("utf-8", "replace"))
            if last:
                return {FRESHNESS_DEPLOY_SERIES: {"lastObservation": last}}
    return {}


def fetch_freshness_deploy_probe(api_key: str | None = None) -> dict:
    """Fast loopback probe for deploy — never blocks on warm-cache lock."""
    global _fred_freshness_cache
    key = (api_key or os.environ.get("FRED_API_KEY", "")).strip()
    now = time.time()

    if _fred_freshness_cache:
        _, cached_payload = _fred_freshness_cache
        stale = dict(cached_payload.get("series") or {})
        if stale:
            return _freshness_payload(stale, cached=True, degraded=True)

    if not key:
        series = _freshness_min_gdp_series(None)
        return _freshness_payload(series, cached=False, degraded=not series) | {
            "fredApi": False,
        }

    series = _freshness_min_gdp_series(key)
    payload = _freshness_payload(series, cached=False, degraded=not series)
    if series:
        _fred_freshness_cache = (now + FRED_FRESHNESS_CACHE_TTL, {**payload, "cached": True})
    return payload


def _collect_freshness_series(
    key: str,
    series_ids: tuple[str, ...],
    *,
    force: bool = False,
    per_timeout: int = 6,
    wall_timeout: int = 20,
) -> dict[str, dict]:
    series: dict[str, dict] = {}

    def _fetch_one(sid: str) -> tuple[str, str | None]:
        last = fred_last_observation(sid, key, force=force, timeout=per_timeout)
        return sid, last

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(_fetch_one, sid) for sid in series_ids]
        try:
            for fut in as_completed(futures, timeout=wall_timeout):
                sid, last = fut.result()
                if last:
                    series[sid] = {"lastObservation": last}
        except TimeoutError:
            pass
    return series


def _freshness_payload(series: dict[str, dict], *, cached: bool, degraded: bool) -> dict:
    return {
        "fredApi": True,
        "series": series,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cached": cached,
        "degraded": degraded,
    }


def _freshness_refresh_worker(key: str) -> None:
    global _freshness_bg_refresh, _fred_freshness_cache
    try:
        base: dict[str, dict] = {}
        if _fred_freshness_cache:
            _, prev = _fred_freshness_cache
            base = dict(prev.get("series") or {})
        with _freshness_collect_lock:
            fresh = _collect_freshness_series(
                key,
                FRESHNESS_FRED_SERIES,
                force=True,
                per_timeout=6,
                wall_timeout=45,
            )
        base.update(fresh)
        if base:
            now = time.time()
            payload = _freshness_payload(base, cached=True, degraded=False)
            _fred_freshness_cache = (now + FRED_FRESHNESS_CACHE_TTL, payload)
    finally:
        with _freshness_refresh_lock:
            _freshness_bg_refresh = False


def _schedule_freshness_refresh(key: str) -> None:
    global _freshness_bg_refresh
    with _freshness_refresh_lock:
        if _freshness_bg_refresh:
            return
        _freshness_bg_refresh = True
    threading.Thread(
        target=_freshness_refresh_worker,
        args=(key,),
        daemon=True,
        name="mmd-freshness-refresh",
    ).start()


def fetch_freshness_api(
    api_key: str | None = None,
    *,
    force: bool = False,
    core_only: bool = False,
) -> dict:
    """Server-side FRED vintage summary for Morning Macro footer."""
    global _fred_freshness_cache
    key = (api_key or os.environ.get("FRED_API_KEY", "")).strip()
    now = time.time()

    if not key:
        with _freshness_collect_lock:
            series = _collect_freshness_series(
                "",
                FRESHNESS_CORE_SERIES,
                force=force,
                per_timeout=8,
                wall_timeout=25,
            )
        return _freshness_payload(series, cached=False, degraded=not series) | {
            "fredApi": False,
        }

    if not force and not core_only and _fred_freshness_cache:
        expires, payload = _fred_freshness_cache
        if now < expires and payload.get("series"):
            return payload
        if payload.get("series"):
            _schedule_freshness_refresh(key)
            return {**payload, "cached": True, "degraded": True}

    stale_series: dict[str, dict] = {}
    if _fred_freshness_cache:
        _, stale_payload = _fred_freshness_cache
        stale_series = dict(stale_payload.get("series") or {})

    if core_only:
        ids = FRESHNESS_CORE_SERIES
        wall = 25
    elif force:
        ids = FRESHNESS_FRED_SERIES
        wall = 50
    else:
        ids = FRESHNESS_CORE_SERIES if not stale_series else FRESHNESS_FRED_SERIES
        wall = 22 if not stale_series else 45

    series = dict(stale_series)
    with _freshness_collect_lock:
        fresh = _collect_freshness_series(
            key,
            ids,
            force=force or core_only,
            per_timeout=8 if core_only else 6,
            wall_timeout=wall,
        )
    series.update(fresh)

    if not force and not core_only and series and len(series) < len(FRESHNESS_FRED_SERIES):
        _schedule_freshness_refresh(key)

    if not series and key:
        series = _freshness_min_gdp_series(key)
        if series and not force and not core_only:
            _schedule_freshness_refresh(key)

    degraded = bool(stale_series and not force) or (
        bool(series) and len(series) < len(ids) and not core_only
    )
    if series and len(series) == 1 and FRESHNESS_DEPLOY_SERIES in series:
        degraded = True

    payload = _freshness_payload(series, cached=False, degraded=degraded)
    if series:
        _fred_freshness_cache = (now + FRED_FRESHNESS_CACHE_TTL, {**payload, "cached": True})
    elif stale_series:
        return _freshness_payload(stale_series, cached=True, degraded=True)
    return payload


VAL_WARM_LIVE_METRICS = (
    "margin-debt",
    "otc-notional",
    "otc-gmv",
    "au-cgs",
    "au-gdp",
    "au-public-debt",
    "au-private-debt",
    "asx-bond-fut",
)


def warm_mmd_cache() -> None:
    """Prefetch live valuation metrics (BIS cache). Freshness loads on /freshness."""
    fetch_valuation_batch(list(VAL_WARM_LIVE_METRICS))


def fetch_au_public_debt() -> dict:
    from aus_fetch import fetch_bis_au_govt_credit

    return fetch_bis_au_govt_credit()


def fetch_au_private_debt() -> dict:
    from aus_fetch import fetch_bis_au_private_credit

    return fetch_bis_au_private_credit()


METRICS = {
    "margin-debt": fetch_margin_debt,
    "otc-notional": fetch_bis_otc_notional,
    "otc-gmv": fetch_bis_otc_gmv,
    "au-cgs": fetch_au_cgs,
    "au-gdp": fetch_au_gdp,
    "au-public-debt": fetch_au_public_debt,
    "au-private-debt": fetch_au_private_debt,
    "asx-bond-fut": fetch_bis_au_turnover,
}


def fetch_valuation_metric(metric: str) -> dict:
    fn = METRICS.get(metric)
    if not fn:
        raise ValueError(f"Unknown metric: {metric}")
    return fn()


VALUATION_HISTORY_METRICS = frozenset({"au-cgs"})


def fetch_valuation_history(metric: str, *, days: int = 1825) -> list[dict]:
    if metric not in VALUATION_HISTORY_METRICS:
        raise ValueError(f"No history for metric: {metric}")
    if metric == "au-cgs":
        from aus_fetch import fetch_aofm_ags_history

        return fetch_aofm_ags_history(days=days)
    return []


def fetch_valuation_batch(metric_ids: list[str]) -> dict[str, dict]:
    """Fetch several live metrics in one request (shared BIS cache, parallel upstream)."""
    unique: list[str] = []
    for mid in metric_ids:
        if mid in METRICS and mid not in unique:
            unique.append(mid)
    if not unique:
        return {}

    if "otc-notional" in unique or "otc-gmv" in unique:
        try:
            _bis_otc_rows()
        except Exception:
            pass

    out: dict[str, dict] = {}
    workers = min(4, len(unique))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_valuation_metric, mid): mid for mid in unique}
        for fut in as_completed(futures):
            mid = futures[fut]
            try:
                out[mid] = fut.result()
            except Exception as exc:
                out[mid] = {"error": str(exc)}
    return out


# --- Multilateral macro (OECD / IMF / World Bank) ---

ML_UPSTREAM_TIMEOUT = 45
CACHE_TTL_OECD = 86400
CACHE_TTL_IMF = 21600
CACHE_TTL_WB = 86400

ML_UA = (
    "Mozilla/5.0 (compatible; MorningMacro/1.0; +https://anthemic-developments.com/economics/)"
)

_ml_cache: dict[str, tuple[float, object]] = {}

OECD_STES_URL = (
    "https://sdmx.oecd.org/public/rest/data/"
    "OECD.SDD.STES,DSD_STES@DF_CLI,4.1/"
    "{country}.M.{measure}.IX._Z.AA.IX._Z.H."
    "?startPeriod={start}&format=csvfilewithlabels"
)

WB_API = "https://api.worldbank.org/v2/country/{countries}/indicator/{indicator}"
IMF_API = "https://www.imf.org/external/datamapper/api/v1/{indicator}/{countries}"


def _ml_fetch(url: str, timeout: int = ML_UPSTREAM_TIMEOUT, *, retries: int = 2) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": ML_UA,
                    "Accept": "application/json,text/csv,*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (TimeoutError, OSError) as exc:
            last_err = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed: {last_err}") from last_err


def _ml_cache_get(key: str, ttl: float):
    row = _ml_cache.get(key)
    if not row:
        return None
    ts, data = row
    if time.time() - ts > ttl:
        return None
    return data


def _ml_cache_set(key: str, data: object) -> None:
    _ml_cache[key] = (time.time(), data)




def _parse_oecd_cli_csv(text: str) -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        period = (row.get("TIME_PERIOD") or "").strip()
        raw = (row.get("OBS_VALUE") or "").strip()
        if not period or not raw:
            continue
        try:
            rows.append((period, float(raw)))
        except ValueError:
            continue
    rows.sort(key=lambda r: r[0])
    return rows


def _period_to_utc_ms(period: str) -> int | None:
    period = period.strip()
    if re.fullmatch(r"\d{4}-\d{2}", period):
        year, month = period.split("-")
        return int(datetime(int(year), int(month), 1, tzinfo=timezone.utc).timestamp() * 1000)
    if re.fullmatch(r"\d{4}", period):
        return int(datetime(int(period), 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    return None


def _rows_to_series(rows: list[tuple[str, float]]) -> list[dict]:
    out: list[dict] = []
    for period, value in rows:
        ts = _period_to_utc_ms(period)
        if ts is None:
            continue
        out.append({"t": ts, "v": value})
    return out


def _card_from_rows(
    rows: list[tuple[str, float]],
    *,
    source: str,
    freshness_kind: str,
    dp: int = 2,
    suffix: str = "",
    forecast_from_year: int | None = None,
    freshness_note: str | None = None,
) -> dict:
    if not rows:
        raise RuntimeError("empty series")
    last_period, last_val = rows[-1]
    prev_val = rows[-2][1] if len(rows) > 1 else None
    q = quote_from_pair(last_val, prev_val)
    as_of_year = int(last_period[:4]) if re.match(r"\d{4}", last_period) else None
    note = freshness_note
    kind = freshness_kind
    if forecast_from_year is not None and as_of_year is not None and as_of_year >= forecast_from_year:
        kind = "estimated"
        note = note or "IMF WEO projection"
    display = f"{last_val:.{dp}f}{suffix}"
    return {
        **q,
        "display": display,
        "asOf": last_period,
        "asOfUtc": _period_to_utc_ms(last_period),
        "source": source,
        "freshnessKind": kind,
        "freshnessNote": note,
        "live": False,
    }


def fetch_oecd_stes(
    country: str,
    measure: str,
    *,
    note: str,
    start: str = "2018",
) -> dict:
    cache_key = f"oecd:stes:{measure}:{country}:{start}"
    cached = _ml_cache_get(cache_key, CACHE_TTL_OECD)
    if cached is not None:
        return dict(cached)

    url = OECD_STES_URL.format(
        country=urllib.parse.quote(country),
        measure=urllib.parse.quote(measure),
        start=start,
    )
    text = _ml_fetch(url).decode("utf-8", "replace")
    rows = _parse_oecd_cli_csv(text)
    if not rows:
        raise RuntimeError(f"OECD {measure} empty for {country}")

    card = _card_from_rows(
        rows,
        source="OECD",
        freshness_kind="monthly",
        dp=2,
        freshness_note=note,
    )
    card["history"] = _rows_to_series(rows)
    _ml_cache_set(cache_key, card)
    return dict(card)


def fetch_oecd_cli(country: str, *, start: str = "2018") -> dict:
    return fetch_oecd_stes(
        country,
        "LI",
        note="Amplitude-adjusted CLI",
        start=start,
    )


def _imf_country_series(indicator: str, country: str) -> dict[str, float]:
    cache_key = f"imf:{indicator}:{country}"
    cached = _ml_cache_get(cache_key, CACHE_TTL_IMF)
    if cached is not None:
        return dict(cached)

    url = IMF_API.format(
        indicator=urllib.parse.quote(indicator),
        countries=urllib.parse.quote(country),
    )
    payload = json.loads(_ml_fetch(url, timeout=60).decode("utf-8", "replace"))
    values = payload.get("values", {}).get(indicator, {}).get(country, {})
    series: dict[str, float] = {}
    for year, val in values.items():
        if val is None:
            continue
        try:
            series[str(year)] = float(val)
        except (TypeError, ValueError):
            continue
    if not series:
        raise RuntimeError(f"IMF {indicator} empty for {country}")
    _ml_cache_set(cache_key, series)
    return series


def _imf_card_rows(series: dict[str, float]) -> list[tuple[str, float]]:
    """Prefer current-year WEO vintage on the card, not far-future projections (e.g. 2027)."""
    rows = sorted(series.items(), key=lambda r: int(r[0]))
    now_y = datetime.now(timezone.utc).year
    rows = [(y, v) for y, v in rows if int(y) <= now_y + 1]
    if not rows:
        return []
    current = [(y, v) for y, v in rows if int(y) == now_y]
    if current:
        y0, v0 = current[-1]
        prior = [(y, v) for y, v in rows if int(y) < now_y]
        if prior:
            return [prior[-1], (y0, v0)]
        return [(y0, v0)]
    return rows[-2:] if len(rows) >= 2 else rows


def _imf_forecast_card_rows(series: dict[str, float]) -> list[tuple[str, float]]:
    """Headline = nearest WEO forecast year (current year onward); change vs prior year."""
    rows = sorted(series.items(), key=lambda r: int(r[0]))
    now_y = datetime.now(timezone.utc).year
    forward = [(y, v) for y, v in rows if int(y) >= now_y]
    if len(forward) >= 2:
        return forward[:2]
    if len(forward) == 1:
        prior = [(y, v) for y, v in rows if int(y) < now_y]
        if prior:
            return [prior[-1], forward[0]]
        return forward
    return rows[-2:] if len(rows) >= 2 else rows


def fetch_imf_forecast_datamapper(indicator: str, country: str, *, suffix: str = "%") -> dict:
    """IMF WEO projection — for Forecast section (not mixed with published actuals)."""
    cache_key = f"imf:forecast:{indicator}:{country}"
    cached = _ml_cache_get(cache_key, CACHE_TTL_IMF)
    if cached is not None:
        return dict(cached)

    raw = _imf_country_series(indicator, country)
    rows = sorted(raw.items(), key=lambda r: int(r[0]))
    card_rows = _imf_forecast_card_rows(raw)
    now_y = datetime.now(timezone.utc).year
    card = _card_from_rows(
        card_rows,
        source="IMF WEO",
        freshness_kind="estimated",
        dp=1,
        suffix=suffix,
        forecast_from_year=now_y,
        freshness_note="IMF WEO forecast",
    )
    card["forecast"] = True
    card["history"] = _rows_to_series([(y, v) for y, v in rows if int(y) >= now_y - 1])
    _ml_cache_set(cache_key, card)
    return dict(card)


def fetch_imf_datamapper(indicator: str, country: str, *, suffix: str = "%") -> dict:
    cache_key = f"imf:card:{indicator}:{country}"
    cached = _ml_cache_get(cache_key, CACHE_TTL_IMF)
    if cached is not None:
        return dict(cached)

    raw = _imf_country_series(indicator, country)
    rows = sorted(raw.items(), key=lambda r: int(r[0]))
    card_rows = _imf_card_rows(raw)
    forecast_from = datetime.now(timezone.utc).year
    card = _card_from_rows(
        card_rows,
        source="IMF WEO",
        freshness_kind="annual",
        dp=1,
        suffix=suffix,
        forecast_from_year=forecast_from,
    )
    card["history"] = _rows_to_series(rows)
    _ml_cache_set(cache_key, card)
    return dict(card)


def _worldbank_series(countries: str, indicator: str, *, start: int = 2010) -> dict[str, list[tuple[str, float]]]:
    cache_key = f"wb:{indicator}:{countries}:{start}"
    cached = _ml_cache_get(cache_key, CACHE_TTL_WB)
    if cached is not None:
        return dict(cached)

    url = WB_API.format(
        countries=urllib.parse.quote(countries),
        indicator=urllib.parse.quote(indicator),
    )
    params = urllib.parse.urlencode(
        {"format": "json", "date": f"{start}:{datetime.now().year + 1}", "per_page": 20000}
    )
    payload = json.loads(_ml_fetch(f"{url}?{params}").decode("utf-8", "replace"))
    if not isinstance(payload, list) or len(payload) < 2:
        raise RuntimeError(f"World Bank unexpected payload for {indicator}")

    by_country: dict[str, list[tuple[str, float]]] = {}
    for row in payload[1]:
        if row.get("value") is None:
            continue
        iso3 = row.get("countryiso3code") or row.get("country", {}).get("id")
        if not iso3:
            continue
        try:
            val = float(row["value"])
        except (TypeError, ValueError):
            continue
        year = str(row.get("date", "")).strip()
        if not year:
            continue
        by_country.setdefault(iso3, []).append((year, val))

    for iso3 in by_country:
        by_country[iso3].sort(key=lambda r: r[0])

    if not by_country:
        raise RuntimeError(f"World Bank empty for {indicator}")
    _ml_cache_set(cache_key, by_country)
    return by_country


def fetch_worldbank(indicator: str, country_iso3: str, *, dp: int = 1, suffix: str = "") -> dict:
    cache_key = f"wb:card:{indicator}:{country_iso3}"
    cached = _ml_cache_get(cache_key, CACHE_TTL_WB)
    if cached is not None:
        return dict(cached)

    by_country = _worldbank_series(country_iso3, indicator)
    rows = by_country.get(country_iso3)
    if not rows:
        raise RuntimeError(f"World Bank {indicator} missing for {country_iso3}")

    card = _card_from_rows(
        rows,
        source="World Bank",
        freshness_kind="annual",
        dp=dp,
        suffix=suffix,
    )
    if indicator == "NY.GNP.PCAP.CD":
        card["display"] = f"${card['price']:,.0f}"
    card["history"] = _rows_to_series(rows)
    _ml_cache_set(cache_key, card)
    return dict(card)


def _imf_forecast(indicator: str, country: str) -> dict:
    return fetch_imf_forecast_datamapper(indicator, country)


def _imf(indicator: str, country: str) -> dict:
    return fetch_imf_datamapper(indicator, country)


def _wb(indicator: str, country: str, *, dp: int = 1, suffix: str = "%") -> dict:
    return fetch_worldbank(indicator, country, dp=dp, suffix=suffix)


def _oecd_cli(country: str) -> dict:
    return fetch_oecd_cli(country)


def _oecd_stes(country: str, measure: str, note: str) -> dict:
    return fetch_oecd_stes(country, measure, note=note)


def _au_unemployment() -> dict:
    from aus_fetch import fetch_au_unemployment_rate

    return fetch_au_unemployment_rate()


def _au_cpi_inflation() -> dict:
    from aus_fetch import fetch_au_cpi_inflation_yoy

    return fetch_au_cpi_inflation_yoy()


def _au_gdp_growth_yoy() -> dict:
    from aus_fetch import fetch_au_gdp_growth_yoy

    return fetch_au_gdp_growth_yoy()


MULTILATERAL_METRIC_SPECS: dict[str, dict] = {
    # OECD — composite leading indicator
    "oecd-cli-au": {"label": "OECD CLI — Australia", "ticker": "CLI", "fn": lambda: _oecd_cli("AUS")},
    "oecd-cli-us": {"label": "OECD CLI — United States", "ticker": "CLI", "fn": lambda: _oecd_cli("USA")},
    "oecd-cli-gb": {"label": "OECD CLI — United Kingdom", "ticker": "CLI", "fn": lambda: _oecd_cli("GBR")},
    "oecd-cli-jp": {"label": "OECD CLI — Japan", "ticker": "CLI", "fn": lambda: _oecd_cli("JPN")},
    "oecd-cli-de": {"label": "OECD CLI — Germany", "ticker": "CLI", "fn": lambda: _oecd_cli("DEU")},
    # OECD — business & consumer confidence (CLI dataflow)
    "oecd-bconf-au": {
        "label": "OECD Business Confidence — AU",
        "ticker": "BCI",
        "fn": lambda: _oecd_stes("AUS", "BCICP", "Composite business confidence"),
    },
    "oecd-bconf-us": {
        "label": "OECD Business Confidence — US",
        "ticker": "BCI",
        "fn": lambda: _oecd_stes("USA", "BCICP", "Composite business confidence"),
    },
    "oecd-cconf-au": {
        "label": "OECD Consumer Confidence — AU",
        "ticker": "CCI",
        "fn": lambda: _oecd_stes("AUS", "CCICP", "Composite consumer confidence"),
    },
    "oecd-cconf-us": {
        "label": "OECD Consumer Confidence — US",
        "ticker": "CCI",
        "fn": lambda: _oecd_stes("USA", "CCICP", "Composite consumer confidence"),
    },
    # IMF WEO — growth, prices, debt, labour, external balance
    "imf-gdp-au": {"label": "IMF WEO GDP Growth — AU", "ticker": "WEO", "fn": lambda: _imf_forecast("NGDP_RPCH", "AUS")},
    "imf-gdp-us": {"label": "IMF WEO GDP Growth — US", "ticker": "WEO", "fn": lambda: _imf_forecast("NGDP_RPCH", "USA")},
    "imf-inflation-au": {"label": "IMF CPI Inflation — AU", "ticker": "CPI", "fn": lambda: _imf_forecast("PCPIPCH", "AUS")},
    "imf-inflation-us": {"label": "IMF CPI Inflation — US", "ticker": "CPI", "fn": lambda: _imf_forecast("PCPIPCH", "USA")},
    "imf-gov-debt-au": {"label": "IMF Govt Debt — AU", "ticker": "DEBT", "fn": lambda: _imf_forecast("GGXWDG_NGDP", "AUS")},
    "imf-gov-debt-us": {"label": "IMF Govt Debt — US", "ticker": "DEBT", "fn": lambda: _imf_forecast("GGXWDG_NGDP", "USA")},
    "imf-unemployment-au": {
        "label": "IMF Unemployment — AU",
        "ticker": "U/E",
        "fn": _au_unemployment,
    },
    "imf-unemployment-us": {
        "label": "IMF Unemployment — US",
        "ticker": "U/E",
        "fn": lambda: _imf_forecast("LUR", "USA"),
    },
    "imf-current-account-au": {
        "label": "IMF Current Account — AU",
        "ticker": "CA",
        "fn": lambda: _imf_forecast("BCA_NGDPD", "AUS"),
    },
    "imf-current-account-us": {
        "label": "IMF Current Account — US",
        "ticker": "CA",
        "fn": lambda: _imf_forecast("BCA_NGDPD", "USA"),
    },
    # World Bank WDI — levels, growth, trade, inflation
    "wb-gni-au": {"label": "GNI per Capita — AU", "ticker": "GNI", "fn": lambda: _wb("NY.GNP.PCAP.CD", "AUS", dp=0, suffix="")},
    "wb-gni-us": {"label": "GNI per Capita — US", "ticker": "GNI", "fn": lambda: _wb("NY.GNP.PCAP.CD", "USA", dp=0, suffix="")},
    "wb-gdp-growth-au": {
        "label": "GDP Growth (actual) — AU",
        "ticker": "GDP",
        "fn": _au_gdp_growth_yoy,
    },
    "wb-gdp-growth-us": {
        "label": "GDP Growth (actual) — US",
        "ticker": "GDP",
        "fn": lambda: _wb("NY.GDP.MKTP.KD.ZG", "USA"),
    },
    "wb-trade-au": {"label": "Trade (% GDP) — AU", "ticker": "TRD", "fn": lambda: _wb("NE.TRD.GNFS.ZS", "AUS")},
    "wb-trade-us": {"label": "Trade (% GDP) — US", "ticker": "TRD", "fn": lambda: _wb("NE.TRD.GNFS.ZS", "USA")},
    "wb-inflation-au": {
        "label": "CPI Inflation (actual) — AU",
        "ticker": "CPI",
        "fn": _au_cpi_inflation,
    },
    "wb-inflation-us": {
        "label": "CPI Inflation (actual) — US",
        "ticker": "CPI",
        "fn": lambda: _wb("FP.CPI.TOTL.ZG", "USA"),
    },
}

MULTILATERAL_METRICS = frozenset(MULTILATERAL_METRIC_SPECS)


def fetch_multilateral_metric(metric: str) -> dict:
    spec = MULTILATERAL_METRIC_SPECS.get(metric)
    if not spec:
        raise ValueError(f"Unknown metric: {metric}")
    data = spec["fn"]()
    out = dict(data)
    out.pop("history", None)
    return out


def fetch_multilateral_history(metric: str, *, days: int = 1825) -> list[dict]:
    spec = MULTILATERAL_METRIC_SPECS.get(metric)
    if not spec:
        raise ValueError(f"Unknown metric: {metric}")
    data = spec["fn"]()
    series = data.get("history") or []
    if not series:
        return []
    cutoff = int(time.time() * 1000) - days * 86400000
    trimmed = [p for p in series if p["t"] >= cutoff]
    return trimmed if len(trimmed) >= 2 else series[-min(len(series), 24):]


def fetch_multilateral_batch(metric_ids: list[str]) -> dict[str, dict]:
    unique: list[str] = []
    for mid in metric_ids:
        if mid in MULTILATERAL_METRICS and mid not in unique:
            unique.append(mid)
    if not unique:
        return {}

    out: dict[str, dict] = {}
    workers = min(4, len(unique))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_multilateral_metric, mid): mid for mid in unique}
        for fut in as_completed(futures):
            mid = futures[fut]
            try:
                out[mid] = fut.result()
            except Exception as exc:
                out[mid] = {"error": str(exc)}
    return out


def warm_multilateral_cache() -> None:
    """Prefetch default Global Macro cards (best-effort)."""
    defaults = (
        "oecd-cli-au",
        "oecd-cli-us",
        "imf-gdp-au",
        "imf-gdp-us",
        "wb-gdp-growth-au",
        "wb-gni-au",
    )
    for mid in defaults:
        try:
            fetch_multilateral_metric(mid)
        except Exception:
            pass