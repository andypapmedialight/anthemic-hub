// ─────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────
let AV_KEY = 'YOUR_API_KEY_HERE';

// ── Cache (5-min TTL) ─────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;
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
let activeProvider = localStorage.getItem('mmd:provider') || 'yahoo';
function setProvider(p) {
  activeProvider = p;
  localStorage.setItem('mmd:provider', p);
  renderInfoBox();
  updateApiUsageDisplay();
  const avNeedsKey = p === 'alphavantage' && AV_KEY === 'YOUR_API_KEY_HERE';
  document.getElementById('api-banner').style.display = avNeedsKey ? 'flex' : 'none';
  loadAll(true);
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
const EQUITIES = [
  { sym: '^GSPC', label: 'S&P 500',        ticker: 'SPX',   def: true,  dp: 2 },
  { sym: '^NDX',  label: 'NASDAQ 100',     ticker: 'NDX',   def: true,  dp: 2 },
  { sym: '^DJI',  label: 'Dow Jones',      ticker: 'DJI',   def: true,  dp: 2 },
  { sym: '^RUT',  label: 'Russell 2000',   ticker: 'RUT',   def: true,  dp: 2 },
  { sym: '^AXJO', label: 'ASX 200',        ticker: 'AXJO',  def: true,  dp: 2 },
  { sym: 'EEM',   label: 'Emerg. Markets', ticker: 'EEM',   def: false, dp: 2 },
  { sym: 'VGK',   label: 'Europe',         ticker: 'VGK',   def: false, dp: 2 },
  { sym: 'EWJ',   label: 'Japan',          ticker: 'EWJ',   def: false, dp: 2 },
  { sym: 'VIXY',  label: 'VIX (Proxy)',    ticker: 'VIXY',  def: false, dp: 2 },
  { sym: 'ARKK',  label: 'ARK Innov.',     ticker: 'ARKK',  def: false, dp: 2 },
];

// FRED-based valuation / debt ratios (% of GDP unless noted)
const VALUATION = [
  { id: 'buffett',      label: 'Buffett Indicator', ticker: 'BI',  def: true  },
  { id: 'public-debt',  label: 'US Public Debt',    ticker: 'PUB', def: true  },
  { id: 'private-debt', label: 'US Private Debt',   ticker: 'PRV', def: true  },
];

const COMMODITIES = [
  { sym: 'GC=F', label: 'Gold',        ticker: 'GC',   def: true,  dp: 2 },
  { sym: 'SI=F', label: 'Silver',      ticker: 'SI',   def: true,  dp: 2 },
  { sym: 'CL=F', label: 'Oil (WTI)',   ticker: 'WTI',  def: true,  dp: 2 },
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
  { id: 'DGS2',   label: 'US 2Y Yield',    ticker: '2Y',  def: true,  yTicker: null   },
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
  const absStr = (meta.isYield || meta.isRatio)
    ? formatYieldChange(meta.change)
    : (meta.change !== null ? `${sign(meta.change)}${fmt(meta.change)}` : '');
  const failed = cardIsFailed(meta);
  const loading = CARD_LOADING.has(meta.itemKey);
  const refreshLabel = `Refresh ${meta.label}`;
  return `
    <div class="card card--clickable ${cls}${failed ? ' card--failed' : ''}${loading ? ' card--loading' : ''}"
         style="animation-delay:${delay}s"
         data-item-key="${meta.itemKey}"
         data-section-key="${meta.sectionKey}"
         tabindex="0"
         role="button"
         aria-label="View ${meta.label} chart">
      <button type="button" class="card-refresh" aria-label="${refreshLabel}" title="${refreshLabel}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>
      <div class="card-ticker">${meta.ticker}</div>
      <div class="card-name">${meta.label}</div>
      <div class="card-price">${priceStr}</div>
      <div class="card-change">
        <span class="pill ${pillClass(meta.pct)}">${pillText(meta.pct)}</span>
        ${absStr ? `<span class="card-abs">${absStr}</span>` : ''}
      </div>
      ${meta.extra || ''}
    </div>`;
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

/** Yahoo chart URL with raw symbol in path. */
function yahooChartUrl(sym, range = '5d') {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=${range}`;
}

function yahooChartUrlDirect(canonicalUrl) {
  return canonicalUrl.replace(/\/chart\/([^?]+)/, (_, s) => `/chart/${encodeURIComponent(s)}`);
}

function isCorsProxiedHost(url) {
  return /^https:\/\/(query1\.finance\.yahoo\.com|fred\.stlouisfed\.org)\//.test(url);
}

function parseRemoteTarget(canonicalUrl) {
  try {
    const u = new URL(canonicalUrl);
    if (u.hostname === 'query1.finance.yahoo.com') {
      const sym = decodeURIComponent(u.pathname.split('/').pop() || '');
      const range = u.searchParams.get('range') || '5d';
      return { type: 'yahoo', sym, range };
    }
    if (u.hostname === 'fred.stlouisfed.org') {
      return {
        type: 'fred',
        id: u.searchParams.get('id') || '',
        start: u.searchParams.get('observation_start') || '',
      };
    }
  } catch {}
  return { type: 'raw', url: canonicalUrl };
}

function localProxyUrl(target) {
  if (!LOCAL_PROXY_OK) return null;
  const base = location.origin;
  if (target.type === 'yahoo') {
    const p = new URLSearchParams({ sym: target.sym, range: target.range });
    return `${base}/economics/proxy/yahoo?${p}`;
  }
  if (target.type === 'fred') {
    const p = new URLSearchParams({ id: target.id, start: target.start });
    return `${base}/economics/proxy/fred?${p}`;
  }
  return null;
}

async function detectLocalProxy() {
  const probe = `${location.origin}/economics/proxy/yahoo?${new URLSearchParams({ sym: '^GSPC', range: '1d' })}`;
  try {
    const r = await fetch(probe);
    if (r.ok) {
      LOCAL_PROXY_OK = true;
      return;
    }
  } catch {}
  LOCAL_PROXY_OK = false;
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
      const r = await fetch(localUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  if (!corsOnly) {
    attempts.push(async () => {
      const r = await fetch(canonicalUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  for (const url of publicProxyUrls(canonicalUrl)) {
    attempts.push(async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  attempts.push(async () => {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(canonicalUrl)}`);
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
      const r = await fetch(direct);
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
    const result = activeProvider === 'yahoo' ? await yahooChart(sym) : await avQuote(sym);
    if (result) cacheSet(key, result);
    return result;
  } catch { return null; }
}

async function fetchFX(from, to, force = false) {
  const key = `${activeProvider}:fx:${from}:${to}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  try {
    // Yahoo mode: use Frankfurter.dev (CORS-friendly); AV mode: Alpha Vantage
    const result = activeProvider === 'yahoo'
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

function fredRowsToQuote(rows) {
  if (!rows?.length) return null;
  const last = rows[rows.length - 1].v;
  const prev = rows.length > 1 ? rows[rows.length - 2].v : null;
  const change = prev != null ? last - prev : null;
  const pct = (change != null && prev) ? (change / prev) * 100 : null;
  return { price: last, change, pct };
}

async function fetchFredSeriesRows(seriesId, start) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&observation_start=${start}`;
  const txt = await fetchRemote(url, { asJson: false });
  return txt ? parseFredCsvRows(txt) : null;
}

async function fetchBuffettRatios(start) {
  const [capRows, gdpRows] = await Promise.all([
    fetchFredSeriesRows('NCBEILQ027S', start),
    fetchFredSeriesRows('GDP', start),
  ]);
  if (!capRows?.length || !gdpRows?.length) return null;
  const gdpMap = new Map(gdpRows.map(r => [r.date, r.v]));
  const ratios = [];
  for (const row of capRows) {
    const gdp = gdpMap.get(row.date);
    if (gdp == null || gdp <= 0) continue;
    ratios.push({
      date: row.date,
      t: new Date(row.date).getTime(),
      ratio: buffettRatio(row.v, gdp),
    });
  }
  return ratios.length ? ratios : null;
}

async function fetchPrivateDebtRatios(start) {
  const [totalRows, fedRows, gdpRows] = await Promise.all([
    fetchFredSeriesRows('TCMDO', start),
    fetchFredSeriesRows('FGSDODNS', start),
    fetchFredSeriesRows('GDP', start),
  ]);
  if (!totalRows?.length || !fedRows?.length || !gdpRows?.length) return null;
  const fedMap = new Map(fedRows.map(r => [r.date, r.v]));
  const gdpMap = new Map(gdpRows.map(r => [r.date, r.v]));
  const ratios = [];
  for (const row of totalRows) {
    const fed = fedMap.get(row.date);
    const gdp = gdpMap.get(row.date);
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

async function fetchValuation(metricId, force = false) {
  const key = `val:${metricId}`;
  if (!force) { const c = cacheGet(key); if (c) return c; }
  const start = new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10);
  try {
    let result = null;
    if (metricId === 'buffett') {
      const ratios = await fetchBuffettRatios(start);
      if (!ratios?.length) return null;
      const last = ratios[ratios.length - 1].ratio;
      const prev = ratios.length > 1 ? ratios[ratios.length - 2].ratio : null;
      const change = prev != null ? last - prev : null;
      const pct = (change != null && prev) ? (change / prev) * 100 : null;
      result = { price: last, change, pct };
    } else if (metricId === 'public-debt') {
      const rows = await fetchFredSeriesRows('GFDEGDQ188S', start);
      result = fredRowsToQuote(rows);
    } else if (metricId === 'private-debt') {
      const ratios = await fetchPrivateDebtRatios(start);
      if (!ratios?.length) return null;
      const last = ratios[ratios.length - 1].ratio;
      const prev = ratios.length > 1 ? ratios[ratios.length - 2].ratio : null;
      const change = prev != null ? last - prev : null;
      const pct = (change != null && prev) ? (change / prev) * 100 : null;
      result = { price: last, change, pct };
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
      const result = activeProvider === 'yahoo'
        ? await yahooChart(bondDef.yTicker)
        : await avQuote(bondDef.yTicker);
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
      const dp = item.id === 'buffett' ? 0 : 1;
      const price = formatRatioPrice(d, dp);
      let extra = '';
      if (item.id === 'buffett') {
        const zone = buffettZone(d?.price);
        if (zone) {
          extra = `<div class="yield-extra"><span class="spread-label">Zone</span>
            <span class="spread-val ${zone.cls}">${zone.label}</span></div>`;
        }
      } else {
        extra = `<div class="yield-extra"><span class="spread-label">Measure</span>
          <span class="spread-val buffett-fair">% of GDP</span></div>`;
      }
      return {
        ticker: item.ticker,
        label: item.label,
        price,
        change: d ? d.change : null,
        pct: d ? d.pct : null,
        extra,
        isRatio: true,
        itemKey: item.id,
        sectionKey: section.key,
        failed: !d || !price,
      };
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
      return { ticker: item.ticker, label: item.label,
        price: formatYieldPrice(d),
        change: d ? d.change : null, pct: d ? d.pct : null, extra,
        isYield: true,
        itemKey: item.id, sectionKey: section.key, failed: !d || !formatYieldPrice(d) };
    }));
    return;
  }

  renderGrid(section.gridId, visible.map(item => {
    const k = getItemKey(item);
    const d = DATA[k];
    const card = section.card(item, d);
    return { ...card, itemKey: k, sectionKey: section.key, failed: !d };
  }));
}

async function refreshCard(itemKey, sectionKey) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  if (!section) return;
  const item = section.items.find(i => getItemKey(i) === itemKey);
  if (!item) return;

  CARD_LOADING.add(itemKey);
  renderSectionGrid(section);

  const result = await section.fetch(item, true);
  if (result) DATA[itemKey] = result;
  else delete DATA[itemKey];

  CARD_LOADING.delete(itemKey);
  renderSectionGrid(section);
}

// ── Customize Rows ────────────────────────────────
function renderCust(section) {
  const el = document.getElementById(section.custId);
  if (!el) return;
  el.innerHTML = section.items.map(item => {
    const k = getItemKey(item);
    const on = isOn(item);
    const lbl = item.ticker || `${item.from}/${item.to}`;
    return `<button type="button" class="sym-pill ${on ? 'on' : 'off'}" data-sym-key="${k}" data-section-key="${section.key}">${lbl}</button>`;
  }).join('');
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
      note: 'Official API with an SLA. Free tier is tight (25 req/day). Crypto always uses CoinGecko regardless of provider. Paid plans from ~$50/mo remove limits.',
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

  box.innerHTML = sources.map(s => {
    const isSelectable = s.id !== 'fred' && s.id !== 'frank' && s.id !== 'coingecko';
    const active = isSelectable && s.id === activeProvider;
    return `
      <div class="info-source${active ? ' info-source-active' : ''}">
        <div class="info-source-header">
          <span class="info-source-name">${s.name}</span>
          <span class="info-tag" style="color:${s.tagColor};border-color:${s.tagColor}">
            ${active ? '✓ Active' : s.tag}
          </span>
        </div>
        <table class="info-table">
          ${s.rows.map(([k, v]) => `<tr><td class="info-key">${k}</td><td class="info-val">${v}</td></tr>`).join('')}
        </table>
        <div class="info-note">${s.note}</div>
        ${isSelectable
          ? `<button type="button" class="info-btn${active ? ' info-btn-active' : ''}" data-provider="${s.id}" ${active ? 'disabled' : ''}>${active ? 'Active' : 'Use this source'}</button>`
          : ''}
      </div>`;
  }).join('');
}

function toggleInfo() {
  const body = document.getElementById('info-body');
  const chevron = document.getElementById('info-chevron');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'grid';
  chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
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
  if (activeProvider !== 'alphavantage') {
    el.textContent = 'Source: Yahoo Finance + Frankfurter (FX) + CoinGecko (Crypto) · No rate limit';
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
  btn.classList.add('spinning');
  status.className = 'status-line';
  status.textContent = 'Loading…';
  updateDateLine();
  updateMarketStatus();

  if (force && activeProvider === 'alphavantage') {
    trackApiCall(visOf(EQUITIES).length + visOf(COMMODITIES).length + visOf(FX_PAIRS).length);
    updateApiUsageDisplay();
  }

  // All sections in parallel; only fetches visible items
  await Promise.all(SECTIONS.map(async section => {
    const visible = visOf(section.items);
    if (!visible.length) return;
    const results = await Promise.all(visible.map(item => section.fetch(item, force)));
    visible.forEach((item, i) => { if (results[i]) DATA[getItemKey(item)] = results[i]; });
    renderSectionGrid(section);
    renderCust(section);
  }));

  btn.classList.remove('spinning');
  const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const eqVisible = visOf(EQUITIES);
  const allEqFailed = eqVisible.length > 0 && eqVisible.every(e => !DATA[e.sym]);
  if (allEqFailed) {
    status.className = 'status-line err';
    status.textContent = activeProvider === 'alphavantage'
      ? '⚠ AV key error or rate limit — check your key'
      : '⚠ Equities failed — allorigins.win proxy may be down, try refresh';
  } else {
    status.className = 'status-line ok';
    status.textContent = `✓ Updated ${now}`;
  }
  updateApiUsageDisplay();
}

// ── Chart modal ───────────────────────────────────
const HISTORY_CACHE_TTL = 15 * 60 * 1000;
const chartState = { itemKey: null, sectionKey: null, days: 7 };

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
  const range = days <= 7 ? '5d' : '1mo';
  const data = await fetchRemote(yahooChartUrl(sym, range), { asJson: true });
  const series = data ? parseYahooSeries(data) : null;
  if (series) historyCacheSet(cacheKey, series);
  return series;
}

async function fetchFredHistory(seriesId, days) {
  const cacheKey = `fred:${seriesId}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&observation_start=${start}`;
  const txt = await fetchRemote(url, { asJson: false });
  if (!txt) return null;
  const series = [];
  for (const line of txt.trim().split('\n')) {
    if (line.startsWith('observation_date') || line.endsWith(',')) continue;
    const [date, val] = line.split(',');
    const v = parseFloat(val);
    if (!date || Number.isNaN(v)) continue;
    series.push({ t: new Date(date).getTime(), v });
  }
  if (!series.length) return null;
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
    const series = Object.keys(d.rates).sort().map(date => ({
      t: new Date(date).getTime(),
      v: d.rates[date][to],
    })).filter(p => p.v != null);
    if (!series.length) return null;
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
    const series = (d.prices || []).map(([t, v]) => ({ t, v }));
    if (!series.length) return null;
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
  const cacheKey = `val:${metricId}:${days}`;
  const cached = historyCacheGet(cacheKey);
  if (cached) return cached;
  const lookback = Math.max(days, 400);
  const start = new Date(Date.now() - lookback * 86400000).toISOString().slice(0, 10);
  let series = null;
  if (metricId === 'buffett') {
    const ratios = await fetchBuffettRatios(start);
    series = ratios?.map(r => ({ t: r.t, v: r.ratio })) ?? null;
  } else if (metricId === 'public-debt') {
    const rows = await fetchFredSeriesRows('GFDEGDQ188S', start);
    series = rows?.map(r => ({ t: new Date(r.date).getTime(), v: r.v })) ?? null;
  } else if (metricId === 'private-debt') {
    const ratios = await fetchPrivateDebtRatios(start);
    series = ratios?.map(r => ({ t: r.t, v: r.ratio })) ?? null;
  }
  if (!series?.length) return null;
  historyCacheSet(cacheKey, series);
  return series;
}

function formatChartDate(ts) {
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function buildChartSvg(series, opts = {}) {
  const { isPercent = false, dp = 2 } = opts;
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
  const fmtV = v => isPercent ? `${v.toFixed(2)}%` : fmt(v, dp);

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

  return { html: svg, statsHtml };
}

function chartOpts(item, section) {
  const isPercent = section.key === 'bond' || section.key === 'val';
  const dp = section.key === 'val' ? 0 : quoteDecimals(item, section.key);
  return { isPercent, dp };
}

function closeChart() {
  const modal = document.getElementById('chart-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  chartState.itemKey = null;
  chartState.sectionKey = null;
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
  chartState.days = 7;

  const modal = document.getElementById('chart-modal');
  const ticker = item.ticker || `${item.from}/${item.to}`;
  document.getElementById('chart-modal-ticker').textContent = ticker;
  document.getElementById('chart-modal-title').textContent = item.label;

  document.querySelectorAll('.chart-period-tabs button').forEach(btn => {
    const on = Number(btn.dataset.days) === chartState.days;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
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
  document.getElementById('api-banner').style.display = 'none';
  loadAll(true);
}

function wireUi() {
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
  });
  document.querySelectorAll('.chart-period-tabs button').forEach(btn => {
    btn.addEventListener('click', async () => {
      chartState.days = Number(btn.dataset.days) || 7;
      document.querySelectorAll('.chart-period-tabs button').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      await loadChartModal();
    });
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
    const card = e.target.closest('.card[data-item-key]');
    if (card?.dataset.itemKey && card.dataset.sectionKey) {
      openChart(card.dataset.itemKey, card.dataset.sectionKey);
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
    const card = e.target.closest('.card[data-item-key]');
    if (!card || e.target.closest('.card-refresh')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openChart(card.dataset.itemKey, card.dataset.sectionKey);
    }
  });
}

async function init() {
  wireUi();
  loadVIS();
  const saved = localStorage.getItem('av_key');
  if (saved && saved !== 'YOUR_API_KEY_HERE') {
    AV_KEY = saved;
    document.getElementById('api-key-input').value = saved;
  }
  const avNeedsKey = activeProvider === 'alphavantage' && AV_KEY === 'YOUR_API_KEY_HERE';
  document.getElementById('api-banner').style.display = avNeedsKey ? 'flex' : 'none';
  updateDateLine();
  updateMarketStatus();
  renderInfoBox();
  updateApiUsageDisplay();
  await detectLocalProxy();
  loadAll(false);
}

init();
