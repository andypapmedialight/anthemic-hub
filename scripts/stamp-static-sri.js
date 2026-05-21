#!/usr/bin/env node
/**
 * CI: compute SRI hashes for static JS and stamp HTML script tags before deploy.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function sriTag(src, defer = false, fileRel = null) {
  const rel = fileRel || (src.startsWith('/') ? src.slice(1) : src);
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`stamp-static-sri: missing ${rel}`);
  }
  const js = fs.readFileSync(file);
  const hash = crypto.createHash('sha384').update(js).digest('base64');
  const integrity = `sha384-${hash}`;
  const deferAttr = defer ? ' defer' : '';
  return `<script src="${src}"${deferAttr} integrity="${integrity}" crossorigin="anonymous"></script>`;
}

function stampHtml(htmlPath, replacements) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  for (const entry of replacements) {
    const src = entry[0];
    const defer = entry[1];
    const fileRel = entry[2];
    const tag = sriTag(src, defer, fileRel);
    const esc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<script\\s+[^>]*src="${esc}(\\?[^"]*)?"[^>]*>\\s*<\\/script>`, 'i');
    if (!re.test(html)) {
      throw new Error(`stamp-static-sri: no script tag for ${src} in ${htmlPath}`);
    }
    html = html.replace(re, tag);
  }
  fs.writeFileSync(htmlPath, html);
}

stampHtml(path.join(ROOT, 'index.html'), [
  ['/assets/js/theme-init.js', false],
  ['/assets/js/hub.js', true],
  ['/assets/js/hub-nav.js', true],
  ['/assets/js/hub-console.js', true],
]);

stampHtml(path.join(ROOT, 'bass', 'index.html'), [
  ['bass-hero-strings.js', false, 'bass/bass-hero-strings.js'],
  ['warmth-page.js', false, 'bass/warmth-page.js'],
  ['papaweb.js', true, 'bass/papaweb.js'],
]);

console.log('stamp-static-sri: OK');
