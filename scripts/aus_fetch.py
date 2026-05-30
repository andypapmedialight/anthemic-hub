"""Official Australian macro data — AOFM (Treasury debt) and ABS (when reachable)."""
from __future__ import annotations

import io
import json
import re
import time
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

from valuation_fetch import _fetch, _fetch_curl, format_aud_billions, quote_from_pair

AOFM_HUB = "https://www.aofm.gov.au/data-hub"
AOFM_DEALT_FALLBACK = (
    "https://www.aofm.gov.au/sites/default/files/2025-05-02/portfolio_aggregate_-_dealt_4.xlsx"
)
ABS_DATA_API = "https://data.api.abs.gov.au/rest"
ABS_GDP_DATAFLOW = "ABS,ANA_AGG,1.0.0"
# Expenditure measure — GDP(A), current price, seasonally adjusted, quarterly.
ABS_GDP_KEY = "1.1.1.10.50.0010.10.Q.AUS.A"

CACHE_TTL_AOFM = 43200
CACHE_TTL_ABS = 21600

UA = (
    "Mozilla/5.0 (compatible; MorningMacro/1.0; +https://anthemic-developments.com/economics/)"
)

_cache: dict[str, tuple[float, object]] = {}


def _cache_get(key: str, ttl: float):
    row = _cache.get(key)
    if not row:
        return None
    ts, data = row
    if time.time() - ts > ttl:
        return None
    return data


def _cache_set(key: str, data: object) -> None:
    _cache[key] = (time.time(), data)


def _abs_fetch(url: str, timeout: int = 45) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except (TimeoutError, OSError):
        return _fetch_curl(url, timeout=min(timeout, 30))


def _excel_serial_to_period(serial: float) -> str:
    base = date(1899, 12, 30)
    dt = base + timedelta(days=int(float(serial)))
    return f"{dt.year}-{dt.month:02d}"


def _xlsx_shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    out: list[str] = []
    for si in root.findall(".//m:si", ns):
        out.append("".join(t.text or "" for t in si.findall(".//m:t", ns)))
    return out


def _xlsx_sheet_path(z: zipfile.ZipFile, sheet_name: str) -> str:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    ns = {
        "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    rid_to_target = {
        rel.attrib["Id"]: rel.attrib["Target"].lstrip("/")
        for rel in rels.findall("r:Relationship", rns)
    }
    for sh in wb.find("m:sheets", ns).findall("m:sheet", ns):
        if sh.attrib.get("name") == sheet_name:
            rid = sh.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rid_to_target.get(rid or "", "")
            return target if target.startswith("xl/") else f"xl/{target}"
    raise RuntimeError(f"xlsx sheet {sheet_name!r} not found")


def _cell_value(c: ET.Element, ss: list[str], ns: dict) -> object:
    v = c.find("m:v", ns)
    if v is None or v.text is None:
        return None
    if c.attrib.get("t") == "s":
        return ss[int(v.text)]
    raw = v.text
    try:
        if "." in raw:
            return float(raw)
        return int(raw)
    except ValueError:
        return raw


def _parse_aofm_face_value_rows(raw: bytes) -> list[dict]:
    z = zipfile.ZipFile(io.BytesIO(raw))
    ss = _xlsx_shared_strings(z)
    sheet = _xlsx_sheet_path(z, "FaceValue")
    root = ET.fromstring(z.read(sheet))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    rows_out: list[dict] = []
    in_data = False
    for row in root.findall(".//m:row", ns):
        cells = row.findall("m:c", ns)
        if not cells:
            continue
        vals = [_cell_value(c, ss, ns) for c in cells]
        while len(vals) < 57:
            vals.append(None)
        if not in_data:
            if vals[0] == "Instrument":
                in_data = True
            continue
        serial = vals[0]
        if not isinstance(serial, (int, float)):
            continue
        period = _excel_serial_to_period(serial)
        tb = abs(float(vals[1])) if isinstance(vals[1], (int, float)) else None
        tib = abs(float(vals[2])) if isinstance(vals[2], (int, float)) else None
        tnotes = abs(float(vals[3])) if isinstance(vals[3], (int, float)) else None
        total_main = abs(float(vals[4])) if isinstance(vals[4], (int, float)) else None
        if total_main is None:
            continue
        rows_out.append(
            {
                "period": period,
                "tb": tb / 1_000_000_000 if tb is not None else None,
                "tib": tib / 1_000_000_000 if tib is not None else None,
                "tnotes": tnotes / 1_000_000_000 if tnotes is not None else None,
                "total_main": total_main / 1_000_000_000,
            }
        )
    if not rows_out:
        raise RuntimeError("AOFM FaceValue sheet empty")
    return rows_out


def _resolve_aofm_dealt_xlsx_url() -> str:
    cached = _cache_get("aofm:url", CACHE_TTL_AOFM)
    if cached:
        return str(cached)
    try:
        html = _fetch(AOFM_HUB, timeout=25).decode("utf-8", "replace")
        candidates = re.findall(
            r'href="(/sites/default/files/\d{4}-\d{2}-\d{2}/portfolio_aggregate_-_dealt(?:_\d+)?\.xlsx)"',
            html,
            flags=re.I,
        )
        if candidates:
            # Prefer portfolio_aggregate_-_dealt_4.xlsx (full aggregate) over executive summary.
            full = [c for c in candidates if "executive_summary" not in c.lower()]
            pick = sorted(full or candidates)[-1]
            url = f"https://www.aofm.gov.au{pick}"
            _cache_set("aofm:url", url)
            return url
    except Exception:
        pass
    _cache_set("aofm:url", AOFM_DEALT_FALLBACK)
    return AOFM_DEALT_FALLBACK


def fetch_aofm_ags_face() -> dict:
    """Commonwealth AGS face value (AOFM monthly positions — total main funding instruments)."""
    cached = _cache_get("aofm:ags", CACHE_TTL_AOFM)
    if cached is not None:
        return dict(cached)

    url = _resolve_aofm_dealt_xlsx_url()
    raw = _fetch(url, timeout=90)
    rows = _parse_aofm_face_value_rows(raw)
    last = rows[-1]
    prev = rows[-2] if len(rows) > 1 else None
    billions = last["total_main"]
    prev_b = prev["total_main"] if prev else None
    q = quote_from_pair(billions, prev_b)
    card = {
        **q,
        "display": format_aud_billions(billions),
        "asOf": last["period"],
        "source": "AOFM",
        "freshnessKind": "monthly",
        "freshnessNote": "AGS face value (TB+TIB+T-Notes)",
        "aofmMeta": {
            "tbBillions": last.get("tb"),
            "tibBillions": last.get("tib"),
            "tnotesBillions": last.get("tnotes"),
            "sourceUrl": url,
        },
    }
    _cache_set("aofm:ags", card)
    return dict(card)


def _parse_abs_json_observations(payload: dict) -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    datasets = payload.get("data", {}).get("dataSets") or payload.get("dataSets") or []
    if not datasets:
        return rows
    obs = datasets[0].get("observations") or {}
    structure = payload.get("data", {}).get("structures") or payload.get("structures") or []
    periods: list[str] = []
    if structure:
        dims = structure[0].get("dimensions", {}).get("observation") or []
        for dim in dims:
            if dim.get("id") in ("TIME_PERIOD", "TIME", "FREQ"):
                for val in dim.get("values") or []:
                    periods.append(str(val.get("id") or val.get("name") or ""))
                break
    if not periods:
        periods = sorted({k.split(":")[0] for k in obs.keys() if obs.get(k)})
    for key, val in obs.items():
        idx = int(key.split(":")[0])
        period = periods[idx] if idx < len(periods) else key
        try:
            v = float(val[0])
        except (IndexError, TypeError, ValueError):
            continue
        rows.append((period, v))
    rows.sort(key=lambda r: r[0])
    return rows


def _fetch_abs_gdp_quarters() -> list[tuple[str, float]]:
    url = (
        f"{ABS_DATA_API}/data/{urllib.parse.quote(ABS_GDP_DATAFLOW)}"
        f"/{urllib.parse.quote(ABS_GDP_KEY)}"
        f"?lastNObservations=8&format=jsondata"
    )
    payload = json.loads(_abs_fetch(url).decode("utf-8", "replace"))
    rows = _parse_abs_json_observations(payload)
    if not rows:
        raise RuntimeError("ABS GDP empty")
    return rows


def _fetch_fred_au_gdp_quarters() -> list[tuple[str, float]]:
    from valuation_fetch import _fred_observations

    rows = _fred_observations("NGDPSAXDCAUQ", start="2018-01-01")
    out: list[tuple[str, float]] = []
    for dt, val in rows:
        period = dt[:7] if len(dt) >= 7 else dt
        out.append((period, val / 1000.0))  # millions → billions (quarterly)
    return out


def _quarter_label_from_period(period: str) -> str | None:
    m = re.match(r"^(\d{4})-(\d{2})$", period)
    if not m:
        return None
    month = int(m.group(2))
    q = {1: 1, 3: 1, 4: 2, 6: 2, 7: 3, 9: 3, 10: 4, 12: 4}.get(month)
    if not q:
        return None
    return f"{m.group(1)}-Q{q}"


def _quarter_end_utc_ms(label: str) -> int | None:
    m = re.match(r"^(\d{4})-Q([1-4])$", label, re.I)
    if not m:
        return None
    year = int(m.group(1))
    end_month = int(m.group(2)) * 3
    if end_month == 12:
        end = datetime(year, 12, 31, tzinfo=timezone.utc)
    else:
        end = datetime(year, end_month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1)
    return int(end.timestamp() * 1000)


def fetch_au_gdp_annual() -> dict:
    """Nominal GDP — annual sum of last 4 quarters (ABS preferred, IMF/FRED fallback)."""
    cached = _cache_get("aus:gdp", CACHE_TTL_ABS)
    if cached is not None:
        return dict(cached)

    source = "ABS"
    try:
        quarters = _fetch_abs_gdp_quarters()
    except Exception:
        quarters = _fetch_fred_au_gdp_quarters()
        source = "FRED / IMF"

    if len(quarters) < 4:
        raise RuntimeError("insufficient AU GDP quarters")

    window = quarters[-4:]
    annual = sum(v for _, v in window)
    prev_window = quarters[-8:-4] if len(quarters) >= 8 else quarters[:-4]
    prev_annual = sum(v for _, v in prev_window) if len(prev_window) == 4 else None
    q = quote_from_pair(annual, prev_annual)
    last_period = window[-1][0]
    as_of = _quarter_label_from_period(last_period) or last_period
    card = {
        **q,
        "display": format_aud_billions(annual),
        "asOf": as_of,
        "asOfUtc": _quarter_end_utc_ms(as_of)
        if re.match(r"\d{4}-Q[1-4]", as_of, re.I)
        else int(datetime.strptime(f"{last_period}-01", "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000)
        if re.match(r"\d{4}-\d{2}", last_period)
        else None,
        "source": source,
        "freshnessKind": "annual",
        "freshnessNote": "Annual nominal (sum of last 4 qtrs)",
        "gdpMeta": {
            "quarters": [p for p, _ in window],
            "quarterlyBillions": [v for _, v in window],
        },
    }
    _cache_set("aus:gdp", card)
    return dict(card)


AUS_METRICS = frozenset({"au-cgs", "au-gdp"})


def fetch_aus_metric(metric: str) -> dict:
    if metric == "au-cgs":
        return fetch_aofm_ags_face()
    if metric == "au-gdp":
        return fetch_au_gdp_annual()
    raise ValueError(f"Unknown metric: {metric}")


def fetch_aus_batch(metric_ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for mid in metric_ids:
        if mid not in AUS_METRICS:
            continue
        try:
            out[mid] = fetch_aus_metric(mid)
        except Exception as exc:
            out[mid] = {"error": str(exc)}
    return out
