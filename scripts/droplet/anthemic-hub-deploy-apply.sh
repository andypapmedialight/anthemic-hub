#!/usr/bin/env bash
# Installed on the Droplet as /usr/local/bin/anthemic-hub-deploy-apply.sh (root, 755).
# Invoked by the deploy user via:
#   sudo /usr/local/bin/anthemic-hub-deploy-apply.sh
# Optional first argument sets INCOMING (manual override).
# If no argument: read one line from /tmp/anthemic-hub-incoming.path if it exists (CI writes this before sudo — works when SUDO_USER is unset).
# Else read /home/${SUDO_USER}/.incoming-hub-path when present (manual).
# Else default /home/deploy/incoming-hub.
#   index.html        - the hub landing page
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
    sleep 1
    if ! systemctl is-active --quiet papaweb-contact.service; then
      echo "anthemic-hub-deploy-apply: papaweb-contact.service is not active" >&2
      systemctl status papaweb-contact.service --no-pager >&2 || true
      journalctl -u papaweb-contact.service -n 40 --no-pager >&2 || true
      exit 1
    fi
    if command -v curl >/dev/null 2>&1; then
      if ! curl -fsS --max-time 10 http://127.0.0.1:8072/health >/dev/null; then
        echo "anthemic-hub-deploy-apply: papaweb-contact /health check failed" >&2
        journalctl -u papaweb-contact.service -n 40 --no-pager >&2 || true
        exit 1
      fi
    fi
  fi
fi

# Morning Macro: valuation API (BIS/FRED) on loopback for nginx proxy_pass.
MMD_OPT=/opt/anthemic-mmd
MMD_ENV=/etc/anthemic-mmd/valuation.env
mkdir -p "${MMD_OPT}"
if [[ -f "${INCOMING}/mmd/valuation_server.py" && -f "${INCOMING}/mmd/valuation_fetch.py" ]]; then
  install -o root -g root -m 644 "${INCOMING}/mmd/valuation_fetch.py" "${MMD_OPT}/valuation_fetch.py"
  install -o root -g root -m 755 "${INCOMING}/mmd/valuation_server.py" "${MMD_OPT}/valuation_server.py"
  if [[ -f "${INCOMING}/mmd/mmd-valuation.service" ]]; then
    install -o root -g root -m 644 "${INCOMING}/mmd/mmd-valuation.service" \
      /etc/systemd/system/mmd-valuation.service
  fi
  mkdir -p /etc/anthemic-mmd
  if [[ -f "${FRED_KEY_FILE}" ]]; then
    KEY="$(tr -d '\r\n' < "${FRED_KEY_FILE}")"
    {
      printf 'FRED_API_KEY=%s\n' "${KEY}"
      printf 'HUB_ORIGIN=https://anthemic-developments.com\n'
      printf '# MMD_FRED_FRESHNESS_CACHE_TTL=300\n'
    } > "${MMD_ENV}"
  else
    printf '# FRED_API_KEY not set — margin-debt uses public FRED CSV fallback\nHUB_ORIGIN=https://anthemic-developments.com\n# MMD_FRED_FRESHNESS_CACHE_TTL=300\n' > "${MMD_ENV}"
  fi
  chmod 640 "${MMD_ENV}"
  chown root:www-data "${MMD_ENV}"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload
    systemctl enable mmd-valuation.service
    systemctl restart mmd-valuation.service
    sleep 2
    if ! systemctl is-active --quiet mmd-valuation.service; then
      echo "anthemic-hub-deploy-apply: mmd-valuation.service is not active" >&2
      systemctl status mmd-valuation.service --no-pager >&2 || true
      journalctl -u mmd-valuation.service -n 40 --no-pager >&2 || true
      exit 1
    fi
    if command -v curl >/dev/null 2>&1; then
      if ! curl -fsS --max-time 10 http://127.0.0.1:8071/health >/dev/null; then
        echo "anthemic-hub-deploy-apply: mmd-valuation /health check failed" >&2
        journalctl -u mmd-valuation.service -n 40 --no-pager >&2 || true
        exit 1
      fi
      fresh_ok=0
      for _ in 1 2 3 4 5 6; do
        if curl -fsS --max-time 55 "http://127.0.0.1:8071/freshness?force=1" | python3 -c \
          'import json,sys; d=json.load(sys.stdin); assert len(d.get("series") or {})>=1'; then
          fresh_ok=1
          break
        fi
        sleep 5
      done
      if [[ "${fresh_ok}" -ne 1 ]]; then
        echo "anthemic-hub-deploy-apply: /freshness returned no FRED series (check FRED_API_KEY / upstream)" >&2
        curl -fsS --max-time 10 http://127.0.0.1:8071/freshness 2>/dev/null | head -c 400 || true
        echo >&2
        journalctl -u mmd-valuation.service -n 40 --no-pager >&2 || true
        exit 1
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
