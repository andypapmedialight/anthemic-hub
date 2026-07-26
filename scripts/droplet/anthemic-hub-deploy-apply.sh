#!/usr/bin/env bash
# Installed on the Droplet as /usr/local/bin/anthemic-hub-deploy-apply.sh (root, 755).
# Invoked by the deploy user via:
#   sudo /usr/local/bin/anthemic-hub-deploy-apply.sh
# Optional first argument sets INCOMING (manual override).
# If no argument: read one line from /tmp/anthemic-hub-incoming.path if it exists (CI writes this before sudo — works when SUDO_USER is unset).
# Else read /home/${SUDO_USER}/.incoming-hub-path when present (manual).
# Else default /home/deploy/incoming-hub.
#   index.html        - the hub landing page
#   consciousness-map.html (+ favicon/preview) - philosophy of mind map
#   grounding-the-unconscious.html (+ favicon) - psychoanalysis / neuroscience map
#   genealogies-of-desire.html (+ favicon) - Freudo-Marxism / accelerationism map
#   constellations-of-history.html (+ favicon) - Western Marxism / Benjamin / Jameson map
#   technics-and-time.html (+ favicon) - Gestell / Simondon / Stiegler / cosmotechnics
#   map-of-maps.html (+ favicon) - chronological index of every thinker/concept across the genealogy pieces
#   map-of-maps-currents.html - optional browse-by-current cohort view
#   fiction-of-the-maps.html (+ favicon) - novelists shaped by the mapped thinkers
#   philosophy-booklet.html - printable assembly of the essays + fiction + timeline
#   the-boundary-play.html - Kant–Hegel one-act + genealogy rewrites
#   sitemap.xml / robots.txt - SEO files at site root
#   assets/           - optional folder of static assets
#   bass/             - bass coaching static site (e.g. bass/index.html)
#   brain/            - 3D brain hub page (e.g. brain/index.html)
#   hire/             - employer pitch deck (hire/index.html + pitch.js)
#   gigs/             - gig calendar (gigs/index.html + gigs.json)
#   content/          - admin-editable site content (content/hub.json)
#
set -euo pipefail

if [[ -n "${1:-}" ]]; then
  INCOMING="$1"
elif [[ -f /tmp/anthemic-hub-incoming.path ]]; then
  IFS= read -r INCOMING < /tmp/anthemic-hub-incoming.path || true
  INCOMING="${INCOMING//$'\r'/}"
  INCOMING="${INCOMING//$'\n'/}"
  INCOMING=$(printf '%s' "$INCOMING" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  rm -f /tmp/anthemic-hub-incoming.path
elif [[ -n "${SUDO_USER:-}" && -f "/home/${SUDO_USER}/.incoming-hub-path" ]]; then
  IFS= read -r INCOMING < "/home/${SUDO_USER}/.incoming-hub-path" || true
  INCOMING="${INCOMING//$'\r'/}"
  INCOMING="${INCOMING//$'\n'/}"
  INCOMING=$(printf '%s' "$INCOMING" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
fi
if [[ -z "${INCOMING:-}" ]]; then
  INCOMING="/home/deploy/incoming-hub"
fi
DEST=/var/www/anthemic-hub
# If /usr/local/bin still predates this block, bootstrap once as root:
#   install -m 755 /home/deploy/incoming-hub/anthemic-hub-deploy-apply.sh /usr/local/bin/anthemic-hub-deploy-apply.sh
SELF_INCOMING="${INCOMING}/anthemic-hub-deploy-apply.sh"
APPLY_BIN="/usr/local/bin/anthemic-hub-deploy-apply.sh"
if [[ "${EUID:-$(id -u)}" -eq 0 ]] && [[ -f "${SELF_INCOMING}" ]]; then
  if ! cmp -s "${SELF_INCOMING}" "${APPLY_BIN}" 2>/dev/null; then
    install -m 755 -o root -g root "${SELF_INCOMING}" "${APPLY_BIN}"
    echo "anthemic-hub-deploy-apply: updated ${APPLY_BIN}; re-running with new script" >&2
    exec "${APPLY_BIN}" "${INCOMING}"
  fi
fi

if [[ ! -f "${INCOMING}/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/index.html" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/consciousness-map.html" ]] \
  || [[ ! -f "${INCOMING}/consciousness-map-favicon.svg" ]] \
  || [[ ! -f "${INCOMING}/consciousness-map-preview.png" ]]; then
  echo "anthemic-hub-deploy-apply: missing consciousness-map.html (and favicon/preview) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/grounding-the-unconscious.html" ]] \
  || [[ ! -f "${INCOMING}/grounding-the-unconscious-favicon.svg" ]]; then
  echo "anthemic-hub-deploy-apply: missing grounding-the-unconscious.html (and favicon) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/genealogies-of-desire.html" ]] \
  || [[ ! -f "${INCOMING}/genealogies-of-desire-favicon.svg" ]]; then
  echo "anthemic-hub-deploy-apply: missing genealogies-of-desire.html (and favicon) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/constellations-of-history.html" ]] \
  || [[ ! -f "${INCOMING}/constellations-of-history-favicon.svg" ]]; then
  echo "anthemic-hub-deploy-apply: missing constellations-of-history.html (and favicon) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/map-of-maps.html" ]] \
  || [[ ! -f "${INCOMING}/map-of-maps-favicon.svg" ]]; then
  echo "anthemic-hub-deploy-apply: missing map-of-maps.html (and favicon) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/map-of-maps-currents.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing map-of-maps-currents.html in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/technics-and-time.html" ]] \
  || [[ ! -f "${INCOMING}/technics-and-time-favicon.svg" ]]; then
  echo "anthemic-hub-deploy-apply: missing technics-and-time.html (and favicon) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/fiction-of-the-maps.html" ]] \
  || [[ ! -f "${INCOMING}/fiction-of-the-maps-favicon.svg" ]]; then
  echo "anthemic-hub-deploy-apply: missing fiction-of-the-maps.html (and favicon) in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/philosophy-booklet.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing philosophy-booklet.html in ${INCOMING}" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/the-boundary-play.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing the-boundary-play.html in ${INCOMING}" >&2
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
if [[ ! -f "${INCOMING}/hire/index.html" ]] || [[ ! -f "${INCOMING}/hire/pitch.js" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/hire/ pitch deck (CI must rsync ./hire/)" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/content/pitch.json" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/content/pitch.json (rsync must ship content/)" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/gigs/index.html" ]] || [[ ! -f "${INCOMING}/gigs/gigs.json" ]]; then
  echo "anthemic-hub-deploy-apply: missing gigs/index.html or gigs/gigs.json (rsync must ship gigs/ from repo)" >&2
  exit 1
fi
if [[ ! -d "${INCOMING}/personal" ]] || [[ ! -f "${INCOMING}/personal/writing/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/personal/ or personal/writing/index.html (CI must rsync ./personal/)" >&2
  exit 1
fi
if [[ ! -f "${INCOMING}/economics/index.html" ]]; then
  echo "anthemic-hub-deploy-apply: missing ${INCOMING}/economics/index.html (rsync must ship economics/ from repo)" >&2
  exit 1
fi

mkdir -p "${DEST}/bass" "${DEST}/brain" "${DEST}/hire" "${DEST}/gigs" "${DEST}/content" "${DEST}/anth-dev-ad" "${DEST}/personal/writing" "${DEST}/economics"

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
rsync -a \
  "${INCOMING}/consciousness-map.html" \
  "${INCOMING}/consciousness-map-favicon.svg" \
  "${INCOMING}/consciousness-map-preview.png" \
  "${INCOMING}/grounding-the-unconscious.html" \
  "${INCOMING}/grounding-the-unconscious-favicon.svg" \
  "${INCOMING}/genealogies-of-desire.html" \
  "${INCOMING}/genealogies-of-desire-favicon.svg" \
  "${INCOMING}/constellations-of-history.html" \
  "${INCOMING}/constellations-of-history-favicon.svg" \
  "${INCOMING}/technics-and-time.html" \
  "${INCOMING}/technics-and-time-favicon.svg" \
  "${INCOMING}/map-of-maps.html" \
  "${INCOMING}/map-of-maps-favicon.svg" \
  "${INCOMING}/map-of-maps-currents.html" \
  "${INCOMING}/fiction-of-the-maps.html" \
  "${INCOMING}/fiction-of-the-maps-favicon.svg" \
  "${INCOMING}/philosophy-booklet.html" \
  "${INCOMING}/the-boundary-play.html" \
  "${DEST}/"
if [[ -f "${INCOMING}/sitemap.xml" ]]; then
  rsync -a "${INCOMING}/sitemap.xml" "${DEST}/"
fi
if [[ -f "${INCOMING}/robots.txt" ]]; then
  rsync -a "${INCOMING}/robots.txt" "${DEST}/"
fi
rsync -a --delete "${INCOMING}/bass/" "${DEST}/bass/"
rsync -a --delete "${INCOMING}/brain/" "${DEST}/brain/"
rsync -a --delete "${INCOMING}/hire/" "${DEST}/hire/"
rsync -a --delete "${INCOMING}/gigs/" "${DEST}/gigs/"
rsync -a --delete "${INCOMING}/anth-dev-ad/" "${DEST}/anth-dev-ad/"
rsync -a --delete "${INCOMING}/personal/" "${DEST}/personal/"
if [[ -d "${INCOMING}/design" ]] && [[ -n "$(find "${INCOMING}/design" -mindepth 1 -print -quit 2>/dev/null)" ]]; then
  mkdir -p "${DEST}/design"
  rsync -a --delete "${INCOMING}/design/" "${DEST}/design/"
fi
rsync -a --delete --exclude '.fred-api-key' "${INCOMING}/economics/" "${DEST}/economics/"
rm -f "${DEST}/economics/.fred-api-key"
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

# Morning Macro: install FRED API key for nginx proxy (Valuation + FRED bonds).
SNIP="/etc/nginx/snippets/mmd-fred-api-key.conf"
FRED_KEY_FILE="${INCOMING}/private/fred-api-key"
if [[ ! -f "${FRED_KEY_FILE}" && -f "${INCOMING}/economics/.fred-api-key" ]]; then
  FRED_KEY_FILE="${INCOMING}/economics/.fred-api-key"
fi
mkdir -p /etc/nginx/snippets
if [[ -f "${FRED_KEY_FILE}" ]]; then
  KEY="$(tr -d '\r\n' < "${FRED_KEY_FILE}")"
  printf 'set $mmd_fred_api_key "%s";\n' "${KEY}" > "${SNIP}"
else
  printf 'set $mmd_fred_api_key "";\n' > "${SNIP}"
fi
chmod 644 "${SNIP}"

# PapaWeb contact API (Slack + JSON store on loopback; nginx proxies /bass/api/*).
CONTACT_OPT=/opt/anthemic-contact
CONTACT_ENV=/etc/anthemic-contact/contact.env
CONTACT_INCOMING_ENV="${INCOMING}/private/contact.env"
if [[ -f "${INCOMING}/contact/server.mjs" ]]; then
  if ! command -v node >/dev/null 2>&1; then
    if command -v dnf >/dev/null 2>&1; then
      dnf install -y nodejs
    elif command -v apt-get >/dev/null 2>&1; then
      apt-get update -qq && apt-get install -y nodejs
    fi
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "anthemic-hub-deploy-apply: node is required for papaweb-contact.service" >&2
    exit 1
  fi
  mkdir -p "${CONTACT_OPT}/data"
  install -o root -g root -m 644 "${INCOMING}/contact/server.mjs" "${CONTACT_OPT}/server.mjs"
  if [[ -f "${INCOMING}/contact/papaweb-contact.service" ]]; then
    install -o root -g root -m 644 "${INCOMING}/contact/papaweb-contact.service" \
      /etc/systemd/system/papaweb-contact.service
  fi
  mkdir -p /etc/anthemic-contact
  if [[ -f "${CONTACT_INCOMING_ENV}" ]]; then
    install -o root -g www-data -m 640 "${CONTACT_INCOMING_ENV}" "${CONTACT_ENV}"
  else
    printf '# contact.env not deployed — set GitHub secrets PAPAWEB_SLACK_WEBHOOK + CONTACT_ADMIN_TOKEN\n' > "${CONTACT_ENV}"
    chmod 640 "${CONTACT_ENV}"
    chown root:www-data "${CONTACT_ENV}"
  fi
  chown -R www-data:www-data "${CONTACT_OPT}/data"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload
    systemctl enable papaweb-contact.service
    systemctl restart papaweb-contact.service
    contact_ok=0
    for attempt in 1 2 3 4 5 6 7 8; do
      if systemctl is-active --quiet papaweb-contact.service \
        && curl -fsS --max-time 5 http://127.0.0.1:8072/health >/dev/null 2>&1; then
        contact_ok=1
        break
      fi
      sleep 2
    done
    if [[ "${contact_ok}" -ne 1 ]]; then
      echo "anthemic-hub-deploy-apply: papaweb-contact /health check failed" >&2
      systemctl status papaweb-contact.service --no-pager >&2 || true
      journalctl -u papaweb-contact.service -n 40 --no-pager >&2 || true
      exit 1
    fi
  fi
fi

# Morning Macro: valuation API (BIS/FRED) on loopback for nginx proxy_pass.
MMD_OPT=/opt/anthemic-mmd
MMD_ENV=/etc/anthemic-mmd/valuation.env
mkdir -p "${MMD_OPT}"
if [[ -f "${INCOMING}/mmd/valuation_server.py" && -f "${INCOMING}/mmd/valuation_fetch.py" ]]; then
  if [[ ! -f "${INCOMING}/mmd/treasury_fetch.py" ]]; then
    echo "anthemic-hub-deploy-apply: missing ${INCOMING}/mmd/treasury_fetch.py (required by valuation_server.py)" >&2
    exit 1
  fi
  install -o root -g root -m 644 "${INCOMING}/mmd/valuation_fetch.py" "${MMD_OPT}/valuation_fetch.py"
  install -o root -g root -m 755 "${INCOMING}/mmd/valuation_server.py" "${MMD_OPT}/valuation_server.py"
  install -o root -g root -m 644 "${INCOMING}/mmd/treasury_fetch.py" "${MMD_OPT}/treasury_fetch.py"
  if [[ -f "${INCOMING}/mmd/aus_fetch.py" ]]; then
    install -o root -g root -m 644 "${INCOMING}/mmd/aus_fetch.py" "${MMD_OPT}/aus_fetch.py"
  fi
  if [[ -f "${INCOMING}/mmd/multilateral_fetch.py" ]]; then
    install -o root -g root -m 644 "${INCOMING}/mmd/multilateral_fetch.py" "${MMD_OPT}/multilateral_fetch.py"
  fi
  if [[ -f "${INCOMING}/mmd/mmd-valuation.service" ]]; then
    install -o root -g root -m 644 "${INCOMING}/mmd/mmd-valuation.service" \
      /etc/systemd/system/mmd-valuation.service
  fi
  mkdir -p /etc/anthemic-mmd
  ABS_KEY_FILE="${INCOMING}/private/abs-indicator-api-key"
  {
    if [[ -f "${FRED_KEY_FILE}" ]]; then
      printf 'FRED_API_KEY=%s\n' "$(tr -d '\r\n' < "${FRED_KEY_FILE}")"
    else
      printf '# FRED_API_KEY not set — margin-debt uses public FRED CSV fallback\n'
    fi
    if [[ -f "${ABS_KEY_FILE}" ]]; then
      printf 'ABS_INDICATOR_API_KEY=%s\n' "$(tr -d '\r\n' < "${ABS_KEY_FILE}")"
    else
      printf '# ABS_INDICATOR_API_KEY not set — AU headline cards use FRED/OECD fallback\n'
    fi
    printf 'HUB_ORIGIN=https://anthemic-developments.com\n'
    printf '# MMD_FRED_FRESHNESS_CACHE_TTL=300\n'
  } > "${MMD_ENV}"
  chmod 640 "${MMD_ENV}"
  chown root:www-data "${MMD_ENV}"
  if ! python3 -c "import sys; sys.path.insert(0, '${MMD_OPT}'); import treasury_fetch" 2>/dev/null; then
    echo "anthemic-hub-deploy-apply: treasury_fetch import failed under ${MMD_OPT}" >&2
    ls -la "${MMD_OPT}" >&2 || true
    exit 1
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload
    systemctl enable mmd-valuation.service
    systemctl restart mmd-valuation.service
    if ! systemctl is-active --quiet mmd-valuation.service; then
      echo "anthemic-hub-deploy-apply: mmd-valuation.service is not active" >&2
      systemctl status mmd-valuation.service --no-pager >&2 || true
      journalctl -u mmd-valuation.service -n 40 --no-pager >&2 || true
      exit 1
    fi
    if command -v curl >/dev/null 2>&1; then
      health_ok=0
      for _ in 1 2 3 4 5 6 7 8; do
        if curl -fsS --max-time 5 http://127.0.0.1:8071/health | grep -q '"ok"'; then
          health_ok=1
          break
        fi
        sleep 2
      done
      if [[ "${health_ok}" -ne 1 ]]; then
        echo "anthemic-hub-deploy-apply: mmd-valuation /health check failed" >&2
        journalctl -u mmd-valuation.service -n 40 --no-pager >&2 || true
        exit 1
      fi
      fresh_ok=0
      fresh_body=""
      for _ in 1 2 3 4 5 6; do
        fresh_body="$(curl -fsS --max-time 12 "http://127.0.0.1:8071/freshness?deploy=1" 2>/dev/null || true)"
        if [[ -n "${fresh_body}" ]] && printf '%s' "${fresh_body}" | python3 -c \
          'import json,sys; d=json.load(sys.stdin); assert len(d.get("series") or {})>=1, d'; then
          fresh_ok=1
          break
        fi
        sleep 3
      done
      if [[ "${fresh_ok}" -ne 1 ]]; then
        if [[ ! -f "${FRED_KEY_FILE}" ]]; then
          echo "anthemic-hub-deploy-apply: skipping FRED freshness probe (no private/fred-api-key in bundle)" >&2
        else
          echo "anthemic-hub-deploy-apply: WARN — /freshness?deploy=1 had no series (FRED may be slow); continuing (mmd-valuation /health ok)" >&2
          printf '%s\n' "${fresh_body}" | head -c 600 >&2 || true
          journalctl -u mmd-valuation.service -n 25 --no-pager >&2 || true
        fi
      fi
    fi
  fi
else
  echo "anthemic-hub-deploy-apply: missing incoming-hub/mmd/ (valuation API not updated)" >&2
  exit 1
fi

chown -R www-data:www-data "${DEST}"
chmod -R a+rX "${DEST}"

if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx
fi

echo "anthemic-hub-deploy-apply: OK"
