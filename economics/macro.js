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
function itemKey(item) {
  if (item.id)   return item.id;
  if (item.from) return `${item.from}${item.to}`;
  return item.sym;
}
function isOn(item) { const k = itemKey(item); return k in VIS ? VIS[k] : item.def; }
function visOf(items) { return items.filter(isOn); }

// ── Data Store ────────────────────────────────────
const DATA = {};  // itemKey → { price, change, pct }

// ── Symbol Config ─────────────────────────────────
const EQUITIES = [
  { sym: 'SPY',    label: 'S&P 500',        ticker: 'SPY',    def: true  },
  { sym: 'QQQ',    label: 'NASDAQ 100',     ticker: 'QQQ',    def: true  },
  { sym: 'DIA',    label: 'Dow Jones',      ticker: 'DIA',    def: true  },
  { sym: 'IWM',    label: 'Russell 2000',   ticker: 'IWM',    def: true  },
  { sym: 'STW.AX', label: 'ASX 200',        ticker: 'STW.AX', def: true  },
  { sym: 'EEM',    label: 'Emerg. Markets', ticker: 'EEM',    def: false },
  { sym: 'VGK',    label: 'Europe',         ticker: 'VGK',    def: false },
  { sym: 'EWJ',    label: 'Japan',          ticker: 'EWJ',    def: false },
  { sym: 'VIXY',   label: 'VIX (Proxy)',    ticker: 'VIXY',   def: false },
  { sym: 'ARKK',   label: 'ARK Innov.',     ticker: 'ARKK',   def: false },
];

const COMMODITIES = [
  { sym: 'GLD',  label: 'Gold',        ticker: 'GLD',  def: true  },
  { sym: 'SLV',  label: 'Silver',      ticker: 'SLV',  def: true  },
  { sym: 'USO',  label: 'Oil (WTI)',   ticker: 'USO',  def: true  },
  { sym: 'UNG',  label: 'Natural Gas', ticker: 'UNG',  def: true  },
  { sym: 'CPER', label: 'Copper',      ticker: 'CPER', def: false },
  { sym: 'WEAT', label: 'Wheat',       ticker: 'WEAT', def: false },
  { sym: 'CORN', label: 'Corn',        ticker: 'CORN', def: false },
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
    card:  (item, d) => ({ ticker: item.ticker, label: item.label,
      price: d ? fmt(d.price) : null, change: d ? d.change : null, pct: d ? d.pct : null }),
  },
  {
    key: 'comm', gridId: 'commodities-grid', custId: 'cust-comm', items: COMMODITIES,
    fetch: (item, force) => fetchQuote(item.sym, force),
    card:  (item, d) => ({ ticker: item.ticker, label: item.label,
      price: d ? fmt(d.price) : null, change: d ? d.change : null, pct: d ? d.pct : null }),
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
    card:  (item, d) => ({ ticker: item.ticker, label: item.label,
      price: d ? fmt(d.price, item.dp ?? 2) : null, change: d ? d.change : null, pct: d ? d.pct : null }),
  },
];

// ── Helpers ───────────────────────────────────────
function fmt(n, dp=2) {
  if (n === null || isNaN(n)) return '–';
  return parseFloat(n).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function sign(n) { return n === null ? '' : n >= 0 ? '+' : ''; }
function cardClass(pct) { return pct === null ? 'neu' : pct >= 0 ? 'up' : 'dn'; }
function pillClass(pct) { return pct === null ? 'neu' : pct >= 0 ? 'up' : 'dn'; }
function pillText(pct) {
  if (pct === null) return '–';
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
}

function renderCard(data, delay=0) {
  const cls = cardClass(data.pct);
  const priceStr = data.price !== null ? data.price : '–';
  const absStr = data.change !== null ? `${sign(data.change)}${fmt(data.change)}` : '';
  return `
    <div class="card ${cls}" style="animation-delay:${delay}s">
      <div class="card-ticker">${data.ticker}</div>
      <div class="card-name">${data.label}</div>
      <div class="card-price">${priceStr}</div>
      <div class="card-change">
        <span class="pill ${pillClass(data.pct)}">${pillText(data.pct)}</span>
        ${absStr ? `<span class="card-abs">${absStr}</span>` : ''}
      </div>
      ${data.extra || ''}
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

// Same-origin CORS proxy (serve-hub.py locally, nginx /economics/proxy in prod)
let LOCAL_PROXY_PREFIX = null;

async function detectLocalProxy() {
  const candidates = [
    location.origin + '/economics/proxy?url=',
    location.origin + '/proxy?url=',
  ];
  const probe = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d';
  for (const prefix of candidates) {
    try {
      const r = await fetch(prefix + encodeURIComponent(probe));
      if (r.ok) {
        LOCAL_PROXY_PREFIX = prefix;
        return;
      }
    } catch {}
  }
  LOCAL_PROXY_PREFIX = null;
}

function publicProxyUrls(targetUrl) {
  return [
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  ];
}

async function fetchRemote(targetUrl, { asJson = true } = {}) {
  const attempts = [];

  attempts.push(async () => {
    const r = await fetch(targetUrl);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return asJson ? r.json() : r.text();
  });

  if (LOCAL_PROXY_PREFIX) {
    const proxied = LOCAL_PROXY_PREFIX + encodeURIComponent(targetUrl);
    attempts.push(async () => {
      const r = await fetch(proxied);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  for (const url of publicProxyUrls(targetUrl)) {
    attempts.push(async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asJson ? r.json() : r.text();
    });
  }

  attempts.push(async () => {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const wrap = await r.json();
    const body = wrap.contents;
    return asJson ? JSON.parse(body) : body;
  });

  for (const fn of attempts) {
    try {
      return await proxyThrottle(fn);
    } catch {}
  }
  return null;
}

function parseYahooChart(d) {
  if (!d?.chart?.result?.[0]) throw new Error('no data');
  const meta = d.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const change = prevClose != null ? price - prevClose : null;
  const pct = (change !== null && prevClose) ? (change / prevClose) * 100 : null;
  return { price, change, pct };
}

// ── Yahoo Finance ──────────────────────────────────────────────────
async function yahooChart(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
  try {
    const data = await fetchRemote(url, { asJson: true });
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

async function fetchBond(series_id, force = false) {
  const bondDef = BOND_SERIES.find(b => b.id === series_id);
  if (bondDef?.yTicker) return fetchQuote(bondDef.yTicker, force);

  const key = `b:${series_id}`;
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
        price: d ? `${d.price.toFixed(2)}%` : null,
        change: d ? d.change : null, pct: d ? d.pct : null, extra };
    }));
    return;
  }

  renderGrid(section.gridId, visible.map(item => section.card(item, DATA[itemKey(item)])));
}

// ── Customize Rows ────────────────────────────────
function renderCust(section) {
  const el = document.getElementById(section.custId);
  if (!el) return;
  el.innerHTML = section.items.map(item => {
    const k = itemKey(item);
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
  const item = section.items.find(i => itemKey(i) === key);
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
    visible.forEach((item, i) => { if (results[i]) DATA[itemKey(item)] = results[i]; });
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
  document.addEventListener('click', e => {
    const pill = e.target.closest('.sym-pill');
    if (pill?.dataset.symKey) {
      toggleSym(pill.dataset.symKey, pill.dataset.sectionKey);
      return;
    }
    const providerBtn = e.target.closest('.info-btn[data-provider]');
    if (providerBtn && !providerBtn.disabled) setProvider(providerBtn.dataset.provider);
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
