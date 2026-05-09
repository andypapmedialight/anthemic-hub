#!/usr/bin/env bash
# Installed on the Droplet as /usr/local/bin/anthemic-hub-deploy-apply.sh (root, 755).
# Invoked by the `deploy` user via: sudo /usr/local/bin/anthemic-hub-deploy-apply.sh
#
# Expects artifacts under /home/deploy/incoming-hub/:
#   index.html        - the hub landing page
#   assets/           - optional folder of static assets
#   bass/             - bass coaching static site (e.g. bass/index.html)
#
set -euo pipefail

INCOMING=/home/deploy/incoming-hub
DEST=/var/www/anthemic-hub

if [[ ! -f "${INCOMING}/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/index.html" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/bass/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/bass/index.html (rsync must ship bass/ from repo)" >&2
  exit 1
fi

mkdir -p "${DEST}"
rsync -a --delete \
  --include 'index.html' \
  --include 'assets/' --include 'assets/**' \
  --include 'bass/' --include 'bass/**' \
  --exclude '*' \
  "${INCOMING}/" "${DEST}/"

chown -R www-data:www-data "${DEST}"

echo "anthemic-hub-deploy-apply: OK"
