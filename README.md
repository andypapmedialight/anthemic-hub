# anthemic-hub

Landing page and project menu for **anthemic-developments.com**.

This repo owns the static landing page at `/` and the **bass coaching** mini-site under `/bass/` (copied from the PapaWeb project). Other linked projects (Set List Generator, personal site) deploy from their own repos.

## Local edit and preview

It is just plain HTML/CSS, no build step. Open `index.html` directly in a browser for a quick look at the landing page only; subpaths such as `/bass/` need a real HTTP server.

From the repo root:

```bash
./scripts/serve-local.sh
```

Then open **http://127.0.0.1:8000/**. Use another port with `PORT=9000 ./scripts/serve-local.sh`.

Equivalent without the script:

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 -m http.server -b 127.0.0.1 8000
```

## Deploy

Push to `main` and GitHub Actions ships `index.html` (and optional `assets/`) to the Droplet at `/var/www/anthemic-hub/`. No Set List / API restart involved.

```bash
git commit -am "hub: ..."
git push origin main
```

Manual: **Actions → Deploy → Run workflow**.

**`/bass/` 404 in the browser:** Hub CI only checks that **`/var/www/anthemic-hub/bass/`** is on disk after apply; **anthemic-ops** CI checks **`https://…/bass/`** (nginx `location /bass/` + `try_files` in `anthemic-hub.conf`). Deploy **hub** first so files exist, then **ops** (or reload nginx) so routing matches.

**Hub deploy fails “bass missing on disk”:** Reinstall **`/usr/local/bin/anthemic-hub-deploy-apply.sh`** from this repo (the two-step `rsync` for `index.html` + `bass/`). Without that, an older script can leave **`/var/www/anthemic-hub/bass/`** empty even when **`incoming-hub/bass/`** is correct.

## One-time Droplet setup

The Droplet already has a `deploy` user (set up for the Set List repo). The hub adds its own apply script so the same CI key can deploy independently.

```bash
# Copy script to Droplet (from this repo root, on your laptop)
scp -P 26555 -i ~/.ssh/id_ed25519 \
  scripts/droplet/anthemic-hub-deploy-apply.sh \
  root@170.64.232.47:/tmp/

# As root on the Droplet
sudo install -o root -g root -m 755 \
  /tmp/anthemic-hub-deploy-apply.sh \
  /usr/local/bin/anthemic-hub-deploy-apply.sh
rm /tmp/anthemic-hub-deploy-apply.sh

# Allow deploy user to run only this script with sudo
sudo tee /etc/sudoers.d/deploy-anthemic-hub <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/bin/anthemic-hub-deploy-apply.sh
EOF
sudo chmod 440 /etc/sudoers.d/deploy-anthemic-hub
sudo visudo -cf /etc/sudoers.d/deploy-anthemic-hub  # should print "parsed OK"

# Make sure the upload destination exists for the deploy user
sudo -u deploy mkdir -p /home/deploy/incoming-hub
```

## GitHub repository secrets

Same four as the Set List repo (the same key works because the `deploy` user trusts it):

| Name | Value |
|------|-------|
| `DEPLOY_HOST` | `170.64.232.47` |
| `DEPLOY_PORT` | `26555` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | private key matching deploy's `authorized_keys` |

## Files

- `index.html` — the landing page
- `bass/` — bass coaching static site (`/bass/`, entry `bass/index.html` plus `bass/brand_assets/` including **`AndyPBass.png`** - commit this binary or CI/deploy will ship HTML without the hero image); sync from PapaWeb when the site changes
- `assets/` — optional images / OG card / icons (served at `/assets/...`)
- `scripts/droplet/anthemic-hub-deploy-apply.sh` — installed at `/usr/local/bin/`
- `.github/workflows/deploy.yml` — push-to-main deploy

## Adding a new project card

Edit `index.html`, copy an existing `<a class="card">` block, change `href`, title, description, and badge:

- `<span class="badge live">Live</span>` — finished and live
- `<span class="badge">Coming soon</span>` plus `aria-disabled="true" onclick="event.preventDefault()"` — placeholder
- `<span class="badge external">External &nearr;</span>` plus `target="_blank" rel="noopener noreferrer"` — link off-domain

Commit + push.
