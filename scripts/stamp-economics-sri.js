#!/usr/bin/env node
/**
 * CI: compute SRI hash for economics/macro.js and stamp economics/index.html before deploy.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'economics', 'index.html');
const JS = path.join(ROOT, 'economics', 'macro.js');

const js = fs.readFileSync(JS);
const hash = crypto.createHash('sha384').update(js).digest('base64');
const integrity = `sha384-${hash}`;
const tag = `<script src="macro.js" defer integrity="${integrity}" crossorigin="anonymous"></script>`;

let html = fs.readFileSync(HTML, 'utf8');
if (!html.includes('src="macro.js"')) {
  html = html.replace(
    /<script src="\/economics\/macro\.js" defer><\/script>/,
    tag,
  );
} else {
  html = html.replace(/<script src="macro\.js" defer[^>]*><\/script>/, tag);
}
fs.writeFileSync(HTML, html);
console.log(`stamp-economics-sri: ${integrity.slice(0, 20)}…`);
