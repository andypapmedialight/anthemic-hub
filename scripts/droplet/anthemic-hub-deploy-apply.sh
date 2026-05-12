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
#   content/          - admin-editable site content (content/hub.json)
#
set -euo pipefail

INCOMING=/home/deploy/incoming-hub
DEST=/var/www/anthemic-hub

# CI rsyncs the latest script here each deploy; refresh /usr/local/bin copy (this run is already root via sudo).
# If /usr/local/bin still predates this block, bootstrap once as root:
#   install -m 755 /home/deploy/incoming-hub/anthemic-hub-deploy-apply.sh /usr/local/bin/anthemic-hub-deploy-apply.sh
SELF_INCOMING="${INCOMING}/anthemic-hub-deploy-apply.sh"
APPLY_BIN="/usr/local/bin/anthemic-hub-deploy-apply.sh"
if [[ "${EUID:-$(id -u)}" -eq 0 ]] && [[ -f "${SELF_INCOMING}" ]]; then
  install -m 755 -o root -g root "${SELF_INCOMING}" "${APPLY_BIN}"
fi

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

mkdir -p "${DEST}/bass" "${DEST}/brain" "${DEST}/gigs" "${DEST}/content" "${DEST}/anth-dev-ad" "${DEST}/personal/writing"

# Preserve admin-managed files: back up before rsync, restore after.
# Git copies act as seeds on first deploy only.
function preserve_backup() { local f="$1"; local bk=""; if [[ -f "$f" ]]; then bk="$(mktemp)"; cp "$f" "$bk"; fi; echo "$bk"; }
function preserve_restore() { local f="$1"; local bk="$2"; if [[ -n "$bk" ]]; then cp "$bk" "$f"; rm -f "$bk"; fi; }

GIGS_LIVE="${DEST}/gigs/gigs.json"
CONTENT_LIVE="${DEST}/content/hub.json"
GIGS_BACKUP="$(preserve_backup "${GIGS_LIVE}")"
CONTENT_BACKUP="$(preserve_backup "${CONTENT_LIVE}")"

# Two-step rsync: multi-source rsync --delete has been observed to skip or clobber bass/ on the droplet.
rsync -a "${INCOMING}/index.html" "${DEST}/"
rsync -a --delete "${INCOMING}/bass/" "${DEST}/bass/"
rsync -a --delete "${INCOMING}/brain/" "${DEST}/brain/"
rsync -a --delete "${INCOMING}/gigs/" "${DEST}/gigs/"
rsync -a --delete "${INCOMING}/anth-dev-ad/" "${DEST}/anth-dev-ad/"
if [[ -d "${INCOMING}/personal" ]]; then
  rsync -a --delete "${INCOMING}/personal/" "${DEST}/personal/"
fi
rsync -a --delete "${INCOMING}/content/" "${DEST}/content/"

# Restore live admin-managed files so edits survive deploys.
preserve_restore "${GIGS_LIVE}"    "${GIGS_BACKUP}"
preserve_restore "${CONTENT_LIVE}" "${CONTENT_BACKUP}"

# Preserved hub.json may predate reading_list. Merge from incoming hub.json, else from reading-list.seed.json.
INCOMING_HUB="${INCOMING}/content/hub.json"
INCOMING_SEED="${INCOMING}/content/reading-list.seed.json"
if [[ -f "${CONTENT_LIVE}" ]]; then
  python3 - "${CONTENT_LIVE}" "${INCOMING_HUB}" "${INCOMING_SEED}" <<'PY'
import json, os, sys

def valid_reading_list(rl):
    return isinstance(rl, dict) and isinstance(rl.get("categories"), list)

live_path, inc_path, seed_path = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    with open(live_path, encoding="utf-8") as f:
        live = json.load(f)
except Exception:
    live = {}

if valid_reading_list(live.get("reading_list")):
    sys.exit(0)


def load_json(p):
    if not p or not os.path.isfile(p):
        return None
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

inc = load_json(inc_path)
seed_doc = load_json(seed_path)
inc_rl = inc.get("reading_list") if isinstance(inc, dict) else None
seed_rl = seed_doc.get("reading_list") if isinstance(seed_doc, dict) else None

picked = None
if valid_reading_list(inc_rl):
    picked = inc_rl
elif valid_reading_list(seed_rl):
    picked = seed_rl
else:
    sys.exit(0)

live["reading_list"] = picked
tmp = live_path + ".tmp." + str(os.getpid())
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(live, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.replace(tmp, live_path)
PY
fi

if [[ -d "${INCOMING}/assets" ]]; then
  mkdir -p "${DEST}/assets"
  MANIFEST_LIVE="${DEST}/assets/gallery/manifest.json"
  MANIFEST_BACKUP="$(preserve_backup "${MANIFEST_LIVE}")"
  rsync -a --delete "${INCOMING}/assets/" "${DEST}/assets/"
  preserve_restore "${MANIFEST_LIVE}" "${MANIFEST_BACKUP}"
fi

chown -R www-data:www-data "${DEST}"

echo "anthemic-hub-deploy-apply: OK"
