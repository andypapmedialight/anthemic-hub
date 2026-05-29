"""Backward-compatible shim — multilateral fetchers live in valuation_fetch.py."""
from valuation_fetch import (  # noqa: F401
    MULTILATERAL_METRICS as METRICS,
    fetch_multilateral_batch,
    fetch_multilateral_history,
    fetch_multilateral_metric,
    warm_multilateral_cache,
)
