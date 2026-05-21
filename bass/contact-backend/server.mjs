/**
 * Contact ingest + admin list API (loopback behind nginx).
 *
 * Env (see /etc/anthemic-contact/contact.env on the droplet):
 *   PORT, BIND
 *   CONTACT_ADMIN_TOKEN   — required for GET /contacts
 *   CONTACT_CORS_ORIGIN   — allowed browser Origin(s), comma-separated (required in production)
 *   SLACK_WEBHOOK_URL     — optional; posts to Slack server-side after storing submission
 *   CONTACT_DATA_DIR      — persistent JSON store (default ./data)
 *   CONTACT_RATE_MAX      — max POSTs per IP per window (default 10)
 *   CONTACT_RATE_WINDOW_MS — rate window (default 3600000)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CONTACT_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'contacts.json');
const ADMIN_TOKEN = process.env.CONTACT_ADMIN_TOKEN || '';
const SLACK_WEBHOOK_URL = (process.env.SLACK_WEBHOOK_URL || '').trim();
const BIND = process.env.BIND || '127.0.0.1';
const RATE_MAX = Math.max(1, Number(process.env.CONTACT_RATE_MAX) || 10);
const RATE_WINDOW_MS = Math.max(60_000, Number(process.env.CONTACT_RATE_WINDOW_MS) || 3_600_000);

const CORS_ORIGINS = (process.env.CONTACT_CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const rateByIp = new Map();
const adminRateByIp = new Map();
const ADMIN_RATE_MAX = Math.max(1, Number(process.env.CONTACT_ADMIN_RATE_MAX) || 60);
const ADMIN_RATE_WINDOW_MS = Math.max(60_000, Number(process.env.CONTACT_ADMIN_RATE_WINDOW_MS) || 3_600_000);

/** Honeypot field names — non-empty means bot; respond OK without storing. */
const HONEYPOT_KEYS = ['fax', 'website', 'company', 'url'];

function readContacts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function appendContact(entry) {
  const list = readContacts();
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    receivedAt: new Date().toISOString(),
    ...entry,
  });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), { mode: 0o600 });
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return req.socket.remoteAddress || 'unknown';
}

function rateAllow(ip) {
  const now = Date.now();
  let bucket = rateByIp.get(ip);
  if (!bucket) {
    bucket = [];
    rateByIp.set(ip, bucket);
  }
  const recent = bucket.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return false;
  recent.push(now);
  rateByIp.set(ip, recent);
  if (rateByIp.size > 10_000) {
    for (const [k, v] of rateByIp) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) rateByIp.delete(k);
    }
  }
  return true;
}

function rateAllowAdmin(ip) {
  const now = Date.now();
  let bucket = adminRateByIp.get(ip);
  if (!bucket) {
    bucket = [];
    adminRateByIp.set(ip, bucket);
  }
  const recent = bucket.filter((t) => now - t < ADMIN_RATE_WINDOW_MS);
  if (recent.length >= ADMIN_RATE_MAX) return false;
  recent.push(now);
  adminRateByIp.set(ip, recent);
  if (adminRateByIp.size > 5_000) {
    for (const [k, v] of adminRateByIp) {
      if (!v.some((t) => now - t < ADMIN_RATE_WINDOW_MS)) adminRateByIp.delete(k);
    }
  }
  return true;
}

function isHoneypotPayload(j) {
  if (!j || typeof j !== 'object') return false;
  for (const key of HONEYPOT_KEYS) {
    if (String(j[key] ?? '').trim()) return true;
  }
  return false;
}

function corsOriginForRequest(req) {
  if (!CORS_ORIGINS.length) return null;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && CORS_ORIGINS.includes(origin)) return origin;
  return null;
}

function sendJson(req, res, status, body, extraHeaders = {}) {
  const allowOrigin = corsOriginForRequest(req);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
    ...extraHeaders,
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  if (status !== 204) headers['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead(status, headers);
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 1_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function isAllowedSlackWebhook(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'hooks.slack.com') return false;
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] === 'services' && parts.length === 4;
  } catch {
    return false;
  }
}

function slackEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function notifySlack(entry) {
  if (!SLACK_WEBHOOK_URL || !isAllowedSlackWebhook(SLACK_WEBHOOK_URL)) return;
  const subject = entry.subject || '[PapaWeb] Contact';
  const name = slackEscape(entry.name || '');
  const email = slackEscape(entry.email || '');
  const interest = slackEscape(entry.interest || '');
  const msg = slackEscape(entry.message || '');
  const mailtoHref = 'mailto:' + encodeURIComponent(entry.email || '');
  const payload = {
    text: slackEscape(subject),
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'New PapaWeb contact', emoji: true } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Name*\n' + name },
          { type: 'mrkdwn', text: '*Email*\n<' + mailtoHref + '|' + email + '>' },
        ],
      },
      { type: 'section', text: { type: 'mrkdwn', text: '*Interest*\n' + interest } },
      { type: 'section', text: { type: 'mrkdwn', text: '*Message*\n' + msg } },
    ],
  };
  const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const raw = await res.text().catch(() => '');
  if (!res.ok && raw.trim() !== 'ok') {
    console.error('Slack webhook failed:', res.status, raw.slice(0, 200));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    if (!corsOriginForRequest(req)) {
      sendJson(req, res, 403, { error: 'origin not allowed' });
      return;
    }
    sendJson(req, res, 204, {});
    return;
  }

  if (req.method === 'POST' && url.pathname === '/contact') {
    if (CORS_ORIGINS.length && !corsOriginForRequest(req)) {
      sendJson(req, res, 403, { success: false, message: 'origin not allowed' });
      return;
    }
    const ip = clientIp(req);
    if (!rateAllow(ip)) {
      sendJson(req, res, 429, { success: false, message: 'too many requests' });
      return;
    }
    try {
      const raw = await readBody(req);
      const j = JSON.parse(raw || '{}');
      if (isHoneypotPayload(j)) {
        sendJson(req, res, 200, { success: true });
        return;
      }
      const name = String(j.name || '').trim().slice(0, 200);
      const email = String(j.email || '').trim().slice(0, 320);
      const interest = String(j.interest || '').trim().slice(0, 200);
      const message = String(j.message || '').trim().slice(0, 20000);
      const subject = String(j.subject || '').trim().slice(0, 500);
      if (!name || !email || !message) {
        sendJson(req, res, 400, { success: false, message: 'name, email, and message are required' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        sendJson(req, res, 400, { success: false, message: 'invalid email' });
        return;
      }
      const entry = { subject, name, email, interest, message };
      appendContact(entry);
      try {
        await notifySlack(entry);
      } catch (e) {
        console.error('Slack notify error:', e);
      }
      sendJson(req, res, 200, { success: true });
    } catch {
      sendJson(req, res, 400, { success: false, message: 'invalid JSON' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/contacts') {
    if (!ADMIN_TOKEN) {
      sendJson(req, res, 503, { error: 'CONTACT_ADMIN_TOKEN is not configured on the server' });
      return;
    }
    const adminIp = clientIp(req);
    if (!rateAllowAdmin(adminIp)) {
      sendJson(req, res, 429, { error: 'too many requests' });
      return;
    }
    const auth = req.headers.authorization || '';
    const expected = 'Bearer ' + ADMIN_TOKEN;
    if (!timingSafeEqualStr(auth, expected)) {
      sendJson(req, res, 401, { error: 'unauthorized' });
      return;
    }
    sendJson(req, res, 200, readContacts());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(req, res, 200, { ok: true });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const port = Number(process.env.PORT) || 8072;
server.listen(port, BIND, () => {
  console.error(`contact-api listening on ${BIND}:${port}`);
  if (CORS_ORIGINS.length) {
    console.error(`CORS origins: ${CORS_ORIGINS.join(', ')}`);
  } else {
    console.error('WARNING: CONTACT_CORS_ORIGIN unset — browser POST /contact will be rejected');
  }
});
