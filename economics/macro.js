// ─────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────
let AV_KEY = 'YOUR_API_KEY_HERE';

// ── Cache (5-min TTL) ─────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;

// ── Load throttle (per-browser, limits refresh spam / bots) ──
const REFRESH_MIN_GAP_MS = 60 * 1000;
const REFRESH_MAX_PER_HOUR = 15;
const PAGE_LOAD_MIN_GAP_MS = 20 * 1000;
const PAGE_LOAD_MAX_PER_HOUR = 30;
const CARD_REFRESH_MIN_GAP_MS = 15 * 1000;
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
function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`mmd:${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return (Date.now() - ts < CACHE_TTL) ? data : null;
  } catch { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem(`mmd:${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
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
function getItemKey(item) {
  if (item.id)   return item.id;
  if (item.from) return `${item.from}${item.to}`;
  return item.sym;
}
function isOn(item) { const k = getItemKey(item); return k in VIS ? VIS[k] : item.def; }
function visOf(items) { return items.filter(isOn); }

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

function syncEquitiesSection() {
  const section = SECTIONS.find(s => s.key === 'eq');
  if (section) section.items = [...EQUITIES, ...CUSTOM_EQUITIES];
}

function equitySymbolSet() {
  const s = new Set();
  for (const item of [...EQUITIES, ...CUSTOM_EQUITIES]) s.add(item.sym);
  return s;
}

function catalogEntryToEquity(entry) {
  return {
    sym: entry.sym,
    label: entry.label,
    ticker: entry.ticker || entry.sym.replace(/\.AX$/, '').split('-')[0],
    def: true,
    dp: 2,
    custom: true,
  };
}

const EQUITIES = [
  { sym: '^GSPC', label: 'S&P 500',           ticker: 'SPX',   def: true,  dp: 2 },
  { sym: '^IXIC', label: 'NASDAQ Composite',  ticker: 'COMP',  def: true,  dp: 2 },
  { sym: '^NDX',  label: 'NASDAQ 100',        ticker: 'NDX',   def: true,  dp: 2 },
  { sym: '^DJI',  label: 'Dow Jones',         ticker: 'DJI',   def: true,  dp: 2 },
  { sym: '^RUT',  label: 'Russell 2000',      ticker: 'RUT',   def: true,  dp: 2 },
  { sym: '^AXJO', label: 'ASX 200',           ticker: 'AXJO',  def: true,  dp: 2 },
  { sym: '^AORD', label: 'ASX All Ords',      ticker: 'AORD',  def: true,  dp: 2 },
  { sym: 'EEM',   label: 'Emerg. Markets', ticker: 'EEM',   def: false, dp: 2 },
  { sym: 'VGK',   label: 'Europe',         ticker: 'VGK',   def: false, dp: 2 },
  { sym: 'EWJ',   label: 'Japan',          ticker: 'EWJ',   def: false, dp: 2 },
  { sym: 'VIXY',  label: 'VIX (Proxy)',    ticker: 'VIXY',  def: false, dp: 2 },
  { sym: 'ARKK',  label: 'ARK Innov.',     ticker: 'ARKK',  def: false, dp: 2 },
];

// FRED-based valuation / debt (GDP & debt levels in billions USD from FRED)
const VALUATION = [
  { id: 'buffett',      label: 'Buffett Indicator', ticker: 'BI',  def: true  },
  { id: 'us-gdp',       label: 'US GDP',            ticker: 'GDP', def: true  },
  { id: 'public-debt',  label: 'US Public Debt',    ticker: 'PUB', def: true  },
  { id: 'private-debt', label: 'US Private Debt',   ticker: 'PRV', def: true  },
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
    href: 'https://www.finra.org/finra-data/browse-catalog/margin-statistics',
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
    href: 'https://www.bis.org/statistics/dt20.htm',
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
    href: 'https://www.bis.org/statistics/dt20.htm',
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
  { sym: 'GC=F', label: 'Gold',        ticker: 'GC',   def: true,  dp: 2 },
  { sym: 'SI=F', label: 'Silver',      ticker: 'SI',   def: true,  dp: 2 },
  { sym: 'CL=F', label: 'Oil (WTI)',   ticker: 'WTI',  def: true,  dp: 2 },
  { sym: 'BZ=F', label: 'Brent Crude', ticker: 'BRENT', def: true,  dp: 2 },
  { sym: 'NG=F', label: 'Nat. Gas',    ticker: 'NG',   def: true,  dp: 2 },
  { sym: 'CPER', label: 'Copper (ETF)', ticker: 'CPER', def: false, dp: 2 },
  { sym: 'WEAT', label: 'Wheat (ETF)',  ticker: 'WEAT', def: false, dp: 2 },
  { sym: 'CORN', label: 'Corn (ETF)',   ticker: 'CORN', def: false, dp: 2 },
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
    fetch: (item, force) => fetchQuote(item.sym, force),
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
    card:  (item, d) => {
      const dp = item.to === 'JPY' ? 2 : 4;
      return { ticker: `${item.from}/${item.to}`, label: item.label,
        price: d ? fmt(d.price, dp) : null, change: d ? d.change : null, pct: d ? d.pct : null };
    },
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

function quoteDecimals(item, sectionKey) {
  if (sectionKey === 'crypto') return item.dp ?? 2;
  if (sectionKey === 'fx') return item.to === 'JPY' ? 2 : 4;
  return item.dp ?? 2;
}

function formatQuotePrice(d, item, sectionKey) {
  if (!d || d.price == null || Number.isNaN(Number(d.price))) return null;
  return fmt(d.price, quoteDecimals(item, sectionKey));
}

function formatQuoteCard(item, d, sectionKey) {
  return {
    ticker: item.ticker,
    label: item.label,
    price: formatQuotePrice(d, item, sectionKey),
    change: d ? d.change : null,
    pct: d ? d.pct : null,
  };
}
function cardClass(pct) { return pct === null ? 'neu' : pct >= 0 ? 'up' : 'dn'; }
function pillClass(pct) { return pct === null ? 'neu' : pct >= 0 ? 'up' : 'dn'; }
function pillText(pct) {
  if (pct === null) return '–';
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
}

const CARD_LOADING = new Set();

function cardIsFailed(meta) {
  if (meta.failed != null) return meta.failed;
  return meta.price === null || meta.price === '–';
}

function renderCard(meta, delay = 0) {
  const cls = cardClass(meta.pct);
  const priceStr = meta.price !== null && meta.price !== '' ? meta.price : '–';
  const absStr = meta.isUsd
    ? formatUsdChange(meta.change)
    : (meta.isYield || meta.isRatio)
      ? formatYieldChange(meta.change)
      : (meta.change !== null ? `${sign(meta.change)}${fmt(meta.change)}` : '');
  const failed = cardIsFailed(meta);
  const loading = CARD_LOADING.has(meta.itemKey);
  const refreshLabel = `Refresh ${escapeHtml(meta.label)}`;
  const chartLabel = `View ${escapeHtml(meta.label)} chart`;
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
  const actions = `<div class="card-actions">${chartBtn}${refreshBtn}</div>`;
  const mainInner = `
      <div class="card-ticker">${escapeHtml(meta.ticker)}</div>
      <div class="card-name">${escapeHtml(meta.label)}</div>
      <div class="card-price">${priceStr}</div>
      <div class="card-change">
        ${meta.pillLabel != null
    ? `<span class="pill neu">${escapeHtml(meta.pillLabel)}</span>`
    : `<span class="pill ${pillClass(meta.pct)}">${pillText(meta.pct)}</span>`}
        ${absStr ? `<span class="card-abs">${absStr}</span>` : ''}
      </div>
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
    active < 4 ? go() : queue.push(go);
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
  if (!LOCAL_PROXY_OK) return null;
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

async function detectLocalProxy() {
  LOCAL_PROXY_OK = false;
  LOCAL_FRED_PROXY_OK = false;

  const yahooProbe = `${location.origin}/economics/proxy/yahoo?${new URLSearchParams({ sym: '^GSPC', range: '1d' })}`;
  try {
    const r = await fetchWithTimeout(yahooProbe, {}, 8000);
    if (r.ok) LOCAL_PROXY_OK = true;
  } catch {}

  const fredProbe = `${location.origin}/economics/proxy/fred?${new URLSearchParams({ id: 'DGS2', start: '2025-01-01' })}`;
  try {
    const r = await fetchWithTimeout(fredProbe, {}, 12000);
    if (r.ok) {
      const ct = r.headers.get('content-type') || '';
      const body = await r.text();
      const rows = parseFredResponseBody(body, ct);
      if (rows?.length) LOCAL_FRED_PROXY_OK = true;
    }
  } catch {}

  const valHealth = `${location.origin}/economics/proxy/valuation/health`;
  try {
    const rv = await fetchWithTimeout(valHealth, {}, 8000);
    if (rv.ok) LOCAL_VALUATION_PROXY_OK = true;
  } catch {}
  // Production nginx: Yahoo proxy up implies valuation route exists (BIS pulls are slow).
  if (!LOCAL_VALUATION_PROXY_OK && LOCAL_PROXY_OK) LOCAL_VALUATION_PROXY_OK = true;
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

async function fetchRemote(canonicalUrl, { asJson = true } = {}) {
  const attempts = [];
  const corsOnly = isCorsProxiedHost(canonicalUrl);
  const localUrl = localProxyUrl(parseRemoteTarget(canonicalUrl));

  if (localUrl) {
    attempts.push(async () => {
      const r = await fetchWithTimeout(localUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  if (!corsOnly) {
    attempts.push(async () => {
      const r = await fetchWithTimeout(canonicalUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  for (const url of publicProxyUrls(canonicalUrl)) {
    attempts.push(async () => {
      const r = await fetchWithTimeout(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  attempts.push(async () => {
    const r = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(canonicalUrl)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const wrap = await r.json();
    const body = wrap.contents;
    return asJson ? JSON.parse(body) : body;
  });

  if (corsOnly && !LOCAL_PROXY_OK) {
    attempts.push(async () => {
      const direct = canonicalUrl.includes('query1.finance.yahoo.com')
        ? yahooChartUrlDirect(canonicalUrl)
        : canonicalUrl;
      const r = await fetchWithTimeout(direct);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
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
  const change = (price != null && prevClose != null) ? price - prevClose : null;
  const pct = (change != null && prevClose) ? (change / prevClose) * 100 : null;
  return { price, change, pct };
}

function formatYieldPrice(d) {
  if (!d || d.price == null || Number.isNaN(Number(d.price))) return null;
  return `${Number(d.price).toFixed(2)}%`;
}

function formatYieldChange(change) {
  if (change == null || Number.isNaN(change)) return '';
  const v = Number(change);
  return `${sign(v)}${Math.abs(v).toFixed(2)} pp`;
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
  'CL=F':   { path: 'CLW00:NYMEX',      ticker: 'CLW00', exchange: 'NYMEX' },
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
    return html ? parseGoogleFinanceHtml(html, meta.ticker, meta.exchange) : null;
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
      const result = { today: d.rates[dates[dates.length - 1]], prev: d.rates[dates[dates.length - 2]] };
      cacheSet(key, result);
      _fxPromise = null;
      return result;
    });
  return _fxPromise;
}

async function fetchFXFrank(from, to) {
  const { today, prev } = await loadFrankfurter();
  const rate = (rates, base, sym) => base === 'USD' ? rates[sym] : (1 / rates[base]);
  const price     = rate(today, from, to);
  const prevPrice = rate(prev,  from, to);
  if (!price) return null;
  const change = prevPrice ? price - prevPrice : null;
  const pct    = (change !== null && prevPrice) ? (change / prevPrice) * 100 : null;
  return { price, change, pct };
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
    const result = {};
    for (const [sym, cgId] of Object.entries(CG_IDS)) {
      const item = d[cgId];
      if (!item) continue;
      const price = item.usd;
      const pct   = item.usd_24h_change ?? null;
      const change = pct !== null ? price * pct / (100 + pct) : null;
      result[sym] = { price, change, pct };
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
  return {
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    pct: parseFloat(q['10. change percent'].replace('%', '')),
  };
}

async function avFX(from, to) {
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${AV_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.Note || d.Information) throw new Error('Rate limit');
  const info = d['Realtime Currency Exchange Rate'];
  if (!info) return null;
  return { price: parseFloat(info['5. Exchange Rate']), change: null, pct: null };
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
    const result = usesFrankfurterFx()
      ? await fetchFXFrank(from, to)
      : await avFX(from, to);
    if (result) cacheSet(key, result);
    return result;
  } catch { return null; }
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

function buffettRatio(capMillions, gdpBillions) {
  return (capMillions / 1000 / gdpBillions) * 100;
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

function latestFredRow(rows) {
  return rows?.length ? rows[rows.length - 1] : null;
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

function valuationReferenceExtra(item, live = null) {
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
  if (live?.asOf) {
    html += `<div class="yield-extra"><span class="spread-label">As of</span>
      <span class="spread-val">${escapeHtml(live.asOf)}</span></div>`;
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

async function fetchValuationLive(metricId, force = false) {
  const item = VALUATION.find(v => v.id === metricId && v.api);
  if (!item) return null;
  const key = `val-live:${metricId}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    const url = `${location.origin}/economics/proxy/valuation?${new URLSearchParams({ metric: metricId })}`;
    const r = await fetchWithTimeout(url, {}, 90000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data?.error) throw new Error(data.error);
    const result = { ...data, live: true };
    cacheSet(key, result);
    return result;
  } catch (err) {
    console.warn('valuation live fetch failed', metricId, err);
    return null;
  }
}

function fredRowsToQuote(rows) {
  if (!rows?.length) return null;
  const last = rows[rows.length - 1].v;
  const prev = rows.length > 1 ? rows[rows.length - 2].v : null;
  const change = prev != null ? last - prev : null;
  const pct = (change != null && prev) ? (change / prev) * 100 : null;
  return { price: last, change, pct };
}

async function fetchFredSeriesRows(seriesId, start) {
  if (LOCAL_FRED_PROXY_OK) {
    try {
      const r = await fetchWithTimeout(localFredProxyUrl(seriesId, start), {}, 20000);
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        const body = await r.text();
        const rows = parseFredResponseBody(body, ct);
        if (rows?.length) return rows;
      }
    } catch {}
  }
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&observation_start=${start}`;
  const txt = await fetchRemote(url, { asJson: false });
  return txt ? parseFredCsvRows(txt) : null;
}

const VAL_FRED_IDS = ['GDP', 'NCBEILQ027S', 'GFDEGDQ188S', 'TCMDO', 'FGSDODNS'];
let valuationFredPromise = null;

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

async function loadValuationFredRows(force = false, lookbackDays = 5 * 365) {
  const batchKey = lookbackDays === 5 * 365 ? 'val:fred-batch' : `val:fred-batch:${lookbackDays}`;
  if (!force) {
    const cached = cacheGet(batchKey);
    if (cached) return cached;
  }
  const start = fredStartDate(lookbackDays);
  const pairs = await Promise.all(
    VAL_FRED_IDS.map(async seriesId => [seriesId, await fetchFredSeriesRows(seriesId, start)])
  );
  const data = Object.fromEntries(pairs);
  cacheSet(batchKey, data);
  return data;
}

function getValuationFredRows(force = false) {
  if (!valuationFredPromise || force) {
    valuationFredPromise = loadValuationFredRows(force);
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
  const last = ratios[ratios.length - 1].ratio;
  const prev = ratios.length > 1 ? ratios[ratios.length - 2].ratio : null;
  const change = prev != null ? last - prev : null;
  const pct = (change != null && prev) ? (change / prev) * 100 : null;
  return { price: last, change, pct };
}

async function fetchValuation(metricId, force = false) {
  if (isValuationLive(metricId)) {
    const live = await fetchValuationLive(metricId, force);
    if (live) return live;
    const item = VALUATION.find(v => v.id === metricId);
    return item ? { display: item.fallbackDisplay, static: true, fallback: true } : null;
  }

  const key = `val:${metricId}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    const fred = await getValuationFredRows(force);
    let result = null;
    if (metricId === 'buffett') {
      result = quoteFromRatioSeries(buildBuffettRatios(fred.NCBEILQ027S, fred.GDP));
    } else if (metricId === 'us-gdp') {
      result = fredRowsToQuote(fred.GDP);
    } else if (metricId === 'public-debt') {
      result = fredRowsToQuote(fred.GFDEGDQ188S);
      if (result) result.usdBillions = federalDebtBillions(fred);
    } else if (metricId === 'private-debt') {
      result = quoteFromRatioSeries(buildPrivateDebtRatios(fred.TCMDO, fred.FGSDODNS, fred.GDP));
      if (result) result.usdBillions = privateDebtBillions(fred);
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
    const last = parseFloat(lines[lines.length - 1].split(',')[1]);
    const prev = parseFloat(lines[lines.length - 2].split(',')[1]);
    if (isNaN(last)) return null;
    const change = !isNaN(prev) ? last - prev : null;
    const pct = (change !== null && prev) ? (change / prev) * 100 : null;
    return { price: last, change, pct };
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
function renderGrid(id, items) {
  document.getElementById(id).innerHTML = items.map((d, i) => renderCard(d, i * 0.06)).join('');
}

function renderSectionGrid(section) {
  const visible = visOf(section.items);

  if (section.key === 'val') {
    renderGrid(section.gridId, visible.map(item => {
      const d = DATA[item.id];
      let price = null;
      let extra = '';
      let isRatio = false;
      let isUsd = false;

      if (item.api) {
        const d = DATA[item.id];
        const display = d?.display || item.fallbackDisplay || '–';
        return {
          ticker: item.ticker,
          label: item.label,
          price: display,
          change: d?.change ?? null,
          pct: d?.pct ?? null,
          extra: valuationReferenceExtra(item, d?.live ? d : null),
          itemKey: item.id,
          sectionKey: section.key,
          failed: false,
          pillLabel: d?.live ? 'Live' : (d?.fallback ? 'Ref' : null),
          noChart: true,
          cardClassExtra: 'card--reference',
        };
      }

      if (item.id === 'us-gdp') {
        isUsd = true;
        price = formatUsdCompact(d?.price);
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
        itemKey: item.id,
        sectionKey: section.key,
        failed: !d || !price,
      }, item, section.key);
    }));
    return;
  }

  if (section.key === 'bond') {
    const b2  = DATA['DGS2']  ? DATA['DGS2'].price  : null;
    const b10 = DATA['^TNX']  ? DATA['^TNX'].price  : null;
    renderGrid(section.gridId, visible.map(item => {
      const d = DATA[item.id];
      let extra = '';
      if (item.id === '^TNX' && b2 !== null && b10 !== null) {
        const spread = (b10 - b2).toFixed(2);
        const cls = spread >= 0 ? 'spread-pos' : 'spread-neg';
        extra = `<div class="yield-extra"><span class="spread-label">2s10s spread</span>
          <span class="spread-val ${cls}">${spread >= 0 ? '+' : ''}${spread}%</span></div>`;
      }
      return withGoogleUrl({ ticker: item.ticker, label: item.label,
        price: formatYieldPrice(d),
        change: d ? d.change : null, pct: d ? d.pct : null, extra,
        isYield: true,
        itemKey: item.id, sectionKey: section.key, failed: !d || !formatYieldPrice(d) }, item, section.key);
    }));
    return;
  }

  renderGrid(section.gridId, visible.map(item => {
    const k = getItemKey(item);
    const d = DATA[k];
    const card = section.card(item, d);
    return withGoogleUrl({ ...card, itemKey: k, sectionKey: section.key, failed: !d }, item, section.key);
  }));
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
  const pct = d.pct != null ? `${sign(d.pct)}${Math.abs(d.pct).toFixed(2)}%` : '';
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
    ? (addStockState.preview.pct >= 0 ? 'up' : 'dn')
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
            <span class="add-stock-option-ticker">${escapeHtml(e.ticker || e.sym)}</span>
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

function renderCust(section) {
  const el = document.getElementById(section.custId);
  if (!el) return;
  el.innerHTML = section.items.map(item => {
    const k = getItemKey(item);
    const on = isOn(item);
    const lbl = item.ticker || `${item.from}/${item.to}`;
    return `<button type="button" class="sym-pill ${on ? 'on' : 'off'}" data-sym-key="${k}" data-section-key="${section.key}">${lbl}</button>`;
  }).join('');
  if (section.key === 'eq' && el.style.display !== 'none') renderAddStockPanel();
  else document.getElementById('add-stock-panel')?.remove();
}

function toggleCustomize(sectionKey) {
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

// ── Market Hours ──────────────────────────────────
function updateMarketStatus() {
  const now = new Date();
  // Use Intl to get true Eastern Time (handles DST automatically)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now).map(p => [p.type, p.value])
  );
  const h = parseInt(parts.hour), m = parseInt(parts.minute);
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday] ?? -1;

  const isWeekday = day > 0 && day < 6;
  const afterOpen = h > 9 || (h === 9 && m >= 30);
  const beforeClose = h < 16;
  const open = isWeekday && afterOpen && beforeClose;

  document.getElementById('mkt-dot').className = `dot ${open ? 'open' : 'closed'}`;
  document.getElementById('mkt-label').textContent = open
    ? 'NYSE / NASDAQ: Open'
    : `NYSE / NASDAQ: Closed · Opens ${(day === 5 || day === 6 || day === 0) ? 'Monday' : 'Today'} 09:30 ET`;
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

  btn.classList.add('spinning');
  status.className = 'status-line';
  status.textContent = throttleNote ? 'Loading cached data…' : 'Loading…';
  updateDateLine();
  updateMarketStatus();

  if (effectiveForce && activeProvider === 'alphavantage') {
    const eqItems = SECTIONS.find(s => s.key === 'eq')?.items || EQUITIES;
    trackApiCall(visOf(eqItems).length + visOf(COMMODITIES).length + visOf(FX_PAIRS).length);
    updateApiUsageDisplay();
  }

  // Valuation: one batched FRED load, then fill all cards (avoids duplicate parallel FRED calls).
  const valSection = SECTIONS.find(s => s.key === 'val');
  if (valSection && visOf(valSection.items).length) {
    if (effectiveForce) valuationFredPromise = null;
    await getValuationFredRows(effectiveForce);
  }

  await Promise.all(SECTIONS.map(async section => {
    const visible = visOf(section.items);
    if (!visible.length) return;
    const results = await Promise.all(visible.map(item => section.fetch(item, effectiveForce)));
    visible.forEach((item, i) => { if (results[i]) DATA[getItemKey(item)] = results[i]; });
    renderSectionGrid(section);
    renderCust(section);
  }));

  btn.classList.remove('spinning');
  if (force) setRefreshButtonBlocked(true, REFRESH_MIN_GAP_MS);
  const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const eqItems = SECTIONS.find(s => s.key === 'eq')?.items || EQUITIES;
  const eqVisible = visOf(eqItems);
  const allEqFailed = eqVisible.length > 0 && eqVisible.every(e => !DATA[getItemKey(e)]);
  if (allEqFailed) {
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
  if (section.key === 'eq' || section.key === 'comm') {
    return fetchYahooHistory(item.sym, days);
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
    const ratios = buildBuffettRatios(fred.NCBEILQ027S, fred.GDP);
    series = ratios?.map(r => ({ t: r.t, v: r.ratio })) ?? null;
  } else if (metricId === 'us-gdp') {
    series = fred.GDP?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  } else if (metricId === 'public-debt') {
    series = fred.GFDEGDQ188S?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  } else if (metricId === 'private-debt') {
    const ratios = buildPrivateDebtRatios(fred.TCMDO, fred.FGSDODNS, fred.GDP);
    series = ratios?.map(r => ({ t: r.t, v: r.ratio })) ?? null;
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
  const chg = last.v - first.v;
  const chgPct = first.v ? (chg / first.v) * 100 : 0;
  const up = chg >= 0;
  const stroke = up ? '#34d399' : '#f87171';
  const pctDp = opts.pctDp ?? dp;
  const fmtV = v => {
    if (opts.usdBillions) return formatUsdCompact(v) || '–';
    if (isPercent) return `${v.toFixed(pctDp)}%`;
    return fmt(v, dp);
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
    <div><div class="chart-stat-label">Period change</div><div class="chart-stat-val ${up ? 'up' : 'dn'}">${sign(chg)}${fmtV(Math.abs(chg))} (${sign(chgPct)}${Math.abs(chgPct).toFixed(2)}%)</div></div>
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
  if (section.key === 'val') {
    const pctDp = item.id === 'buffett' ? 0 : 1;
    return { isPercent: true, dp: 2, pctDp, quarterlyNote: true };
  }
  const isPercent = section.key === 'bond';
  const dp = quoteDecimals(item, section.key);
  return { isPercent, dp };
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
  document.body.style.overflow = '';
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
  document.getElementById('save-key-btn')?.addEventListener('click', saveKey);
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
    const chartBtn = e.target.closest('.card-chart');
    if (chartBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (chartBtn.dataset.itemKey && chartBtn.dataset.sectionKey) {
        openChart(chartBtn.dataset.itemKey, chartBtn.dataset.sectionKey);
      }
      return;
    }
    const pill = e.target.closest('.sym-pill');
    if (pill?.dataset.symKey) {
      toggleSym(pill.dataset.symKey, pill.dataset.sectionKey);
      return;
    }
    const providerBtn = e.target.closest('.info-btn[data-provider]');
    if (providerBtn && !providerBtn.disabled) setProvider(providerBtn.dataset.provider);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('chart-modal')?.hidden) {
      closeChart();
      return;
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
  wireUi();
  loadVIS();
  loadCustomEquities();
  syncEquitiesSection();
  const saved = localStorage.getItem('av_key');
  if (saved && saved !== 'YOUR_API_KEY_HERE') {
    AV_KEY = saved;
    document.getElementById('api-key-input').value = saved;
  }
  syncApiBanner();
  updateDateLine();
  updateMarketStatus();
  renderInfoBox();
  updateApiUsageDisplay();
  await detectLocalProxy();
  loadAll(false);
}

init();
