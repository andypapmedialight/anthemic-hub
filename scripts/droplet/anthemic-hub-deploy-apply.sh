#!/usr/bin/env bash
# Installed on the Droplet as /usr/local/bin/anthemic-hub-deploy-apply.sh (root, 755).
# Invoked by the `deploy` user via: sudo /usr/local/bin/anthemic-hub-deploy-apply.sh
#
# Expects artifacts under /home/deploy/incoming-hub/:
#   index.html        - the hub landing page
#   assets/           - optional folder of static assets
#
set -euo pipefail

INCOMING=/home/deploy/incoming-hub
DEST=/var/www/anthemic-hub

if [[ ! -f "${INCOMING}/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/index.html" >&2
  exit 1
fi

mkdir -p "${DEST}"
rsync -a --delete \
  --include 'index.html' \
  --include 'assets/' --include 'assets/**' \
  --exclude '*' \
  "${INCOMING}/" "${DEST}/"

chown -R www-data:www-data "${DEST}"

echo "anthemic-hub-deploy-apply: OK"
