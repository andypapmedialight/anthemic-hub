# HTMX — Future development notes (Morning Macro)

**Status:** Research only — not implemented.  
**Date:** 2026-05-21  
**Scope:** `anthemic-hub/economics/` (`index.html`, `macro.js`, hub proxies)

---

## What HTMX is

[HTMX](https://four.htmx.org/) (v4) extends HTML so **any element** can drive HTTP requests and **swap HTML fragments** into the page — not only `<a>` and `<form>`. It targets **hypermedia-driven UIs**: the server returns markup; the browser updates targets. ~11k minified, zero dependencies.

| Mechanism | Role |
|-----------|------|
| `hx-get` / `hx-post` / … | Trigger requests from clicks, submits, or custom triggers |
| `hx-target` | Where response HTML goes (e.g. `#equities-grid`) |
| `hx-swap` | How to merge (`innerHTML`, `outerHTML`, `beforeend`, …) |
| `hx-trigger` | When to fire (`click`, `every 5m`, `revealed`, …) |
| `hx-swap-oob` | Update multiple regions from one response |
| `hx-boost` | Progressive enhancement on normal links/forms |

**v4 notes** ([migration guide](https://four.htmx.org/docs/get-started/migration)):

- v4 is marked **under construction** on the site.
- Explicit attribute inheritance by default (`:inherited`); 2.x used implicit inheritance.
- 4xx/5xx responses **swap by default** (unlike 2.x).
- Uses native `fetch()` (not XHR).

Compat snippet if adopting 2.x-style error handling:

```html
<script>
  htmx.config.implicitInheritance = true;
  htmx.config.noSwap = [204, 304, '4xx', '5xx'];
</script>
<script src="https://cdn.jsdelivr.net/npm/htmx.org@next/dist/htmx.min.js" defer></script>
```

Or load the [`htmx-2-compat`](https://four.htmx.org/extensions/htmx-2-compat) extension.

**References:** [docs](https://four.htmx.org/docs/) · [reference](https://four.htmx.org/reference/) · [migration](https://four.htmx.org/docs/get-started/migration)

---

## Current Morning Macro architecture

| Piece | Role |
|-------|------|
| `economics/index.html` | Shell, CSS, empty section grids, chart modal markup |
| `economics/macro.js` | ~2.6k lines: fetch orchestration, rendering, cache, throttles, charts |
| `scripts/serve-hub.py` | Static hub + **JSON** proxies: `/economics/proxy/yahoo`, `fred`, `google`, `valuation` |
| `scripts/valuation_server.py` | Loopback JSON API for FRED valuation metrics (production) |

**Client-side today:**

- `innerHTML` into `#equities-grid`, `#valuation-grid`, `#commodities-grid`, `#bonds-grid`, `#fx-grid`, `#crypto-grid`
- `fetch()` to Yahoo/Google (via proxy), Frankfurter, CoinGecko, FRED
- `localStorage`: visibility (`mmd:vis`), provider (`mmd:provider`), API key, quote cache, refresh throttles
- Global Refresh, per-card refresh, chart modal (SVG + period tabs), customize pills, add-stock search

**Gap for HTMX:** Proxies return **JSON** (or upstream bodies), not **HTML partials**. HTMX expects server-rendered fragments.

---

## Fit assessment

### Strong fits (need new HTML fragment endpoints)

| Feature | HTMX pattern | Replaces / simplifies in `macro.js` |
|---------|--------------|-------------------------------------|
| Global refresh | `hx-get` → swap root or multiple grids (`hx-swap-oob`) | `loadAll()`, section re-render |
| Per-card refresh | `hx-get` → `hx-target="closest .card"` `hx-swap="outerHTML"` | `refreshCard()`, partial `renderSectionGrid()` |
| Chart modal | `hx-get` → `#chart-modal-body`; period tabs as further `hx-get` | Chart load handlers, tab re-fetch |
| Valuation section | `hx-get` on `#valuation-grid` (`load` or refresh) | Batched FRED + `renderGrid` for val |
| Provider switch (info box) | `hx-post` → swap `#info-body` | `setProvider()` + `renderInfoBox()` **if** prefs move server-side |
| Ambient updates | `hx-trigger="every 5m"` on a section | Optional soft refresh (server throttle) |

### Weak fits — keep `macro.js` (or thin JS layer)

- Multi-provider orchestration (Yahoo / Google / Alpha Vantage)
- `localStorage` visibility, customize pills, add-stock autocomplete
- Yahoo history → SVG chart pipeline (unless server renders SVG/HTML chart)
- Parallel `Promise.all` across six sections with shared in-memory `DATA`
- Alpha Vantage key banner (unless keys move to server session)

**Full HTMX rewrite** = move quote fetch, cache, throttle, and `renderCard()` to the server (Python templates, etc.). Large architecture change.

### Recommended approach: **hybrid**

| Layer | Technology |
|-------|------------|
| Shell, CSS, a11y | `index.html` |
| Quotes, charts, search, LS throttles | `macro.js` (initially unchanged) |
| Incremental updates (future) | HTMX + `/economics/fragment/*` in `serve-hub.py` |

**Suggested first vertical slice:** Valuation grid only — server returns HTML for `#valuation-grid`; validates deploy, SRI stamping (`scripts/stamp-economics-sri.js`), then expand.

---

## Example `index.html` wiring (future)

```html
<script>
  htmx.config.implicitInheritance = true;
  htmx.config.noSwap = [204, 304, '4xx', '5xx'];
</script>
<script src="https://cdn.jsdelivr.net/npm/htmx.org@next/dist/htmx.min.js" defer></script>
<script src="macro.js" defer></script>
```

```html
<button type="button" class="refresh-btn" id="refresh-btn"
  hx-get="/economics/fragment/all?force=1"
  hx-target="#economics-swap-root"
  hx-swap="innerHTML"
  hx-indicator="#refresh-btn">
  Refresh
</button>

<div class="cards" id="valuation-grid"
  hx-get="/economics/fragment/valuation"
  hx-trigger="load"
  hx-swap="innerHTML">
</div>

<button type="button" class="card-refresh"
  hx-get="/economics/fragment/card?section=eq&sym=AAPL"
  hx-target="closest .card"
  hx-swap="outerHTML">
</button>

<button type="button" class="card-chart"
  hx-get="/economics/fragment/chart?section=eq&sym=AAPL&days=7"
  hx-target="#chart-modal-body"
  hx-swap="innerHTML">
</button>
```

Spinners: `htmx:afterRequest` / `hx-indicator` or keep classes in `macro.js`.

---

## Backend work required

Extend `scripts/serve-hub.py` (or adjacent module) with routes that return **HTML**, reusing existing fetch logic:

| Route (proposed) | Returns |
|------------------|---------|
| `GET /economics/fragment/valuation` | `#valuation-grid` inner HTML |
| `GET /economics/fragment/card?section=&key=` | Single card `outerHTML` |
| `GET /economics/fragment/chart?…` | Chart modal body + optional stats |
| `GET /economics/fragment/all?force=` | Multi-section (or use `hx-swap-oob`) |
| `POST /economics/preferences/provider` | Updated info panel (optional) |

Implementation notes:

- Port `renderCard()` markup to Python templates (or shared string builder).
- Reuse `valuation_fetch.fetch_valuation_metric` and proxy helpers from `serve-hub.py`.
- Move refresh throttle limits server-side (mirror `REFRESH_MIN_GAP_MS`, `REFRESH_MAX_PER_HOUR`, etc. in `macro.js`).
- Keep CORS/proxy host allowlists as today.

---

## Files to touch when implementing

| File | Change |
|------|--------|
| `economics/index.html` | Script tag, `hx-*` on refresh, grids, cards, chart modal |
| `economics/macro.js` | Shrink or gate code paths replaced by fragments; keep charts/search/LS |
| `scripts/serve-hub.py` | New fragment handlers + HTML responses |
| `scripts/valuation_fetch.py` | Unchanged logic; called from fragment handlers |
| `scripts/stamp-economics-sri.js` | If CDN htmx added, extend SRI stamping if used for `macro.js` pattern |
| `scripts/check-economics.js` | Update checks if new endpoints required |

---

## Risks and checklist before merge

- [ ] Pin HTMX version (v4 `@next` is moving).
- [ ] Read [migration guide](https://four.htmx.org/docs/get-started/migration) before production.
- [ ] Run `npx htmx.org@next upgrade-check` on templates when upgrading.
- [ ] Server-side throttle replaces client-only bot protection for fragment routes.
- [ ] Error responses: design HTML error partials or set `noSwap` for 4xx/5xx.
- [ ] Alpha Vantage key: still client `localStorage` unless session/cookie path added.
- [ ] Deploy path: confirm nginx/systemd routes for new `/economics/fragment/*` paths.

---

## Decision summary

| Question | Answer |
|----------|--------|
| Does HTMX match this page? | **Partially** — strong for refresh/swap/modal **with** HTML fragment APIs |
| One script tag enough? | **No** — current app is JSON + `innerHTML` |
| Best first feature | Valuation grid or scoped global refresh |
| Keep in JS for now | Charts, providers, customize/search, AV key UX |

---

*Generated from agent research conversation; implement when Morning Macro moves toward server-driven partials.*
