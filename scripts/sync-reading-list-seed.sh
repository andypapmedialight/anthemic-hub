#!/usr/bin/env bash
# Regenerate content/reading-list.seed.json from content/hub.json (reading_list only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node -e "
const fs=require('fs');
const hub=JSON.parse(fs.readFileSync('$ROOT/content/hub.json','utf8'));
if (!hub.reading_list || typeof hub.reading_list !== 'object') process.exit(1);
fs.writeFileSync('$ROOT/content/reading-list.seed.json', JSON.stringify({ reading_list: hub.reading_list }, null, 2) + '\n');
console.log('Wrote content/reading-list.seed.json');
"
