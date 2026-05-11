#!/usr/bin/env bash
# Installed on the Droplet as /usr/local/bin/anthemic-hub-deploy-apply.sh (root, 755).
# Invoked by the `deploy` user via: sudo /usr/local/bin/anthemic-hub-deploy-apply.sh
#
# Expects artifacts under /home/deploy/incoming-hub/:
#   index.html        - the hub landing page
#   assets/           - optional folder of static assets
#   bass/             - bass coaching static site (e.g. bass/index.html)
#   brain/            - 3D brain hub page (e.g. brain/index.html)
#   gigs/             - gig calendar (gigs/index.html + gigs.json)
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
if [[ ! -f "${INCOMING}/brain/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/brain/index.html (rsync must ship brain/ from repo)" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/gigs/index.html" ]] || [[ ! -f "${INCOMING}/gigs/gigs.json" ]]; then
  echo "anthemic-hub-deploy-apply: missing gigs/index.html or gigs/gigs.json (rsync must ship gigs/ from repo)" >&2
  exit 1
fi

mkdir -p "${DEST}/bass" "${DEST}/brain" "${DEST}/gigs"

# Preserve admin-managed gigs.json: back up before rsync, restore after.
# Git copy in incoming/ acts as the seed on first deploy only.
GIGS_LIVE="${DEST}/gigs/gigs.json"
GIGS_BACKUP=""
if [[ -f "${GIGS_LIVE}" ]]; then
  GIGS_BACKUP="$(mktemp)"
  cp "${GIGS_LIVE}" "${GIGS_BACKUP}"
fi

# Two-step rsync: multi-source rsync --delete has been observed to skip or clobber bass/ on the droplet.
rsync -a "${INCOMING}/index.html" "${DEST}/"
rsync -a --delete "${INCOMING}/bass/" "${DEST}/bass/"
rsync -a --delete "${INCOMING}/brain/" "${DEST}/brain/"
rsync -a --delete "${INCOMING}/gigs/" "${DEST}/gigs/"

# Restore live gigs.json so admin edits survive deploys.
if [[ -n "${GIGS_BACKUP}" ]]; then
  cp "${GIGS_BACKUP}" "${GIGS_LIVE}"
  rm -f "${GIGS_BACKUP}"
fi
if [[ -d "${INCOMING}/assets" ]]; then
  mkdir -p "${DEST}/assets"
  rsync -a --delete "${INCOMING}/assets/" "${DEST}/assets/"
fi

chown -R www-data:www-data "${DEST}"

echo "anthemic-hub-deploy-apply: OK"
