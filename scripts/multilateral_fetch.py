"""Fetch IMF DataMapper, OECD SDMX, and World Bank indicators for Morning Macro."""
from __future__ import annotations

import csv
import io
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

UPSTREAM_TIMEOUT = 45
CACHE_TTL_OECD = 86400
CACHE_TTL_IMF = 21600
CACHE_TTL_WB = 86400

UA = (
    "Mozilla/5.0 (compatible; MorningMacro/1.0; +https://anthemic-developments.com/economics/)"
)

_cache: dict[str, tuple[float, object]] = {}

OECD_STES_URL = (
    "https://sdmx.oecd.org/public/rest/data/"
    "OECD.SDD.STES,DSD_STES@DF_CLI,4.1/"
    "{country}.M.{measure}.IX._Z.AA.IX._Z.H."
    "?startPeriod={start}&format=csvfilewithlabels"
)

WB_API = "https://api.worldbank.org/v2/country/{countries}/indicator/{indicator}"
IMF_API = "https://www.imf.org/external/datamapper/api/v1/{indicator}/{countries}"


def _fetch(url: str, timeout: int = UPSTREAM_TIMEOUT, *, retries: int = 2) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": UA,
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


def quote_from_pair(current: float, previous: float | None) -> dict:
    change = (current - previous) if previous is not None else None
    pct = (change / previous * 100) if (change is not None and previous) else None
    return {"price": current, "change": change, "pct": pct}


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
    cached = _cache_get(cache_key, CACHE_TTL_OECD)
    if cached is not None:
        return dict(cached)

    url = OECD_STES_URL.format(
        country=urllib.parse.quote(country),
        measure=urllib.parse.quote(measure),
        start=start,
    )
    text = _fetch(url).decode("utf-8", "replace")
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
    _cache_set(cache_key, card)
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
    cached = _cache_get(cache_key, CACHE_TTL_IMF)
    if cached is not None:
        return dict(cached)

    url = IMF_API.format(
        indicator=urllib.parse.quote(indicator),
        countries=urllib.parse.quote(country),
    )
    payload = json.loads(_fetch(url, timeout=60).decode("utf-8", "replace"))
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
    _cache_set(cache_key, series)
    return series


def _imf_card_rows(series: dict[str, float]) -> list[tuple[str, float]]:
    """Prefer near-term WEO vintages (not far-future 2030+ projections on the card)."""
    rows = sorted(series.items(), key=lambda r: int(r[0]))
    horizon = datetime.now(timezone.utc).year + 1
    window = [(y, v) for y, v in rows if int(y) <= horizon]
    if len(window) >= 2:
        return window
    return rows[-2:] if len(rows) >= 2 else rows


def fetch_imf_datamapper(indicator: str, country: str, *, suffix: str = "%") -> dict:
    cache_key = f"imf:card:{indicator}:{country}"
    cached = _cache_get(cache_key, CACHE_TTL_IMF)
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
    _cache_set(cache_key, card)
    return dict(card)


def _worldbank_series(countries: str, indicator: str, *, start: int = 2010) -> dict[str, list[tuple[str, float]]]:
    cache_key = f"wb:{indicator}:{countries}:{start}"
    cached = _cache_get(cache_key, CACHE_TTL_WB)
    if cached is not None:
        return dict(cached)

    url = WB_API.format(
        countries=urllib.parse.quote(countries),
        indicator=urllib.parse.quote(indicator),
    )
    params = urllib.parse.urlencode(
        {"format": "json", "date": f"{start}:{datetime.now().year + 1}", "per_page": 20000}
    )
    payload = json.loads(_fetch(f"{url}?{params}").decode("utf-8", "replace"))
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
    _cache_set(cache_key, by_country)
    return by_country


def fetch_worldbank(indicator: str, country_iso3: str, *, dp: int = 1, suffix: str = "") -> dict:
    cache_key = f"wb:card:{indicator}:{country_iso3}"
    cached = _cache_get(cache_key, CACHE_TTL_WB)
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
    _cache_set(cache_key, card)
    return dict(card)


def _imf(indicator: str, country: str) -> dict:
    return fetch_imf_datamapper(indicator, country)


def _wb(indicator: str, country: str, *, dp: int = 1, suffix: str = "%") -> dict:
    return fetch_worldbank(indicator, country, dp=dp, suffix=suffix)


def _oecd_cli(country: str) -> dict:
    return fetch_oecd_cli(country)


def _oecd_stes(country: str, measure: str, note: str) -> dict:
    return fetch_oecd_stes(country, measure, note=note)


METRIC_SPECS: dict[str, dict] = {
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
    "imf-gdp-au": {"label": "IMF WEO GDP Growth — AU", "ticker": "WEO", "fn": lambda: _imf("NGDP_RPCH", "AUS")},
    "imf-gdp-us": {"label": "IMF WEO GDP Growth — US", "ticker": "WEO", "fn": lambda: _imf("NGDP_RPCH", "USA")},
    "imf-inflation-au": {"label": "IMF CPI Inflation — AU", "ticker": "CPI", "fn": lambda: _imf("PCPIPCH", "AUS")},
    "imf-inflation-us": {"label": "IMF CPI Inflation — US", "ticker": "CPI", "fn": lambda: _imf("PCPIPCH", "USA")},
    "imf-gov-debt-au": {"label": "IMF Govt Debt — AU", "ticker": "DEBT", "fn": lambda: _imf("GGXWDG_NGDP", "AUS")},
    "imf-gov-debt-us": {"label": "IMF Govt Debt — US", "ticker": "DEBT", "fn": lambda: _imf("GGXWDG_NGDP", "USA")},
    "imf-unemployment-au": {"label": "IMF Unemployment — AU", "ticker": "U/E", "fn": lambda: _imf("LUR", "AUS")},
    "imf-unemployment-us": {"label": "IMF Unemployment — US", "ticker": "U/E", "fn": lambda: _imf("LUR", "USA")},
    "imf-current-account-au": {
        "label": "IMF Current Account — AU",
        "ticker": "CA",
        "fn": lambda: _imf("BCA_NGDPD", "AUS"),
    },
    "imf-current-account-us": {
        "label": "IMF Current Account — US",
        "ticker": "CA",
        "fn": lambda: _imf("BCA_NGDPD", "USA"),
    },
    # World Bank WDI — levels, growth, trade, inflation
    "wb-gni-au": {"label": "GNI per Capita — AU", "ticker": "GNI", "fn": lambda: _wb("NY.GNP.PCAP.CD", "AUS", dp=0, suffix="")},
    "wb-gni-us": {"label": "GNI per Capita — US", "ticker": "GNI", "fn": lambda: _wb("NY.GNP.PCAP.CD", "USA", dp=0, suffix="")},
    "wb-gdp-growth-au": {
        "label": "GDP Growth (actual) — AU",
        "ticker": "GDP",
        "fn": lambda: _wb("NY.GDP.MKTP.KD.ZG", "AUS"),
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
        "fn": lambda: _wb("FP.CPI.TOTL.ZG", "AUS"),
    },
    "wb-inflation-us": {
        "label": "CPI Inflation (actual) — US",
        "ticker": "CPI",
        "fn": lambda: _wb("FP.CPI.TOTL.ZG", "USA"),
    },
}

METRICS = frozenset(METRIC_SPECS)


def fetch_multilateral_metric(metric: str) -> dict:
    spec = METRIC_SPECS.get(metric)
    if not spec:
        raise ValueError(f"Unknown metric: {metric}")
    data = spec["fn"]()
    out = dict(data)
    out.pop("history", None)
    return out


def fetch_multilateral_history(metric: str, *, days: int = 1825) -> list[dict]:
    spec = METRIC_SPECS.get(metric)
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
        if mid in METRICS and mid not in unique:
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
        "imf-unemployment-au",
        "wb-gdp-growth-au",
        "wb-gni-au",
    )
    for mid in defaults:
        try:
            fetch_multilateral_metric(mid)
        except Exception:
            pass
