#!/usr/bin/env node
/**
 * Static checks for Morning Macro (economics/) — run in CI before deploy.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'economics', 'index.html');
const MACRO_CSS = path.join(ROOT, 'economics', 'macro.css');
const MACRO = path.join(ROOT, 'economics', 'macro.js');

let failed = false;
const fail = (msg) => {
  console.error(`check-economics: ${msg}`);
  failed = true;
};

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const macroJs = fs.readFileSync(MACRO, 'utf8');

if (!fs.existsSync(MACRO_CSS)) {
  fail('missing economics/macro.css (run extract or edit macro.css directly)');
} else {
  const css = fs.readFileSync(MACRO_CSS, 'utf8');
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth < 0) fail('unbalanced CSS in macro.css: extra closing brace');
  }
  if (depth !== 0) fail(`unbalanced CSS in macro.css: depth ${depth} at end`);
  if (!css.includes('.api-banner[hidden]')) {
    fail('macro.css missing .api-banner[hidden] (display:flex overrides hidden)');
  }
  if (!css.includes('prefers-reduced-motion')) {
    fail('macro.css missing prefers-reduced-motion media queries');
  }
  if (!css.includes('@media (hover: none)')) {
    fail('macro.css missing touch-friendly card action visibility');
  }
}

if (!indexHtml.includes('href="macro.css')) {
  fail('economics/index.html should link macro.css');
}
if (indexHtml.match(/<style>/)) {
  fail('economics/index.html should not contain inline <style> (use macro.css)');
}

// Required shell IDs for macro.js
const requiredIds = [
  'api-banner',
  'api-key-input',
  'info-header-toggle',
  'info-body',
  'refresh-btn',
  'status-line',
  'chart-modal',
  'chart-modal-body',
  'chart-period-tabs',
  'chart-modal-close',
];
for (const id of requiredIds) {
  if (!indexHtml.includes(`id="${id}"`)) fail(`missing #${id} in economics/index.html`);
}

// Card markup: buttons must not be nested inside anchor cards
if (macroJs.includes('card--link"') && macroJs.includes('${body}</a>`')) {
  fail('macro.js still nests card body inside <a class="card--link">');
}
if (!macroJs.includes('card--link-wrap') || !macroJs.includes('card-actions')) {
  fail('macro.js missing card--link-wrap / card-actions structure');
}

// Info panel toggle contract
if (!indexHtml.includes('aria-controls="info-body"')) {
  fail('info-header-toggle missing aria-controls="info-body"');
}

if (!indexHtml.includes('id="api-banner" hidden')) {
  fail('api-banner should start hidden in HTML');
}

if (!indexHtml.includes('src="macro.js"')) {
  fail('economics/index.html should load macro.js with a relative script path');
}

if (failed) process.exit(1);
console.log('check-economics: OK');
