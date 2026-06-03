#!/usr/bin/env node
/**
 * Fail CI if the deploy bundle would expose secrets on the public static site.
 * Run after generating papaweb.config.js and economics/.fred-api-key (staging only).
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const errors = [];

function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const papawebConfig = read('bass/papaweb.config.js');
if (/hooks\.slack\.com/i.test(papawebConfig)) {
  errors.push('bass/papaweb.config.js must not contain a Slack webhook URL');
}
if (/CONTACT_SLACK_WEBHOOK|SLACK_WEBHOOK_URL|CONTACT_FORM_ACCESS_KEY|access_key\s*:/i.test(papawebConfig)) {
  errors.push('bass/papaweb.config.js must only set public options (e.g. CONTACT_FORM_ENDPOINT)');
}

for (const rel of ['incoming-hub/private/fred-api-key', 'incoming-hub/private/abs-indicator-api-key']) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) {
    const st = fs.statSync(p);
    if ((st.mode & 0o077) !== 0) {
      errors.push(`${rel} should be mode 0600 in CI`);
    }
  }
}
if (fs.existsSync(path.join(root, 'economics/.fred-api-key'))) {
  errors.push('economics/.fred-api-key must not be staged — use incoming-hub/private/fred-api-key');
}

const apply = read('scripts/droplet/anthemic-hub-deploy-apply.sh');
if (!apply.includes('--exclude \'.fred-api-key\'') && !apply.includes('--exclude ".fred-api-key"')) {
  errors.push('anthemic-hub-deploy-apply.sh must rsync economics/ with --exclude .fred-api-key');
}
if (!apply.includes('economics/.fred-api-key')) {
  errors.push('anthemic-hub-deploy-apply.sh should remove economics/.fred-api-key from the web root');
}

if (errors.length) {
  console.error('check-deploy-secrets: FAILED\n');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('check-deploy-secrets: OK');
