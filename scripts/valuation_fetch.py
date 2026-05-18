"""Fetch live valuation metrics for Morning Macro (used by serve-hub proxy)."""
from __future__ import annotations

import csv
import io
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

UPSTREAM_TIMEOUT = 25

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


def _fetch_curl(url: str, timeout: int) -> bytes:
    proc = subprocess.run(
        [
            "curl",
            "-fsSL",
            "--http1.1",
            "-A",
            UA,
            "--max-time",
            str(timeout),
            url,
        ],
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
    if billions >= 100:
        return f"A${billions:.0f}B"
    return f"A${billions:.1f}B"


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


def _fred_observations(series_id: str, start: str = "2015-01-01") -> list[tuple[str, float]]:
    """Prefer local hub FRED proxy (uses FRED_API_KEY); fall back to public CSV."""
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
    text = _fetch(BIS_OTC_OUT, timeout=60).decode("utf-8", "replace")
    return _parse_csv(text)


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
    """Australian government debt securities on issue (BIS debt securities, AUD billions)."""
    text = _fetch(BIS_DEBT_AU, timeout=90).decode("utf-8", "replace")
    rows = _parse_csv(text)
    candidates = [
        r
        for r in rows
        if r.get("REF_AREA") == "AU"
        and r.get("INSTR_ASSET") == "F3"
        and r.get("ACCOUNTING_ENTRY") == "L"
        and r.get("REF_SECTOR") == "S12"
        and r.get("UNIT_MEASURE") == "AUD"
        and r.get("STO") == "LE"
        and r.get("COUNTERPART_AREA") == "XW"
        and r.get("CURRENCY_DENOM") == "_T"
        and r.get("CUST_BREAKDOWN") == "_T"
        and r.get("CONSOLIDATION") == "N"
        and r.get("MATURITY") == "S"
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


METRICS = {
    "margin-debt": fetch_margin_debt,
    "otc-notional": fetch_bis_otc_notional,
    "otc-gmv": fetch_bis_otc_gmv,
    "au-cgs": fetch_au_cgs,
    "asx-bond-fut": fetch_bis_au_turnover,
}


def fetch_valuation_metric(metric: str) -> dict:
    fn = METRICS.get(metric)
    if not fn:
        raise ValueError(f"Unknown metric: {metric}")
    return fn()
