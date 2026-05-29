// ─────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────
let AV_KEY = 'YOUR_API_KEY_HERE';

function hasValidAvKey() {
  return Boolean(AV_KEY && AV_KEY !== 'YOUR_API_KEY_HERE' && AV_KEY.length >= 8);
}

// ── Cache (tiered TTL) ────────────────────────────
const CACHE_TTL_MS = {
  market: 2 * 60 * 1000,
  bond: 5 * 60 * 1000,
  fx: 12 * 60 * 60 * 1000,
  crypto: 2 * 60 * 1000,
  valuation: 30 * 60 * 1000,
  valuationLive: 6 * 60 * 60 * 1000,
  default: 5 * 60 * 1000,
};

/** Max age before UI appends a “market close” (or section-specific) lag note. */
const STALE_AFTER_MS = {
  live: 30 * 60 * 1000,
  daily: 3 * 86400000,
  quarterly: 120 * 86400000,
  estimated: 45 * 86400000,
  reference: Infinity,
};

let macroFreshnessSummary = null;
/** FRED rows for valuation cards (quarterly change); charts load a longer series on demand. */
const VAL_FRED_CARD_LOOKBACK_DAYS = 800;

// ── Load throttle (per-browser, limits refresh spam / bots) ──
const REFRESH_MIN_GAP_MS = 45 * 1000;
const REFRESH_MAX_PER_HOUR = 24;
const PAGE_LOAD_MIN_GAP_MS = 12 * 1000;
const PAGE_LOAD_MAX_PER_HOUR = 48;
const CARD_REFRESH_MIN_GAP_MS = 10 * 1000;
const THROTTLE_WINDOW_MS = 60 * 60 * 1000;
let refreshBtnTimer = null;
const cardRefreshAt = new Map(); // itemKey → last forced fetch ts

function getThrottleState() {
  const now = Date.now();
  const cutoff = now - THROTTLE_WINDOW_MS;
  try {
    const raw = localStorage.getItem('mmd:throttle');
    const state = raw ? JSON.parse(raw) : {};
    return {
      lastForce: state.lastForce || 0,
      lastPageLoad: state.lastPageLoad || 0,
      forceHits: (state.forceHits || []).filter(ts => ts > cutoff),
      pageHits: (state.pageHits || []).filter(ts => ts > cutoff),
    };
  } catch {
    return { lastForce: 0, lastPageLoad: 0, forceHits: [], pageHits: [] };
  }
}

function saveThrottleState(state) {
  try { localStorage.setItem('mmd:throttle', JSON.stringify(state)); } catch {}
}

function formatThrottleWait(ms) {
  const sec = Math.max(1, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}s`;
  return `${Math.ceil(sec / 60)} min`;
}

function setRefreshButtonBlocked(blocked, retryAfterMs = 0) {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.disabled = blocked;
  btn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  clearTimeout(refreshBtnTimer);
  if (blocked && retryAfterMs > 0) {
    refreshBtnTimer = setTimeout(() => setRefreshButtonBlocked(false), retryAfterMs);
  }
}

/** @returns {{ ok: true } | { ok: false, message: string, retryAfterMs: number }} */
function checkForceRefreshThrottle() {
  const state = getThrottleState();
  const now = Date.now();
  const gapWait = REFRESH_MIN_GAP_MS - (now - state.lastForce);
  if (state.lastForce && gapWait > 0) {
    return {
      ok: false,
      message: `Please wait ${formatThrottleWait(gapWait)} before refreshing again`,
      retryAfterMs: gapWait,
    };
  }
  if (state.forceHits.length >= REFRESH_MAX_PER_HOUR) {
    const retryAfterMs = state.forceHits[0] + THROTTLE_WINDOW_MS - now;
    return {
      ok: false,
      message: `Refresh limit reached — try again in ${formatThrottleWait(retryAfterMs)}`,
      retryAfterMs,
    };
  }
  return { ok: true };
}

function recordForceRefreshThrottle() {
  const state = getThrottleState();
  const now = Date.now();
  state.lastForce = now;
  state.forceHits.push(now);
  saveThrottleState(state);
}

/** @returns {{ ok: true } | { ok: false, message: string, cacheOnly: true }} */
function checkPageLoadThrottle() {
  const state = getThrottleState();
  const now = Date.now();
  const gapWait = PAGE_LOAD_MIN_GAP_MS - (now - state.lastPageLoad);
  if (state.lastPageLoad && gapWait > 0) {
    return {
      ok: false,
      message: `Loaded recently — wait ${formatThrottleWait(gapWait)} for fresh data`,
      cacheOnly: true,
    };
  }
  if (state.pageHits.length >= PAGE_LOAD_MAX_PER_HOUR) {
    return {
      ok: false,
      message: 'Hourly load limit reached — showing cached quotes',
      cacheOnly: true,
    };
  }
  return { ok: true };
}

function recordPageLoadThrottle() {
  const state = getThrottleState();
  const now = Date.now();
  state.lastPageLoad = now;
  state.pageHits.push(now);
  saveThrottleState(state);
}

function checkCardRefreshThrottle(itemKey) {
  const last = cardRefreshAt.get(itemKey) || 0;
  const wait = CARD_REFRESH_MIN_GAP_MS - (Date.now() - last);
  if (wait > 0) {
    return { ok: false, message: `Wait ${formatThrottleWait(wait)} before refreshing this card` };
  }
  return { ok: true };
}

function recordCardRefreshThrottle(itemKey) {
  cardRefreshAt.set(itemKey, Date.now());
}
function cacheTierForKey(key) {
  if (key.startsWith('val-live:') || key.startsWith('val-live-batch')) return 'valuationLive';
  if (key.startsWith('val:') || key.startsWith('val:fred')) return 'valuation';
  if (key.startsWith('b:')) return 'bond';
  if (key.startsWith('cg:') || key.includes(':q:')) return 'market';
  if (key.includes(':fx:')) return 'fx';
  if (key.startsWith('yh:') || key.startsWith('fred:') || key.startsWith('fx:')) return 'valuation';
  return 'default';
}

function cacheTtlForKey(key) {
  return CACHE_TTL_MS[cacheTierForKey(key)] ?? CACHE_TTL_MS.default;
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`mmd:${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return (Date.now() - ts < cacheTtlForKey(key)) ? data : null;
  } catch { return null; }
}

/** Returns cached payload even past TTL (for stale-while-revalidate paint). */
function cacheGetStale(key) {
  try {
    const raw = localStorage.getItem(`mmd:${key}`);
    if (!raw) return null;
    return JSON.parse(raw).data ?? null;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { localStorage.setItem(`mmd:${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function cacheKeyForItem(item, section) {
  const k = getItemKey(item);
  if (section.key === 'eq') return `${activeProvider}:q:${item.sym || k}`;
  if (section.key === 'comm') return item.fredId ? `fred:comm:${item.fredId}` : `${activeProvider}:q:${item.sym || k}`;
  if (section.key === 'bond') return `b:${item.id}`;
  if (section.key === 'fx') return `${activeProvider}:fx:${item.from}:${item.to}`;
  if (section.key === 'crypto') return `cg:${item.sym}`;
  return k;
}

function attachFreshness(data, kind, extra = {}) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    freshnessKind: kind,
    freshnessNote: extra.note ?? data.freshnessNote ?? null,
    anchorDate: extra.anchorDate ?? data.anchorDate ?? null,
    estimated: kind === 'estimated' || extra.estimated === true || data.estimated === true,
  };
}

function quarterLabelFromFredDate(dateStr) {
  if (!dateStr) return '';
  const m = parseInt(dateStr.slice(5, 7), 10);
  const y = dateStr.slice(0, 4);
  const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
  return `Q${q} ${y}`;
}

function isDateOnlyUtc(ms) {
  const d = new Date(ms);
  return (
    !Number.isNaN(d.getTime())
    && d.getUTCHours() === 0 && d.getUTCMinutes() === 0
    && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  );
}

/** Resolve freshness tier (handles legacy cache rows missing freshnessKind). */
function inferFreshnessKind(meta) {
  if (meta.freshnessKind) return meta.freshnessKind;
  if (meta.estimated || meta.buffettMeta || meta.debtEstMeta || meta.anchorDate) return 'estimated';
  if (meta.fallback || meta.static) return 'reference';
  if (meta.live) return 'live';
  const sk = meta.sectionKey;
  if (sk === 'fx') return 'daily';
  if (sk === 'eq' || sk === 'comm' || sk === 'crypto') return 'live';
  if (sk === 'val') return 'quarterly';
  if (sk === 'bond' && meta.asOfUtc != null && isDateOnlyUtc(meta.asOfUtc)) return 'daily';
  if (meta.asOfUtc != null && isDateOnlyUtc(meta.asOfUtc)) return 'daily';
  return 'live';
}

function staleThresholdMs(meta, kind) {
  if (kind === 'daily' && meta.freshnessNote?.includes('prior biz day')) {
    return 7 * 86400000;
  }
  return STALE_AFTER_MS[kind] ?? STALE_AFTER_MS.live;
}

function isMetaStale(meta) {
  if (!meta?.asOfUtc) return false;
  const kind = inferFreshnessKind(meta);
  const max = staleThresholdMs(meta, kind);
  return Date.now() - Number(meta.asOfUtc) > max;
}

/** Wording when as-of is older than the freshness threshold (replaces “may be stale”). */
function staleAsOfWording(meta) {
  const kind = inferFreshnessKind(meta);
  if (kind === 'quarterly' || kind === 'reference') return 'last observation';
  if (kind === 'estimated') return 'last estimate';
  if (kind === 'daily' && meta.freshnessNote?.includes('prior biz day')) return 'prior business day';
  return 'market close';
}

function resolveFreshnessPill(meta) {
  if (meta.pillLabel != null) return meta.pillLabel;
  const kind = inferFreshnessKind(meta);
  if (meta.fallback || meta.static || kind === 'reference') return 'Ref';
  if (meta.estimated || kind === 'estimated') return 'Est.';
  if (kind === 'quarterly') return 'Qtrly';
  if (kind === 'daily') return 'Daily';
  if (meta.sessionOpen === false) return 'Closed';
  if (kind === 'live' || meta.live) return 'Live';
  return null;
}

function freshnessPillClass(label) {
  if (label === 'Closed') return 'pill pill--ref';
  if (label === 'Live') return 'pill pill--live';
  if (label === 'Est.') return 'pill pill--est';
  if (label === 'Ref' || label === 'Qtrly' || label === 'Daily') return 'pill pill--ref';
  return 'pill neu';
}

function formatCardAsOf(meta) {
  if (!meta?.asOfUtc) return null;
  const utc = formatUtcAsOf(meta.asOfUtc);
  if (!utc) return null;
  const parts = [utc];
  if (meta.freshnessNote) parts.push(meta.freshnessNote);
  if (meta.anchorDate && meta.estimated) parts.push(`Z.1 ${meta.anchorDate}`);
  if (meta.sessionOpen === false) {
    const lag = staleAsOfWording(meta);
    if (!parts.some(p => {
      const lower = p.toLowerCase();
      return lower.includes('market close') || lower.includes('last observation')
        || lower.includes('last estimate') || lower.includes('prior business day');
    })) parts.push(lag);
  } else if (isMetaStale(meta)) {
    parts.push(staleAsOfWording(meta));
  }
  return parts.join(' · ');
}

// ── Provider ──────────────────────────────────────
const PROVIDERS = ['yahoo', 'google', 'alphavantage'];
let activeProvider = localStorage.getItem('mmd:provider') || 'yahoo';
if (!PROVIDERS.includes(activeProvider)) activeProvider = 'yahoo';

function setProvider(p) {
  if (!PROVIDERS.includes(p)) return;
  activeProvider = p;
  localStorage.setItem('mmd:provider', p);
  renderInfoBox();
  updateApiUsageDisplay();
  syncApiBanner();
  loadAll(true);
}

function syncApiBanner() {
  const el = document.getElementById('api-banner');
  if (!el) return;
  const show = activeProvider === 'alphavantage';
  el.hidden = !show;
  el.setAttribute('aria-hidden', show ? 'false' : 'true');
}

// ── Visibility ────────────────────────────────────
let VIS = {};
function loadVIS() { try { VIS = JSON.parse(localStorage.getItem('mmd:vis') || '{}'); } catch { VIS = {}; } }
function saveVIS() { try { localStorage.setItem('mmd:vis', JSON.stringify(VIS)); } catch {} }
let SECTION_ORDER = {};
function loadSectionOrder() {
  try {
    const raw = localStorage.getItem('mmd:order');
    SECTION_ORDER = raw ? JSON.parse(raw) : {};
    if (!SECTION_ORDER || typeof SECTION_ORDER !== 'object') SECTION_ORDER = {};
  } catch {
    SECTION_ORDER = {};
  }
}
function saveSectionOrder() { try { localStorage.setItem('mmd:order', JSON.stringify(SECTION_ORDER)); } catch {} }
function getItemKey(item) {
  if (item.id)   return item.id;
  if (item.from) return `${item.from}${item.to}`;
  return item.sym;
}
function isOn(item) { const k = getItemKey(item); return k in VIS ? VIS[k] : item.def; }
function visOf(items) { return items.filter(isOn); }
function applySectionOrder(section) {
  const wanted = Array.isArray(SECTION_ORDER[section.key]) ? SECTION_ORDER[section.key] : [];
  if (!wanted.length) return;
  const byKey = new Map(section.items.map(item => [getItemKey(item), item]));
  const ordered = [];
  for (const key of wanted) {
    const item = byKey.get(key);
    if (!item) continue;
    ordered.push(item);
    byKey.delete(key);
  }
  for (const item of section.items) {
    const key = getItemKey(item);
    if (byKey.has(key)) ordered.push(item);
  }
  section.items = ordered;
}
function saveSectionOrderFor(section) {
  SECTION_ORDER[section.key] = section.items.map(getItemKey);
  saveSectionOrder();
}

// ── At a Glance overview ───────────────────────────
const OVERVIEW_MAX_ITEMS = 12;
const OVERVIEW_PICKABLE_SECTIONS = ['eq', 'comm', 'bond', 'fx', 'crypto', 'val'];
const OVERVIEW_DEFAULTS = [
  { sectionKey: 'eq', itemKey: '^AORD' },
  { sectionKey: 'eq', itemKey: '^GSPC' },
  { sectionKey: 'eq', itemKey: '^IXIC' },
  { sectionKey: 'comm', itemKey: 'spot-gold' },
  { sectionKey: 'comm', itemKey: 'spot-brent' },
  { sectionKey: 'comm', itemKey: 'spot-wti' },
];
let OVERVIEW_REFS = [];

function overviewRefId(ref) {
  return `${ref.sectionKey}:${ref.itemKey}`;
}

function loadOverviewRefs() {
  try {
    const raw = localStorage.getItem('mmd:overview');
    if (!raw) {
      OVERVIEW_REFS = OVERVIEW_DEFAULTS.map(r => ({ ...r }));
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      OVERVIEW_REFS = OVERVIEW_DEFAULTS.map(r => ({ ...r }));
      return;
    }
    OVERVIEW_REFS = parsed
      .filter(r => r?.sectionKey && r?.itemKey)
      .slice(0, OVERVIEW_MAX_ITEMS)
      .map(r => ({ sectionKey: r.sectionKey, itemKey: r.itemKey }));
    if (!OVERVIEW_REFS.length) OVERVIEW_REFS = OVERVIEW_DEFAULTS.map(r => ({ ...r }));
  } catch {
    OVERVIEW_REFS = OVERVIEW_DEFAULTS.map(r => ({ ...r }));
  }
}

function saveOverviewRefs() {
  try { localStorage.setItem('mmd:overview', JSON.stringify(OVERVIEW_REFS)); } catch {}
}

function getOverviewRefs() {
  return OVERVIEW_REFS;
}

function isOverviewRef(ref) {
  return OVERVIEW_REFS.some(r => overviewRefId(r) === overviewRefId(ref));
}

function resolveOverviewRef(ref) {
  const section = SECTIONS.find(s => s.key === ref.sectionKey);
  if (!section) return null;
  const item = section.items.find(i => getItemKey(i) === ref.itemKey);
  if (!item) return null;
  return { section, item };
}

function buildOverviewCatalog() {
  const out = [];
  for (const section of SECTIONS) {
    if (!OVERVIEW_PICKABLE_SECTIONS.includes(section.key)) continue;
    for (const item of section.items) {
      out.push({
        sectionKey: section.key,
        itemKey: getItemKey(item),
        label: item.label,
        ticker: item.ticker || getItemKey(item),
        sectionName: getSectionName(section.key),
      });
    }
  }
  return out;
}

function toggleOverviewRef(ref) {
  const id = overviewRefId(ref);
  const ix = OVERVIEW_REFS.findIndex(r => overviewRefId(r) === id);
  if (ix >= 0) {
    OVERVIEW_REFS.splice(ix, 1);
  } else if (OVERVIEW_REFS.length < OVERVIEW_MAX_ITEMS) {
    OVERVIEW_REFS.push({ sectionKey: ref.sectionKey, itemKey: ref.itemKey });
  }
  saveOverviewRefs();
  renderCustGlance();
  renderGlanceGrid();
  void loadOverviewItems(false);
}

function moveOverviewRef(sectionKey, itemKey, dir) {
  if (!dir) return;
  const ix = OVERVIEW_REFS.findIndex(r => r.sectionKey === sectionKey && r.itemKey === itemKey);
  if (ix < 0) return;
  const to = ix + dir;
  if (to < 0 || to >= OVERVIEW_REFS.length) return;
  const [ref] = OVERVIEW_REFS.splice(ix, 1);
  OVERVIEW_REFS.splice(to, 0, ref);
  saveOverviewRefs();
  renderCustGlance();
  renderGlanceGrid();
}

function renderCustGlance() {
  const el = document.getElementById('cust-glance');
  if (!el) return;
  const parts = [];
  if (OVERVIEW_REFS.length) {
    parts.push(`<div class="glance-cust-group glance-cust-order">
      <span class="glance-cust-label">Overview order</span>
      <div class="glance-cust-order-rows">${OVERVIEW_REFS.map((ref, idx) => {
    const resolved = resolveOverviewRef(ref);
    const lbl = resolved?.item?.ticker || resolved?.item?.label || ref.itemKey;
    const sectionName = getSectionName(ref.sectionKey);
    return `<div class="sym-pill-row">
      <span class="sym-pill sym-pill--label" title="${escapeHtml(sectionName)} · ${escapeHtml(lbl)}">${escapeHtml(lbl)}</span>
      <button type="button" class="sym-move-btn" title="Move left" aria-label="Move ${escapeHtml(lbl)} left in overview"
        data-overview-section="${escapeHtml(ref.sectionKey)}" data-overview-key="${escapeHtml(ref.itemKey)}" data-move-dir="-1"${idx === 0 ? ' disabled' : ''}>←</button>
      <button type="button" class="sym-move-btn" title="Move right" aria-label="Move ${escapeHtml(lbl)} right in overview"
        data-overview-section="${escapeHtml(ref.sectionKey)}" data-overview-key="${escapeHtml(ref.itemKey)}" data-move-dir="1"${idx === OVERVIEW_REFS.length - 1 ? ' disabled' : ''}>→</button>
    </div>`;
  }).join('')}</div></div>`);
  }
  const bySection = new Map();
  for (const entry of buildOverviewCatalog()) {
    if (!bySection.has(entry.sectionKey)) bySection.set(entry.sectionKey, []);
    bySection.get(entry.sectionKey).push(entry);
  }
  for (const sectionKey of OVERVIEW_PICKABLE_SECTIONS) {
    const entries = bySection.get(sectionKey);
    if (!entries?.length) continue;
    parts.push(`<div class="glance-cust-group">
      <span class="glance-cust-label">${escapeHtml(getSectionName(sectionKey))}</span>
      <div class="glance-cust-pills">${entries.map(entry => {
    const ref = { sectionKey: entry.sectionKey, itemKey: entry.itemKey };
    const on = isOverviewRef(ref);
    const atMax = !on && OVERVIEW_REFS.length >= OVERVIEW_MAX_ITEMS;
    return `<button type="button" class="sym-pill ${on ? 'on' : 'off'}"${atMax ? ' disabled title="Overview full (max 12)"' : ''}
      data-overview-section="${escapeHtml(entry.sectionKey)}" data-overview-key="${escapeHtml(entry.itemKey)}"
      title="${escapeHtml(entry.label)}">${escapeHtml(entry.ticker)}</button>`;
  }).join('')}</div></div>`);
  }
  el.innerHTML = parts.join('');
}

// ── Data Store ────────────────────────────────────
const DATA = {};  // itemKey → { price, change, pct }

// ── Symbol Config ─────────────────────────────────
// sym = Yahoo quote symbol; ticker = short label on card (index/futures, not ETF share price)
// Curated symbols available in the equities “add stock” picker (Yahoo-compatible)
const STOCK_CATALOG = [
  { sym: 'AAPL',  label: 'Apple',              ticker: 'AAPL' },
  { sym: 'MSFT',  label: 'Microsoft',          ticker: 'MSFT' },
  { sym: 'GOOGL', label: 'Alphabet (A)',       ticker: 'GOOGL' },
  { sym: 'AMZN',  label: 'Amazon',             ticker: 'AMZN' },
  { sym: 'NVDA',  label: 'NVIDIA',             ticker: 'NVDA' },
  { sym: 'META',  label: 'Meta Platforms',     ticker: 'META' },
  { sym: 'TSLA',  label: 'Tesla',              ticker: 'TSLA' },
  { sym: 'BRK-B', label: 'Berkshire Hathaway', ticker: 'BRK-B' },
  { sym: 'JPM',   label: 'JPMorgan Chase',     ticker: 'JPM' },
  { sym: 'V',     label: 'Visa',               ticker: 'V' },
  { sym: 'UNH',   label: 'UnitedHealth',       ticker: 'UNH' },
  { sym: 'XOM',   label: 'Exxon Mobil',        ticker: 'XOM' },
  { sym: 'JNJ',   label: 'Johnson & Johnson',  ticker: 'JNJ' },
  { sym: 'WMT',   label: 'Walmart',            ticker: 'WMT' },
  { sym: 'MA',    label: 'Mastercard',         ticker: 'MA' },
  { sym: 'PG',    label: 'Procter & Gamble',   ticker: 'PG' },
  { sym: 'HD',    label: 'Home Depot',         ticker: 'HD' },
  { sym: 'CVX',   label: 'Chevron',            ticker: 'CVX' },
  { sym: 'LLY',   label: 'Eli Lilly',          ticker: 'LLY' },
  { sym: 'ABBV',  label: 'AbbVie',             ticker: 'ABBV' },
  { sym: 'AVGO',  label: 'Broadcom',           ticker: 'AVGO' },
  { sym: 'KO',    label: 'Coca-Cola',          ticker: 'KO' },
  { sym: 'PEP',   label: 'PepsiCo',            ticker: 'PEP' },
  { sym: 'COST',  label: 'Costco',             ticker: 'COST' },
  { sym: 'AMD',   label: 'AMD',                ticker: 'AMD' },
  { sym: 'NFLX',  label: 'Netflix',            ticker: 'NFLX' },
  { sym: 'DIS',   label: 'Walt Disney',        ticker: 'DIS' },
  { sym: 'BA',    label: 'Boeing',             ticker: 'BA' },
  { sym: 'INTC',  label: 'Intel',              ticker: 'INTC' },
  { sym: 'CSCO',  label: 'Cisco',              ticker: 'CSCO' },
  { sym: 'ORCL',  label: 'Oracle',             ticker: 'ORCL' },
  { sym: 'CRM',   label: 'Salesforce',         ticker: 'CRM' },
  { sym: 'BABA',  label: 'Alibaba',            ticker: 'BABA' },
  { sym: 'TSM',   label: 'Taiwan Semi',        ticker: 'TSM' },
  { sym: 'ASML',  label: 'ASML',               ticker: 'ASML' },
  { sym: 'NKE',   label: 'Nike',               ticker: 'NKE' },
  { sym: 'SBUX',  label: 'Starbucks',          ticker: 'SBUX' },
  { sym: 'PYPL',  label: 'PayPal',             ticker: 'PYPL' },
  { sym: 'SQ',    label: 'Block',              ticker: 'SQ' },
  { sym: 'COIN',  label: 'Coinbase',           ticker: 'COIN' },
  { sym: 'PLTR',  label: 'Palantir',           ticker: 'PLTR' },
  { sym: 'BHP',   label: 'BHP Group',          ticker: 'BHP' },
  { sym: 'CBA.AX', label: 'Commonwealth Bank', ticker: 'CBA' },
  { sym: 'CSL.AX', label: 'CSL',               ticker: 'CSL' },
  { sym: 'NAB.AX', label: 'NAB',               ticker: 'NAB' },
  { sym: 'WBC.AX', label: 'Westpac',           ticker: 'WBC' },
  { sym: 'MQG.AX', label: 'Macquarie',         ticker: 'MQG' },
  { sym: 'SPY',   label: 'S&P 500 ETF',        ticker: 'SPY' },
  { sym: 'QQQ',   label: 'Nasdaq 100 ETF',     ticker: 'QQQ' },
  { sym: 'IWM',   label: 'Russell 2000 ETF',   ticker: 'IWM' },
  { sym: 'DIA',   label: 'Dow ETF',            ticker: 'DIA' },
  { sym: 'VTI',   label: 'Total US Market ETF', ticker: 'VTI' },
  { sym: 'XLF',   label: 'Financials ETF',     ticker: 'XLF' },
  { sym: 'XLK',   label: 'Tech ETF',           ticker: 'XLK' },
  { sym: 'XLE',   label: 'Energy ETF',         ticker: 'XLE' },
];

let CUSTOM_EQUITIES = [];
let CUSTOM_COMMODITIES = [];

function loadCustomEquities() {
  try {
    const raw = localStorage.getItem('mmd:custom:eq');
    CUSTOM_EQUITIES = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(CUSTOM_EQUITIES)) CUSTOM_EQUITIES = [];
  } catch {
    CUSTOM_EQUITIES = [];
  }
}

function saveCustomEquities() {
  try { localStorage.setItem('mmd:custom:eq', JSON.stringify(CUSTOM_EQUITIES)); } catch {}
}

function loadCustomCommodities() {
  try {
    const raw = localStorage.getItem('mmd:custom:comm');
    CUSTOM_COMMODITIES = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(CUSTOM_COMMODITIES)) CUSTOM_COMMODITIES = [];
    for (const item of CUSTOM_COMMODITIES) {
      if (item?.fredId === 'GOLDAMGBD228NLBM' || item?.fredId === 'PGOLDUSDM') {
        delete item.fredId;
        item.sym = item.sym || 'GC=F';
      }
      if (item?.fredId === 'SLVPRUSD' || item?.fredId === 'PSILVERUSDM') {
        delete item.fredId;
        item.sym = item.sym || 'SI=F';
      }
    }
  } catch {
    CUSTOM_COMMODITIES = [];
  }
}

function saveCustomCommodities() {
  try { localStorage.setItem('mmd:custom:comm', JSON.stringify(CUSTOM_COMMODITIES)); } catch {}
}

function syncEquitiesSection() {
  const section = SECTIONS.find(s => s.key === 'eq');
  if (section) {
    section.items = [...EQUITIES, ...CUSTOM_EQUITIES];
    applySectionOrder(section);
  }
}

function syncCommoditiesSection() {
  const section = SECTIONS.find(s => s.key === 'comm');
  if (section) {
    section.items = [...COMMODITIES, ...CUSTOM_COMMODITIES];
    applySectionOrder(section);
  }
}

function equitySymbolSet() {
  const s = new Set();
  for (const item of [...EQUITIES, ...CUSTOM_EQUITIES]) s.add(item.sym);
  return s;
}

function commoditySymbolSet() {
  const s = new Set();
  for (const item of [...COMMODITIES, ...CUSTOM_COMMODITIES]) s.add(getItemKey(item));
  return s;
}

function catalogEntryToEquity(entry) {
  return {
    sym: entry.sym,
    label: entry.label,
    ticker: entry.ticker || entry.sym.replace(/\.AX$/, '').split('-')[0],
    exchange: entry.exchange || inferExchangeFromSym(entry.sym),
    def: true,
    dp: 2,
    custom: true,
  };
}

const EQUITIES = [
  { sym: '^AORD', label: 'ASX All Ords',      ticker: 'AORD',  exchange: 'ASX',        def: true,  dp: 2 },
  { sym: '^AXJO', label: 'ASX 200',           ticker: 'AXJO',  exchange: 'ASX',        def: true,  dp: 2 },
  { sym: '^GSPC', label: 'S&P 500',           ticker: 'SPX',   exchange: 'US index',   def: true,  dp: 2 },
  { sym: '^IXIC', label: 'NASDAQ Composite',  ticker: 'COMP',  exchange: 'NASDAQ',     def: true,  dp: 2 },
  { sym: '^NDX',  label: 'NASDAQ 100',        ticker: 'NDX',   exchange: 'NASDAQ',     def: true,  dp: 2 },
  { sym: '^DJI',  label: 'Dow Jones',         ticker: 'DJI',   exchange: 'NYSE',       def: true,  dp: 2 },
  { sym: '^RUT',  label: 'Russell 2000',      ticker: 'RUT',   exchange: 'US index',   def: true,  dp: 2 },
  { sym: 'EEM',   label: 'Emerg. Markets', ticker: 'EEM',   exchange: 'NYSE Arca',  def: false, dp: 2 },
  { sym: 'VGK',   label: 'Europe',         ticker: 'VGK',   exchange: 'NYSE Arca',  def: false, dp: 2 },
  { sym: 'EWJ',   label: 'Japan',          ticker: 'EWJ',   exchange: 'NYSE Arca',  def: false, dp: 2 },
  { sym: 'VIXY',  label: 'VIX (Proxy)',    ticker: 'VIXY',  exchange: 'NYSE Arca',  def: false, dp: 2 },
  { sym: 'ARKK',  label: 'ARK Innov.',     ticker: 'ARKK',  exchange: 'NYSE Arca',  def: false, dp: 2 },
];

// FRED-based valuation / debt (GDP & debt levels in billions USD from FRED)
const VALUATION = [
  { id: 'buffett',      label: 'Buffett Indicator', ticker: 'BI',  def: true  },
  { id: 'us-gdp',       label: 'US GDP',            ticker: 'GDP', def: true  },
  { id: 'public-debt',  label: 'US Public Debt',    ticker: 'PUB', def: true  },
  { id: 'private-debt', label: 'US Private Debt',   ticker: 'PRV', def: true  },
  { id: 'au-gdp',       label: 'AU GDP',            ticker: 'A-GDP', def: true  },
  { id: 'au-public-debt',  label: 'AU Public Debt',  ticker: 'A-PUB', def: true  },
  { id: 'au-private-debt', label: 'AU Private Debt', ticker: 'A-PRV', def: true  },
  // Futures / leverage (live via hub /economics/proxy/valuation)
  {
    id: 'margin-debt',
    api: 'margin-debt',
    label: 'US Margin Debt',
    ticker: 'MGN',
    def: true,
    fallbackDisplay: '$1.22T',
    sublabel: 'FINRA investor debit balances',
    lines: [
      ['Use', 'Equities & leveraged derivatives'],
      ['Risk', 'Margin calls if positions move against you'],
    ],
    source: 'FINRA',
    href: 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics',
  },
  {
    id: 'otc-notional',
    api: 'otc-notional',
    label: 'OTC Derivatives',
    ticker: 'OTC',
    def: true,
    fallbackDisplay: '$845.7T',
    sublabel: 'Notional outstanding (global)',
    lines: [
      ['Scope', 'Futures, swaps & other OTC'],
      ['vs GMV', 'Notional ≠ economic exposure'],
    ],
    source: 'BIS / ISDA',
    href: 'https://data.bis.org/topics/OTC_DER',
  },
  {
    id: 'otc-gmv',
    api: 'otc-gmv',
    label: 'OTC Gross Exposure',
    ticker: 'GMV',
    def: true,
    fallbackDisplay: '$21.8T',
    sublabel: 'Gross market value (mark-to-market)',
    lines: [
      ['Meaning', 'Actual economic exposure'],
      ['Context', 'Much smaller than notional'],
    ],
    source: 'BIS',
    href: 'https://data.bis.org/topics/OTC_DER',
  },
  {
    id: 'au-cgs',
    api: 'au-cgs',
    label: 'AU Govt Securities',
    ticker: 'CGS',
    def: false,
    fallbackDisplay: 'A$489B',
    sublabel: 'Commonwealth bonds on issue',
    lines: [
      ['Market', 'Physical AU debt stock'],
      ['Futures', '3Y & 10Y ASX bond contracts'],
    ],
    source: 'AU Treasury / ASX',
    href: 'https://www.asx.com.au/markets/trade-our-derivatives-market/bond-derivatives',
  },
  {
    id: 'asx-bond-fut',
    api: 'asx-bond-fut',
    label: 'ASX Bond Futures',
    ticker: 'ABF',
    def: false,
    fallbackDisplay: '3Y · 10Y',
    sublabel: 'Treasury bond futures (ASX)',
    lines: [
      ['Liquidity', 'Highly liquid vs physical CGS'],
      ['Turnover', 'Billions AUD daily (broad debt mkt)'],
    ],
    source: 'ASX Derivatives',
    href: 'https://www.asx.com.au/markets/trade-our-derivatives-market/bond-derivatives/prices',
  },
];

function isValuationLive(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  const item = VALUATION.find(v => v.id === id);
  return Boolean(item?.api);
}

const COMMODITIES = [
  { id: 'spot-gold',    sym: 'GC=F',               label: 'Gold Spot',      ticker: 'XAU',   unit: 'USD/oz', def: true,  dp: 2 },
  { id: 'spot-silver',  sym: 'SI=F',               label: 'Silver Spot',    ticker: 'XAG',   unit: 'USD/oz', def: true,  dp: 3 },
  { id: 'spot-copper',  fredId: 'PCOPPUSDM',        label: 'Copper Spot',    ticker: 'CU',    unit: 'USD/mt', def: true,  dp: 2 },
  { id: 'spot-wti',     fredId: 'DCOILWTICO',       label: 'WTI Spot',       ticker: 'WTI',   unit: 'USD/bbl', def: true, dp: 2 },
  { id: 'spot-brent',   fredId: 'DCOILBRENTEU',     label: 'Brent Spot',     ticker: 'BRENT', unit: 'USD/bbl', def: true, dp: 2 },
  { id: 'spot-ironore', fredId: 'PIORECRUSDM',      label: 'Iron Ore Spot',  ticker: 'IRON',  unit: 'USD/dmtu', def: false, dp: 2 },
  { id: 'spot-gas',     fredId: 'PNGASUSDM',        label: 'Natural Gas Spot', ticker: 'NG',  unit: 'USD/mmbtu', def: false, dp: 3 },
  { id: 'spot-wheat',   fredId: 'PWHEAMTUSDM',      label: 'Wheat Spot',     ticker: 'WHEAT', unit: 'USD/mt', def: false, dp: 2 },
  { id: 'spot-corn',    fredId: 'PMAIZMTUSDM',      label: 'Corn Spot',      ticker: 'CORN',  unit: 'USD/mt', def: false, dp: 2 },
];

const COMMODITY_CATALOG = [
  { id: 'spot-gold', sym: 'GC=F', label: 'Gold Spot', ticker: 'XAU', unit: 'USD/oz' },
  { id: 'spot-silver', sym: 'SI=F', label: 'Silver Spot', ticker: 'XAG', unit: 'USD/oz' },
  { id: 'spot-copper', fredId: 'PCOPPUSDM', label: 'Copper Spot', ticker: 'CU', unit: 'USD/mt' },
  { id: 'spot-wti', fredId: 'DCOILWTICO', label: 'WTI Spot', ticker: 'WTI', unit: 'USD/bbl' },
  { id: 'spot-brent', fredId: 'DCOILBRENTEU', label: 'Brent Spot', ticker: 'BRENT', unit: 'USD/bbl' },
  { id: 'spot-ironore', fredId: 'PIORECRUSDM', label: 'Iron Ore Spot', ticker: 'IRON', unit: 'USD/dmtu' },
  { id: 'spot-gas', fredId: 'PNGASUSDM', label: 'Natural Gas Spot', ticker: 'NG', unit: 'USD/mmbtu' },
  { id: 'spot-wheat', fredId: 'PWHEAMTUSDM', label: 'Wheat Spot', ticker: 'WHEAT', unit: 'USD/mt' },
  { id: 'spot-corn', fredId: 'PMAIZMTUSDM', label: 'Corn Spot', ticker: 'CORN', unit: 'USD/mt' },
  { id: 'spot-coffee', fredId: 'PCOFFOTMUSDM', label: 'Coffee Spot', ticker: 'COFFEE', unit: 'USD/lb' },
  { id: 'spot-sugar', fredId: 'PSUGAISAUSDM', label: 'Sugar Spot', ticker: 'SUGAR', unit: 'USD/kg' },
  { id: 'spot-cocoa', fredId: 'PCOCOUSDM', label: 'Cocoa Spot', ticker: 'COCOA', unit: 'USD/mt' },
];

const FX_PAIRS = [
  { from: 'AUD', to: 'USD', label: 'AUD / USD', def: true  },
  { from: 'EUR', to: 'USD', label: 'EUR / USD', def: true  },
  { from: 'GBP', to: 'USD', label: 'GBP / USD', def: true  },
  { from: 'USD', to: 'JPY', label: 'USD / JPY', def: true  },
  { from: 'USD', to: 'CAD', label: 'USD / CAD', def: false },
  { from: 'NZD', to: 'USD', label: 'NZD / USD', def: false },
  { from: 'USD', to: 'CHF', label: 'USD / CHF', def: false },
  { from: 'USD', to: 'MXN', label: 'USD / MXN', def: false },
];

// yTicker: Yahoo Finance CBOE index — used first (no CORS); null falls back to FRED
const BOND_SERIES = [
  { id: 'DGS2',   label: 'US 2Y Yield',    ticker: '2Y',  def: true,  yTicker: '2YY=F' },
  { id: '^FVX',   label: 'US 5Y Yield',    ticker: '5Y',  def: false, yTicker: '^FVX' },
  { id: '^TNX',   label: 'US 10Y Yield',   ticker: '10Y', def: true,  yTicker: '^TNX' },
  { id: '^TYX',   label: 'US 30Y Yield',   ticker: '30Y', def: true,  yTicker: '^TYX' },
  { id: '^IRX',   label: 'US 3M T-Bill',   ticker: '3M',  def: false, yTicker: '^IRX' },
  { id: 'DFF',    label: 'Fed Funds Rate', ticker: 'FFR', def: false, yTicker: null   },
  { id: 'T10YIE', label: '10Y Breakeven',  ticker: 'BEI', def: false, yTicker: null   },
];

// Yahoo uses BTC-USD format; dp controls price decimal places per coin
const CRYPTO = [
  { sym: 'BTC-USD',  label: 'Bitcoin',   ticker: 'BTC',  def: true,  dp: 0 },
  { sym: 'ETH-USD',  label: 'Ethereum',  ticker: 'ETH',  def: true,  dp: 2 },
  { sym: 'SOL-USD',  label: 'Solana',    ticker: 'SOL',  def: true,  dp: 2 },
  { sym: 'BNB-USD',  label: 'BNB',       ticker: 'BNB',  def: false, dp: 2 },
  { sym: 'XRP-USD',  label: 'XRP',       ticker: 'XRP',  def: false, dp: 4 },
  { sym: 'ADA-USD',  label: 'Cardano',   ticker: 'ADA',  def: false, dp: 4 },
  { sym: 'AVAX-USD', label: 'Avalanche', ticker: 'AVAX', def: false, dp: 2 },
  { sym: 'DOGE-USD', label: 'Dogecoin',  ticker: 'DOGE', def: false, dp: 4 },
  { sym: 'LINK-USD', label: 'Chainlink', ticker: 'LINK', def: false, dp: 2 },
];

const CG_IDS = {
  'BTC-USD':  'bitcoin',
  'ETH-USD':  'ethereum',
  'SOL-USD':  'solana',
  'BNB-USD':  'binancecoin',
  'XRP-USD':  'ripple',
  'ADA-USD':  'cardano',
  'AVAX-USD': 'avalanche-2',
  'DOGE-USD': 'dogecoin',
  'LINK-USD': 'chainlink',
};

/** Per-section market / venue / source copy (rendered under section headers). */
const SECTION_EXPLAINERS = {
  eq: {
    title: 'Market & source',
    market: 'Cash equity sessions on listed exchanges (NYSE, NASDAQ, NYSE Arca, ASX, etc.) and major index benchmarks.',
    venue: 'The exchange on each card is the listing venue. Index symbols (^GSPC, ^AXJO) are calculated levels, not a single tradable ticker.',
    source: 'Quotes from your selected provider (Yahoo, Google Finance, or Alpha Vantage). Prices may be delayed.',
    detail: 'US and ASX cash markets have separate session hours (see footer). ETFs trade like stocks; indices track underlying baskets.',
  },
  val: {
    title: 'Market & source',
    market: 'Macroeconomic ratios and reference statistics — not live exchange prices.',
    venue: 'No exchange. Buffett, GDP, and debt series are national accounts; margin/OTC cards are regulatory or survey aggregates.',
    source: 'FRED (St. Louis Fed) for GDP, debt, and Buffett inputs; hub valuation API for FINRA margin, BIS/ISDA OTC, and AU Treasury/ASX references.',
    detail: 'Quarterly FRED series drive most cards. Live-reference cards (margin debt, OTC) show published levels with “as of” dates when available.',
  },
  comm: {
    title: 'Market & source',
    market: 'Physical commodity spot/reference market levels (metals, energy, and agricultural benchmarks).',
    venue: 'Reference series rather than exchange-traded futures contracts. Units vary by commodity (e.g., USD/oz, USD/bbl, USD/mt).',
    source: 'FRED commodity price series (daily/monthly reference observations).',
    detail: 'These are spot/reference levels, not front-month futures. Update cadence depends on each source series and may be daily or monthly.',
  },
  bond: {
    title: 'Market & source',
    market: 'US Treasury secondary market — yields implied from bond prices (constant-maturity benchmarks).',
    venue: 'CBOE Treasury yield indices (^TNX, ^FVX) when available; otherwise FRED daily series (DGS2, DGS10, DFF, T10YIE).',
    source: 'Yahoo/CBOE for live yield indices where mapped; FRED CSV fallback. 2s10s spread uses aligned FRED DGS2 and DGS10.',
    detail: 'Quoted in percent per year (yield to maturity style). Moves are shown in percentage points (pp), not price dollars.',
  },
  fx: {
    title: 'Market & source',
    market: 'Spot foreign exchange — the rate to exchange one currency for another for near-term settlement.',
    venue: 'Wholesale spot FX typically settles T+2; this dashboard shows reference spot-style rates, not a live interbank order book.',
    source: 'Default: Frankfurter.dev (European Central Bank reference rates, one fix per business day). With Alpha Vantage: intraday GLOBAL_QUOTE FX.',
    detail: 'Spot FX is not the same as futures or forwards (dated delivery). ECB reference rates are official benchmarks for the euro area and crosses — useful for macro comparison, but they update once per business day and can lag active trading.',
  },
  crypto: {
    title: 'Market & source',
    market: 'Global crypto spot markets — 24/7 trading across many venues, aggregated here as a single USD price.',
    venue: 'No single exchange on cards; CoinGecko blends volume-weighted prices from major centralized and decentralized markets.',
    source: 'CoinGecko simple price API (always on, no API key). Change is a rolling 24-hour percentage, not an exchange session close.',
    detail: 'Unlike equities, there is no official closing auction; weekend and holiday gaps do not apply.',
  },
};

// ── Section Registry ──────────────────────────────
const SECTIONS = [
  {
    key: 'eq',   gridId: 'equities-grid',    custId: 'cust-eq',   items: EQUITIES,
    fetch: (item, force) => fetchQuote(item.sym, force),
    card:  (item, d) => formatQuoteCard(item, d, 'eq'),
  },
  {
    key: 'val',  gridId: 'valuation-grid',   custId: 'cust-val',  items: VALUATION,
    fetch: (item, force) => fetchValuation(item.id, force),
    card:  null,
  },
  {
    key: 'comm', gridId: 'commodities-grid', custId: 'cust-comm', items: COMMODITIES,
    fetch: (item, force) => fetchCommodity(item, force),
    card:  (item, d) => formatQuoteCard(item, d, 'comm'),
  },
  {
    key: 'bond', gridId: 'bonds-grid',       custId: 'cust-bond', items: BOND_SERIES,
    fetch: (item, force) => fetchBond(item.id, force),
    card: null, // handled specially in renderSectionGrid
  },
  {
    key: 'fx',     gridId: 'fx-grid',          custId: 'cust-fx',     items: FX_PAIRS,
    fetch: (item, force) => fetchFX(item.from, item.to, force),
    card:  (item, d) => formatQuoteCard(
      { ...item, ticker: `${item.from}/${item.to}` },
      d,
      'fx',
    ),
  },
  {
    key: 'crypto', gridId: 'crypto-grid',      custId: 'cust-crypto', items: CRYPTO,
    fetch: (item, force) => fetchCrypto(item.sym, force),
    card:  (item, d) => formatQuoteCard(item, d, 'crypto'),
  },
];

// ── Helpers ───────────────────────────────────────
function fmt(n, dp=2) {
  if (n === null || isNaN(n)) return '–';
  return parseFloat(n).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function sign(n) { return n === null ? '' : n >= 0 ? '+' : ''; }

const MONTH_ABBR = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Relative % change from two values (null if previous is zero/missing). */
function pctChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Absolute difference in percentage points (yields, ratios, spreads). */
function pointsChange(current, previous) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function formatUtcAsOf(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Map FINRA / BIS / ISO reference labels to an approximate UTC instant. */
function parseReferencePeriodUtc(period) {
  if (!period || typeof period !== 'string') return null;
  const s = period.trim();
  const finra = s.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (finra) {
    const y = 2000 + parseInt(finra[2], 10);
    const mo = MONTH_ABBR[finra[1]];
    if (mo === undefined) return null;
    return Date.UTC(y, mo + 1, 0, 0, 0, 0);
  }
  const bisSemi = s.match(/^(\d{4})-S([12])$/);
  if (bisSemi) {
    const y = parseInt(bisSemi[1], 10);
    const endMonth = bisSemi[2] === '1' ? 5 : 11;
    return Date.UTC(y, endMonth + 1, 0, 0, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = Date.parse(`${s}T00:00:00Z`);
    return Number.isNaN(t) ? null : t;
  }
  if (/^\d{4}$/.test(s)) return Date.UTC(parseInt(s, 10), 11, 31, 0, 0, 0);
  return null;
}

function fredDateToUtc(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/** CBOE yield indices (^TNX etc.) are often quoted as yield × 10. */
function normalizeCBOEYieldQuote(sym, quote) {
  if (!quote || quote.price == null) return quote;
  const bondSyms = new Set(['^TNX', '^FVX', '^TYX', '^IRX', '2YY=F', 'TNX', 'FVX', 'TYX', 'IRX']);
  if (!bondSyms.has(sym) && !sym.startsWith('^')) return quote;
  if (quote.price <= 20) return quote;
  return {
    ...quote,
    price: quote.price / 10,
    change: quote.change != null ? quote.change / 10 : null,
  };
}

function quoteDecimals(item, sectionKey) {
  if (sectionKey === 'crypto') return item.dp ?? 2;
  if (sectionKey === 'fx') return item.to === 'JPY' ? 2 : 4;
  return item.dp ?? 2;
}

/** True when a value rounds to zero at the given decimal places. */
function isDisplayFlat(value, dp = 2) {
  if (value == null || Number.isNaN(Number(value))) return true;
  const n = Number(value);
  if (n === 0) return true;
  return Math.abs(Number(n.toFixed(dp))) === 0;
}

/** Bump precision when a move would show as 0.00 at base dp (3 dp for %/pp; 4 for FX). */
function displayDecimalsForDelta(value, baseDp = 2, extendedDp = 3) {
  if (value == null || Number.isNaN(Number(value)) || value === 0) return baseDp;
  if (isDisplayFlat(value, baseDp)) return extendedDp;
  return baseDp;
}

/** Extra precision when a small move would display as 0.00 at 2 dp (typical FX). */
function changeDisplayDecimals(change, quoteDp = 2) {
  const dp = quoteDp ?? 2;
  return displayDecimalsForDelta(change, dp, Math.max(dp, 4));
}

function formatQuoteAbsChange(change, quoteDp = 2) {
  if (change == null || Number.isNaN(change)) return '';
  const v = Number(change);
  const dp = changeDisplayDecimals(change, quoteDp);
  if (isDisplayFlat(v, dp)) return fmt(0, quoteDp ?? 2);
  const prefix = v > 0 ? '+' : '-';
  return `${prefix}${fmt(Math.abs(v), dp)}`;
}

function formatQuotePrice(d, item, sectionKey) {
  if (!d || d.price == null || Number.isNaN(Number(d.price))) return null;
  return fmt(d.price, quoteDecimals(item, sectionKey));
}

function formatCommodityPrice(d, item) {
  const base = formatQuotePrice(d, item, 'comm');
  if (!base) return null;
  return item?.unit ? `${base} ${item.unit}` : base;
}

const YAHOO_EXCHANGE_LABELS = {
  NMS: 'NASDAQ',
  NGM: 'NASDAQ',
  NCM: 'NASDAQ',
  NG: 'NASDAQ',
  NasdaqGS: 'NASDAQ',
  NasdaqGM: 'NASDAQ',
  NasdaqCM: 'NASDAQ',
  NYQ: 'NYSE',
  NYSE: 'NYSE',
  PCX: 'NYSE Arca',
  BTS: 'NYSE Arca',
  ARCX: 'NYSE Arca',
  PNK: 'OTC',
  ASE: 'NYSE American',
  ASX: 'ASX',
  AX: 'ASX',
  LSE: 'LSE',
  LON: 'LSE',
  TSE: 'TSX',
  TOR: 'TSX',
  HKG: 'HKEX',
  HKSE: 'HKEX',
  FRA: 'Frankfurt',
  PAR: 'Euronext Paris',
  SWX: 'SIX',
  INDEXSP: 'US index',
  INDEXNASDAQ: 'NASDAQ',
  INDEXDJX: 'NYSE',
  INDEXASX: 'ASX',
  INDEXCBOE: 'CBOE',
  INDEXRUSSELL: 'US index',
  NYSEARCA: 'NYSE Arca',
  SNP: 'US index',
};

function inferExchangeFromSym(sym) {
  if (!sym) return null;
  const u = String(sym).toUpperCase();
  if (u.endsWith('.AX')) return 'ASX';
  if (u.endsWith('.L')) return 'LSE';
  if (u.endsWith('.TO') || u.endsWith('.V')) return 'TSX';
  if (u.endsWith('.HK')) return 'HKEX';
  if (u.endsWith('.SS')) return 'SSE';
  if (u.endsWith('.SZ')) return 'SZSE';
  if (u.endsWith('.DE')) return 'XETRA';
  if (u.endsWith('.PA')) return 'Euronext Paris';
  if (u.startsWith('^')) return null;
  if (u.includes('-')) return 'NYSE';
  return null;
}

function formatYahooExchange(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const full = meta.fullExchangeName;
  const short = meta.exchangeName;
  if (full && YAHOO_EXCHANGE_LABELS[full]) return YAHOO_EXCHANGE_LABELS[full];
  if (short && YAHOO_EXCHANGE_LABELS[short]) return YAHOO_EXCHANGE_LABELS[short];
  if (full) {
    const cleaned = String(full)
      .replace(/^Nasdaq/i, 'NASDAQ')
      .replace(/Stock Exchange/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) return cleaned;
  }
  return short || null;
}

function resolveEquityExchange(item, d) {
  if (item?.exchange) return item.exchange;
  if (d?.exchangeLabel) return d.exchangeLabel;
  return inferExchangeFromSym(item?.sym);
}

function formatQuoteCard(item, d, sectionKey) {
  const quoteDp = quoteDecimals(item, sectionKey);
  const exchangeLabel = sectionKey === 'eq' ? resolveEquityExchange(item, d) : null;
  const price = sectionKey === 'comm'
    ? formatCommodityPrice(d, item)
    : formatQuotePrice(d, item, sectionKey);
  return {
    ticker: item.ticker,
    label: item.label,
    exchangeLabel,
    price,
    change: d ? d.change : null,
    pct: d ? d.pct : null,
    asOfUtc: d?.asOfUtc ?? null,
    freshnessKind: d?.freshnessKind ?? (
      sectionKey === 'fx' ? 'daily'
        : (sectionKey === 'eq' || sectionKey === 'comm' || sectionKey === 'crypto') ? 'live'
          : undefined
    ),
    freshnessNote: d?.freshnessNote ?? null,
    anchorDate: d?.anchorDate ?? null,
    estimated: d?.estimated ?? false,
    quoteDp,
  };
}
/** Direction for card/pill styling: 1 up, -1 down, 0 flat/neutral, null unknown. */
function resolveMoveDirection(pct, absChange = null) {
  if (absChange != null && !Number.isNaN(Number(absChange))) {
    const dp = displayDecimalsForDelta(absChange, 2, 3);
    if (!isDisplayFlat(absChange, dp)) return absChange > 0 ? 1 : -1;
  }
  if (pct != null && !Number.isNaN(Number(pct))) {
    const dp = displayDecimalsForDelta(pct, 2, 3);
    if (!isDisplayFlat(pct, dp)) return pct > 0 ? 1 : -1;
  }
  if (pct === null && absChange == null) return null;
  return 0;
}

function directionClass(dir) {
  if (dir === null) return 'neu';
  if (dir === 0) return 'neu';
  return dir > 0 ? 'up' : 'dn';
}

function cardClass(pct, absChange = null) {
  return directionClass(resolveMoveDirection(pct, absChange));
}

function pillClass(pct, absChange = null) {
  return cardClass(pct, absChange);
}

function pillText(pct) {
  if (pct === null) return '–';
  const dp = displayDecimalsForDelta(pct, 2, 3);
  if (isDisplayFlat(pct, dp)) return '0.00%';
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(dp)}%`;
}

function absChangeClass(pct, absChange) {
  const dir = resolveMoveDirection(pct, absChange);
  if (dir === 0) return 'card-abs--flat';
  if (dir === null) return '';
  return dir > 0 ? 'card-abs--up' : 'card-abs--dn';
}

const CARD_LOADING = new Set();

// ── Card indicator info (modal copy) ─────────────────────────────
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function infoLink(name, url) {
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`;
}

function infoPara(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function quoteProviderBlurb() {
  if (activeProvider === 'yahoo') {
    return 'Live quotes via Yahoo Finance (hub proxy). Prior close from chart metadata or last daily close.';
  }
  if (activeProvider === 'google') {
    return 'Live quotes via Google Finance page scrape (hub proxy).';
  }
  return 'Live quotes via Alpha Vantage GLOBAL_QUOTE (API key required in Data Sources).';
}

function changeFormulaeBlurb(kind = 'price') {
  if (kind === 'yield') {
    return 'Pill (▲/▼): relative % vs prior observation.\nAbsolute: change in percentage points (pp).\n\n% change = (yield − prior) / prior × 100\npp change = yield − prior';
  }
  if (kind === 'ratio') {
    return 'Pill (▲/▼): relative % vs prior ratio.\nAbsolute: change in percentage points (pp).\n\n% change = (ratio − prior) / prior × 100\npp change = ratio − prior';
  }
  if (kind === 'usd') {
    return 'Pill (▲/▼): relative % vs prior level.\nAbsolute: change in USD (compact $B / $T).\n\n% change = (value − prior) / prior × 100';
  }
  return 'Pill (▲/▼): relative % vs prior close.\nAbsolute: price change in index/ETF points.\n\n% change = (price − prev_close) / prev_close × 100\nΔ price = price − prev_close';
}

function equityCardInfo(item) {
  const sym = item.sym || item.ticker;
  const gf = googleFinanceUrlForItem(item, 'eq');
  const venue = resolveEquityExchange(item, DATA[sym]);
  const src = gf
    ? `${quoteProviderBlurb()} Chart: ${infoLink('Google Finance', gf)}.`
    : quoteProviderBlurb();
  return {
    title: item.label,
    summary: `${item.label} tracks the listed index or ETF. It is a market-price benchmark, not a valuation ratio.`,
    derived: 'Latest price and day-over-day change from your selected quote provider. “As of” uses the provider timestamp in UTC when available.',
    data: `Yahoo symbol: ${sym}. Card ticker: ${item.ticker}.${venue ? ` Exchange: ${venue}.` : ''}`,
    sourceHtml: src,
    formula: changeFormulaeBlurb('price'),
  };
}

function commodityCardInfo(item) {
  const unit = item.unit ? ` Unit: ${item.unit}.` : '';
  const source = item.fredId
    ? { label: 'FRED commodity series', href: `https://fred.stlouisfed.org/series/${item.fredId}`, data: `FRED ${item.fredId}` }
    : { label: 'Yahoo Finance', href: `https://finance.yahoo.com/quote/${encodeURIComponent(item.sym || '')}`, data: `Yahoo ${item.sym || item.ticker}` };
  return {
    title: item.label,
    summary: `${item.label} is a spot/reference commodity benchmark level.${item.sym ? ' Live quote via Yahoo.' : ''}`,
    derived: item.fredId
      ? 'Latest published FRED spot/reference value and change vs the prior observation.'
      : 'Latest market quote and change vs the prior session.',
    data: `${source.data}. Card ticker: ${item.ticker}.${unit}`,
    sourceHtml: infoLink(source.label, source.href),
    formula: changeFormulaeBlurb('price'),
  };
}

function fxCardInfo(item) {
  return {
    title: item.label,
    summary: `Spot FX: how many ${item.to} you get per 1 ${item.from} for immediate-style conversion. Not a futures or forward contract.`,
    derived: activeProvider === 'alphavantage'
      ? 'Alpha Vantage realtime exchange rate; change not shown for AV FX.'
      : 'Frankfurter.dev daily ECB reference rates: latest business day vs prior published day (spot reference, not live dealing room).',
    data: `Cross: ${item.from} → ${item.to}. Frankfurter base USD with cross-rates when needed.`,
    sourceHtml: activeProvider === 'alphavantage'
      ? infoLink('Alpha Vantage FX', 'https://www.alphavantage.co/documentation/#currency-exchange')
      : `${infoLink('Frankfurter', 'https://www.frankfurter.dev/')} (ECB reference). ${quoteProviderBlurb()}`,
    formula: activeProvider === 'alphavantage'
      ? 'Displayed rate = AV “5. Exchange Rate”.'
      : '% change = (rate − prior_day) / prior_day × 100\nΔ = rate − prior_day',
  };
}

function cryptoCardInfo(item) {
  return {
    title: item.label,
    summary: `${item.label} spot price in USD from CoinGecko (24/7 market).`,
    derived: 'CoinGecko simple price API with rolling 24-hour percentage change.',
    data: `Yahoo-style symbol: ${item.sym}. CoinGecko id: ${CG_IDS[item.sym] || '—'}.`,
    sourceHtml: infoLink('CoinGecko API', 'https://www.coingecko.com/en/api'),
    formula: '24h % from CoinGecko.\nImplied Δ price = price × (% / (100 + %))\n(24h rolling, not exchange session close).',
  };
}

function bondCardInfo(item) {
  const fredUrl = `https://fred.stlouisfed.org/series/${item.id}`;
  const ySym = item.yTicker;
  const usesYahoo = Boolean(ySym);
  return {
    title: item.label,
    summary: item.id === 'T10YIE'
      ? '10-year breakeven inflation rate: market-implied average CPI inflation over the next decade.'
      : item.id === 'DFF'
        ? 'Effective federal funds rate (policy rate) from FRED.'
        : `US Treasury ${item.ticker} yield — annualized yield to maturity implied by market prices.`,
    derived: usesYahoo
      ? `Yahoo/CBOE index ${ySym} when available (yield %; ×10 indices normalized). Falls back to FRED ${item.id} daily series.`
      : `FRED daily series ${item.id} only.`,
    data: usesYahoo
      ? `Primary: ${ySym}. Fallback CSV: ${item.id}. 2s10s spread on 10Y card uses FRED DGS2 and DGS10 (same observation date) when available.`
      : `FRED series ${item.id}.`,
    sourceHtml: `${infoLink('FRED', fredUrl)}${usesYahoo ? ` · ${quoteProviderBlurb()}` : ''}`,
    formula: changeFormulaeBlurb('yield'),
  };
}

function valuationCardInfo(item) {
  const fred = 'https://fred.stlouisfed.org';
  const byId = {
    buffett: {
      summary: 'Warren Buffett’s “market cap to GDP” gauge: how large the US equity market is relative to the economy. High readings suggest stretched valuations vs history.',
      derived: 'Numerator: Z.1 corporate equities (NCBEILQ027S), scaled from the latest Z.1 quarter to today using S&P 500 (^GSPC) moves. Denominator: nominal GDP (FRED), projected with Atlanta Fed GDPNow when the nowcast quarter is ahead of the latest GDP print.',
      data: 'Cap: FRED NCBEILQ027S. GDP: FRED GDP + GDPNOW. Scale proxy: ^GSPC.',
      sourceHtml: infoLink('FRED', fred),
      formula: 'Buffett indicator = (market cap USD / nominal GDP USD) × 100\nEst. cap = Z.1 cap × (S&P now / S&P at Z.1 date)',
    },
    'us-gdp': {
      summary: 'US nominal gross domestic product — total market value of goods and services produced (not inflation-adjusted).',
      derived: 'Latest quarterly FRED GDP; when GDPNow is ahead of the GDP print, level is projected using the nowcast SAAR reading.',
      data: 'FRED GDP, FRED GDPNOW (Atlanta Fed). Billions USD, SAAR.',
      sourceHtml: infoLink('FRED / BEA', fred),
      formula: changeFormulaeBlurb('usd'),
    },
    'public-debt': {
      summary: 'Federal government debt held by the public as a percent of GDP — sovereign leverage vs economic output.',
      derived: 'Latest nominal GDP (FRED) with federal debt stock scaled from the newest Z.1 quarter using monthly Treasury market-value data.',
      data: 'FRED GFDEGDQ188S, GFDEBTN, GDP, MVMTD027MNFRBDAL.',
      sourceHtml: infoLink('FRED', fred),
      formula: changeFormulaeBlurb('ratio'),
    },
    'private-debt': {
      summary: 'Non-federal (private) debt as a percent of GDP — household & business leverage outside the federal government.',
      derived: 'Private debt = total credit (TCMDO) minus federal debt (FGSDODNS), estimated forward to latest GDP using Z.1 growth and Treasury MV scaling.',
      data: 'FRED TCMDO, FGSDODNS, GDP, MVMTD027MNFRBDAL.',
      sourceHtml: infoLink('FRED Z.1', fred),
      formula: 'Private debt % GDP = ((TCMDO − FGSDODNS) / 1000) / GDP × 100',
    },
    'au-gdp': {
      summary: 'Australian nominal gross domestic product — total current-price output of the Australian economy.',
      derived: 'Latest quarterly nominal GDP from FRED IMF series, displayed in billions of AUD.',
      data: 'FRED NGDPSAXDCAUQ (millions of domestic currency).',
      sourceHtml: infoLink('FRED / IMF', fred),
      formula: 'AU GDP (A$B) = NGDPSAXDCAUQ / 1000',
    },
    'au-public-debt': {
      summary: 'Australian general government credit as a percent of GDP (BIS, break-adjusted).',
      derived: 'BIS % of GDP with estimated AUD level from aligned nominal GDP (ratio × GDP).',
      data: 'FRED QAUGAN770A (% of GDP, quarterly) · NGDPSAXDCAUQ (GDP, quarterly).',
      sourceHtml: infoLink('FRED / BIS', fred),
      formula: 'Est. AUD = (% of GDP ÷ 100) × AU nominal GDP (A$B)',
    },
    'au-private-debt': {
      summary: 'Australian private non-financial sector credit as a percent of GDP.',
      derived: 'BIS % of GDP with estimated AUD level from aligned nominal GDP (ratio × GDP).',
      data: 'FRED QAUPAM770A (% of GDP, quarterly) · NGDPSAXDCAUQ (GDP, quarterly).',
      sourceHtml: infoLink('FRED / BIS', fred),
      formula: 'Est. AUD = (% of GDP ÷ 100) × AU nominal GDP (A$B)',
    },
    'margin-debt': {
      summary: 'FINRA aggregate debit balances in customer securities margin accounts — a proxy for stock-market leverage and speculative demand.',
      derived: 'Latest month vs prior month from FINRA margin statistics (fallback: Fed Z.1 broker-dealer margin receivables).',
      data: 'Debit balances ($ millions). Displayed as USD trillions on card.',
      sourceHtml: `${infoLink('FINRA', item.href || 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics')} · hub /economics/proxy/valuation`,
      formula: changeFormulaeBlurb('usd'),
    },
    'otc-notional': {
      summary: 'Global OTC derivatives notional outstanding — contractual face value of all open OTC derivatives (much larger than economic exposure).',
      derived: 'BIS semiannual OTC derivatives statistics; headline total notional for reporting dealers.',
      data: 'BIS WS_OTC_DERIV2 (USD millions → T on card).',
      sourceHtml: `${infoLink('BIS Data Portal', item.href || 'https://data.bis.org/topics/OTC_DER')} · hub proxy`,
      formula: 'Card value = BIS reported notional (USD, consolidated dealers).',
    },
    'otc-gmv': {
      summary: 'OTC derivatives gross market value (mark-to-market) — closer to economic exposure than notional.',
      derived: 'BIS GMV aggregate (average of reported instrument buckets when needed).',
      data: 'BIS WS_OTC_DERIV2, GMV measure (USD millions).',
      sourceHtml: `${infoLink('BIS', item.href || 'https://data.bis.org/topics/OTC_DER')} · hub proxy`,
      formula: 'Card ≈ sum/avg of BIS GMV buckets (USD).',
    },
    'au-cgs': {
      summary: 'Australian Commonwealth government securities on issue — physical government bond stock (AUD).',
      derived: 'BIS debt securities statistics, Australia general government bonds (latest vs prior observation).',
      data: 'BIS WS_NA_SEC_DSS, AUD billions.',
      sourceHtml: `${infoLink('BIS', 'https://data.bis.org/')} · hub proxy`,
      formula: changeFormulaeBlurb('usd').replace('USD', 'AUD'),
    },
    'asx-bond-fut': {
      summary: 'Australian OTC derivatives turnover tied to rates/bonds — liquidity proxy for ASX bond futures complex.',
      derived: 'BIS OTC turnover, reporting country Australia (annual, USD).',
      data: 'BIS WS_DER_OTC_TOV.',
      sourceHtml: `${infoLink('ASX bond derivatives', item.href || 'https://www.asx.com.au/markets/trade-our-derivatives-market/bond-derivatives')} · ${infoLink('BIS', 'https://data.bis.org/')}`,
      formula: 'Displayed = BIS AU turnover (USD, annual).',
    },
  };
  const block = byId[item.id];
  if (!block) {
    return {
      title: item.label,
      summary: item.sublabel || 'Valuation or macro reference metric.',
      derived: 'Fetched on refresh via hub valuation proxy or FRED batch.',
      data: item.source || 'See card source link.',
      sourceHtml: item.href ? infoLink(item.source || 'Source', item.href) : escapeHtml(item.source || 'FRED / BIS'),
      formula: changeFormulaeBlurb(),
    };
  }
  return { title: item.label, ...block };
}

const CARD_INFO_RESOLVERS = {
  eq: equityCardInfo,
  comm: commodityCardInfo,
  fx: fxCardInfo,
  crypto: cryptoCardInfo,
  bond: bondCardInfo,
  val: valuationCardInfo,
};

function getCardInfo(sectionKey, item) {
  const resolver = CARD_INFO_RESOLVERS[sectionKey];
  if (!resolver) {
    return {
      title: item.label || 'Indicator',
      summary: 'Market or macro indicator on the Morning Macro dashboard.',
      derived: 'See Data Sources panel for provider settings.',
      data: '—',
      sourceHtml: quoteProviderBlurb(),
      formula: changeFormulaeBlurb(),
    };
  }
  return resolver(item);
}

function renderInfoModalBody(info) {
  const blocks = [
    ['What it is', info.summary, false],
    ['How it is derived', info.derived, false],
    ['Data used', info.data, false],
    ['Source', info.sourceHtml, true],
    ['Formulae', info.formula, false],
  ];
  return blocks.filter(([, body]) => body).map(([heading, body, isHtml]) => `
    <section class="info-modal-block">
      <h3 class="info-modal-h3">${escapeHtml(heading)}</h3>
      <div class="info-modal-text">${isHtml ? body : infoPara(body)}</div>
    </section>`).join('');
}

const infoState = { returnFocus: null };

function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (!modal) return;
  const restore = infoState.returnFocus;
  infoState.returnFocus = null;
  modal.hidden = true;
  modal.inert = true;
  document.body.style.overflow = document.getElementById('chart-modal')?.hidden === false ? 'hidden' : '';
  if (restore instanceof HTMLElement && document.contains(restore)) {
    restore.focus({ preventScroll: true });
  }
}

function openInfoModal(itemKey, sectionKey) {
  const resolved = resolveItem(itemKey, sectionKey);
  if (!resolved) return;
  const { item } = resolved;
  const info = getCardInfo(sectionKey, item);
  const modal = document.getElementById('info-modal');
  const body = document.getElementById('info-modal-body');
  if (!modal || !body) return;

  document.getElementById('info-modal-ticker').textContent = item.ticker || itemKey;
  document.getElementById('info-modal-title').textContent = info.title || item.label;
  body.innerHTML = renderInfoModalBody(info);

  infoState.returnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  modal.hidden = false;
  modal.inert = false;
  if (document.getElementById('chart-modal')?.hidden !== false) {
    document.body.style.overflow = 'hidden';
  }
  document.getElementById('info-modal-close')?.focus();
}

function cardIsFailed(meta) {
  if (meta.failed != null) return meta.failed;
  return meta.price === null || meta.price === '–';
}

function renderCard(meta, delay = 0) {
  const cls = cardClass(meta.pct, meta.change);
  const priceStr = meta.price !== null && meta.price !== '' ? meta.price : '–';
  const absStr = meta.isUsd
    ? formatUsdChange(meta.change)
    : meta.isAud
      ? formatAudChange(meta.change)
      : (meta.isYield || meta.isRatio)
        ? formatPointsChange(meta.change)
        : formatQuoteAbsChange(meta.change, meta.quoteDp);
  const asOfStr = formatCardAsOf(meta);
  const freshnessPill = resolveFreshnessPill(meta);
  const failed = cardIsFailed(meta);
  const loading = CARD_LOADING.has(meta.itemKey);
  const refreshLabel = `Refresh ${escapeHtml(meta.label)}`;
  const chartLabel = `View ${escapeHtml(meta.label)} chart`;
  const infoLabel = `About ${escapeHtml(meta.label)}`;
  const infoBtn = `
      <button type="button" class="card-info" data-item-key="${meta.itemKey}" data-section-key="${meta.sectionKey}"
        aria-label="${infoLabel}" title="${infoLabel}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 10v6M12 7h.01"/>
        </svg>
      </button>`;
  const chartBtn = meta.noChart ? '' : `
      <button type="button" class="card-chart" data-item-key="${meta.itemKey}" data-section-key="${meta.sectionKey}"
        aria-label="${chartLabel}" title="${chartLabel}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 17l5-6 4 4 5-7 4 5"/>
        </svg>
      </button>`;
  const refreshBtn = `
      <button type="button" class="card-refresh" aria-label="${refreshLabel}" title="${refreshLabel}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>`;
  const actions = `<div class="card-actions">${infoBtn}${chartBtn}${refreshBtn}</div>`;
  const venueLine = meta.exchangeLabel
    ? `<div class="card-venue">${escapeHtml(meta.exchangeLabel)}</div>`
    : '';
  const mainInner = `
      <div class="card-ticker">${escapeHtml(meta.ticker)}</div>
      ${venueLine}
      <div class="card-name">${escapeHtml(meta.label)}</div>
      <div class="card-price">${priceStr}</div>
      <div class="card-change">
        ${freshnessPill
    ? `<span class="${freshnessPillClass(freshnessPill)}">${escapeHtml(freshnessPill)}</span>
        <span class="pill ${pillClass(meta.pct, meta.change)}">${pillText(meta.pct)}</span>`
    : `<span class="pill ${pillClass(meta.pct, meta.change)}">${pillText(meta.pct)}</span>`}
        ${absStr ? `<span class="card-abs ${absChangeClass(meta.pct, meta.change)}">${absStr}</span>` : ''}
      </div>
      ${asOfStr && meta.showCardAsOf !== false
    ? `<div class="card-asof${isMetaStale(meta) || meta.sessionOpen === false ? ' card-asof--stale' : ''}">${escapeHtml(asOfStr)}</div>`
    : ''}
      ${meta.extra || ''}`;

  const stateCls = `${cls}${meta.cardClassExtra ? ` ${meta.cardClassExtra}` : ''}${failed ? ' card--failed' : ''}${loading ? ' card--loading' : ''}`;
  const style = `style="animation-delay:${delay}s"`;
  const dataAttrs = ` data-item-key="${meta.itemKey}" data-section-key="${meta.sectionKey}"`;

  if (meta.googleUrl && String(meta.googleUrl).startsWith('https://')) {
    const gfLabel = `View ${escapeHtml(meta.label)} on Google Finance (opens in new tab)`;
    return `
    <div class="card card--link-wrap ${stateCls}"${style}${dataAttrs}>
      ${actions}
      <a class="card-main" href="${meta.googleUrl}" target="_blank" rel="noopener noreferrer"
         aria-label="${gfLabel}">${mainInner}</a>
    </div>`;
  }

  return `
    <div class="card card--has-chart ${stateCls}"${style}${dataAttrs}>
      ${actions}
      <div class="card-main">${mainInner}</div>
    </div>`;
}
const FETCH_TIMEOUT_MS = 12000;

/** Set when hub/nginx returns HTTP 429 (limit_req on /economics/proxy/*). */
let hubProxyRateLimited = false;

function resetHubProxyRateLimit() {
  hubProxyRateLimited = false;
}

function noteHubHttpStatus(status) {
  if (status === 429) hubProxyRateLimited = true;
}

async function readFetchResponse(r, { asJson = true } = {}) {
  if (!r.ok) {
    noteHubHttpStatus(r.status);
    throw new Error(`HTTP ${r.status}`);
  }
  return asJson ? r.json() : r.text();
}

async function fetchWithTimeout(resource, options = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(resource, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Throttle concurrent proxied fetches
const proxyThrottle = (() => {
  let active = 0; const queue = [];
  return fn => new Promise((res, rej) => {
    const go = () => { active++; fn().then(res, rej).finally(() => { active--; queue.length && queue.shift()(); }); };
    active < 8 ? go() : queue.push(go);
  });
})();

// Same-origin CORS proxy (serve-hub.py locally, nginx /economics/proxy/* in prod)
let LOCAL_PROXY_OK = false;
let LOCAL_FRED_PROXY_OK = false;
let LOCAL_VALUATION_PROXY_OK = false;

/** Yahoo chart URL with raw symbol in path. */
function yahooChartUrl(sym, range = '5d', interval = '1d') {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`;
}

function yahooHistoryParams(days) {
  if (days <= 1) return { range: '1d', interval: '5m' };
  if (days <= 7) return { range: '7d', interval: '1h' };
  if (days <= 30) return { range: '1mo', interval: '1d' };
  if (days <= 180) return { range: '6mo', interval: '1d' };
  return { range: '1y', interval: '1d' };
}

function yahooChartUrlDirect(canonicalUrl) {
  return canonicalUrl.replace(/\/chart\/([^?]+)/, (_, s) => `/chart/${encodeURIComponent(s)}`);
}

function isCorsProxiedHost(url) {
  return /^https:\/\/(query1\.finance\.yahoo\.com|fred\.stlouisfed\.org|www\.google\.com)\//.test(url);
}

function parseRemoteTarget(canonicalUrl) {
  try {
    const u = new URL(canonicalUrl);
    if (u.hostname === 'query1.finance.yahoo.com') {
      const sym = decodeURIComponent(u.pathname.split('/').pop() || '');
      const range = u.searchParams.get('range') || '5d';
      const interval = u.searchParams.get('interval') || '1d';
      return { type: 'yahoo', sym, range, interval };
    }
    if (u.hostname === 'fred.stlouisfed.org') {
      return {
        type: 'fred',
        id: u.searchParams.get('id') || '',
        start: u.searchParams.get('observation_start') || '',
      };
    }
    if (u.hostname === 'www.google.com' && u.pathname.startsWith('/finance/quote/')) {
      const path = decodeURIComponent(u.pathname.slice('/finance/quote/'.length));
      return { type: 'google', path };
    }
  } catch {}
  return { type: 'raw', url: canonicalUrl };
}

function localProxyUrl(target) {
  const hubProxy = shouldOptimisticLocalProxy();
  if (!LOCAL_PROXY_OK && !(hubProxy && target.type === 'fred' && canUseHubFredProxy())) return null;
  if (!LOCAL_PROXY_OK && !hubProxy) return null;
  const base = location.origin;
  if (target.type === 'yahoo') {
    const p = new URLSearchParams({ sym: target.sym, range: target.range, interval: target.interval || '1d' });
    return `${base}/economics/proxy/yahoo?${p}`;
  }
  if (target.type === 'fred') {
    const p = new URLSearchParams({ id: target.id, start: target.start });
    return `${base}/economics/proxy/fred?${p}`;
  }
  if (target.type === 'google') {
    const p = new URLSearchParams({ path: target.path });
    return `${base}/economics/proxy/google?${p}`;
  }
  return null;
}

const PROXY_PROBE_TIMEOUT_MS = 5000;

async function probeLocalProxy(url, timeoutMs = PROXY_PROBE_TIMEOUT_MS, validate) {
  try {
    const r = await fetchWithTimeout(url, {}, timeoutMs);
    if (!r.ok) {
      noteHubHttpStatus(r.status);
      return false;
    }
    return validate ? validate(r) : true;
  } catch {
    return false;
  }
}

function isHubHostname() {
  const host = location.hostname;
  return host === 'anthemic-developments.com'
    || host === 'www.anthemic-developments.com'
    || host === 'localhost'
    || host === '127.0.0.1';
}

function isHubEconomicsPage() {
  const path = location.pathname;
  return path === '/economics' || path.startsWith('/economics/');
}

/** Hub pages: use same-origin /economics/proxy/* immediately; probe verifies in background. */
function shouldOptimisticLocalProxy() {
  return isHubHostname() && isHubEconomicsPage();
}

function canUseHubFredProxy() {
  return LOCAL_FRED_PROXY_OK || shouldOptimisticLocalProxy();
}

function setOptimisticLocalProxy() {
  LOCAL_PROXY_OK = true;
  LOCAL_FRED_PROXY_OK = true;
  LOCAL_VALUATION_PROXY_OK = true;
}

async function detectLocalProxy() {
  const origin = location.origin;
  const yahooProbe = `${origin}/economics/proxy/yahoo?${new URLSearchParams({ sym: '^GSPC', range: '1d' })}`;
  const fredHealth = `${origin}/economics/proxy/fred/health`;
  const valHealth = `${origin}/economics/proxy/valuation/health`;

  const [yahooOk, fredOk, valOk] = await Promise.all([
    probeLocalProxy(yahooProbe),
    probeLocalProxy(fredHealth),
    probeLocalProxy(valHealth),
  ]);

  LOCAL_PROXY_OK = yahooOk;
  LOCAL_FRED_PROXY_OK = fredOk || (yahooOk && isHubEconomicsPage());
  LOCAL_VALUATION_PROXY_OK = valOk || yahooOk;
}

function localFredProxyUrl(seriesId, start) {
  const p = new URLSearchParams({ id: seriesId, start: start || '' });
  return `${location.origin}/economics/proxy/fred?${p}`;
}

function publicProxyUrls(canonicalUrl) {
  return [
    `https://corsproxy.io/?${encodeURIComponent(canonicalUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(canonicalUrl)}`,
  ];
}

/** Third-party CORS proxies leak upstream URLs; disabled on production hub. */
function useThirdPartyCorsProxies() {
  const h = typeof location !== 'undefined' ? location.hostname : '';
  if (h === 'anthemic-developments.com' || h === 'www.anthemic-developments.com') return false;
  return true;
}

async function fetchRemote(canonicalUrl, { asJson = true } = {}) {
  const attempts = [];
  const corsOnly = isCorsProxiedHost(canonicalUrl);
  const localUrl = localProxyUrl(parseRemoteTarget(canonicalUrl));

  if (localUrl) {
    attempts.push(async () => {
      const r = await fetchWithTimeout(localUrl);
      return readFetchResponse(r, { asJson });
    });
  }

  if (!corsOnly) {
    attempts.push(async () => {
      const r = await fetchWithTimeout(canonicalUrl);
      return readFetchResponse(r, { asJson });
    });
  }

  const skipPublicProxy = (() => {
    if (!useThirdPartyCorsProxies()) return true;
    if (!isHubEconomicsPage()) return false;
    try {
      return new URL(canonicalUrl).hostname === 'fred.stlouisfed.org';
    } catch {
      return false;
    }
  })();

  if (useThirdPartyCorsProxies() && !skipPublicProxy) {
    for (const url of publicProxyUrls(canonicalUrl)) {
      attempts.push(async () => {
        const r = await fetchWithTimeout(url);
        return readFetchResponse(r, { asJson });
      });
    }

    attempts.push(async () => {
      const r = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(canonicalUrl)}`);
      const wrap = await readFetchResponse(r, { asJson: true });
      const body = wrap.contents;
      return asJson ? JSON.parse(body) : body;
    });

    if (corsOnly && !LOCAL_PROXY_OK) {
      attempts.push(async () => {
        const direct = canonicalUrl.includes('query1.finance.yahoo.com')
          ? yahooChartUrlDirect(canonicalUrl)
          : canonicalUrl;
        const r = await fetchWithTimeout(direct);
        return readFetchResponse(r, { asJson });
      });
    }
  }

  for (const fn of attempts) {
    try {
      return await proxyThrottle(fn);
    } catch {}
  }
  return null;
}

function parseYahooChart(d) {
  if (!d?.chart?.result?.[0]) throw new Error('no data');
  const r = d.chart.result[0];
  const meta = r.meta;
  const closes = (r.indicators?.quote?.[0]?.close || []).filter(v => v != null && !Number.isNaN(v));
  const metaPrice = meta.regularMarketPrice;
  // Prefer last daily close so card, change %, and chart history use the same scale
  let price = closes.length ? closes[closes.length - 1] : metaPrice;
  if (price == null || Number.isNaN(price)) price = metaPrice;
  if (closes.length && metaPrice != null && Math.abs(metaPrice - price) / price > 0.15) {
    price = closes[closes.length - 1];
  }
  let prevClose = meta.chartPreviousClose ?? meta.previousClose;
  if ((prevClose == null || Number.isNaN(prevClose)) && closes.length > 1) {
    prevClose = closes[closes.length - 2];
  }
  const change = pointsChange(price, prevClose);
  const pct = pctChange(price, prevClose);
  const asOfUtc = meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();
  const exchangeLabel = formatYahooExchange(meta);
  return attachFreshness({ price, change, pct, asOfUtc, exchangeLabel }, 'live', {
    note: meta.regularMarketTime ? null : 'quote time unavailable',
  });
}

function formatYieldPrice(d) {
  if (!d || d.price == null || Number.isNaN(Number(d.price))) return null;
  return `${Number(d.price).toFixed(2)}%`;
}

function formatPointsChange(change, baseDp = 2) {
  if (change == null || Number.isNaN(change)) return '';
  const v = Number(change);
  const dp = displayDecimalsForDelta(v, baseDp, 3);
  if (isDisplayFlat(v, dp)) return `${v.toFixed(2)} pp`;
  const prefix = v > 0 ? '+' : '-';
  return `${prefix}${Math.abs(v).toFixed(dp)} pp`;
}

function formatAudChange(changeBillions) {
  if (changeBillions == null || Number.isNaN(changeBillions)) return '';
  const v = Number(changeBillions);
  const abs = Math.abs(v);
  const body = abs >= 100 ? `A$${abs.toFixed(0)}B` : `A$${abs.toFixed(1)}B`;
  return `${sign(v)}${body}`;
}

function formatAudCompact(billions) {
  if (billions == null || Number.isNaN(billions)) return null;
  const abs = Math.abs(billions);
  if (abs >= 1000) return `A$${(billions / 1000).toFixed(2)}T`;
  if (abs >= 1) return `A$${billions.toFixed(1)}B`;
  return `A$${(billions * 1000).toFixed(0)}M`;
}

// ── Google Finance (unofficial — quote HTML scrape) ────────────────
const GOOGLE_FINANCE_BASE = {
  '^GSPC':  { path: '.INX:INDEXSP',     ticker: '.INX',  exchange: 'INDEXSP' },
  '^IXIC':  { path: '.IXIC:INDEXNASDAQ', ticker: '.IXIC', exchange: 'INDEXNASDAQ' },
  '^NDX':   { path: 'NDX:INDEXNASDAQ',  ticker: 'NDX',   exchange: 'INDEXNASDAQ' },
  '^AORD':  { path: 'XAO:INDEXASX',     ticker: 'XAO',   exchange: 'INDEXASX' },
  '^DJI':   { path: '.DJI:INDEXDJX',    ticker: '.DJI',  exchange: 'INDEXDJX' },
  '^RUT':   { path: 'RUT:INDEXRUSSELL', ticker: 'RUT',   exchange: 'INDEXRUSSELL' },
  '^AXJO':  { path: 'XJO:INDEXASX',     ticker: 'XJO',   exchange: 'INDEXASX' },
  'EEM':    { path: 'EEM:NYSEARCA',     ticker: 'EEM',   exchange: 'NYSEARCA' },
  'VGK':    { path: 'VGK:NYSEARCA',     ticker: 'VGK',   exchange: 'NYSEARCA' },
  'EWJ':    { path: 'EWJ:NYSEARCA',     ticker: 'EWJ',   exchange: 'NYSEARCA' },
  'VIXY':   { path: 'VIXY:NYSEARCA',    ticker: 'VIXY',  exchange: 'NYSEARCA' },
  'ARKK':   { path: 'ARKK:NYSEARCA',    ticker: 'ARKK',  exchange: 'NYSEARCA' },
  'GC=F':   { path: 'GCW00:COMEX',      ticker: 'GCW00', exchange: 'COMEX' },
  'SI=F':   { path: 'SIW00:COMEX',      ticker: 'SIW00', exchange: 'COMEX' },
  'HG=F':   { path: 'HGW00:COMEX',      ticker: 'HGW00', exchange: 'COMEX' },
  'CL=F':   { path: 'CLW00:NYMEX',      ticker: 'CLW00', exchange: 'NYMEX' },
  'BZ=F':   { path: 'BZW00:NYMEX',      ticker: 'BZW00', exchange: 'NYMEX' },
  'NG=F':   { path: 'NGW00:NYMEX',      ticker: 'NGW00', exchange: 'NYMEX' },
  'CPER':   { path: 'CPER:NYSEARCA',    ticker: 'CPER',  exchange: 'NYSEARCA' },
  'WEAT':   { path: 'WEAT:NYSEARCA',    ticker: 'WEAT',  exchange: 'NYSEARCA' },
  'CORN':   { path: 'CORN:NYSEARCA',    ticker: 'CORN',  exchange: 'NYSEARCA' },
  '^FVX':   { path: 'FVX:INDEXCBOE',    ticker: 'FVX',   exchange: 'INDEXCBOE' },
  '^TNX':   { path: 'TNX:INDEXCBOE',    ticker: 'TNX',   exchange: 'INDEXCBOE' },
  '^TYX':   { path: 'TYX:INDEXCBOE',    ticker: 'TYX',   exchange: 'INDEXCBOE' },
  '^IRX':   { path: 'IRX:INDEXCBOE',    ticker: 'IRX',   exchange: 'INDEXCBOE' },
  'BRK-B':  { path: 'BRK.B:NYSE',       ticker: 'BRK.B', exchange: 'NYSE' },
};

function guessGoogleMeta(sym) {
  if (sym.endsWith('.AX')) {
    const t = sym.replace(/\.AX$/i, '');
    return { path: `${t}:ASX`, ticker: t, exchange: 'ASX' };
  }
  if (sym.includes('-USD') || sym.includes('=')) return null;
  if (sym.startsWith('^')) return null;
  if (sym.includes('.')) {
    const t = sym.replace(/\./g, '-');
    return { path: `${t}:NYSE`, ticker: t, exchange: 'NYSE' };
  }
  if (sym.includes('-')) {
    return { path: `${sym}:NYSE`, ticker: sym, exchange: 'NYSE' };
  }
  return { path: `${sym}:NASDAQ`, ticker: sym, exchange: 'NASDAQ' };
}

function resolveGoogleMeta(sym) {
  return GOOGLE_FINANCE_BASE[sym] || guessGoogleMeta(sym);
}

for (const entry of STOCK_CATALOG) {
  if (!GOOGLE_FINANCE_BASE[entry.sym]) {
    const guessed = guessGoogleMeta(entry.sym);
    if (guessed) GOOGLE_FINANCE_BASE[entry.sym] = guessed;
  }
}

function googleFinancePageUrl(path) {
  return `https://www.google.com/finance/quote/${encodeURIComponent(path)}`;
}

function googleFinanceUrlForItem(item, sectionKey) {
  if (sectionKey === 'fx') {
    return googleFinancePageUrl(`${item.from}-${item.to}`);
  }
  if (sectionKey === 'crypto') {
    return googleFinancePageUrl(item.sym);
  }
  const sym = item.sym || item.yTicker || null;
  if (sym) {
    const meta = resolveGoogleMeta(sym);
    if (meta) return googleFinancePageUrl(meta.path);
  }
  if (sectionKey === 'bond' && item.id?.startsWith('^')) {
    const meta = resolveGoogleMeta(item.id);
    if (meta) return googleFinancePageUrl(meta.path);
  }
  return null;
}

function withGoogleUrl(meta, item, sectionKey) {
  const googleUrl = googleFinanceUrlForItem(item, sectionKey);
  return googleUrl ? { ...meta, googleUrl } : meta;
}

function parseGoogleFinanceHtml(html, ticker, exchange) {
  if (!html || !ticker || !exchange) return null;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\[\\["/[^"]+",\\["${esc(ticker)}","${esc(exchange)}"\\](?:,[^[]*)*,\\[(-?[\\d.]+),(-?[\\d.]+),(-?[\\d.]+),2,2,2\\]`
  );
  const m = html.match(re);
  if (!m) return null;
  const price = parseFloat(m[1]);
  const change = parseFloat(m[2]);
  const pct = parseFloat(m[3]);
  if ([price, change, pct].some(v => Number.isNaN(v))) return null;
  return { price, change, pct };
}

async function googleFinanceQuote(sym) {
  const meta = resolveGoogleMeta(sym);
  if (!meta) return null;
  try {
    const html = await fetchRemote(googleFinancePageUrl(meta.path), { asJson: false });
    const q = html ? parseGoogleFinanceHtml(html, meta.ticker, meta.exchange) : null;
    if (!q) return null;
    const normalized = normalizeCBOEYieldQuote(sym, q);
    const gfMeta = resolveGoogleMeta(sym);
    const exchangeLabel = gfMeta?.exchange
      ? (YAHOO_EXCHANGE_LABELS[gfMeta.exchange] || gfMeta.exchange)
      : null;
    return attachFreshness(
      { ...normalized, asOfUtc: Date.now(), exchangeLabel },
      'live',
      { note: 'Google Finance' },
    );
  } catch {
    return null;
  }
}

function usesFrankfurterFx() {
  return activeProvider === 'yahoo' || activeProvider === 'google';
}

// ── Yahoo Finance ──────────────────────────────────────────────────
async function yahooChart(sym) {
  try {
    const data = await fetchRemote(yahooChartUrl(sym, '5d'), { asJson: true });
    return data ? parseYahooChart(data) : null;
  } catch {
    return null;
  }
}

// ── Frankfurter.dev FX (CORS-friendly, no key needed) ─────────────
let _fxPromise = null;
async function loadFrankfurter(force = false) {
  const key = 'fx:frank';
  if (!force) { const c = cacheGet(key); if (c) return c; }
  if (!force && _fxPromise) return _fxPromise;
  const symbols = 'EUR,GBP,JPY,AUD,NZD,CAD,CHF,MXN,CNY,INR';
  const from = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
  const to   = new Date().toISOString().slice(0, 10);
  _fxPromise = fetch(`https://api.frankfurter.dev/v1/${from}..${to}?base=USD&symbols=${symbols}`)
    .then(r => r.json())
    .then(d => {
      const dates = Object.keys(d.rates).sort();
      const latestDate = dates[dates.length - 1];
      const result = {
        today: d.rates[latestDate],
        prev: d.rates[dates[dates.length - 2]],
        latestDate,
      };
      cacheSet(key, result);
      _fxPromise = null;
      return result;
    });
  return _fxPromise;
}

async function fetchFXFrank(from, toCcy) {
  const { today, prev, latestDate } = await loadFrankfurter();
  const rate = (rates, base, sym) => base === 'USD' ? rates[sym] : (1 / rates[base]);
  const price     = rate(today, from, toCcy);
  const prevPrice = rate(prev,  from, toCcy);
  if (!price) return null;
  const change = pointsChange(price, prevPrice);
  const pct = pctChange(price, prevPrice);
  return attachFreshness(
    { price, change, pct, asOfUtc: fredDateToUtc(latestDate) },
    'daily',
    { note: 'ECB reference · prior biz day' },
  );
}

// ── CoinGecko crypto (CORS-friendly, no key needed) ────────────────
let _cgPromise = null;
async function loadCoinGecko(force = false) {
  const key = 'cg:batch';
  if (!force) { const c = cacheGet(key); if (c) return c; }
  if (!force && _cgPromise) return _cgPromise;
  const ids = Object.values(CG_IDS).join(',');
  _cgPromise = fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  ).then(r => r.json()).then(d => {
    const asOfUtc = Date.now();
    const result = {};
    for (const [sym, cgId] of Object.entries(CG_IDS)) {
      const item = d[cgId];
      if (!item) continue;
      const price = item.usd;
      const pct   = item.usd_24h_change ?? null;
      const change = pct !== null ? price * pct / (100 + pct) : null;
      result[sym] = attachFreshness({ price, change, pct, asOfUtc }, 'live', { note: '24h rolling' });
    }
    cacheSet(key, result);
    _cgPromise = null;
    return result;
  });
  return _cgPromise;
}

async function fetchCrypto(sym, force = false) {
  try {
    const batch = await loadCoinGecko(force);
    return batch?.[sym] ?? null;
  } catch { return null; }
}

// ── Alpha Vantage ─────────────────────────────────
async function avQuote(sym) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${AV_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.Note || d.Information) throw new Error('Rate limit');
  const q = d['Global Quote'];
  if (!q || !q['05. price']) return null;
  const exchangeLabel = q['04. exchange'] ? String(q['04. exchange']).trim() : null;
  return attachFreshness({
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    pct: parseFloat(q['10. change percent'].replace('%', '')),
    asOfUtc: Date.now(),
    exchangeLabel,
  }, 'live');
}

async function avFX(from, to) {
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${AV_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.Note || d.Information) throw new Error('Rate limit');
  const info = d['Realtime Currency Exchange Rate'];
  if (!info) return null;
  const refreshed = info['6. Last Refreshed'];
  const asOfUtc = refreshed ? Date.parse(`${refreshed.replace(' ', 'T')}Z`) : Date.now();
  return attachFreshness(
    {
      price: parseFloat(info['5. Exchange Rate']),
      change: null,
      pct: null,
      asOfUtc: Number.isNaN(asOfUtc) ? Date.now() : asOfUtc,
    },
    'live',
    { note: 'Alpha Vantage FX' },
  );
}

// ── Dispatched Fetchers (with cache) ──────────────
async function fetchQuote(sym, force = false) {
  const key = `${activeProvider}:q:${sym}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    let result = null;
    if (activeProvider === 'yahoo') result = await yahooChart(sym);
    else if (activeProvider === 'google') result = await googleFinanceQuote(sym);
    else result = await avQuote(sym);
    if (result) cacheSet(key, result);
    return result;
  } catch { return null; }
}

async function fetchFX(from, to, force = false) {
  const key = `${activeProvider}:fx:${from}:${to}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    let result = null;
    if (hasValidAvKey()) {
      try {
        result = await avFX(from, to);
      } catch (err) {
        console.warn('AV FX failed, falling back', from, to, err);
      }
    }
    if (!result && usesFrankfurterFx()) result = await fetchFXFrank(from, to);
    else if (!result) result = await avFX(from, to);
    if (result) cacheSet(key, result);
    return result;
  } catch { return null; }
}

async function fetchCommodity(item, force = false) {
  if (item?.fredId) {
    const key = `fred:comm:${item.fredId}`;
    if (!force) {
      const cached = cacheGet(key);
      if (cached) return cached;
    }
    try {
      const rows = await proxyThrottle(() => fetchFredSeriesRows(item.fredId, fredStartDate(5 * 365)));
      if (!rows?.length) return null;
      const q = fredDailyQuoteFromRows(rows);
      if (!q) return null;
      const note = q.freshnessNote ? `${q.freshnessNote} · ${item.fredId}` : `FRED · ${item.fredId}`;
      const result = { ...q, freshnessNote: note };
      cacheSet(key, result);
      return result;
    } catch {
      return null;
    }
  }
  if (!item?.sym) return null;
  return fetchQuote(item.sym, force);
}

function parseFredCsvRows(txt) {
  const rows = [];
  for (const line of txt.trim().split('\n')) {
    if (line.startsWith('observation_date') || line.endsWith(',')) continue;
    const [date, val] = line.split(',');
    const v = parseFloat(val);
    if (!date || Number.isNaN(v)) continue;
    rows.push({ date, v });
  }
  return rows;
}

function parseFredApiRows(data) {
  const obs = data?.observations;
  if (!Array.isArray(obs)) return null;
  const rows = [];
  for (const o of obs) {
    if (!o?.date || o.value === '.') continue;
    const v = parseFloat(o.value);
    if (Number.isNaN(v)) continue;
    rows.push({ date: o.date, v });
  }
  return rows.length ? rows : null;
}

function parseFredResponseBody(body, contentType = '') {
  const trimmed = (body || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || contentType.includes('json')) {
    try {
      return parseFredApiRows(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return parseFredCsvRows(trimmed);
}

/** Z.1 corporate equities (quarterly); scaled to today via broad market index. */
const BUFFETT_CAP_SERIES = 'NCBEILQ027S';
const BUFFETT_SCALE_SYM = '^GSPC';

function buffettRatio(capMillions, gdpBillions) {
  return (capMillions / 1000 / gdpBillions) * 100;
}

function indexAtOrBefore(series, ts) {
  if (!series?.length || ts == null) return null;
  let v = null;
  for (const p of series) {
    if (p.t <= ts) v = p.v;
    else break;
  }
  return v;
}

function buffettExtraHtml(d) {
  if (!d?.buffettMeta) return '';
  const m = d.buffettMeta;
  let html = '';
  const capLabel = m.capScaled
    ? `Cap est. (Z.1 ${m.capZ1Date} × ${BUFFETT_SCALE_SYM})`
    : `Cap (Z.1 ${m.capZ1Date})`;
  html += `<div class="yield-extra"><span class="spread-label">Numerator</span>
    <span class="spread-val">${escapeHtml(capLabel)}</span></div>`;
  const gdpLabel = m.gdpNowcast
    ? `Nominal GDP est. (${escapeHtml(m.gdpDate)} · GDPNow)`
    : `Nominal GDP (${escapeHtml(m.gdpDate)})`;
  html += `<div class="yield-extra"><span class="spread-label">Denominator</span>
    <span class="spread-val">${gdpLabel}</span></div>`;
  return html;
}

function spread2s10sExtraHtml(info) {
  if (!info || info.spread == null || Number.isNaN(info.spread)) return '';
  const v = Number(info.spread);
  const cls = v >= 0 ? 'spread-pos' : 'spread-neg';
  const sign = v >= 0 ? '+' : '';
  const dateNote = info.sameDay
    ? `FRED DGS2/DGS10 · ${escapeHtml(info.y2Date)}`
    : `FRED · 2Y ${escapeHtml(info.y2Date)} / 10Y ${escapeHtml(info.y10Date)}`;
  return `<div class="yield-extra"><span class="spread-label">2s10s spread</span>
    <span class="spread-val ${cls}">${sign}${v.toFixed(2)} pp</span></div>
    <div class="yield-extra yield-extra--sub"><span class="spread-label">Curve</span>
    <span class="spread-val spread-val--muted">${dateNote}</span></div>`;
}

function fredDailyQuoteFromRows(rows) {
  if (!rows?.length) return null;
  const sorted = sortedFredRows(rows);
  const last = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  return attachFreshness({
    price: last.v,
    change: prev ? pointsChange(last.v, prev.v) : null,
    pct: prev ? pctChange(last.v, prev.v) : null,
    asOfUtc: fredDateToUtc(last.date),
    obsDate: last.date,
  }, 'daily', { note: 'FRED daily' });
}

function computeBondSpreadFred(spreadFred) {
  const y2 = spreadFred?.DGS2;
  const y10 = spreadFred?.DGS10;
  if (y2?.price == null || y10?.price == null) return null;
  const spread = y10.price - y2.price;
  const sameDay = y2.obsDate === y10.obsDate;
  return {
    spread,
    sameDay,
    y2Date: y2.obsDate,
    y10Date: y10.obsDate,
    asOfUtc: fredDateToUtc(sameDay ? y2.obsDate : (y2.obsDate > y10.obsDate ? y2.obsDate : y10.obsDate)),
  };
}

async function loadBondSpreadFred(force = false) {
  const key = 'bond:spread-fred';
  if (!force) {
    const c = cacheGet(key);
    if (c) return c;
  }
  if (!force && bondSpreadFredPromise) return bondSpreadFredPromise;
  const start = fredStartDate(90);
  bondSpreadFredPromise = Promise.all(
    BOND_SPREAD_FRED_IDS.map(async id => [id, await fetchFredSeriesRows(id, start)]),
  ).then(pairs => {
    const out = {};
    for (const [id, rows] of pairs) {
      const q = fredDailyQuoteFromRows(rows);
      if (q) out[id] = q;
    }
    cacheSet(key, out);
    bondSpreadFredPromise = null;
    return out;
  }).catch(err => {
    console.warn('bond spread FRED load failed', err);
    bondSpreadFredPromise = null;
    return {};
  });
  return bondSpreadFredPromise;
}

/** Latest Buffett ratio: scale stale Z.1 cap with live market; GDP = newest FRED row. */
async function fetchBuffettCurrent(fred, force = false) {
  if (!fred) return null;
  const ratios = buildBuffettRatios(fred[BUFFETT_CAP_SERIES], fred.GDP);
  const historical = quoteFromRatioSeries(ratios);
  const capRows = fred[BUFFETT_CAP_SERIES];
  const gdpPick = pickGdpDenominator(fred);
  if (!capRows?.length || !gdpPick) return historical;

  const lastCap = capRows[capRows.length - 1];
  let capMillions = lastCap.v;
  let asOfUtc = null;
  let scaled = false;

  try {
    const capTs = fredDateToUtc(lastCap.date);
    const histDays = capTs
      ? Math.min(400, Math.max(60, Math.ceil((Date.now() - capTs) / 86400000) + 14))
      : 180;
    const scale = await Promise.race([
      Promise.all([
        fetchQuote(BUFFETT_SCALE_SYM, force),
        fetchYahooHistory(BUFFETT_SCALE_SYM, histDays),
      ]).then(([live, hist]) => ({ live, hist })),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Buffett scale timeout')), 15000)),
    ]);
    const benchAtCap = capTs != null ? indexAtOrBefore(scale.hist, capTs) : null;
    if (scale.live?.price && benchAtCap && benchAtCap > 0) {
      capMillions = lastCap.v * (scale.live.price / benchAtCap);
      scaled = true;
      asOfUtc = scale.live.asOfUtc ?? Date.now();
    }
  } catch (err) {
    console.warn('Buffett cap scale failed', err);
  }

  if (!asOfUtc) asOfUtc = fredDateToUtc(lastCap.date);

  const ratio = buffettRatio(capMillions, gdpPick.billions);
  const change = historical ? pointsChange(ratio, historical.price) : null;
  const pct = historical ? pctChange(ratio, historical.price) : null;
  const gdpNowcast = gdpPick.source === 'nowcast';

  return attachFreshness({
    price: ratio,
    change,
    pct,
    asOfUtc,
    buffettMeta: {
      gdpDate: gdpPick.date,
      gdpNowcast,
      capZ1Date: lastCap.date,
      capScaled: scaled,
    },
    anchorDate: lastCap.date,
    freshnessNote: [
      scaled ? 'Cap scaled via ^GSPC' : `Z.1 cap ${lastCap.date}`,
      gdpPick.freshnessNote,
    ].filter(Boolean).join(' · '),
  }, 'estimated', { estimated: true });
}

function buffettZone(ratio) {
  if (ratio == null || Number.isNaN(ratio)) return null;
  if (ratio < 75)  return { label: 'Strongly undervalued', cls: 'buffett-cool' };
  if (ratio < 90)  return { label: 'Undervalued', cls: 'buffett-cool' };
  if (ratio <= 115) return { label: 'Fair value', cls: 'buffett-fair' };
  if (ratio <= 135) return { label: 'Overvalued', cls: 'buffett-warm' };
  return { label: 'Strongly overvalued', cls: 'buffett-hot' };
}

function formatRatioPrice(d, dp = 1) {
  if (!d || d.price == null || Number.isNaN(Number(d.price))) return null;
  return `${Number(d.price).toFixed(dp)}%`;
}

/** @param {number} billions nominal USD (FRED GDP / debt series) */
function formatUsdCompact(billions) {
  if (billions == null || Number.isNaN(billions)) return null;
  const abs = Math.abs(billions);
  if (abs >= 1000) return `$${(billions / 1000).toFixed(2)}T`;
  if (abs >= 1) return `$${billions.toFixed(1)}B`;
  return `$${(billions * 1000).toFixed(0)}M`;
}

function formatUsdChange(changeBillions) {
  if (changeBillions == null || Number.isNaN(changeBillions)) return '';
  const v = Number(changeBillions);
  return `${sign(v)}${formatUsdCompact(Math.abs(v))}`;
}

function sortedFredRows(rows) {
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

function latestFredRow(rows) {
  const sorted = sortedFredRows(rows);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function prevFredRow(rows) {
  const sorted = sortedFredRows(rows);
  return sorted.length > 1 ? sorted[sorted.length - 2] : null;
}

/** Scale quarterly federal debt stocks using monthly marketable Treasury debt (FRED). */
const FRED_TREASURY_MV_SERIES = 'MVMTD027MNFRBDAL';
const FRED_PUBLIC_DEBT_LEVEL_SERIES = 'GFDEBTN';
const FRED_GDP_NOWCAST_SERIES = 'GDPNOW';
/** BIS govt credit % GDP (quarterly). IMF GGGDTAAUA188N is annual and lags ~1y on FRED. */
const FRED_AU_PUBLIC_DEBT_SERIES = 'QAUGAN770A';
const BOND_SPREAD_FRED_IDS = ['DGS2', 'DGS10'];
let BOND_SPREAD_FRED = null;
let bondSpreadFredPromise = null;

/**
 * Pick GDP denominator: quarterly FRED GDP, or project forward with Atlanta Fed GDPNow when newer.
 * @returns {{ billions: number, date: string, source: 'quarterly'|'nowcast', freshnessNote?: string, anchorDate?: string } | null}
 */
function pickGdpDenominator(fred) {
  const quarterly = latestFredRow(fred.GDP);
  if (!quarterly?.v) return null;
  const nowcast = latestFredRow(fred[FRED_GDP_NOWCAST_SERIES]);
  if (!nowcast?.v || nowcast.date <= quarterly.date) {
    return { billions: quarterly.v, date: quarterly.date, source: 'quarterly' };
  }
  const months = monthsBetweenFredDates(quarterly.date, nowcast.date);
  const quarters = Math.max(1, Math.round(months / 3));
  const qGrowth = (nowcast.v / 100) / 4;
  let billions = quarterly.v;
  for (let i = 0; i < quarters; i++) billions *= (1 + qGrowth);
  return {
    billions,
    date: nowcast.date,
    source: 'nowcast',
    anchorDate: quarterly.date,
    freshnessNote: `GDP proj. · GDPNow ${nowcast.v.toFixed(1)}% SAAR`,
  };
}

function treasuryMvScaleFactor(monthlyRows, anchorDate) {
  if (!monthlyRows?.length || !anchorDate) return { scale: 1, asOfDate: null };
  const sorted = sortedFredRows(monthlyRows);
  let anchor = null;
  for (const row of sorted) {
    if (row.date <= anchorDate) anchor = row;
    else break;
  }
  const latest = sorted[sorted.length - 1];
  if (!anchor?.v || !latest?.v) return { scale: 1, asOfDate: latest?.date ?? null };
  return { scale: latest.v / anchor.v, asOfDate: latest.date };
}

function monthsBetweenFredDates(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const a = new Date(fromDate);
  const b = new Date(toDate);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function debtRatioExtraHtml(d) {
  if (!d?.debtEstMeta) return '';
  const m = d.debtEstMeta;
  let html = '';
  if (m.scaled) {
    html += `<div class="yield-extra"><span class="spread-label">Estimate</span>
      <span class="spread-val">Debt scaled via Treasury MV (${escapeHtml(m.treasuryMvDate || '—')})</span></div>`;
  }
  if (m.debtAnchorDate) {
    html += `<div class="yield-extra"><span class="spread-label">Z.1 debt</span>
      <span class="spread-val">${escapeHtml(m.debtAnchorDate)}</span></div>`;
  }
  if (m.ratioDate) {
    html += `<div class="yield-extra"><span class="spread-label">Ratio</span>
      <span class="spread-val">${escapeHtml(m.ratioDate)}</span></div>`;
  }
  if (m.gdpDate) {
    html += `<div class="yield-extra"><span class="spread-label">GDP</span>
      <span class="spread-val">${escapeHtml(m.gdpDate)}</span></div>`;
  }
  return html;
}

function fetchPublicDebtCurrent(fred) {
  const official = fredRowsToQuote(fred.GFDEGDQ188S);
  const anchorRatio = latestFredRow(fred.GFDEGDQ188S);
  const gdpPick = pickGdpDenominator(fred);
  const debtLevel = latestFredRow(fred[FRED_PUBLIC_DEBT_LEVEL_SERIES]);
  const treasuryMv = fred[FRED_TREASURY_MV_SERIES];
  if (!anchorRatio || !gdpPick || !debtLevel) return official;

  const { scale, asOfDate: treasuryMvDate } = treasuryMv?.length
    ? treasuryMvScaleFactor(treasuryMv, anchorRatio.date)
    : { scale: 1, asOfDate: null };

  const debtBillions = (debtLevel.v / 1000) * scale;
  const ratio = (debtBillions / gdpPick.billions) * 100;
  const asOfUtc = fredDateToUtc(treasuryMvDate || gdpPick.date);

  return attachFreshness({
    price: ratio,
    change: official ? pointsChange(ratio, official.price) : null,
    pct: official ? pctChange(ratio, official.price) : null,
    asOfUtc,
    usdBillions: debtBillions,
    debtEstMeta: {
      scaled: scale !== 1,
      debtAnchorDate: anchorRatio.date,
      gdpDate: gdpPick.date,
      gdpNowcast: gdpPick.source === 'nowcast',
      treasuryMvDate,
    },
    anchorDate: anchorRatio.date,
    freshnessNote: [
      scale !== 1 ? 'Debt scaled via Treasury MV' : null,
      gdpPick.freshnessNote,
    ].filter(Boolean).join(' · ') || null,
  }, 'estimated', { estimated: true });
}

function fetchPrivateDebtCurrent(fred) {
  const official = quoteFromRatioSeries(buildPrivateDebtRatios(fred.TCMDO, fred.FGSDODNS, fred.GDP));
  const tcmdoRow = latestFredRow(fred.TCMDO);
  const fedRow = latestFredRow(fred.FGSDODNS);
  const prevTcmdo = prevFredRow(fred.TCMDO);
  const gdpPick = pickGdpDenominator(fred);
  const treasuryMv = fred[FRED_TREASURY_MV_SERIES];
  if (!tcmdoRow || !fedRow || !gdpPick) return official;

  const { scale: fedScale, asOfDate: treasuryMvDate } = treasuryMv?.length
    ? treasuryMvScaleFactor(treasuryMv, fedRow.date)
    : { scale: 1, asOfDate: null };

  let scaledTcmdo = tcmdoRow.v;
  if (prevTcmdo?.v > 0 && tcmdoRow.v > 0 && tcmdoRow.date !== gdpPick.date) {
    const qGrowth = tcmdoRow.v / prevTcmdo.v;
    const months = Math.max(0, monthsBetweenFredDates(tcmdoRow.date, gdpPick.date));
    scaledTcmdo = tcmdoRow.v * (qGrowth ** (months / 3));
  }

  const scaledFed = fedRow.v * fedScale;
  const privateMillions = scaledTcmdo - scaledFed;
  if (privateMillions <= 0) return official;

  const ratio = (privateMillions / 1000 / gdpPick.billions) * 100;
  const asOfUtc = fredDateToUtc(treasuryMvDate || gdpPick.date);

  return attachFreshness({
    price: ratio,
    change: official ? pointsChange(ratio, official.price) : null,
    pct: official ? pctChange(ratio, official.price) : null,
    asOfUtc,
    usdBillions: privateMillions / 1000,
    debtEstMeta: {
      scaled: fedScale !== 1 || scaledTcmdo !== tcmdoRow.v,
      debtAnchorDate: tcmdoRow.date,
      gdpDate: gdpPick.date,
      gdpNowcast: gdpPick.source === 'nowcast',
      treasuryMvDate,
    },
    anchorDate: tcmdoRow.date,
    freshnessNote: [
      'Private debt est. to latest GDP',
      gdpPick.freshnessNote,
    ].filter(Boolean).join(' · '),
  }, 'estimated', { estimated: true });
}

function fetchAuGdpCurrent(fred) {
  const rows = sortedFredRows(fred.NGDPSAXDCAUQ);
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const price = last.v / 1000;
  const prevPrice = prev ? prev.v / 1000 : null;
  return attachFreshness({
    price,
    change: prevPrice != null ? pointsChange(price, prevPrice) : null,
    pct: prevPrice != null ? pctChange(price, prevPrice) : null,
    asOfUtc: fredDateToUtc(last.date),
  }, 'quarterly', { note: quarterLabelFromFredDate(last.date) });
}

function quoteFromPercentRows(rows, kind = 'quarterly', note = null) {
  if (!rows?.length) return null;
  const sorted = sortedFredRows(rows);
  const last = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  return attachFreshness({
    price: last.v,
    change: prev ? pointsChange(last.v, prev.v) : null,
    pct: prev ? pctChange(last.v, prev.v) : null,
    asOfUtc: fredDateToUtc(last.date),
  }, kind, { note: note || (kind === 'quarterly' ? quarterLabelFromFredDate(last.date) : null) });
}

function fetchAuPublicDebtCurrent(fred) {
  const rows = fred[FRED_AU_PUBLIC_DEBT_SERIES];
  const quote = quoteFromPercentRows(rows, 'quarterly');
  const ratioDate = latestFredRow(rows)?.date;
  return attachAuDebtLevel(quote, fred, ratioDate);
}

function fetchAuPrivateDebtCurrent(fred) {
  const rows = fred.QAUPAM770A;
  const quote = quoteFromPercentRows(rows, 'quarterly');
  const ratioDate = latestFredRow(rows)?.date;
  return attachAuDebtLevel(quote, fred, ratioDate);
}

function federalDebtBillions(fred) {
  const row = latestFredRow(fred.FGSDODNS);
  return row ? row.v / 1000 : null;
}

function privateDebtBillions(fred) {
  const total = latestFredRow(fred.TCMDO);
  const fed = latestFredRow(fred.FGSDODNS);
  if (!total || fed == null) return null;
  const privateMillions = total.v - fed.v;
  return privateMillions > 0 ? privateMillions / 1000 : null;
}

function valuationUsdExtra(label, billions) {
  const usd = formatUsdCompact(billions);
  if (!usd) return '';
  return `<div class="yield-extra yield-extra--usd"><span class="spread-label">${label}</span>
    <span class="spread-val spread-val--figure buffett-fair">${usd}</span></div>`;
}

function valuationAudExtra(label, billions) {
  const aud = formatAudCompact(billions);
  if (!aud) return '';
  return `<div class="yield-extra yield-extra--usd"><span class="spread-label">${label}</span>
    <span class="spread-val spread-val--figure buffett-fair">${aud}</span></div>`;
}

function latestFredRowOnOrBefore(rows, date) {
  if (!rows?.length) return null;
  const sorted = sortedFredRows(rows);
  if (!date) return sorted[sorted.length - 1];
  let pick = null;
  for (const r of sorted) {
    if (r.date <= date) pick = r;
    else break;
  }
  return pick || sorted[0];
}

function pickAuGdpBillionsForDebt(fred, ratioDate) {
  const rows = fred.NGDPSAXDCAUQ;
  if (!rows?.length) return null;
  const row = latestFredRowOnOrBefore(rows, ratioDate);
  return row ? row.v / 1000 : null;
}

function attachAuDebtLevel(quote, fred, ratioDate) {
  if (!quote || quote.price == null) return quote;
  const gdpBillions = pickAuGdpBillionsForDebt(fred, ratioDate);
  const audBillions = gdpBillions != null ? (quote.price / 100) * gdpBillions : null;
  const gdpRow = latestFredRowOnOrBefore(fred.NGDPSAXDCAUQ, ratioDate);
  return {
    ...quote,
    audBillions,
    debtEstMeta: {
      gdpDate: gdpRow?.date || ratioDate || null,
      ratioDate: ratioDate || null,
    },
  };
}

function valuationReferenceExtra(item, live = null, asOfUtc = null) {
  let html = '';
  const measure = live?.measureLabel || item.sublabel;
  if (measure) {
    html += `<div class="yield-extra"><span class="spread-label">Measure</span>
      <span class="spread-val buffett-fair">${escapeHtml(measure)}</span></div>`;
  }
  if (live?.turnoverLabel) {
    html += `<div class="yield-extra"><span class="spread-label">Metric</span>
      <span class="spread-val">${escapeHtml(live.turnoverLabel)}</span></div>`;
  }
  for (const [label, val] of item.lines || []) {
    html += `<div class="yield-extra"><span class="spread-label">${escapeHtml(label)}</span>
      <span class="spread-val">${escapeHtml(val)}</span></div>`;
  }
  const refUtc = asOfUtc ?? live?.asOfUtc ?? parseReferencePeriodUtc(live?.asOf);
  if (live?.asOf || refUtc) {
    const period = live?.asOf ? `${escapeHtml(live.asOf)} · ` : '';
    const utc = refUtc ? formatUtcAsOf(refUtc) : '';
    html += `<div class="yield-extra"><span class="spread-label">As of</span>
      <span class="spread-val">${period}${utc ? escapeHtml(utc) : ''}</span></div>`;
  }
  if (item.source) {
    const src = item.href
      ? `<a class="val-ref-link" href="${item.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(live?.source || item.source)}</a>`
      : escapeHtml(live?.source || item.source);
    html += `<div class="yield-extra yield-extra--source"><span class="spread-label">Source</span>
      <span class="spread-val">${src}</span></div>`;
  }
  if (!live) {
    html += `<div class="yield-extra"><span class="spread-label">Note</span>
      <span class="spread-val">Benchmark — use Refresh if live fetch did not run</span></div>`;
  }
  return html;
}

function normalizeValuationLiveRow(data) {
  if (!data || data.error) return null;
  return attachFreshness({
    ...data,
    live: true,
    asOfUtc: data.asOfUtc ?? parseReferencePeriodUtc(data.asOf),
  }, 'live', { note: data.source ? String(data.source) : 'Hub valuation' });
}

async function fetchValuationLive(metricId, force = false) {
  const item = VALUATION.find(v => v.id === metricId && v.api);
  if (!item) return null;
  const key = `val-live:${metricId}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    const url = `${location.origin}/economics/proxy/valuation?${new URLSearchParams({ metric: metricId })}`;
    const r = await fetchWithTimeout(url, {}, 90000);
    const data = await readFetchResponse(r, { asJson: true });
    if (data?.error) throw new Error(data.error);
    const result = normalizeValuationLiveRow(data);
    if (result) cacheSet(key, result);
    return result;
  } catch (err) {
    console.warn('valuation live fetch failed', metricId, err);
    return null;
  }
}

/** One hub round-trip for all visible live valuation cards (BIS fetched once server-side). */
async function fetchValuationLiveBatch(metricIds, force = false) {
  const ids = [...new Set(metricIds.filter(id => isValuationLive(id)))];
  if (!ids.length) return;
  const pending = ids.filter(id => force || !cacheGet(`val-live:${id}`));
  if (!pending.length) return;
  try {
    // Literal commas — URLSearchParams encodes them as %2C and nginx rejects the batch.
    const url = `${location.origin}/economics/proxy/valuation?metrics=${pending.map(encodeURIComponent).join(',')}`;
    const r = await fetchWithTimeout(url, {}, 120000);
    const body = await readFetchResponse(r, { asJson: true });
    if (body?.error && !body.metrics) throw new Error(body.error);
    const metrics = body.metrics || body;
    for (const id of pending) {
      const row = normalizeValuationLiveRow(metrics[id]);
      if (row) cacheSet(`val-live:${id}`, row);
    }
  } catch (err) {
    console.warn('valuation live batch failed, falling back per metric', err);
    await Promise.allSettled(pending.map(id => fetchValuationLive(id, force)));
  }
}

function startValuationPrefetch(force = false) {
  const visible = visOf(VALUATION);
  if (!visible.length) return;
  if (force) valuationFredPromise = null;
  void getValuationFredRows(force);
  const liveIds = visible.filter(item => item.api).map(item => item.id);
  if (liveIds.length) void fetchValuationLiveBatch(liveIds, force);
}

function fredRowsToQuote(rows) {
  if (!rows?.length) return null;
  const sorted = sortedFredRows(rows);
  const lastRow = sorted[sorted.length - 1];
  const prevRow = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const last = lastRow.v;
  const prev = prevRow?.v ?? null;
  const change = pointsChange(last, prev);
  const pct = pctChange(last, prev);
  return attachFreshness(
    { price: last, change, pct, asOfUtc: fredDateToUtc(lastRow.date) },
    'quarterly',
    { note: quarterLabelFromFredDate(lastRow.date) },
  );
}

function fetchGdpCurrent(fred) {
  const denom = pickGdpDenominator(fred);
  const official = fredRowsToQuote(fred.GDP);
  if (!denom || denom.source === 'quarterly') return official;
  return attachFreshness({
    price: denom.billions,
    change: official ? pointsChange(denom.billions, official.price) : null,
    pct: official ? pctChange(denom.billions, official.price) : null,
    asOfUtc: fredDateToUtc(denom.date),
    anchorDate: denom.anchorDate,
    freshnessNote: denom.freshnessNote,
  }, 'estimated', { estimated: true });
}

async function fetchFredSeriesRows(seriesId, start) {
  if (canUseHubFredProxy()) {
    try {
      const r = await fetchWithTimeout(localFredProxyUrl(seriesId, start), {}, 60000);
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        const body = await r.text();
        const rows = parseFredResponseBody(body, ct);
        if (rows?.length) return rows;
      } else {
        noteHubHttpStatus(r.status);
      }
    } catch {}
  }
  if (isHubEconomicsPage() && isHubHostname()) return null;
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&observation_start=${start}`;
  const txt = await fetchRemote(url, { asJson: false });
  return txt ? parseFredCsvRows(txt) : null;
}

const VAL_FRED_IDS = ['GDP', FRED_GDP_NOWCAST_SERIES, 'NCBEILQ027S', 'GFDEGDQ188S', 'GFDEBTN', 'TCMDO', 'FGSDODNS', 'NGDPSAXDCAUQ', FRED_AU_PUBLIC_DEBT_SERIES, 'QAUPAM770A'];
const VAL_FRED_MONTHLY_IDS = [FRED_TREASURY_MV_SERIES];
/** Minimum FRED series required before caching or showing valuation ratios. */
const VAL_FRED_REQUIRED_IDS = ['GDP', 'NCBEILQ027S'];
let valuationFredPromise = null;

function fredBatchUsable(data) {
  if (!data || typeof data !== 'object') return false;
  return VAL_FRED_REQUIRED_IDS.every(id => Array.isArray(data[id]) && data[id].length > 0);
}

function clearValuationFredCache(lookbackDays = VAL_FRED_CARD_LOOKBACK_DAYS) {
  const batchKey = lookbackDays === 5 * 365 ? 'val:fred-batch' : `val:fred-batch:${lookbackDays}`;
  try { localStorage.removeItem(`mmd:${batchKey}`); } catch {}
}

function fredStartDate(lookbackDays) {
  return new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
}

function valuationStartDate() {
  return fredStartDate(5 * 365);
}

/** Charts need enough quarters; 7D/30D tabs still slice to recent observations. */
function valuationHistoryLookbackDays(days) {
  return Math.max(days, 5 * 365);
}

function buildFredLookup(rows) {
  const sorted = [...(rows || [])].sort((a, b) => a.date.localeCompare(b.date));
  return date => {
    let val = null;
    for (const r of sorted) {
      if (r.date <= date) val = r.v;
      else break;
    }
    return val;
  };
}

function sliceSeriesForChart(series, days) {
  if (!series?.length) return series;
  const cutoff = Date.now() - days * 86400000;
  const inWindow = series.filter(p => p.t >= cutoff);
  if (inWindow.length >= 2) return inWindow;
  const keep = days <= 1 ? 2 : days <= 7 ? 2 : days <= 30 ? 4 : days <= 180 ? 12 : 24;
  return series.slice(-Math.min(series.length, Math.max(2, keep)));
}

async function fetchValuationFredSeriesStaggered(lookbackDays) {
  const allIds = [...VAL_FRED_IDS, ...VAL_FRED_MONTHLY_IDS];
  const data = {};
  for (const seriesId of allIds) {
    const lookback = VAL_FRED_MONTHLY_IDS.includes(seriesId) || seriesId === FRED_GDP_NOWCAST_SERIES
      ? Math.min(lookbackDays, 500)
      : lookbackDays;
    const seriesStart = fredStartDate(lookback);
    try {
      data[seriesId] = await proxyThrottle(() => fetchFredSeriesRows(seriesId, seriesStart));
    } catch (err) {
      console.warn('FRED series fetch failed', seriesId, err);
      data[seriesId] = null;
    }
    if (canUseHubFredProxy()) await new Promise(r => setTimeout(r, 220));
  }
  return data;
}

async function loadValuationFredRows(force = false, lookbackDays = VAL_FRED_CARD_LOOKBACK_DAYS) {
  const batchKey = lookbackDays === 5 * 365 ? 'val:fred-batch' : `val:fred-batch:${lookbackDays}`;
  if (!force) {
    const cached = cacheGet(batchKey);
    if (fredBatchUsable(cached)) return cached;
    if (cached) clearValuationFredCache(lookbackDays);
  }
  const data = await fetchValuationFredSeriesStaggered(lookbackDays);
  if (fredBatchUsable(data)) cacheSet(batchKey, data);
  else clearValuationFredCache(lookbackDays);
  return data;
}

function getValuationFredRows(force = false) {
  if (force) valuationFredPromise = null;
  if (!valuationFredPromise) {
    valuationFredPromise = (async () => {
      let data = await loadValuationFredRows(force);
      if (!fredBatchUsable(data)) {
        clearValuationFredCache();
        data = await loadValuationFredRows(true);
      }
      return fredBatchUsable(data) ? data : null;
    })().catch(err => {
      console.warn('valuation FRED batch failed', err);
      valuationFredPromise = null;
      return null;
    });
  }
  return valuationFredPromise;
}

function buildBuffettRatios(capRows, gdpRows) {
  if (!capRows?.length || !gdpRows?.length) return null;
  const gdpAt = buildFredLookup(gdpRows);
  const ratios = [];
  for (const row of capRows) {
    const gdp = gdpAt(row.date);
    if (gdp == null || gdp <= 0) continue;
    ratios.push({
      date: row.date,
      t: new Date(row.date).getTime(),
      ratio: buffettRatio(row.v, gdp),
    });
  }
  return ratios.length ? ratios : null;
}

function buildPrivateDebtRatios(totalRows, fedRows, gdpRows) {
  if (!totalRows?.length || !fedRows?.length || !gdpRows?.length) return null;
  const fedAt = buildFredLookup(fedRows);
  const gdpAt = buildFredLookup(gdpRows);
  const ratios = [];
  for (const row of totalRows) {
    const fed = fedAt(row.date);
    const gdp = gdpAt(row.date);
    if (fed == null || gdp == null || gdp <= 0) continue;
    const privateMillions = row.v - fed;
    if (privateMillions <= 0) continue;
    ratios.push({
      date: row.date,
      t: new Date(row.date).getTime(),
      ratio: (privateMillions / 1000 / gdp) * 100,
    });
  }
  return ratios.length ? ratios : null;
}

function quoteFromRatioSeries(ratios) {
  if (!ratios?.length) return null;
  const lastRow = ratios[ratios.length - 1];
  const prevRow = ratios.length > 1 ? ratios[ratios.length - 2] : null;
  const last = lastRow.ratio;
  const prev = prevRow?.ratio ?? null;
  const change = pointsChange(last, prev);
  const pct = pctChange(last, prev);
  const asOfUtc = lastRow.t ?? fredDateToUtc(lastRow.date);
  return attachFreshness(
    { price: last, change, pct, asOfUtc },
    'quarterly',
    { note: quarterLabelFromFredDate(lastRow.date) },
  );
}

async function fetchValuation(metricId, force = false) {
  if (isValuationLive(metricId)) {
    const live = await fetchValuationLive(metricId, force);
    if (live) return live;
    const item = VALUATION.find(v => v.id === metricId);
    return item
      ? attachFreshness(
        { display: item.fallbackDisplay, static: true, fallback: true },
        'reference',
        { note: 'Benchmark — live fetch unavailable' },
      )
      : null;
  }

  const key = `val:${metricId}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    const fred = await getValuationFredRows(force);
    if (!fred) return null;
    let result = null;
    if (metricId === 'buffett') {
      result = await fetchBuffettCurrent(fred, force);
    } else if (metricId === 'us-gdp') {
      result = fetchGdpCurrent(fred);
    } else if (metricId === 'public-debt') {
      result = fetchPublicDebtCurrent(fred);
    } else if (metricId === 'private-debt') {
      result = fetchPrivateDebtCurrent(fred);
    } else if (metricId === 'au-gdp') {
      result = fetchAuGdpCurrent(fred);
    } else if (metricId === 'au-public-debt') {
      result = fetchAuPublicDebtCurrent(fred);
    } else if (metricId === 'au-private-debt') {
      result = fetchAuPrivateDebtCurrent(fred);
    }
    if (result) cacheSet(key, result);
    return result;
  } catch {
    return null;
  }
}

async function fetchBond(series_id, force = false) {
  const bondDef = BOND_SERIES.find(b => b.id === series_id);
  const key = `b:${series_id}`;
  if (bondDef?.yTicker) {
    if (!force) { const c = cacheGet(key); if (c) return c; }
    try {
      let result = null;
      if (activeProvider === 'yahoo') result = await yahooChart(bondDef.yTicker);
      else if (activeProvider === 'google') result = await googleFinanceQuote(bondDef.yTicker);
      else result = await avQuote(bondDef.yTicker);
      result = result ? normalizeCBOEYieldQuote(bondDef.yTicker, result) : null;
      if (result) cacheSet(key, result);
      return result;
    } catch { return null; }
  }

  if (!force) { const c = cacheGet(key); if (c) return c; }
  const start = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const fredUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series_id}&observation_start=${start}`;

  function parseCsvText(txt) {
    const lines = txt.trim().split('\n').filter(l => !l.startsWith('observation_date') && !l.endsWith(','));
    if (lines.length < 2) return null;
    const lastParts = lines[lines.length - 1].split(',');
    const prevParts = lines[lines.length - 2].split(',');
    const last = parseFloat(lastParts[1]);
    const prev = parseFloat(prevParts[1]);
    if (isNaN(last)) return null;
    const change = !isNaN(prev) ? pointsChange(last, prev) : null;
    const pct = !isNaN(prev) ? pctChange(last, prev) : null;
    return attachFreshness(
      { price: last, change, pct, asOfUtc: fredDateToUtc(lastParts[0]) },
      'daily',
    );
  }

  try {
    const txt = await fetchRemote(fredUrl, { asJson: false });
    const result = txt ? parseCsvText(txt) : null;
    if (result) cacheSet(key, result);
    return result;
  } catch {
    return null;
  }
}

// ── Render Grids ──────────────────────────────────
const SECTION_LOAD_LABELS = {
  eq: 'Loading quotes…',
  val: 'Loading FRED & live metrics…',
  comm: 'Loading commodities…',
  bond: 'Loading yields…',
  fx: 'Loading FX rates…',
  crypto: 'Loading crypto…',
};

function skeletonCardsMarkup(count) {
  return Array.from({ length: count }, (_, i) => `
      <div class="card card--skeleton neu" style="animation-delay:${i * 0.05}s" aria-hidden="true">
        <div class="skeleton sk-ticker"></div>
        <div class="skeleton sk-name"></div>
        <div class="skeleton sk-price"></div>
        <div class="skeleton sk-change"></div>
      </div>`).join('');
}

function isPageLoading() {
  return Boolean(document.querySelector('.section--loading'));
}

function beginPageLoad(message = 'Retrieving data…') {
  document.getElementById('refresh-btn')?.classList.add('spinning');
  const status = document.getElementById('status-line');
  if (status) {
    status.className = 'status-line loading';
    status.textContent = message;
  }
  if (isPageLoading()) return;
  for (const section of SECTIONS) {
    if (visOf(section.items).length) setSectionLoading(section, true);
  }
}

function setSectionLoading(section, loading) {
  const grid = document.getElementById(section.gridId);
  const el = grid?.closest('.section');
  if (!grid || !el) return;

  const header = el.querySelector('.section-header');
  let status = el.querySelector('.section-load-status');
  if (!status && header) {
    status = document.createElement('span');
    status.className = 'section-load-status';
    const editBtn = header.querySelector('.section-edit-btn');
    header.insertBefore(status, editBtn || null);
  }

  if (loading) {
    const visible = visOf(section.items);
    if (!visible.length) return;
    el.classList.add('section--loading');
    if (status) {
      status.textContent = SECTION_LOAD_LABELS[section.key] || 'Loading…';
      status.hidden = false;
    }
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = skeletonCardsMarkup(visible.length);
  } else {
    el.classList.remove('section--loading');
    if (status) status.hidden = true;
    grid.removeAttribute('aria-busy');
  }
}

function renderGrid(id, items) {
  document.getElementById(id).innerHTML = items.map((d, i) => renderCard(d, i * 0.06)).join('');
}

function collectCardMetas(section, items) {
  if (!items.length) return [];

  if (section.key === 'val') {
    return items.map(item => {
      const d = DATA[item.id];
      let price = null;
      let extra = '';
      let isRatio = false;
      let isUsd = false;

      if (item.api) {
        const d = DATA[item.id];
        const display = d?.display || item.fallbackDisplay || '–';
        let change = d?.change ?? null;
        let isUsd = false;
        let isAud = false;
        if (item.id === 'margin-debt' && change != null) {
          isUsd = true;
          change = change / 1000;
        } else if (item.id === 'au-cgs' && change != null) {
          isAud = true;
        }
        const asOfUtc = d?.asOfUtc ?? parseReferencePeriodUtc(d?.asOf);
        return {
          ticker: item.ticker,
          label: item.label,
          price: display,
          change,
          pct: d?.pct ?? null,
          isUsd,
          isAud,
          asOfUtc,
          freshnessKind: d?.freshnessKind ?? (d?.live ? 'live' : d?.fallback ? 'reference' : 'daily'),
          freshnessNote: d?.freshnessNote ?? null,
          live: d?.live,
          fallback: d?.fallback,
          extra: valuationReferenceExtra(item, d?.live ? d : null, asOfUtc),
          itemKey: item.id,
          sectionKey: section.key,
          failed: false,
          noChart: true,
          cardClassExtra: 'card--reference',
          showCardAsOf: Boolean(asOfUtc),
        };
      }

      if (item.id === 'us-gdp') {
        isUsd = true;
        price = formatUsdCompact(d?.price);
        extra = `<div class="yield-extra"><span class="spread-label">Series</span>
          <span class="spread-val buffett-fair">Nominal GDP (FRED)</span></div>`;
      } else if (item.id === 'au-gdp') {
        isAud = true;
        price = formatAudCompact(d?.price);
        extra = `<div class="yield-extra"><span class="spread-label">Series</span>
          <span class="spread-val buffett-fair">Nominal GDP (FRED)</span></div>`;
      } else if (item.id === 'buffett') {
        isRatio = true;
        price = formatRatioPrice(d, 0);
        const zone = buffettZone(d?.price);
        if (zone) {
          extra = `<div class="yield-extra"><span class="spread-label">Zone</span>
            <span class="spread-val ${zone.cls}">${zone.label}</span></div>`;
        }
        extra += buffettExtraHtml(d);
      } else if (item.id === 'public-debt' || item.id === 'private-debt') {
        isRatio = true;
        price = formatRatioPrice(d, 1);
        extra = valuationUsdExtra('Est. (USD)', d?.usdBillions);
        extra += debtRatioExtraHtml(d);
        extra += `<div class="yield-extra"><span class="spread-label">Measure</span>
          <span class="spread-val buffett-fair">% of GDP (est.)</span></div>`;
      } else if (item.id === 'au-public-debt' || item.id === 'au-private-debt') {
        isRatio = true;
        price = formatRatioPrice(d, 1);
        extra = valuationAudExtra('Est. (AUD)', d?.audBillions);
        extra += debtRatioExtraHtml(d);
        extra += `<div class="yield-extra"><span class="spread-label">Measure</span>
          <span class="spread-val buffett-fair">% of GDP (est.)</span></div>`;
      } else {
        isRatio = true;
        price = formatRatioPrice(d, 1);
        extra = valuationUsdExtra('Est. (USD)', d?.usdBillions);
        extra += `<div class="yield-extra"><span class="spread-label">Measure</span>
          <span class="spread-val buffett-fair">% of GDP</span></div>`;
      }

      return withGoogleUrl({
        ticker: item.ticker,
        label: item.label,
        price,
        change: d ? d.change : null,
        pct: d ? d.pct : null,
        extra,
        isRatio,
        isUsd,
        asOfUtc: d?.asOfUtc ?? null,
        freshnessKind: d?.freshnessKind,
        freshnessNote: d?.freshnessNote,
        anchorDate: d?.anchorDate,
        estimated: d?.estimated,
        buffettMeta: d?.buffettMeta,
        debtEstMeta: d?.debtEstMeta,
        live: d?.live,
        fallback: d?.fallback,
        itemKey: item.id,
        sectionKey: section.key,
        failed: !d || !price,
      }, item, section.key);
    });
  }

  if (section.key === 'bond') {
    const spreadFred = computeBondSpreadFred(BOND_SPREAD_FRED);
    const b2  = spreadFred?.spread != null ? null : (DATA['DGS2'] ? DATA['DGS2'].price : null);
    const b10 = spreadFred?.spread != null ? null : (DATA['^TNX'] ? DATA['^TNX'].price : null);
    return items.map(item => {
      const d = DATA[item.id];
      let extra = '';
      if (item.id === '^TNX') {
        if (spreadFred) extra = spread2s10sExtraHtml(spreadFred);
        else if (b2 !== null && b10 !== null) {
          const spread = (b10 - b2).toFixed(2);
          const cls = spread >= 0 ? 'spread-pos' : 'spread-neg';
          extra = `<div class="yield-extra"><span class="spread-label">2s10s spread</span>
            <span class="spread-val ${cls}">${spread >= 0 ? '+' : ''}${spread} pp</span>
            <span class="spread-val spread-val--muted">mixed sources</span></div>`;
        }
      }
      return withGoogleUrl({ ticker: item.ticker, label: item.label,
        price: formatYieldPrice(d),
        change: d ? d.change : null, pct: d ? d.pct : null, extra,
        isYield: true,
        asOfUtc: d?.asOfUtc ?? null,
        freshnessKind: d?.freshnessKind,
        freshnessNote: d?.freshnessNote,
        itemKey: item.id, sectionKey: section.key, failed: !d || !formatYieldPrice(d) }, item, section.key);
    });
  }

  return items.map(item => {
    const k = getItemKey(item);
    const d = DATA[k];
    const card = section.card(item, d);
    const sessionAware = (section.key === 'eq' || section.key === 'comm')
      ? applySessionAwareQuoteMeta(item, section.key, {
        ...card,
        itemKey: k,
        sectionKey: section.key,
        asOfUtc: d?.asOfUtc ?? card.asOfUtc,
        freshnessKind: d?.freshnessKind ?? card.freshnessKind
          ?? (section.key === 'fx' ? 'daily' : undefined),
        freshnessNote: d?.freshnessNote ?? card.freshnessNote,
      })
      : card;
    return withGoogleUrl({
      ...sessionAware,
      itemKey: k,
      sectionKey: section.key,
      failed: !d,
      asOfUtc: d?.asOfUtc ?? card.asOfUtc,
      freshnessKind: sessionAware.freshnessKind ?? d?.freshnessKind ?? card.freshnessKind
        ?? (section.key === 'fx' ? 'daily' : undefined),
      freshnessNote: sessionAware.freshnessNote ?? d?.freshnessNote ?? card.freshnessNote,
      anchorDate: d?.anchorDate ?? card.anchorDate,
      estimated: d?.estimated ?? card.estimated,
      buffettMeta: d?.buffettMeta,
      debtEstMeta: d?.debtEstMeta,
      live: d?.live,
      sessionOpen: sessionAware.sessionOpen,
      pillLabel: sessionAware.pillLabel,
    }, item, section.key);
  });
}

function renderSectionGrid(section) {
  const visible = visOf(section.items);
  renderGrid(section.gridId, collectCardMetas(section, visible));
}

function renderGlanceGrid() {
  const grid = document.getElementById('glance-grid');
  if (!grid) return;
  const metas = [];
  for (const ref of getOverviewRefs()) {
    const resolved = resolveOverviewRef(ref);
    if (!resolved) continue;
    metas.push(...collectCardMetas(resolved.section, [resolved.item]));
  }
  if (!metas.length) {
    grid.innerHTML = '<p class="glance-empty">Tap Edit to choose instruments for At a Glance (up to 12).</p>';
    return;
  }
  renderGrid('glance-grid', metas);
}

async function loadOverviewItems(force = false) {
  const refs = getOverviewRefs();
  if (!refs.length) {
    renderGlanceGrid();
    return;
  }
  for (const ref of refs) {
    const resolved = resolveOverviewRef(ref);
    if (!resolved) continue;
    const { item, section } = resolved;
    const key = getItemKey(item);
    if (!force) {
      const ck = cacheKeyForItem(item, section);
      const cached = cacheGet(ck) || cacheGetStale(ck);
      if (cached) {
        DATA[key] = cached;
        continue;
      }
    }
  }
  await Promise.allSettled(refs.map(async ref => {
    const resolved = resolveOverviewRef(ref);
    if (!resolved) return;
    const { item, section } = resolved;
    const key = getItemKey(item);
    try {
      const data = await section.fetch(item, force);
      if (data) DATA[key] = data;
      else delete DATA[key];
    } catch (err) {
      console.warn('overview fetch failed', ref.sectionKey, ref.itemKey, err);
      delete DATA[key];
    }
  }));
  renderGlanceGrid();
}

async function refreshCard(itemKey, sectionKey) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  if (!section) return;
  const item = section.items.find(i => getItemKey(i) === itemKey);
  if (!item) return;

  const gate = checkCardRefreshThrottle(itemKey);
  if (!gate.ok) {
    const status = document.getElementById('status-line');
    if (status) {
      status.className = 'status-line warn';
      status.textContent = `⚠ ${gate.message}`;
    }
    return;
  }
  recordCardRefreshThrottle(itemKey);

  CARD_LOADING.add(itemKey);
  renderSectionGrid(section);

  const result = await section.fetch(item, true);
  if (result) DATA[itemKey] = result;
  else delete DATA[itemKey];

  CARD_LOADING.delete(itemKey);
  renderSectionGrid(section);
  if (isOverviewRef({ sectionKey, itemKey })) renderGlanceGrid();
}

// ── Customize Rows ────────────────────────────────
const addStockState = {
  query: '',
  results: [],
  selected: null,
  preview: null,
  loading: false,
  focusIdx: -1,
};
const addCommodityState = {
  query: '',
  results: [],
  selected: null,
  preview: null,
  loading: false,
  focusIdx: -1,
};

function filterStockCatalog(query) {
  const q = query.trim().toLowerCase();
  if (!q) return STOCK_CATALOG.filter(e => !equitySymbolSet().has(e.sym)).slice(0, 24);
  return STOCK_CATALOG.filter(e => {
    if (equitySymbolSet().has(e.sym)) return false;
    return e.sym.toLowerCase().includes(q)
      || e.label.toLowerCase().includes(q)
      || (e.ticker && e.ticker.toLowerCase().includes(q));
  }).slice(0, 24);
}

async function yahooStockSearch(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`;
  try {
    const data = await fetchRemote(url, { asJson: true });
    const quotes = data?.quotes || [];
    const seen = equitySymbolSet();
    return quotes
      .filter(x => x.symbol && ['EQUITY', 'ETF', 'MUTUALFUND'].includes(x.quoteType))
      .filter(x => !seen.has(x.symbol))
      .map(x => ({
        sym: x.symbol,
        label: x.shortname || x.longname || x.symbol,
        ticker: x.symbol.replace(/\.AX$/, '').split('-')[0],
        exchange: formatYahooExchange({ exchangeName: x.exchange, fullExchangeName: x.exchDisp })
          || inferExchangeFromSym(x.symbol),
      }))
      .slice(0, 12);
  } catch {
    return [];
  }
}

async function searchAccessibleStocks(query) {
  const local = filterStockCatalog(query);
  if (query.trim().length < 2) return local;
  const remote = await yahooStockSearch(query);
  const seen = new Set(local.map(e => e.sym));
  for (const r of remote) {
    if (!seen.has(r.sym)) {
      local.push(r);
      seen.add(r.sym);
    }
  }
  return local.slice(0, 20);
}

function formatPreviewQuote(d) {
  if (!d || d.price == null) return 'Quote unavailable';
  const price = fmt(d.price, 2);
  let pct = '';
  if (d.pct != null) {
    const dp = displayDecimalsForDelta(d.pct, 2, 3);
    pct = isDisplayFlat(d.pct, dp)
      ? '0.00%'
      : `${d.pct > 0 ? '+' : '-'}${Math.abs(d.pct).toFixed(dp)}%`;
  }
  return `${price}${pct ? ` · ${pct}` : ''}`;
}

async function loadAddStockPreview(entry) {
  addStockState.selected = entry;
  addStockState.preview = null;
  addStockState.loading = true;
  renderAddStockPanel();
  const d = await fetchQuote(entry.sym, false);
  addStockState.preview = d;
  addStockState.loading = false;
  renderAddStockPanel();
}

function resetAddStockPanel() {
  addStockState.query = '';
  addStockState.results = [];
  addStockState.selected = null;
  addStockState.preview = null;
  addStockState.loading = false;
  addStockState.focusIdx = -1;
}

function filterCommodityCatalog(query) {
  const q = query.trim().toLowerCase();
  if (!q) return COMMODITY_CATALOG.filter(e => !commoditySymbolSet().has(e.id)).slice(0, 24);
  return COMMODITY_CATALOG.filter(e => {
    if (commoditySymbolSet().has(e.id)) return false;
    return e.id.toLowerCase().includes(q)
      || e.label.toLowerCase().includes(q)
      || e.fredId.toLowerCase().includes(q)
      || (e.ticker && e.ticker.toLowerCase().includes(q));
  }).slice(0, 24);
}

function resetAddCommodityPanel() {
  addCommodityState.query = '';
  addCommodityState.results = [];
  addCommodityState.selected = null;
  addCommodityState.preview = null;
  addCommodityState.loading = false;
  addCommodityState.focusIdx = -1;
}

async function addSelectedStockToWatchlist() {
  const entry = addStockState.selected;
  if (!entry) return;
  if (equitySymbolSet().has(entry.sym)) {
    VIS[entry.sym] = true;
    saveVIS();
    const section = SECTIONS.find(s => s.key === 'eq');
    if (section && !DATA[entry.sym]) DATA[entry.sym] = await section.fetch({ sym: entry.sym }, false);
    renderSectionGrid(section);
    renderCust(section);
    resetAddStockPanel();
    renderAddStockPanel();
    return;
  }
  const item = catalogEntryToEquity(entry);
  CUSTOM_EQUITIES.push(item);
  saveCustomEquities();
  syncEquitiesSection();
  VIS[item.sym] = true;
  saveVIS();
  const section = SECTIONS.find(s => s.key === 'eq');
  const data = await section.fetch(item, false);
  if (data) DATA[item.sym] = data;
  renderSectionGrid(section);
  renderCust(section);
  resetAddStockPanel();
  renderAddStockPanel();
}

async function loadAddCommodityPreview(entry) {
  addCommodityState.selected = entry;
  addCommodityState.preview = null;
  addCommodityState.loading = true;
  renderAddCommodityPanel();
  const d = await fetchCommodity(entry, false);
  addCommodityState.preview = d;
  addCommodityState.loading = false;
  renderAddCommodityPanel();
}

async function addSelectedCommodityToWatchlist() {
  const entry = addCommodityState.selected;
  if (!entry) return;
  const key = entry.id;
  if (commoditySymbolSet().has(key)) {
    VIS[key] = true;
    saveVIS();
    const section = SECTIONS.find(s => s.key === 'comm');
    if (section && !DATA[key]) DATA[key] = await section.fetch(entry, false);
    renderSectionGrid(section);
    renderCust(section);
    resetAddCommodityPanel();
    renderAddCommodityPanel();
    return;
  }
  const item = {
    id: entry.id,
    fredId: entry.fredId,
    label: entry.label,
    ticker: entry.ticker || entry.id,
    unit: entry.unit || null,
    def: true,
    dp: 2,
    custom: true,
  };
  CUSTOM_COMMODITIES.push(item);
  saveCustomCommodities();
  syncCommoditiesSection();
  VIS[item.id] = true;
  saveVIS();
  const section = SECTIONS.find(s => s.key === 'comm');
  const data = await section.fetch(item, false);
  if (data) DATA[item.id] = data;
  renderSectionGrid(section);
  renderCust(section);
  resetAddCommodityPanel();
  renderAddCommodityPanel();
}

function renderAddStockPanel() {
  const row = document.getElementById('cust-eq');
  if (!row || row.style.display === 'none') return;

  const inputEl = document.getElementById('add-stock-input');
  const hadFocus = document.activeElement === inputEl;
  const caret = inputEl?.selectionStart ?? null;

  let panel = document.getElementById('add-stock-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'add-stock-panel';
    panel.className = 'add-stock-wrap';
    row.appendChild(panel);
  }

  const listOpen = !addStockState.selected && addStockState.results.length > 0;
  const results = addStockState.results;
  const sel = addStockState.selected;
  const previewCls = addStockState.preview?.pct != null
    ? cardClass(addStockState.preview.pct, addStockState.preview.change)
    : '';

  panel.innerHTML = `
    <span class="add-stock-label">Add stock to watch</span>
    <p class="add-stock-hint">Pick from the list or type a symbol — preview loads before you add the card.</p>
    <div class="add-stock-search-row">
      <input type="search" class="add-stock-input" id="add-stock-input"
        placeholder="Search symbol or company…" autocomplete="off"
        value="${escapeHtml(addStockState.query)}" aria-expanded="${listOpen}" aria-controls="add-stock-list">
      <div class="add-stock-list${listOpen && results.length ? ' open' : ''}" id="add-stock-list" role="listbox">
        ${results.map((e, i) => `
          <button type="button" class="add-stock-option${i === addStockState.focusIdx ? ' focused' : ''}"
            role="option" data-stock-idx="${i}">
            <span class="add-stock-option-ticker">${escapeHtml(e.ticker || e.sym)}${
              e.exchange || inferExchangeFromSym(e.sym)
                ? ` <span class="add-stock-option-venue">${escapeHtml(e.exchange || inferExchangeFromSym(e.sym))}</span>`
                : ''
            }</span>
            <span class="add-stock-option-name">${escapeHtml(e.label)}</span>
          </button>`).join('')}
        ${listOpen && !results.length && addStockState.query.length >= 2 && !addStockState.loading
          ? '<div class="add-stock-hint" style="padding:8px 10px">No matches — try another symbol.</div>' : ''}
      </div>
    </div>
    <div class="add-stock-preview${sel ? ' open' : ''}" id="add-stock-preview">
      ${sel ? `
        <div class="add-stock-preview-meta">
          <div class="add-stock-preview-ticker">${escapeHtml(sel.ticker || sel.sym)}</div>
          ${(sel.exchange || inferExchangeFromSym(sel.sym))
    ? `<div class="add-stock-preview-venue">${escapeHtml(sel.exchange || inferExchangeFromSym(sel.sym))}</div>`
    : ''}
          <div class="add-stock-preview-name">${escapeHtml(sel.label)}</div>
          <div class="add-stock-preview-quote ${previewCls}">${
            addStockState.loading ? 'Loading quote…' : escapeHtml(formatPreviewQuote(addStockState.preview))
          }</div>
        </div>
        <div class="add-stock-actions">
          <button type="button" class="add-stock-btn" data-add-stock-cancel>Cancel</button>
          <button type="button" class="add-stock-btn add-stock-btn-primary" data-add-stock-confirm
            ${addStockState.loading ? 'disabled' : ''}>Add card</button>
        </div>
      ` : ''}
    </div>`;

  if (hadFocus) {
    const next = document.getElementById('add-stock-input');
    next?.focus();
    if (caret != null && next) next.setSelectionRange(caret, caret);
  }
}

function renderAddCommodityPanel() {
  const row = document.getElementById('cust-comm');
  if (!row || row.style.display === 'none') return;
  const inputEl = document.getElementById('add-commodity-input');
  const hadFocus = document.activeElement === inputEl;
  const caret = inputEl?.selectionStart ?? null;
  let panel = document.getElementById('add-commodity-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'add-commodity-panel';
    panel.className = 'add-stock-wrap';
    row.appendChild(panel);
  }
  const listOpen = !addCommodityState.selected && addCommodityState.results.length > 0;
  const results = addCommodityState.results;
  const sel = addCommodityState.selected;
  const previewCls = addCommodityState.preview?.pct != null
    ? cardClass(addCommodityState.preview.pct, addCommodityState.preview.change)
    : '';
  panel.innerHTML = `
    <span class="add-stock-label">Add commodity to watch</span>
    <p class="add-stock-hint">Pick from supported spot/reference commodity series and preview before adding.</p>
    <div class="add-stock-search-row">
      <input type="search" class="add-stock-input" id="add-commodity-input"
        placeholder="Search symbol or commodity…" autocomplete="off"
        value="${escapeHtml(addCommodityState.query)}" aria-expanded="${listOpen}" aria-controls="add-commodity-list">
      <div class="add-stock-list${listOpen && results.length ? ' open' : ''}" id="add-commodity-list" role="listbox">
        ${results.map((e, i) => `
          <button type="button" class="add-stock-option${i === addCommodityState.focusIdx ? ' focused' : ''}"
            role="option" data-commodity-idx="${i}">
            <span class="add-stock-option-ticker">${escapeHtml(e.ticker || e.sym)}</span>
            <span class="add-stock-option-name">${escapeHtml(e.label)}</span>
          </button>`).join('')}
        ${listOpen && !results.length && addCommodityState.query.length >= 1 && !addCommodityState.loading
    ? '<div class="add-stock-hint" style="padding:8px 10px">No matches — try another commodity.</div>' : ''}
      </div>
    </div>
    <div class="add-stock-preview${sel ? ' open' : ''}" id="add-commodity-preview">
      ${sel ? `
        <div class="add-stock-preview-meta">
          <div class="add-stock-preview-ticker">${escapeHtml(sel.ticker || sel.sym)}</div>
          <div class="add-stock-preview-name">${escapeHtml(sel.label)}</div>
          <div class="add-stock-preview-quote ${previewCls}">${
    addCommodityState.loading ? 'Loading quote…' : escapeHtml(formatPreviewQuote(addCommodityState.preview))
  }</div>
        </div>
        <div class="add-stock-actions">
          <button type="button" class="add-stock-btn" data-add-commodity-cancel>Cancel</button>
          <button type="button" class="add-stock-btn add-stock-btn-primary" data-add-commodity-confirm
            ${addCommodityState.loading ? 'disabled' : ''}>Add card</button>
        </div>
      ` : ''}
    </div>`;
  if (hadFocus) {
    const next = document.getElementById('add-commodity-input');
    next?.focus();
    if (caret != null && next) next.setSelectionRange(caret, caret);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

let addStockSearchTimer = null;
function scheduleStockSearch(query) {
  clearTimeout(addStockSearchTimer);
  addStockSearchTimer = setTimeout(async () => {
    addStockState.loading = true;
    addStockState.results = await searchAccessibleStocks(query);
    addStockState.loading = false;
    addStockState.focusIdx = addStockState.results.length ? 0 : -1;
    renderAddStockPanel();
  }, query.trim().length >= 2 ? 280 : 0);
}

function wireAddStockPanel() {
  document.addEventListener('focusin', e => {
    if (e.target.id !== 'add-stock-input') return;
    if (!addStockState.query.trim() && !addStockState.results.length) {
      addStockState.results = filterStockCatalog('');
      renderAddStockPanel();
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'add-stock-input') return;
    addStockState.query = e.target.value;
    addStockState.selected = null;
    addStockState.preview = null;
    if (!addStockState.query.trim()) {
      addStockState.results = [];
      renderAddStockPanel();
      return;
    }
    scheduleStockSearch(addStockState.query);
    renderAddStockPanel();
  });

  document.addEventListener('keydown', e => {
    if (e.target.id !== 'add-stock-input') return;
    const list = document.getElementById('add-stock-list');
    if (!list?.classList.contains('open') || !addStockState.results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      addStockState.focusIdx = Math.min(addStockState.focusIdx + 1, addStockState.results.length - 1);
      renderAddStockPanel();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      addStockState.focusIdx = Math.max(addStockState.focusIdx - 1, 0);
      renderAddStockPanel();
    } else if (e.key === 'Enter' && addStockState.focusIdx >= 0) {
      e.preventDefault();
      loadAddStockPreview(addStockState.results[addStockState.focusIdx]);
    } else if (e.key === 'Escape') {
      if (addStockState.selected) {
        addStockState.selected = null;
        addStockState.preview = null;
        renderAddStockPanel();
      } else {
        addStockState.query = '';
        addStockState.results = [];
        renderAddStockPanel();
      }
    }
  });

  document.addEventListener('click', e => {
    const opt = e.target.closest('[data-stock-idx]');
    if (opt) {
      const idx = Number(opt.dataset.stockIdx);
      const entry = addStockState.results[idx];
      if (entry) loadAddStockPreview(entry);
      return;
    }
    if (e.target.closest('[data-add-stock-confirm]')) {
      addSelectedStockToWatchlist();
      return;
    }
    if (e.target.closest('[data-add-stock-cancel]')) {
      addStockState.selected = null;
      addStockState.preview = null;
      renderAddStockPanel();
      return;
    }
    const panel = document.getElementById('add-stock-panel');
    if (panel && !panel.contains(e.target) && e.target.id !== 'add-stock-input') {
      const list = document.getElementById('add-stock-list');
      if (list?.classList.contains('open') && !addStockState.selected) {
        addStockState.results = [];
        renderAddStockPanel();
      }
    }
  });
}

let addCommoditySearchTimer = null;
function scheduleCommoditySearch(query) {
  clearTimeout(addCommoditySearchTimer);
  addCommoditySearchTimer = setTimeout(() => {
    addCommodityState.loading = true;
    addCommodityState.results = filterCommodityCatalog(query);
    addCommodityState.loading = false;
    addCommodityState.focusIdx = addCommodityState.results.length ? 0 : -1;
    renderAddCommodityPanel();
  }, 0);
}

function wireAddCommodityPanel() {
  document.addEventListener('focusin', e => {
    if (e.target.id !== 'add-commodity-input') return;
    if (!addCommodityState.query.trim() && !addCommodityState.results.length) {
      addCommodityState.results = filterCommodityCatalog('');
      renderAddCommodityPanel();
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'add-commodity-input') return;
    addCommodityState.query = e.target.value;
    addCommodityState.selected = null;
    addCommodityState.preview = null;
    scheduleCommoditySearch(addCommodityState.query);
    renderAddCommodityPanel();
  });
  document.addEventListener('keydown', e => {
    if (e.target.id !== 'add-commodity-input') return;
    const list = document.getElementById('add-commodity-list');
    if (!list?.classList.contains('open') || !addCommodityState.results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      addCommodityState.focusIdx = Math.min(addCommodityState.focusIdx + 1, addCommodityState.results.length - 1);
      renderAddCommodityPanel();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      addCommodityState.focusIdx = Math.max(addCommodityState.focusIdx - 1, 0);
      renderAddCommodityPanel();
    } else if (e.key === 'Enter' && addCommodityState.focusIdx >= 0) {
      e.preventDefault();
      loadAddCommodityPreview(addCommodityState.results[addCommodityState.focusIdx]);
    } else if (e.key === 'Escape') {
      if (addCommodityState.selected) {
        addCommodityState.selected = null;
        addCommodityState.preview = null;
      } else {
        addCommodityState.query = '';
        addCommodityState.results = [];
      }
      renderAddCommodityPanel();
    }
  });
  document.addEventListener('click', e => {
    const opt = e.target.closest('[data-commodity-idx]');
    if (opt) {
      const idx = Number(opt.dataset.commodityIdx);
      const entry = addCommodityState.results[idx];
      if (entry) loadAddCommodityPreview(entry);
      return;
    }
    if (e.target.closest('[data-add-commodity-confirm]')) {
      addSelectedCommodityToWatchlist();
      return;
    }
    if (e.target.closest('[data-add-commodity-cancel]')) {
      addCommodityState.selected = null;
      addCommodityState.preview = null;
      renderAddCommodityPanel();
      return;
    }
    const panel = document.getElementById('add-commodity-panel');
    if (panel && !panel.contains(e.target) && e.target.id !== 'add-commodity-input') {
      const list = document.getElementById('add-commodity-list');
      if (list?.classList.contains('open') && !addCommodityState.selected) {
        addCommodityState.results = [];
        renderAddCommodityPanel();
      }
    }
  });
}

function renderCust(section) {
  const el = document.getElementById(section.custId);
  if (!el) return;
  el.innerHTML = section.items.map((item, idx) => {
    const k = getItemKey(item);
    const on = isOn(item);
    const lbl = item.ticker || `${item.from}/${item.to}`;
    return `<div class="sym-pill-row">
      <button type="button" class="sym-pill ${on ? 'on' : 'off'}" data-sym-key="${k}" data-section-key="${section.key}">${lbl}</button>
      <button type="button" class="sym-move-btn" title="Move left" aria-label="Move ${escapeHtml(lbl)} left"
        data-move-key="${k}" data-section-key="${section.key}" data-move-dir="-1"${idx === 0 ? ' disabled' : ''}>←</button>
      <button type="button" class="sym-move-btn" title="Move right" aria-label="Move ${escapeHtml(lbl)} right"
        data-move-key="${k}" data-section-key="${section.key}" data-move-dir="1"${idx === section.items.length - 1 ? ' disabled' : ''}>→</button>
    </div>`;
  }).join('');
  if (section.key === 'eq' && el.style.display !== 'none') renderAddStockPanel();
  else document.getElementById('add-stock-panel')?.remove();
  if (section.key === 'comm' && el.style.display !== 'none') renderAddCommodityPanel();
  else document.getElementById('add-commodity-panel')?.remove();
}

function toggleCustomize(sectionKey) {
  if (sectionKey === 'glance') {
    const row = document.getElementById('cust-glance');
    const btn = document.getElementById('edit-glance');
    if (!row) return;
    const isOpen = row.style.display !== 'none';
    row.style.display = isOpen ? 'none' : 'flex';
    btn?.classList.toggle('open', !isOpen);
    if (!isOpen) renderCustGlance();
    return;
  }
  const section = SECTIONS.find(s => s.key === sectionKey);
  if (!section) return;
  const row = document.getElementById(section.custId);
  const btn = document.getElementById(`edit-${sectionKey}`);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : 'flex';
  btn?.classList.toggle('open', !isOpen);
  if (sectionKey === 'eq') {
    if (isOpen) {
      resetAddStockPanel();
      document.getElementById('add-stock-panel')?.remove();
    } else {
      renderAddStockPanel();
    }
  }
  if (sectionKey === 'comm') {
    if (isOpen) {
      resetAddCommodityPanel();
      document.getElementById('add-commodity-panel')?.remove();
    } else {
      renderAddCommodityPanel();
    }
  }
}

async function toggleSym(key, sectionKey) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  if (!section) return;
  const item = section.items.find(i => getItemKey(i) === key);
  if (!item) return;
  VIS[key] = !isOn(item);
  saveVIS();
  if (isOn(item) && !DATA[key]) DATA[key] = await section.fetch(item, false);
  renderSectionGrid(section);
  renderCust(section);
  if (isOverviewRef({ sectionKey, itemKey: key })) renderGlanceGrid();
  updateMarketStatus();
}

function moveSym(key, sectionKey, dir) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  if (!section || !dir) return;
  const ix = section.items.findIndex(i => getItemKey(i) === key);
  if (ix < 0) return;
  const to = ix + dir;
  if (to < 0 || to >= section.items.length) return;
  const [item] = section.items.splice(ix, 1);
  section.items.splice(to, 0, item);
  saveSectionOrderFor(section);
  renderSectionGrid(section);
  renderCust(section);
  if (isOverviewRef({ sectionKey, itemKey: key })) renderGlanceGrid();
}

function buildSectionSourcesHtml(ex) {
  return `
    <dl class="section-sources-dl">
      <div class="section-sources-row">
        <dt>Market</dt>
        <dd>${infoPara(ex.market)}</dd>
      </div>
      <div class="section-sources-row">
        <dt>Venue / exchange</dt>
        <dd>${infoPara(ex.venue)}</dd>
      </div>
      <div class="section-sources-row">
        <dt>Data source</dt>
        <dd>${infoPara(ex.source)}</dd>
      </div>
    </dl>
    ${ex.detail ? `<p class="section-sources-detail">${infoPara(ex.detail)}</p>` : ''}`;
}

function toggleSectionSources(sectionKey) {
  const btn = document.querySelector(`.section-sources-btn[data-section="${sectionKey}"]`);
  const panel = document.querySelector(`.section-sources-panel[data-section="${sectionKey}"]`);
  if (!btn || !panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function renderSectionExplainers() {
  for (const section of SECTIONS) {
    const ex = SECTION_EXPLAINERS[section.key];
    if (!ex) continue;
    const editBtn = document.querySelector(`.section-edit-btn[data-section="${section.key}"]`);
    const sectionEl = editBtn?.closest('.section');
    const header = editBtn?.closest('.section-header');
    if (!sectionEl || !header || !editBtn) continue;

    sectionEl.querySelector('.section-explainer')?.remove();

    let sourcesBtn = header.querySelector(`.section-sources-btn[data-section="${section.key}"]`);
    if (!sourcesBtn) {
      sourcesBtn = document.createElement('button');
      sourcesBtn.type = 'button';
      sourcesBtn.className = 'section-sources-btn';
      sourcesBtn.dataset.section = section.key;
      sourcesBtn.id = `sources-btn-${section.key}`;
      sourcesBtn.textContent = 'Sources';
      sourcesBtn.title = 'Market, exchange, and data source for this section';
      sourcesBtn.setAttribute('aria-expanded', 'false');
      header.insertBefore(sourcesBtn, editBtn);
    }

    let panel = sectionEl.querySelector(`.section-sources-panel[data-section="${section.key}"]`);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'section-sources-panel';
      panel.dataset.section = section.key;
      panel.id = `section-sources-${section.key}`;
      panel.hidden = true;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', `${section.key} market and data source`);
      header.insertAdjacentElement('afterend', panel);
    }
    sourcesBtn.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', sourcesBtn.id);
    panel.innerHTML = buildSectionSourcesHtml(ex);
  }
}

// ── Info Box ──────────────────────────────────────
function renderInfoBox() {
  const box = document.getElementById('info-body');
  if (!box) return;

  const sources = [
    {
      id: 'yahoo',
      name: 'Yahoo Finance',
      tag: 'Recommended',
      tagColor: 'var(--up)',
      rows: [
        ['Key required', 'No'],
        ['Daily limit',  'None'],
        ['Rate limit',   '~Unlimited'],
        ['API type',     'Unofficial'],
        ['CORS proxy',   'allorigins.win'],
        ['Coverage',     'Equities, Commodities, Bonds'],
      ],
      note: 'Equities, commodities, and Treasury yields use Yahoo Finance via allorigins.win proxy (no key needed). FX rates come from Frankfurter.dev and crypto from CoinGecko — both CORS-friendly with no key required.',
    },
    {
      id: 'google',
      name: 'Google Finance',
      tag: 'No key',
      tagColor: 'var(--accent)',
      rows: [
        ['Key required', 'No'],
        ['Daily limit',  'None (be gentle)'],
        ['Rate limit',   'Self-throttled'],
        ['API type',     'Unofficial'],
        ['CORS proxy',   'Hub / allorigins'],
        ['Coverage',     'Equities, Comms, Yields'],
      ],
      note: 'Live quotes from Google Finance quote pages (HTML parse). Charts still use Yahoo history. FX via Frankfurter, crypto via CoinGecko, valuation via FRED. Large page payloads — refresh sparingly.',
    },
    {
      id: 'alphavantage',
      name: 'Alpha Vantage',
      tag: 'Key required',
      tagColor: 'var(--gold)',
      rows: [
        ['Key required', 'Yes'],
        ['Daily limit',  '25 req (free)'],
        ['Rate limit',   '5 req / min'],
        ['API type',     'Official'],
        ['FX % change',  'No ✗'],
        ['Coverage',     'Equities, FX, Comms'],
      ],
      note: 'Official API with an SLA. Free tier is tight (25 req/day). Your API key is stored in this browser\'s localStorage (visible to any script on this site). Crypto always uses CoinGecko regardless of provider. Paid plans from ~$50/mo remove limits.',
    },
    {
      id: 'frank',
      name: 'Frankfurter.dev (FX)',
      tag: 'Always on',
      tagColor: 'var(--accent)',
      rows: [
        ['Key required', 'No'],
        ['Daily limit',  'None'],
        ['CORS',         'Native ✓'],
        ['API type',     'Official (ECB data)'],
        ['Coverage',     'Major currency pairs'],
        ['Update freq',  'Daily (business days)'],
      ],
      note: 'Used for all FX rates in Yahoo mode — no CORS workaround needed. Based on European Central Bank reference rates. Includes EUR, GBP, JPY, AUD, NZD, CAD, CHF, MXN, CNY, INR.',
    },
    {
      id: 'coingecko',
      name: 'CoinGecko (Crypto)',
      tag: 'Always on',
      tagColor: 'var(--accent)',
      rows: [
        ['Key required', 'No'],
        ['Daily limit',  '30 calls/min'],
        ['CORS',         'Native ✓'],
        ['API type',     'Official'],
        ['Coverage',     'Top 100+ crypto assets'],
        ['Change shown', '24h rolling'],
      ],
      note: 'Used for all crypto prices — no proxy needed. Change % is 24-hour rolling (crypto trades 24/7). One batched request for all coins.',
    },
  ];

  const privacyHtml = `
    <div class="info-source info-privacy">
      <div class="info-source-header">
        <span class="info-source-name">Privacy &amp; local storage</span>
        <span class="info-tag" style="color:var(--muted);border-color:var(--border2)">Read first</span>
      </div>
      <div class="info-note">Card visibility, provider choice, and Alpha Vantage keys are saved in <strong>localStorage</strong> on this device (plain text). Any script running on this origin could read them. Fonts load from Google Fonts. Do not paste production keys on a shared or untrusted machine.</div>
    </div>`;

  box.innerHTML = privacyHtml + sources.map(s => {
    const isSelectable = s.id !== 'fred' && s.id !== 'frank' && s.id !== 'coingecko';
    const active = isSelectable && s.id === activeProvider;
    return `
      <div class="info-source${active ? ' info-source-active' : ''}">
        <div class="info-source-header">
          <span class="info-source-name">${escapeHtml(s.name)}</span>
          <span class="info-tag" style="color:${s.tagColor};border-color:${s.tagColor}">
            ${active ? '✓ Active' : s.tag}
          </span>
        </div>
        <table class="info-table">
          ${s.rows.map(([k, v]) => `<tr><td class="info-key">${escapeHtml(k)}</td><td class="info-val">${escapeHtml(v)}</td></tr>`).join('')}
        </table>
        <div class="info-note">${escapeHtml(s.note)}</div>
        ${isSelectable
          ? `<button type="button" class="info-btn${active ? ' info-btn-active' : ''}" data-provider="${s.id}" ${active ? 'disabled' : ''}>${active ? 'Active' : 'Use this source'}</button>`
          : ''}
      </div>`;
  }).join('');
}

function setInfoOpen(open) {
  const body = document.getElementById('info-body');
  const chevron = document.getElementById('info-chevron');
  const header = document.getElementById('info-header-toggle');
  body?.classList.toggle('is-open', open);
  chevron?.classList.toggle('info-chevron--closed', !open);
  header?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleInfo() {
  const body = document.getElementById('info-body');
  if (!body) return;
  setInfoOpen(!body.classList.contains('is-open'));
}

// ── API Usage Tracker ─────────────────────────────
// Tracks calls against Alpha Vantage's free-tier limit (25/day, 500/day premium)
function trackApiCall(count = 1) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem('mmd:api_usage');
    const usage = raw ? JSON.parse(raw) : { date: today, calls: 0 };
    if (usage.date !== today) { usage.date = today; usage.calls = 0; }
    usage.calls += count;
    localStorage.setItem('mmd:api_usage', JSON.stringify(usage));
    return usage.calls;
  } catch { return null; }
}

function getApiUsage() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem('mmd:api_usage');
    if (!raw) return { calls: 0, remaining: 25 };
    const usage = JSON.parse(raw);
    if (usage.date !== today) return { calls: 0, remaining: 25 };
    return { calls: usage.calls, remaining: Math.max(0, 25 - usage.calls) };
  } catch { return null; }
}

function updateApiUsageDisplay() {
  const el = document.getElementById('api-usage');
  if (!el) return;
  if (activeProvider === 'yahoo') {
    el.textContent = 'Source: Yahoo Finance + Frankfurter (FX) + CoinGecko (Crypto) · No rate limit';
    el.style.color = 'var(--dim)';
    return;
  }
  if (activeProvider === 'google') {
    el.textContent = 'Source: Google Finance (quotes) · Yahoo (charts) · Frankfurter · CoinGecko · Refresh sparingly';
    el.style.color = 'var(--dim)';
    return;
  }
  const usage = getApiUsage();
  if (!usage) return;
  el.textContent = `AV calls today: ${usage.calls} / 25  ·  ${usage.remaining} remaining`;
  el.style.color = usage.remaining <= 5 ? 'var(--dn)' : usage.remaining <= 10 ? 'var(--gold)' : 'var(--dim)';
}

// ── Market hours ───────────────────────────────────
const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const MARKET_VENUES = {
  us_equity: {
    label: 'US equities',
    tz: 'America/New_York',
    tzShort: 'ET',
    open: [9, 30],
    close: [16, 0],
    weekdays: [1, 2, 3, 4, 5],
    kind: 'cash',
  },
  asx: {
    label: 'ASX',
    tz: 'Australia/Sydney',
    tzShort: 'AEDT/AEST',
    open: [10, 0],
    close: [16, 0],
    weekdays: [1, 2, 3, 4, 5],
    kind: 'cash',
  },
  london: {
    label: 'LSE',
    tz: 'Europe/London',
    tzShort: 'GMT/BST',
    open: [8, 0],
    close: [16, 30],
    weekdays: [1, 2, 3, 4, 5],
    kind: 'cash',
  },
  tokyo: {
    label: 'TSE',
    tz: 'Asia/Tokyo',
    tzShort: 'JST',
    open: [9, 0],
    close: [15, 0],
    lunch: [[11, 30], [12, 30]],
    weekdays: [1, 2, 3, 4, 5],
    kind: 'cash',
  },
  hong_kong: {
    label: 'HKEX',
    tz: 'Asia/Hong_Kong',
    tzShort: 'HKT',
    open: [9, 30],
    close: [16, 0],
    lunch: [[12, 0], [13, 0]],
    weekdays: [1, 2, 3, 4, 5],
    kind: 'cash',
  },
  cme: {
    label: 'CME Globex',
    tz: 'America/Chicago',
    tzShort: 'CT',
    kind: 'globex',
  },
  fx: {
    label: 'FX (spot)',
    tz: 'America/New_York',
    tzShort: 'ET',
    kind: 'fx',
  },
  crypto: {
    label: 'Crypto',
    kind: 'always',
  },
};

/** Header clocks — major cash equity centres (always shown). */
const TRADING_CLOCK_CENTRES = [
  { id: 'asx', city: 'Sydney' },
  { id: 'tokyo', city: 'Tokyo' },
  { id: 'hong_kong', city: 'Hong Kong' },
  { id: 'london', city: 'London' },
  { id: 'us_equity', city: 'New York' },
];

const SECTION_MARKET_IDS = {
  eq: ['us_equity', 'asx', 'london', 'tokyo', 'hong_kong'],
  val: [],
  comm: [],
  bond: ['us_equity'],
  fx: ['fx'],
  crypto: ['crypto'],
};

function tzParts(date, timeZone) {
  const raw = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date).map(p => [p.type, p.value])
  );
  return {
    day: DAY_INDEX[raw.weekday] ?? -1,
    h: parseInt(raw.hour, 10),
    m: parseInt(raw.minute, 10),
  };
}

function mins(h, m) { return h * 60 + m; }

function hmFromMins(total) {
  return [Math.floor(total / 60), total % 60];
}

function venueLocalYmd(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addCalendarDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** UTC instant for a wall-clock time on a calendar day in `timeZone`. */
function utcAtVenueLocal(timeZone, ymd, hour, minute) {
  const targetM = mins(hour, minute);
  let lo = Date.parse(`${ymd}T00:00:00Z`) - 36 * 3600000;
  let hi = lo + 72 * 3600000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const midYmd = venueLocalYmd(new Date(mid), timeZone);
    const p = tzParts(new Date(mid), timeZone);
    const midM = mins(p.h, p.m);
    const cmp = midYmd < ymd ? -1 : midYmd > ymd ? 1 : (midM < targetM ? -1 : midM > targetM ? 1 : 0);
    if (cmp <= 0) lo = mid;
    else hi = mid;
  }
  return new Date(lo);
}

function weekdayForYmd(ymd, timeZone) {
  return tzParts(utcAtVenueLocal(timeZone, ymd, 12, 0), timeZone).day;
}

/** Ordered session edges for one cash day (state after each edge). */
function venueDayTransitions(venue) {
  const openM = mins(venue.open[0], venue.open[1]);
  const closeM = mins(venue.close[0], venue.close[1]);
  const edges = [{ m: openM, open: true }];
  if (venue.lunch) {
    edges.push({ m: mins(venue.lunch[0][0], venue.lunch[0][1]), open: false });
    edges.push({ m: mins(venue.lunch[1][0], venue.lunch[1][1]), open: true });
  }
  edges.push({ m: closeM, open: false });
  return edges;
}

function formatCentreTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatCentreWeekday(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
  }).format(date);
}

function tradingClockHtml(centre, now = new Date()) {
  const venue = MARKET_VENUES[centre.id];
  if (!venue) return '';
  const state = evaluateVenue(centre.id, now);
  const time = formatCentreTime(now, venue.tz);
  const day = formatCentreWeekday(now, venue.tz);
  const status = state.open ? 'Open' : 'Closed';
  const countdown = state.nextAt
    ? `${state.open ? 'Closes' : 'Opens'} in ${formatCountdown(state.nextAt, now)}`
    : '';
  return `<div class="trading-clock ${state.open ? 'open' : 'closed'}" title="${escapeHtml(state.hours)} · ${escapeHtml(state.detail)}">
    <div class="trading-clock-head">
      <span class="dot ${state.open ? 'open' : 'closed'}" aria-hidden="true"></span>
      <span class="trading-clock-city">${escapeHtml(centre.city)}</span>
    </div>
    <div class="trading-clock-time" aria-live="off">${escapeHtml(time)}</div>
    <div class="trading-clock-meta">
      <span class="trading-clock-tz">${escapeHtml(venue.tzShort)}</span>
      <span class="trading-clock-day">${escapeHtml(day)}</span>
    </div>
    <div class="trading-clock-status">${escapeHtml(status)}</div>
    ${countdown ? `<div class="trading-clock-countdown" aria-live="polite">${escapeHtml(countdown)}</div>` : ''}
  </div>`;
}

function updateTradingClocks() {
  const el = document.getElementById('trading-clocks');
  if (!el) return;
  const now = new Date();
  el.innerHTML = TRADING_CLOCK_CENTRES.map(c => tradingClockHtml(c, now)).join('');
}

function formatClock(date, timeZone, withUtc = true) {
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);
  if (!withUtc) return local;
  const utc = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${local} (${utc} UTC)`;
}

function cashSessionOpen(venue, date = new Date()) {
  const t = tzParts(date, venue.tz);
  if (!venue.weekdays.includes(t.day)) return false;
  const nowM = mins(t.h, t.m);
  const openM = mins(venue.open[0], venue.open[1]);
  const closeM = mins(venue.close[0], venue.close[1]);
  if (nowM < openM || nowM >= closeM) return false;
  if (venue.lunch) {
    const lunchStart = mins(venue.lunch[0][0], venue.lunch[0][1]);
    const lunchEnd = mins(venue.lunch[1][0], venue.lunch[1][1]);
    if (nowM >= lunchStart && nowM < lunchEnd) return false;
  }
  return true;
}

function findNextCashTransition(venue, from, wantOpen) {
  const startYmd = venueLocalYmd(from, venue.tz);
  const fromLocal = tzParts(from, venue.tz);
  const fromLocalM = mins(fromLocal.h, fromLocal.m);
  const edges = venueDayTransitions(venue);
  for (let offset = 0; offset < 10; offset++) {
    const ymd = addCalendarDaysYmd(startYmd, offset);
    if (!venue.weekdays.includes(weekdayForYmd(ymd, venue.tz))) continue;
    for (const edge of edges) {
      if (offset === 0 && edge.m <= fromLocalM) continue;
      if (edge.open !== wantOpen) continue;
      const [h, m] = hmFromMins(edge.m);
      const at = utcAtVenueLocal(venue.tz, ymd, h, m);
      if (at.getTime() > from.getTime() + 500) return at;
    }
  }
  return null;
}

function evaluateCashVenue(venue, now = new Date()) {
  const open = cashSessionOpen(venue, now);
  const hours = `${String(venue.open[0]).padStart(2, '0')}:${String(venue.open[1]).padStart(2, '0')}–${String(venue.close[0]).padStart(2, '0')}:${String(venue.close[1]).padStart(2, '0')} ${venue.tzShort}`;
  if (open) {
    const closeAt = findNextCashTransition(venue, now, false);
    const detail = closeAt
      ? `Open · closes ${formatClock(closeAt, venue.tz)}`
      : `Open · ${hours}`;
    return { open: true, detail, hours, nextAt: closeAt || null };
  }
  const openAt = findNextCashTransition(venue, now, true);
  const detail = openAt
    ? `Closed · opens ${formatClock(openAt, venue.tz)}`
    : `Closed · ${hours}`;
  return { open: false, detail, hours, nextAt: openAt || null };
}

/** CME Globex: Sun 17:00 – Fri 16:00 CT; daily halt 16:00–17:00 CT. */
function cmeGlobexOpen(date = new Date()) {
  const t = tzParts(date, 'America/Chicago');
  const nowM = mins(t.h, t.m);
  if (nowM >= mins(16, 0) && nowM < mins(17, 0)) return false;
  if (t.day === 6) return false;
  if (t.day === 0) return nowM >= mins(17, 0);
  if (t.day === 5 && nowM >= mins(16, 0)) return false;
  return t.day >= 1 && t.day <= 5;
}

function findNextGlobexTransition(from, toOpen) {
  for (let i = 0; i <= 10 * 24 * 4; i++) {
    const d = new Date(from.getTime() + i * 15 * 60_000);
    const open = cmeGlobexOpen(d);
    if (toOpen && open) return d;
    if (!toOpen && !open) {
      const prev = new Date(d.getTime() - 15 * 60_000);
      if (cmeGlobexOpen(prev)) return d;
    }
  }
  return null;
}

function evaluateCmeGlobex(now = new Date()) {
  const hours = 'Sun 17:00 – Fri 16:00 CT · daily halt 16:00–17:00';
  const t = tzParts(now, 'America/Chicago');
  const nowM = mins(t.h, t.m);
  const halt = t.day >= 1 && t.day <= 5 && nowM >= mins(16, 0) && nowM < mins(17, 0);
  if (halt) {
    const reopen = findNextGlobexTransition(now, true);
    return {
      open: false,
      detail: reopen
        ? `Maintenance · reopens ${formatClock(reopen, 'America/Chicago')}`
        : 'Maintenance · 16:00–17:00 CT',
      hours,
      nextAt: reopen || null,
    };
  }
  if (cmeGlobexOpen(now)) {
    const closeAt = findNextGlobexTransition(now, false);
    return {
      open: true,
      detail: closeAt ? `Open · closes ${formatClock(closeAt, 'America/Chicago')}` : `Open · ${hours}`,
      hours,
      nextAt: closeAt || null,
    };
  }
  const openAt = findNextGlobexTransition(now, true);
  return {
    open: false,
    detail: openAt ? `Closed · opens ${formatClock(openAt, 'America/Chicago')}` : `Closed · ${hours}`,
    hours,
    nextAt: openAt || null,
  };
}

/** FX spot: Sun 17:00 ET – Fri 17:00 ET (NY week). */
function fxSpotOpen(date = new Date()) {
  const t = tzParts(date, 'America/New_York');
  const nowM = mins(t.h, t.m);
  if (t.day === 6) return false;
  if (t.day === 0) return nowM >= mins(17, 0);
  if (t.day === 5) return nowM < mins(17, 0);
  return true;
}

function findNextFxTransition(from, toOpen) {
  for (let i = 0; i <= 10 * 24 * 4; i++) {
    const d = new Date(from.getTime() + i * 15 * 60_000);
    const open = fxSpotOpen(d);
    if (toOpen && open) return d;
    if (!toOpen && !open) {
      const prev = new Date(d.getTime() - 15 * 60_000);
      if (fxSpotOpen(prev)) return d;
    }
  }
  return null;
}

function evaluateFxSession(now = new Date()) {
  const hours = 'Sun 17:00 – Fri 17:00 ET';
  if (fxSpotOpen(now)) {
    const closeAt = findNextFxTransition(now, false);
    return {
      open: true,
      detail: closeAt ? `Open · closes ${formatClock(closeAt, 'America/New_York')}` : `Open · ${hours}`,
      hours,
      nextAt: closeAt || null,
    };
  }
  const openAt = findNextFxTransition(now, true);
  return {
    open: false,
    detail: openAt ? `Closed · opens ${formatClock(openAt, 'America/New_York')}` : `Closed · ${hours}`,
    hours,
    nextAt: openAt || null,
  };
}

function evaluateCryptoSession() {
  return {
    open: true,
    detail: 'Open · 24/7',
    hours: 'Always trading',
    nextAt: null,
  };
}

function evaluateVenue(venueId, now = new Date()) {
  const venue = MARKET_VENUES[venueId];
  if (!venue) return { open: false, detail: '—', hours: '' };
  if (venue.kind === 'always') return evaluateCryptoSession();
  if (venue.kind === 'fx') return evaluateFxSession(now);
  if (venue.kind === 'globex') return evaluateCmeGlobex(now);
  return evaluateCashVenue(venue, now);
}

/** Cash/Globex venue for session-aware quote cards (eq / comm). */
function sessionVenueForItem(item, sectionKey) {
  if (sectionKey === 'comm') return null;
  if (sectionKey !== 'eq') return null;
  const sym = String(item?.sym || '').toUpperCase();
  const ex = item?.exchange || inferExchangeFromSym(item?.sym);
  if (ex === 'ASX' || sym.endsWith('.AX') || sym === '^AXJO' || sym === '^AORD') return 'asx';
  return 'us_equity';
}

function formatCountdown(target, now = new Date()) {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return '0s';
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isSessionOpenForItem(item, sectionKey, now = new Date()) {
  const venueId = sessionVenueForItem(item, sectionKey);
  if (!venueId) return null;
  return evaluateVenue(venueId, now).open;
}

/** Align Live/Closed pill with trading-centre session (e.g. S&P 500 when NY is closed). */
function applySessionAwareQuoteMeta(item, sectionKey, meta) {
  const open = isSessionOpenForItem(item, sectionKey);
  if (open === null) return meta;
  if (open) {
    return { ...meta, sessionOpen: true, pillLabel: null };
  }
  return {
    ...meta,
    sessionOpen: false,
    pillLabel: 'Closed',
    freshnessKind: 'daily',
    freshnessNote: meta.freshnessNote || null,
  };
}

const SESSION_TRACKED_VENUES = ['us_equity', 'asx', 'cme'];
let lastSessionOpenByVenue = {};

function sessionStateChanged(now = new Date()) {
  let changed = false;
  for (const id of SESSION_TRACKED_VENUES) {
    const open = evaluateVenue(id, now).open;
    if (lastSessionOpenByVenue[id] !== undefined && lastSessionOpenByVenue[id] !== open) {
      changed = true;
    }
    lastSessionOpenByVenue[id] = open;
  }
  return changed;
}

function marketChipHtml(venueId, state) {
  const venue = MARKET_VENUES[venueId];
  return `<div class="market-hours-chip ${state.open ? 'open' : 'closed'}" title="${escapeHtml(state.hours)}">
    <span class="dot ${state.open ? 'open' : 'closed'}" aria-hidden="true"></span>
    <span class="market-hours-name">${escapeHtml(venue?.label || venueId)}</span>
    <span class="market-hours-detail">${escapeHtml(state.detail)}</span>
  </div>`;
}

function activeMarketVenueIds() {
  const ids = new Set();
  for (const section of SECTIONS) {
    if (!visOf(section.items).length) continue;
    for (const id of SECTION_MARKET_IDS[section.key] || []) ids.add(id);
  }
  return [...ids];
}

function renderMarketHoursBar(container, venueIds) {
  if (!container) return;
  const now = new Date();
  container.innerHTML = venueIds.map(id => marketChipHtml(id, evaluateVenue(id, now))).join('');
}

function ensureSectionMarketsBar(section) {
  const grid = document.getElementById(section.gridId);
  const el = grid?.closest('.section');
  if (!el) return null;
  let bar = el.querySelector('.section-markets');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'section-markets';
    bar.dataset.section = section.key;
    const header = el.querySelector('.section-header');
    header?.insertAdjacentElement('afterend', bar);
  }
  return bar;
}

function updateSectionMarkets() {
  for (const section of SECTIONS) {
    const ids = SECTION_MARKET_IDS[section.key];
    if (!ids?.length || !visOf(section.items).length) {
      const bar = document.querySelector(`.section-markets[data-section="${section.key}"]`);
      if (bar) bar.hidden = true;
      continue;
    }
    const bar = ensureSectionMarketsBar(section);
    if (!bar) continue;
    bar.hidden = false;
    renderMarketHoursBar(bar, ids);
  }
}

function updateMarketStatus() {
  const now = new Date();
  const sessionChanged = sessionStateChanged(now);
  const footer = document.getElementById('market-hours');
  const venueIds = activeMarketVenueIds();
  if (footer) renderMarketHoursBar(footer, venueIds.length ? venueIds : ['us_equity', 'fx', 'crypto']);
  updateSectionMarkets();
  if (sessionChanged) {
    for (const section of SECTIONS) {
      if (section.key === 'eq') renderSectionGrid(section);
    }
    renderGlanceGrid();
  }
}

let marketHoursTimer = null;
let tradingClockTimer = null;
let marketHoursTick = 0;

function startMarketHoursClock() {
  if (marketHoursTimer) clearInterval(marketHoursTimer);
  if (tradingClockTimer) clearInterval(tradingClockTimer);
  updateTradingClocks();
  updateMarketStatus();
  marketHoursTick = 0;
  tradingClockTimer = setInterval(() => {
    updateTradingClocks();
    marketHoursTick += 1;
    if (marketHoursTick % 60 === 0) updateMarketStatus();
  }, 1000);
  marketHoursTimer = tradingClockTimer;
}

// ── Date line ─────────────────────────────────────
function updateDateLine() {
  const now = new Date();
  document.getElementById('date-line').textContent =
    now.toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).toUpperCase() + '  ·  ' +
    now.toLocaleTimeString('en-AU', {
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
}

// ── Main Load ─────────────────────────────────────
async function loadAll(force = false) {
  const btn = document.getElementById('refresh-btn');
  const status = document.getElementById('status-line');
  let effectiveForce = force;
  let throttleNote = null;

  if (force) {
    const gate = checkForceRefreshThrottle();
    if (!gate.ok) {
      status.className = 'status-line warn';
      status.textContent = `⚠ ${gate.message}`;
      setRefreshButtonBlocked(true, gate.retryAfterMs);
      return;
    }
    recordForceRefreshThrottle();
  } else {
    const gate = checkPageLoadThrottle();
    if (!gate.ok) {
      effectiveForce = false;
      throttleNote = gate.message;
    } else {
      recordPageLoadThrottle();
    }
  }

  resetHubProxyRateLimit();
  beginPageLoad(throttleNote ? 'Loading cached data…' : 'Retrieving data…');
  updateDateLine();
  updateMarketStatus();
  startValuationPrefetch(effectiveForce);
  void loadBondSpreadFred(effectiveForce).then(data => { BOND_SPREAD_FRED = data || {}; });

  if (effectiveForce && activeProvider === 'alphavantage') {
    const eqItems = SECTIONS.find(s => s.key === 'eq')?.items || EQUITIES;
    trackApiCall(visOf(eqItems).length + visOf(COMMODITIES).length + visOf(FX_PAIRS).length);
    updateApiUsageDisplay();
  }

  async function loadSection(section) {
    const visible = visOf(section.items);
    if (!visible.length) return;

    if (section.key === 'val') {
      if (!effectiveForce) {
        let painted = false;
        for (const item of visible) {
          const key = getItemKey(item);
          const ck = item.api ? `val-live:${key}` : `val:${key}`;
          const cached = cacheGet(ck) || cacheGetStale(ck);
          if (cached) {
            DATA[key] = cached;
            painted = true;
          }
        }
        if (painted) {
          renderSectionGrid(section);
          setSectionLoading(section, false);
        }
      }

      let renderQueued = false;
      const scheduleRender = () => {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => {
          renderQueued = false;
          renderSectionGrid(section);
        });
      };
      try {
        await Promise.allSettled(visible.map(async item => {
          const key = getItemKey(item);
          try {
            const data = await section.fetch(item, effectiveForce);
            if (data) DATA[key] = data;
            else delete DATA[key];
          } catch (err) {
            console.warn('card fetch failed', section.key, key, err);
            delete DATA[key];
          }
          scheduleRender();
        }));
      } catch (err) {
        console.warn('section load failed', section.key, err);
      } finally {
        renderSectionGrid(section);
        renderCust(section);
        setSectionLoading(section, false);
      }
      return;
    }

    if (section.key === 'bond') {
      try {
        BOND_SPREAD_FRED = await loadBondSpreadFred(effectiveForce);
      } catch {
        BOND_SPREAD_FRED = {};
      }
    }

    if (!effectiveForce) {
      let painted = false;
      for (const item of visible) {
        const key = getItemKey(item);
        const ck = cacheKeyForItem(item, section);
        const cached = cacheGet(ck) || cacheGetStale(ck);
        if (cached) {
          DATA[key] = cached;
          painted = true;
        }
      }
      if (painted) {
        renderSectionGrid(section);
        setSectionLoading(section, false);
      }
    }

    try {
      const outcomes = await Promise.allSettled(
        visible.map(item => section.fetch(item, effectiveForce))
      );
      outcomes.forEach((out, i) => {
        if (out.status === 'fulfilled' && out.value) {
          DATA[getItemKey(visible[i])] = out.value;
        } else if (out.status === 'rejected') {
          console.warn('card fetch failed', section.key, getItemKey(visible[i]), out.reason);
        }
      });
    } catch (err) {
      console.warn('section load failed', section.key, err);
    } finally {
      renderSectionGrid(section);
      renderCust(section);
      setSectionLoading(section, false);
    }
  }

  await Promise.all(SECTIONS.map(s => loadSection(s)));
  await loadOverviewItems(effectiveForce);

  btn.classList.remove('spinning');
  if (force) setRefreshButtonBlocked(true, REFRESH_MIN_GAP_MS);
  const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const eqItems = SECTIONS.find(s => s.key === 'eq')?.items || EQUITIES;
  const eqVisible = visOf(eqItems);
  const allEqFailed = eqVisible.length > 0 && eqVisible.every(e => !DATA[getItemKey(e)]);
  const valVisible = visOf(VALUATION);
  const valLoaded = valVisible.some(item => {
    const d = DATA[item.id];
    if (item.api) return Boolean(d?.display || d?.live);
    return d?.price != null || d?.display;
  });
  const valAllFailed = valVisible.length > 0 && !valLoaded;
  if (hubProxyRateLimited) {
    status.className = 'status-line warn';
    status.textContent = '⚠ Too many data requests — wait about a minute, then refresh';
  } else if (valAllFailed) {
    status.className = 'status-line warn';
    status.textContent = '⚠ Valuation unavailable — FRED data did not load. Wait ~1 min and refresh, or check Valuation ⊞ Edit (cards enabled).';
  } else if (allEqFailed) {
    status.className = 'status-line err';
    status.textContent = activeProvider === 'alphavantage'
      ? '⚠ AV key error or rate limit — check your key'
      : '⚠ Equities failed — allorigins.win proxy may be down, try refresh';
  } else if (throttleNote) {
    status.className = 'status-line warn';
    status.textContent = `⚠ ${throttleNote} · cached ${now}`;
  } else {
    status.className = 'status-line ok';
    status.textContent = `✓ Updated ${now}`;
  }
  updateApiUsageDisplay();
  updateMarketStatus();
  buildFreshnessSummaryFromData();
  updateFreshnessFooter();
  void fetchHubFreshness().then(() => {
    buildFreshnessSummaryFromData();
    updateFreshnessFooter();
  });
}

async function fetchHubFreshness() {
  if (!isHubEconomicsPage() || !isHubHostname()) return null;
  try {
    const r = await fetchWithTimeout(`${location.origin}/economics/api/freshness`, {}, 8000);
    macroFreshnessSummary = await readFetchResponse(r, { asJson: true });
    return macroFreshnessSummary;
  } catch {
    return null;
  }
}

function buildFreshnessSummaryFromData() {
  const series = { ...(macroFreshnessSummary?.series || {}) };
  for (const section of SECTIONS) {
    for (const item of section.items) {
      const key = getItemKey(item);
      const d = DATA[key];
      if (!d?.asOfUtc) continue;
      const sid = item.id || item.sym;
      const existing = series[sid];
      const asOf = fredDateToUtcLabel(d.asOfUtc);
      if (!existing || (asOf && asOf > (existing.lastObservation || ''))) {
        series[sid] = {
          lastObservation: asOf,
          kind: inferFreshnessKind({ ...d, sectionKey: section.key, itemKey: key }),
        };
      }
    }
  }
  macroFreshnessSummary = {
    ...(macroFreshnessSummary || {}),
    series,
    clientBuiltAt: new Date().toISOString(),
  };
}

function fredDateToUtcLabel(ms) {
  if (ms == null) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function updateFreshnessFooter() {
  const el = document.getElementById('freshness-line');
  if (!el) return;
  const s = macroFreshnessSummary;
  if (!s) {
    el.textContent = '';
    el.hidden = true;
    return;
  }
  const parts = [];
  if (s.fredApi) parts.push('FRED API');
  const gdp = s.series?.GDP?.lastObservation;
  const debt = s.series?.GFDEGDQ188S?.lastObservation;
  const mv = s.series?.MVMTD027MNFRBDAL?.lastObservation;
  if (gdp) parts.push(`GDP ${gdp}`);
  if (debt) parts.push(`debt ${debt}`);
  if (mv) parts.push(`Treasury MV ${mv}`);
  if (!parts.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = `Data vintage: ${parts.join(' · ')}`;
}

// ── Chart modal ───────────────────────────────────
const HISTORY_CACHE_TTL = 15 * 60 * 1000;
const CHART_PERIODS = [
  { days: 1, label: '1D' },
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 180, label: '6M' },
  { days: 365, label: '1Y' },
];
const chartState = { itemKey: null, sectionKey: null, days: 7, returnFocus: null };
const COMPARE_PERIODS = [
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 180, label: '6M' },
  { days: 365, label: '1Y' },
  { days: 1825, label: '5Y' },
];
const compareState = {
  open: false,
  selected: [],
  days: 180,
  mode: 'pct',
  query: '',
  returnFocus: null,
};
const COMPARE_MAX_ITEMS = 6;

function chartPeriodsFor(item, section) {
  if (section.key === 'val') return CHART_PERIODS.filter(p => p.days >= 30);
  if (section.key === 'bond' && !item.yTicker) return CHART_PERIODS.filter(p => p.days >= 30);
  if (section.key === 'fx') return CHART_PERIODS.filter(p => p.days >= 7);
  return CHART_PERIODS;
}

function renderChartPeriodTabs(periods, activeDays) {
  const el = document.getElementById('chart-period-tabs');
  if (!el) return;
  el.innerHTML = periods.map(p => `
    <button type="button" role="tab" id="chart-tab-${p.days}" data-days="${p.days}"
      class="${p.days === activeDays ? 'active' : ''}"
      aria-selected="${p.days === activeDays ? 'true' : 'false'}"
      aria-controls="chart-modal-body" tabindex="${p.days === activeDays ? '0' : '-1'}">${p.label}</button>
  `).join('');
  const body = document.getElementById('chart-modal-body');
  const activeTab = el.querySelector('button.active');
  if (body) {
    body.setAttribute('role', 'tabpanel');
    if (activeTab) body.setAttribute('aria-labelledby', activeTab.id);
  }
}

function syncChartPeriodTabs(activeDays) {
  document.querySelectorAll('#chart-period-tabs button').forEach(btn => {
    const on = Number(btn.dataset.days) === activeDays;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
  });
  const body = document.getElementById('chart-modal-body');
  const activeTab = document.querySelector(`#chart-period-tabs button[data-days="${activeDays}"]`);
  if (body && activeTab) body.setAttribute('aria-labelledby', activeTab.id);
}

function historyCacheGet(key) {
  try {
    const raw = localStorage.getItem(`mmd:hist:${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return (Date.now() - ts < HISTORY_CACHE_TTL) ? data : null;
  } catch { return null; }
}
function historyCacheSet(key, data) {
  try { localStorage.setItem(`mmd:hist:${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function resolveItem(itemKey, sectionKey) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  const item = section?.items.find(i => getItemKey(i) === itemKey);
  return section && item ? { section, item } : null;
}

function parseYahooSeries(data) {
  const r = data?.chart?.result?.[0];
  if (!r) return null;
  const timestamps = r.timestamp || [];
  const quote = r.indicators?.quote?.[0] || {};
  const closes = quote.close || quote.adjclose || [];
  const series = [];
  for (let i = 0; i < timestamps.length; i++) {
    const v = closes[i];
    if (v == null || Number.isNaN(v)) continue;
    series.push({ t: timestamps[i] * 1000, v });
  }
  return series.length ? series : null;
}

async function fetchYahooHistory(sym, days) {
  const cacheKey = `yh:${sym}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;
  const { range, interval } = yahooHistoryParams(days);
  const data = await fetchRemote(yahooChartUrl(sym, range, interval), { asJson: true });
  let series = data ? parseYahooSeries(data) : null;
  if (series) series = sliceSeriesForChart(series, days);
  if (series) historyCacheSet(cacheKey, series);
  return series;
}

async function fetchFredHistory(seriesId, days) {
  const cacheKey = `fred:${seriesId}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;
  const lookback = Math.max(days, 400);
  const start = new Date(Date.now() - lookback * 86400000).toISOString().slice(0, 10);
  const rows = await fetchFredSeriesRows(seriesId, start);
  if (!rows?.length) return null;
  let series = rows.map(r => ({ t: new Date(r.date).getTime(), v: r.v }));
  series = sliceSeriesForChart(series, days);
  if (!series?.length) return null;
  historyCacheSet(cacheKey, series);
  return series;
}

async function fetchFxHistory(from, to, days) {
  const cacheKey = `fx:${from}:${to}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${start}..${end}?from=${from}&to=${to}`);
    if (!r.ok) return null;
    const d = await r.json();
    let series = Object.keys(d.rates).sort().map(date => ({
      t: new Date(date).getTime(),
      v: d.rates[date][to],
    })).filter(p => p.v != null);
    if (!series.length) return null;
    series = sliceSeriesForChart(series, days);
    if (!series?.length) return null;
    historyCacheSet(cacheKey, series);
    return series;
  } catch {
    return null;
  }
}

async function fetchCryptoHistory(sym, days) {
  const id = CG_IDS[sym];
  if (!id) return null;
  const cacheKey = `cg:${sym}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    let series = (d.prices || []).map(([t, v]) => ({ t, v }));
    if (!series.length) return null;
    series = sliceSeriesForChart(series, days);
    if (!series?.length) return null;
    historyCacheSet(cacheKey, series);
    return series;
  } catch {
    return null;
  }
}

async function fetchHistory(item, section, days) {
  if (section.key === 'eq') {
    return fetchYahooHistory(item.sym, days);
  }
  if (section.key === 'comm') {
    if (item.fredId) return fetchFredHistory(item.fredId, days);
    if (item.sym) return fetchYahooHistory(item.sym, days);
    return null;
  }
  if (section.key === 'bond') {
    if (item.yTicker) return fetchYahooHistory(item.yTicker, days);
    return fetchFredHistory(item.id, days);
  }
  if (section.key === 'fx') {
    return fetchFxHistory(item.from, item.to, days);
  }
  if (section.key === 'crypto') {
    return fetchCryptoHistory(item.sym, days);
  }
  if (section.key === 'val') {
    return fetchValuationHistory(item.id, days);
  }
  return null;
}

async function fetchValuationHistory(metricId, days) {
  if (isValuationLive(metricId)) return null;

  const cacheKey = `val:${metricId}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;

  const lookback = valuationHistoryLookbackDays(days);
  const fred = await loadValuationFredRows(false, lookback);
  let series = null;

  if (metricId === 'buffett') {
    const ratios = buildBuffettRatios(fred[BUFFETT_CAP_SERIES], fred.GDP);
    series = ratios?.map(r => ({ t: r.t, v: r.ratio })) ?? null;
  } else if (metricId === 'us-gdp') {
    series = fred.GDP?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  } else if (metricId === 'public-debt') {
    series = fred.GFDEGDQ188S?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  } else if (metricId === 'private-debt') {
    const ratios = buildPrivateDebtRatios(fred.TCMDO, fred.FGSDODNS, fred.GDP);
    series = ratios?.map(r => ({ t: r.t, v: r.ratio })) ?? null;
  } else if (metricId === 'au-gdp') {
    series = fred.NGDPSAXDCAUQ?.map(r => ({ t: new Date(r.date).getTime(), v: r.v / 1000 })) ?? null;
  } else if (metricId === 'au-public-debt') {
    series = fred[FRED_AU_PUBLIC_DEBT_SERIES]?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  } else if (metricId === 'au-private-debt') {
    series = fred.QAUPAM770A?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  }

  series = sliceSeriesForChart(series, days);
  if (!series?.length) return null;
  historyCacheSet(cacheKey, series);
  return series;
}

function formatChartDate(ts) {
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function buildChartSvg(series, opts = {}) {
  const { isPercent = false, dp = 2, quarterlyNote = false } = opts;
  if (!series?.length) return { html: '<p class="chart-empty">No history available for this period.</p>', statsHtml: '' };

  const w = 560, h = 200;
  const pad = { t: 14, r: 14, b: 30, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const vals = series.map(p => p.v);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const range = maxV - minV;
  const n = series.length;

  const pts = series.map((p, i) => ({
    x: pad.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2),
    y: pad.t + ih - ((p.v - minV) / range) * ih,
    v: p.v,
    t: p.t,
  }));

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[n - 1].x.toFixed(1)},${pad.t + ih} L${pts[0].x.toFixed(1)},${pad.t + ih} Z`;
  const first = series[0];
  const last = series[series.length - 1];
  const chg = pointsChange(last.v, first.v) ?? 0;
  const chgPct = pctChange(last.v, first.v) ?? 0;
  const up = chg >= 0;
  const stroke = up ? '#34d399' : '#f87171';
  const pctDp = opts.pctDp ?? dp;
  const fmtV = v => {
    if (opts.usdBillions) return formatUsdCompact(v) || '–';
    if (opts.audBillions) return formatAudCompact(v) || '–';
    if (isPercent) return `${v.toFixed(pctDp)}%`;
    return fmt(v, dp);
  };
  const fmtChgAbs = v => {
    if (opts.isYield || opts.isRatio) return `${Math.abs(v).toFixed(pctDp)} pp`;
    if (opts.usdBillions) return formatUsdCompact(Math.abs(v)) || '–';
    if (opts.audBillions) return formatAudCompact(Math.abs(v)) || '–';
    if (isPercent) return `${Math.abs(v).toFixed(pctDp)}%`;
    return fmt(Math.abs(v), dp);
  };

  const yTicks = [minV, (minV + maxV) / 2, maxV];
  const yLabels = yTicks.map((v, i) => {
    const y = pad.t + ih - ((v - minV) / range) * ih;
    return `<text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" fill="#4a5568" font-size="9" font-family="DM Mono, monospace">${fmtV(v)}</text>`;
  }).join('');

  const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yTicks.map(v => {
      const y = pad.t + ih - ((v - minV) / range) * ih;
      return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${pad.l + iw}" y2="${y.toFixed(1)}" stroke="#252b33" stroke-width="1"/>`;
    }).join('')}
    <path d="${area}" fill="url(#chart-fill)"/>
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${yLabels}
    <text x="${pad.l}" y="${h - 8}" fill="#4a5568" font-size="9" font-family="DM Mono, monospace">${formatChartDate(first.t)}</text>
    <text x="${pad.l + iw}" y="${h - 8}" text-anchor="end" fill="#4a5568" font-size="9" font-family="DM Mono, monospace">${formatChartDate(last.t)}</text>
  </svg>`;

  const statsHtml = `
    <div><div class="chart-stat-label">Period change</div><div class="chart-stat-val ${up ? 'up' : 'dn'}">${sign(chg)}${fmtChgAbs(chg)} (${sign(chgPct)}${Math.abs(chgPct).toFixed(2)}%)</div></div>
    <div><div class="chart-stat-label">High</div><div class="chart-stat-val">${fmtV(maxV)}</div></div>
    <div><div class="chart-stat-label">Low</div><div class="chart-stat-val">${fmtV(minV)}</div></div>
    <div><div class="chart-stat-label">Latest</div><div class="chart-stat-val">${fmtV(last.v)}</div></div>`;

  const noteHtml = quarterlyNote
    ? '<p class="chart-note">Quarterly FRED data — short periods show the latest observations.</p>'
    : '';
  return { html: noteHtml + svg, statsHtml };
}

function chartOpts(item, section) {
  if (section.key === 'val' && item.id === 'us-gdp') {
    return { isPercent: false, usdBillions: true, dp: 2, quarterlyNote: true };
  }
  if (section.key === 'val' && item.id === 'au-gdp') {
    return { isPercent: false, audBillions: true, dp: 2, quarterlyNote: true };
  }
  if (section.key === 'val') {
    const pctDp = item.id === 'buffett' ? 0 : 1;
    return { isPercent: true, isRatio: true, dp: 2, pctDp, quarterlyNote: true };
  }
  const isPercent = section.key === 'bond';
  const dp = quoteDecimals(item, section.key);
  return { isPercent, isYield: section.key === 'bond', dp };
}

let chartFocusTrapHandler = null;

function chartModalFocusables() {
  const panel = document.querySelector('#chart-modal .chart-modal-panel');
  if (!panel) return [];
  return [...panel.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];
}

function installChartFocusTrap() {
  const modal = document.getElementById('chart-modal');
  if (!modal) return;
  removeChartFocusTrap();
  chartFocusTrapHandler = e => {
    if (e.key !== 'Tab' || modal.hidden) return;
    const nodes = chartModalFocusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  modal.addEventListener('keydown', chartFocusTrapHandler);
}

function removeChartFocusTrap() {
  const modal = document.getElementById('chart-modal');
  if (modal && chartFocusTrapHandler) {
    modal.removeEventListener('keydown', chartFocusTrapHandler);
    chartFocusTrapHandler = null;
  }
}

function closeChart() {
  const modal = document.getElementById('chart-modal');
  if (!modal) return;
  const restore = chartState.returnFocus;
  chartState.returnFocus = null;
  chartState.itemKey = null;
  chartState.sectionKey = null;
  modal.hidden = true;
  modal.inert = true;
  document.body.style.overflow = document.getElementById('info-modal')?.hidden === false ? 'hidden' : '';
  removeChartFocusTrap();
  if (restore instanceof HTMLElement && document.contains(restore)) {
    restore.focus({ preventScroll: true });
  }
}

async function loadChartModal() {
  const body = document.getElementById('chart-modal-body');
  const stats = document.getElementById('chart-modal-stats');
  if (!body || !chartState.itemKey) return;

  const resolved = resolveItem(chartState.itemKey, chartState.sectionKey);
  if (!resolved) {
    body.innerHTML = '<p class="chart-empty">Unknown instrument.</p>';
    stats.innerHTML = '';
    return;
  }

  const { item, section } = resolved;
  const opts = chartOpts(item, section);
  body.textContent = 'Loading…';
  stats.innerHTML = '';

  try {
    const series = await fetchHistory(item, section, chartState.days);
    const { html, statsHtml } = buildChartSvg(series, opts);
    body.innerHTML = html;
    stats.innerHTML = statsHtml;
  } catch (err) {
    console.error('chart load failed', err);
    body.innerHTML = '<p class="chart-empty">Could not load chart data. Try Refresh on the card.</p>';
    stats.innerHTML = '';
  }
}

async function openChart(itemKey, sectionKey) {
  const resolved = resolveItem(itemKey, sectionKey);
  if (!resolved) return;

  const { item, section } = resolved;
  chartState.itemKey = itemKey;
  chartState.sectionKey = sectionKey;
  const periods = chartPeriodsFor(item, section);
  chartState.days = periods.find(p => p.days === 7)?.days ?? periods[0]?.days ?? 7;

  const modal = document.getElementById('chart-modal');
  const ticker = item.ticker || `${item.from}/${item.to}`;
  document.getElementById('chart-modal-ticker').textContent = ticker;
  document.getElementById('chart-modal-title').textContent = item.label;

  renderChartPeriodTabs(periods, chartState.days);

  chartState.returnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  modal.hidden = false;
  modal.inert = false;
  document.body.style.overflow = 'hidden';
  installChartFocusTrap();
  document.getElementById('chart-modal-close')?.focus();
  await loadChartModal();
}

function compareKey(itemKey, sectionKey) {
  return `${sectionKey}:${itemKey}`;
}

function parseCompareKey(key) {
  const idx = key.indexOf(':');
  if (idx < 1) return null;
  return { sectionKey: key.slice(0, idx), itemKey: key.slice(idx + 1) };
}

function getSectionName(sectionKey) {
  const names = {
    eq: 'Equities',
    val: 'Valuation',
    comm: 'Commodities',
    bond: 'Treasuries',
    fx: 'Currencies',
    crypto: 'Crypto',
  };
  return names[sectionKey] || sectionKey.toUpperCase();
}

function getCompareCatalog() {
  const out = [];
  for (const section of SECTIONS) {
    for (const item of section.items) {
      const itemKey = getItemKey(item);
      out.push({
        key: compareKey(itemKey, section.key),
        itemKey,
        sectionKey: section.key,
        sectionName: getSectionName(section.key),
        label: item.label,
        ticker: item.ticker || item.sym || item.id || `${item.from}/${item.to}`,
      });
    }
  }
  return out;
}

function saveComparePrefs() {
  try {
    localStorage.setItem('mmd:compare:v1', JSON.stringify({
      selected: compareState.selected,
      days: compareState.days,
      mode: compareState.mode,
    }));
  } catch {}
}

function loadComparePrefs() {
  try {
    const raw = localStorage.getItem('mmd:compare:v1');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.selected)) compareState.selected = parsed.selected.slice(0, COMPARE_MAX_ITEMS);
    if (Number.isFinite(parsed.days)) compareState.days = parsed.days;
    if (['pct', 'indexed', 'raw'].includes(parsed.mode)) compareState.mode = parsed.mode;
  } catch {}
}

function filteredCompareCatalog() {
  const q = compareState.query.trim().toLowerCase();
  const all = getCompareCatalog();
  if (!q) return all;
  return all.filter(item =>
    item.label.toLowerCase().includes(q)
    || item.ticker.toLowerCase().includes(q)
    || item.sectionName.toLowerCase().includes(q)
  );
}

function toggleCompareItem(key) {
  const ix = compareState.selected.indexOf(key);
  if (ix >= 0) {
    compareState.selected.splice(ix, 1);
  } else if (compareState.selected.length < COMPARE_MAX_ITEMS) {
    compareState.selected.push(key);
  }
  saveComparePrefs();
  renderCompareModal();
  void renderCompareChart();
}

function compareSeriesColor(i) {
  const colors = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#22d3ee'];
  return colors[i % colors.length];
}

function normalizeSeries(series, mode) {
  if (!series?.length) return series;
  const base = series[0]?.v;
  if (base == null || base === 0) return series;
  if (mode === 'raw') return series;
  return series.map(p => {
    if (mode === 'pct') return { t: p.t, v: ((p.v - base) / base) * 100 };
    if (mode === 'indexed') return { t: p.t, v: (p.v / base) * 100 };
    return p;
  });
}

function buildCompareSvg(lines, mode) {
  const allPoints = lines.flatMap(line => line.series.map(p => ({ ...p, color: line.color, label: line.label })));
  if (!allPoints.length) return '<p class="chart-empty">No comparable history for selected items.</p>';
  const w = 680;
  const h = 260;
  const pad = { t: 14, r: 18, b: 28, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const minT = Math.min(...allPoints.map(p => p.t));
  const maxT = Math.max(...allPoints.map(p => p.t));
  let minV = Math.min(...allPoints.map(p => p.v));
  let maxV = Math.max(...allPoints.map(p => p.v));
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const spanT = Math.max(maxT - minT, 1);
  const spanV = maxV - minV;
  const x = t => pad.l + ((t - minT) / spanT) * iw;
  const y = v => pad.t + ih - ((v - minV) / spanV) * ih;

  const paths = lines.map(line => {
    const path = line.series.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    return `<path d="${path}" fill="none" stroke="${line.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');

  const yTicks = [minV, (minV + maxV) / 2, maxV];
  const yLabels = yTicks.map(v => {
    const yy = y(v);
    let label = fmt(v, 2);
    if (mode === 'pct') label = `${v.toFixed(2)}%`;
    return `<text x="${pad.l - 8}" y="${yy + 3}" text-anchor="end" fill="#4a5568" font-size="9" font-family="DM Mono, monospace">${label}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${yTicks.map(v => `<line x1="${pad.l}" y1="${y(v).toFixed(1)}" x2="${pad.l + iw}" y2="${y(v).toFixed(1)}" stroke="#252b33" stroke-width="1"/>`).join('')}
    ${paths}
    ${yLabels}
    <text x="${pad.l}" y="${h - 8}" fill="#4a5568" font-size="9" font-family="DM Mono, monospace">${formatChartDate(minT)}</text>
    <text x="${pad.l + iw}" y="${h - 8}" text-anchor="end" fill="#4a5568" font-size="9" font-family="DM Mono, monospace">${formatChartDate(maxT)}</text>
  </svg>`;
}

async function renderCompareChart() {
  const body = document.getElementById('compare-modal-body');
  if (!body) return;
  if (compareState.selected.length < 2) {
    body.textContent = 'Select at least 2 items to compare.';
    return;
  }
  body.textContent = 'Loading compare chart…';
  const lines = [];
  for (let i = 0; i < compareState.selected.length; i++) {
    const parsed = parseCompareKey(compareState.selected[i]);
    if (!parsed) continue;
    const resolved = resolveItem(parsed.itemKey, parsed.sectionKey);
    if (!resolved) continue;
    const rawSeries = await fetchHistory(resolved.item, resolved.section, compareState.days);
    const series = normalizeSeries(rawSeries, compareState.mode);
    if (!series?.length) continue;
    lines.push({
      label: resolved.item.ticker || resolved.item.label,
      color: compareSeriesColor(i),
      series,
    });
  }
  if (lines.length < 2) {
    body.innerHTML = '<p class="chart-empty">Not enough series with history in this range.</p>';
    return;
  }
  const legend = `<div class="compare-legend">${lines.map(l =>
    `<span class="compare-legend-item"><span class="compare-dot" style="background:${l.color}"></span>${escapeHtml(l.label)}</span>`
  ).join('')}</div>`;
  body.innerHTML = buildCompareSvg(lines, compareState.mode) + legend;
}

function renderComparePeriodTabs() {
  const tabs = document.getElementById('compare-period-tabs');
  if (!tabs) return;
  tabs.innerHTML = COMPARE_PERIODS.map(p => `
    <button type="button" data-days="${p.days}" class="${p.days === compareState.days ? 'active' : ''}">${p.label}</button>
  `).join('');
}

function renderCompareModal() {
  const list = document.getElementById('compare-list');
  const selected = document.getElementById('compare-selected');
  const mode = document.getElementById('compare-mode');
  const search = document.getElementById('compare-search');
  if (!list || !selected) return;
  if (mode) mode.value = compareState.mode;
  if (search && search.value !== compareState.query) search.value = compareState.query;

  renderComparePeriodTabs();
  selected.innerHTML = compareState.selected.map(key => {
    const parsed = parseCompareKey(key);
    const resolved = parsed ? resolveItem(parsed.itemKey, parsed.sectionKey) : null;
    if (!resolved) return '';
    const label = `${resolved.item.ticker || resolved.item.label} · ${getSectionName(parsed.sectionKey)}`;
    return `<span class="compare-chip">${escapeHtml(label)} <button type="button" data-compare-remove="${escapeHtml(key)}" aria-label="Remove ${escapeHtml(label)}">×</button></span>`;
  }).join('');
  if (!selected.innerHTML) {
    selected.innerHTML = '<span class="footer-note">No instruments selected yet.</span>';
  }

  const rows = filteredCompareCatalog().slice(0, 200);
  list.innerHTML = rows.map(row => {
    const checked = compareState.selected.includes(row.key);
    const disabled = !checked && compareState.selected.length >= COMPARE_MAX_ITEMS;
    return `<label class="compare-row">
      <input type="checkbox" data-compare-key="${escapeHtml(row.key)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span class="compare-row-name">${escapeHtml(row.label)}</span>
      <span class="compare-row-meta">${escapeHtml(row.ticker)} · ${escapeHtml(row.sectionName)}</span>
    </label>`;
  }).join('');
}

function openCompare() {
  const modal = document.getElementById('compare-modal');
  if (!modal) return;
  compareState.open = true;
  compareState.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  modal.inert = false;
  document.body.style.overflow = 'hidden';
  renderCompareModal();
  void renderCompareChart();
  document.getElementById('compare-search')?.focus();
}

function closeCompare() {
  const modal = document.getElementById('compare-modal');
  if (!modal) return;
  compareState.open = false;
  modal.hidden = true;
  modal.inert = true;
  document.body.style.overflow =
    (document.getElementById('chart-modal')?.hidden === false || document.getElementById('info-modal')?.hidden === false)
      ? 'hidden'
      : '';
  const restore = compareState.returnFocus;
  compareState.returnFocus = null;
  if (restore instanceof HTMLElement && document.contains(restore)) restore.focus({ preventScroll: true });
}

// ── API Key Management ─────────────────────────────
function saveKey() {
  const input = document.getElementById('api-key-input');
  const key = input.value.trim();
  if (!key) return;
  AV_KEY = key;
  localStorage.setItem('av_key', key);
  syncApiBanner();
  loadAll(true);
}

function wireUi() {
  wireAddStockPanel();
  wireAddCommodityPanel();
  document.getElementById('api-banner')?.addEventListener('submit', e => {
    e.preventDefault();
    saveKey();
  });
  document.getElementById('save-key-btn')?.addEventListener('click', e => {
    e.preventDefault();
    saveKey();
  });
  document.getElementById('refresh-btn')?.addEventListener('click', () => loadAll(true));
  const infoToggle = document.getElementById('info-header-toggle');
  infoToggle?.addEventListener('click', toggleInfo);
  infoToggle?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleInfo(); }
  });
  document.querySelectorAll('.section-edit-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => toggleCustomize(btn.dataset.section));
  });
  document.getElementById('api-key-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveKey();
  });

  document.getElementById('info-modal-close')?.addEventListener('click', closeInfoModal);
  document.querySelectorAll('[data-info-close]').forEach(el => {
    el.addEventListener('click', closeInfoModal);
    if (el.classList.contains('info-modal-backdrop')) {
      el.addEventListener('mousedown', e => e.preventDefault());
    }
  });

  document.getElementById('chart-modal-close')?.addEventListener('click', closeChart);
  document.querySelectorAll('[data-chart-close]').forEach(el => {
    el.addEventListener('click', closeChart);
    if (el.classList.contains('chart-modal-backdrop')) {
      el.addEventListener('mousedown', e => e.preventDefault());
    }
  });
  document.getElementById('chart-period-tabs')?.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-days]');
    if (!btn) return;
    chartState.days = Number(btn.dataset.days) || 7;
    syncChartPeriodTabs(chartState.days);
    await loadChartModal();
  });
  document.getElementById('compare-btn')?.addEventListener('click', openCompare);
  document.getElementById('compare-modal-close')?.addEventListener('click', closeCompare);
  document.querySelectorAll('[data-compare-close]').forEach(el => {
    el.addEventListener('click', closeCompare);
  });
  document.getElementById('compare-search')?.addEventListener('input', e => {
    compareState.query = e.target.value || '';
    renderCompareModal();
  });
  document.getElementById('compare-mode')?.addEventListener('change', e => {
    compareState.mode = e.target.value;
    saveComparePrefs();
    void renderCompareChart();
  });
  document.getElementById('compare-period-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-days]');
    if (!btn) return;
    compareState.days = Number(btn.dataset.days) || compareState.days;
    saveComparePrefs();
    renderCompareModal();
    void renderCompareChart();
  });
  document.getElementById('compare-selected')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-compare-remove]');
    if (!btn) return;
    toggleCompareItem(btn.dataset.compareRemove);
  });
  document.getElementById('compare-list')?.addEventListener('change', e => {
    const input = e.target.closest('input[data-compare-key]');
    if (!input) return;
    toggleCompareItem(input.dataset.compareKey);
  });

  document.addEventListener('click', e => {
    const refreshBtn = e.target.closest('.card-refresh');
    if (refreshBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = refreshBtn.closest('.card');
      if (card?.dataset.itemKey && card.dataset.sectionKey) {
        refreshCard(card.dataset.itemKey, card.dataset.sectionKey);
      }
      return;
    }
    const infoBtn = e.target.closest('.card-info');
    if (infoBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (infoBtn.dataset.itemKey && infoBtn.dataset.sectionKey) {
        openInfoModal(infoBtn.dataset.itemKey, infoBtn.dataset.sectionKey);
      }
      return;
    }
    const chartBtn = e.target.closest('.card-chart');
    if (chartBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (chartBtn.dataset.itemKey && chartBtn.dataset.sectionKey) {
        openChart(chartBtn.dataset.itemKey, chartBtn.dataset.sectionKey);
      }
      return;
    }
    const sourcesBtn = e.target.closest('.section-sources-btn[data-section]');
    if (sourcesBtn) {
      toggleSectionSources(sourcesBtn.dataset.section);
      return;
    }
    const overviewBtn = e.target.closest('[data-overview-section][data-overview-key]');
    if (overviewBtn) {
      toggleOverviewRef({
        sectionKey: overviewBtn.dataset.overviewSection,
        itemKey: overviewBtn.dataset.overviewKey,
      });
      return;
    }
    const pill = e.target.closest('.sym-pill');
    if (pill?.dataset.symKey) {
      toggleSym(pill.dataset.symKey, pill.dataset.sectionKey);
      return;
    }
    const glanceMove = e.target.closest('[data-overview-section][data-overview-key][data-move-dir]');
    if (glanceMove?.dataset.overviewSection) {
      moveOverviewRef(
        glanceMove.dataset.overviewSection,
        glanceMove.dataset.overviewKey,
        Number(glanceMove.dataset.moveDir || 0),
      );
      return;
    }
    const moveBtn = e.target.closest('[data-move-key][data-move-dir]');
    if (moveBtn?.dataset.moveKey) {
      const dir = Number(moveBtn.dataset.moveDir || 0);
      moveSym(moveBtn.dataset.moveKey, moveBtn.dataset.sectionKey, dir);
      return;
    }
    const providerBtn = e.target.closest('.info-btn[data-provider]');
    if (providerBtn && !providerBtn.disabled) setProvider(providerBtn.dataset.provider);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('info-modal')?.hidden) {
        closeInfoModal();
        return;
      }
      if (!document.getElementById('chart-modal')?.hidden) {
        closeChart();
        return;
      }
      if (!document.getElementById('compare-modal')?.hidden) {
        closeCompare();
        return;
      }
    }
    if (!(e.target instanceof Element)) return;
    const chartBtn = e.target.closest('.card-chart');
    if (chartBtn?.dataset.itemKey && chartBtn.dataset.sectionKey) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openChart(chartBtn.dataset.itemKey, chartBtn.dataset.sectionKey);
      }
    }
  });
}

async function init() {
  renderSectionExplainers();
  wireUi();
  loadComparePrefs();
  loadVIS();
  loadSectionOrder();
  loadCustomEquities();
  loadCustomCommodities();
  syncEquitiesSection();
  syncCommoditiesSection();
  for (const section of SECTIONS) applySectionOrder(section);
  loadOverviewRefs();
  const saved = localStorage.getItem('av_key');
  if (saved && saved !== 'YOUR_API_KEY_HERE') {
    AV_KEY = saved;
    document.getElementById('api-key-input').value = saved;
  }
  syncApiBanner();
  updateDateLine();
  startMarketHoursClock();
  renderInfoBox();
  updateApiUsageDisplay();
  beginPageLoad();
  if (shouldOptimisticLocalProxy()) {
    setOptimisticLocalProxy();
    void detectLocalProxy();
  } else {
    await detectLocalProxy();
  }
  startValuationPrefetch(false);
  await loadAll(false);
}

init();
