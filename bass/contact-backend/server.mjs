/**
 * Minimal contact ingest + list API for DigitalOcean App Platform (or any Node host).
 *
 * Env:
 *   PORT                 — listen port (DO sets this)
 *   CONTACT_ADMIN_TOKEN  — required for GET /contacts; use a long random string
 *   CONTACT_CORS_ORIGIN  — browser origin allowed for POST /contact (e.g. https://yoursite.com)
 *                          Default * (fine for public forms; tighten if you prefer)
 *
 * Persist: ./data/contacts.json — on DO, attach a volume mounted at /workspace/data or set
 *   CONTACT_DATA_DIR to a persistent path.
 *
 * Wire PapaWeb index.html:
 *   const CONTACT_FORM_ENDPOINT = 'https://<your-app>.ondigitalocean.app/contact';
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CONTACT_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'contacts.json');
const ADMIN_TOKEN = process.env.CONTACT_ADMIN_TOKEN || '';
const CORS_ORIGIN = process.env.CONTACT_CORS_ORIGIN || '*';

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
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function sendJson(res, status, body, extraHeaders = {}) {
  const headers = {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  };
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'POST' && url.pathname === '/contact') {
    try {
      const raw = await readBody(req);
      const j = JSON.parse(raw || '{}');
      const name = String(j.name || '').trim().slice(0, 200);
      const email = String(j.email || '').trim().slice(0, 320);
      const interest = String(j.interest || '').trim().slice(0, 200);
      const message = String(j.message || '').trim().slice(0, 20000);
      const subject = String(j.subject || '').trim().slice(0, 500);
      if (!name || !email || !message) {
        sendJson(res, 400, { success: false, message: 'name, email, and message are required' });
        return;
      }
      appendContact({ subject, name, email, interest, message });
      sendJson(res, 200, { success: true });
    } catch {
      sendJson(res, 400, { success: false, message: 'invalid JSON' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/contacts') {
    if (!ADMIN_TOKEN) {
      sendJson(res, 503, { error: 'CONTACT_ADMIN_TOKEN is not configured on the server' });
      return;
    }
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + ADMIN_TOKEN) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    sendJson(res, 200, readContacts());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.error(`contact-api listening on ${port}`);
});
