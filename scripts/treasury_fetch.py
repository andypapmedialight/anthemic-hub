"""U.S. Treasury Fiscal Data API — server-side fetch for Morning Macro."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from valuation_fetch import quote_from_pair

TREASURY_API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
DEBT_TO_PENNY = "/v2/accounting/od/debt_to_penny"
CACHE_TTL_DEBT = 3600

UA = (
    "Mozilla/5.0 (compatible; MorningMacro/1.0; +https://anthemic-developments.com/economics/)"
)

_cache: dict[str, tuple[float, object]] = {}

TREASURY_METRICS = frozenset({"debt-to-penny"})


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


def _record_date_utc_ms(date_str: str) -> int | None:
    if not date_str or len(date_str) < 10:
        return None
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return None


def _treasury_json(path: str, params: dict[str, str], *, timeout: int = 30) -> dict:
    query = urllib.parse.urlencode(params)
    url = f"{TREASURY_API}{path}?{query}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def fetch_debt_to_penny() -> dict:
    """Debt to the Penny — daily debt held by the public (Treasury Fiscal Data)."""
    cached = _cache_get("treasury:debt-penny", CACHE_TTL_DEBT)
    if cached is not None:
        return dict(cached)

    payload = _treasury_json(
        DEBT_TO_PENNY,
        {
            "fields": "record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt",
            "sort": "-record_date",
            "page[size]": "2",
        },
    )
    rows = payload.get("data") or []
    if not rows:
        raise RuntimeError("Treasury debt_to_penny empty")

    latest = rows[0]
    prev = rows[1] if len(rows) > 1 else None

    def _billions(row: dict, field: str) -> float:
        return float(row[field]) / 1_000_000_000

    held = _billions(latest, "debt_held_public_amt")
    prev_held = _billions(prev, "debt_held_public_amt") if prev else None
    record_date = str(latest.get("record_date") or "")

    card = {
        "debtHeldPublicBillions": held,
        "prevDebtHeldPublicBillions": prev_held,
        "totalDebtBillions": _billions(latest, "tot_pub_debt_out_amt"),
        "intragovBillions": _billions(latest, "intragov_hold_amt"),
        "recordDate": record_date,
        "prevRecordDate": str(prev.get("record_date") or "") if prev else None,
        "asOfUtc": _record_date_utc_ms(record_date),
        "source": "U.S. Treasury",
        "freshnessKind": "daily",
        "freshnessNote": "Debt to the Penny · debt held by the public",
        "treasuryFiscalData": True,
    }
    level_q = quote_from_pair(held, prev_held)
    card["levelChangeBillions"] = level_q.get("change")
    card["levelPct"] = level_q.get("pct")

    _cache_set("treasury:debt-penny", card)
    return dict(card)


def fetch_treasury_metric(metric: str) -> dict:
    if metric == "debt-to-penny":
        return fetch_debt_to_penny()
    raise ValueError(f"Unknown metric: {metric}")
