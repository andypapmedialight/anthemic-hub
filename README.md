# anthemic-hub

Static site for **anthemic-developments.com** - hub landing page, gig calendar, bass coaching, brain map, and admin panel.

## Structure

```
index.html                          Hub landing page
bass/                               Bass coaching static site (/bass/)
brain/                              3D brain map (/brain/)
personal/
  writing/
    index.html                      Writing placeholder (/personal/writing/) — quill & ink animation
gigs/
  index.html                        Gig calendar (/gigs/) - reads gigs.json at runtime
  gigs.json                         Gig data - seed only; live copy managed by admin panel
anth-dev-ad/
  admin/
    index.php                       Admin panel - PHP built-in server via Docker (URL: /anth-dev-ad/admin/)
    php.ini                         Upload limits for the PHP container (20 MB)
content/
  hub.json                          Editable site content (bio, instruments, projects, reading list) - managed by admin panel
assets/
  gallery/                          Photo gallery images - managed by admin panel
  gallery/manifest.json             Auto-generated on upload/delete; drives front-end gallery
  cinnamon.jpg                      "Who am I" card photo
scripts/
  droplet/anthemic-hub-deploy-apply.sh   Installed on Droplet as /usr/local/bin/
.github/workflows/deploy.yml        Push-to-main CI deploy
```

## Local preview

No build step. Serve from repo root:

```bash
./scripts/serve-local.sh
# or
python3 -m http.server -b 127.0.0.1 8000
```

Open **http://127.0.0.1:8000/**. The admin panel requires the PHP Docker container (see below).

## Deploy

Push to `main` → GitHub Actions rsyncs all dirs to the Droplet → apply script promotes to web root.

```bash
git push origin main
```

### What the deploy preserves (never overwritten by CI)

| File | Reason |
|------|--------|
| `gigs/gigs.json` | Admin-managed gig data |
| `content/hub.json` | Admin-managed site content |
| `assets/gallery/manifest.json` | Admin-managed gallery manifest |

Git copies of these files act as **seeds on first deploy only**. After that the admin panel is the source of truth.

## Admin panel

Accessible at `https://anthemic-developments.com/anth-dev-ad/admin/` (nginx `auth_basic` + `proxy_pass` to the PHP container).

Two auth layers:
1. **nginx `auth_basic`** - htpasswd credentials (set once on Droplet, never in git)
2. **PHP password** - bcrypt hash stored in Docker env var

Three tabs: **Gig calendar** · **Site content** · **Gallery**

### Admin security (PHP)

The admin app (`anth-dev-ad/admin/index.php`) applies consistent hardening:

- **CSRF tokens** on authenticated state-changing POSTs (including sign-out).
- **Session cookies**: `HttpOnly`, `SameSite=Lax`, and `Secure` when the request is HTTPS or `X-Forwarded-Proto` is `https` (so TLS behind nginx still gets a secure session cookie).
- **Gig URLs** (event, tickets, maps, venue): only `http://` and `https://` are stored; enforced both on form saves and when using the **Raw JSON** editor (raw input is normalised through the same sanitisation as structured edits).
- **Poster and gallery uploads**: MIME is checked with `getimagesize()`; the file on disk always uses an extension that matches that MIME (`jpg`, `png`, `gif`, `webp`), not the browser-supplied filename extension.
- **Poster filenames** in JSON: `basename` only, restricted to a safe character set (path segments like `../` are rejected).
- **Public hub gallery** (`assets/js/hub.js`): image `alt` text built from manifest entries is HTML-escaped so a hostile filename cannot break attribute boundaries.

### PHP Docker container (Droplet)

The admin panel runs as a PHP 8.2 CLI container. Run once, persists via `--restart unless-stopped`:

```bash
# Generate password hash
docker run --rm php:8.2-cli php -r "echo password_hash('YOUR_PASSWORD', PASSWORD_BCRYPT) . PHP_EOL;"

# Start container
docker run -d --name gigs-admin --restart unless-stopped -p 127.0.0.1:9001:9001 -e GIGS_ADMIN_PASSWORD_HASH='$2y$10$...' -v /var/www/anthemic-hub:/app php:8.2-cli php -S 0.0.0.0:9001 -c /app/anth-dev-ad/admin/php.ini /app/anth-dev-ad/admin/index.php

# Create nginx basic auth user (one time)
sudo apt install apache2-utils -y
sudo htpasswd -c /etc/nginx/conf.d/gigs-admin.htpasswd andy
```

The volume mounts the full `/var/www/anthemic-hub` dir so the container can read/write `gigs/gigs.json`, `content/hub.json`, `assets/gallery/`, and `assets/gig-posters/`.

## Dynamic content

Two JSON files are fetched client-side at runtime:

| URL | Powers |
|-----|--------|
| `/content/hub.json` | Hero, employer strip, ships line, gallery tagline, who-am-i, music prose, instruments, projects, **reading_list** (intro + categories of books with `status`: `read` \| `reading`, optional `url`, `note`) |
| `/assets/gallery/manifest.json` | Photo gallery image list |

The HTML includes fallback content so the page renders even if JS or the fetches fail.

## nginx

Config lives in **anthemic-ops** repo (`nginx/sites-available/anthemic-hub.conf`). Key locations:

| Location | Behaviour |
|----------|-----------|
| `/anth-dev-ad/admin/` | `auth_basic` + `proxy_pass` to PHP container on `127.0.0.1:9001` |
| `/setlist/` | Proxy to Set List SPA |
| `/api/` | Proxy to Set List API on `127.0.0.1:8081` |
| `/bass/` | Static files from `/var/www/anthemic-hub/bass/` |
| `/` | Static files from `/var/www/anthemic-hub/` |

## One-time Droplet setup

```bash
# Install apply script
scp -P 26555 scripts/droplet/anthemic-hub-deploy-apply.sh root@YOUR_DROPLET:/tmp/
sudo install -o root -g root -m 755 /tmp/anthemic-hub-deploy-apply.sh /usr/local/bin/anthemic-hub-deploy-apply.sh

# Sudoers entry for deploy user
sudo tee /etc/sudoers.d/deploy-anthemic-hub <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/bin/anthemic-hub-deploy-apply.sh
EOF
sudo chmod 440 /etc/sudoers.d/deploy-anthemic-hub

# Incoming dir
sudo -u deploy mkdir -p /home/deploy/incoming-hub
```

## GitHub secrets

| Name | Value |
|------|-------|
| `DEPLOY_HOST` | Droplet IP |
| `DEPLOY_PORT` | SSH port |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Private key matching deploy's `authorized_keys` |

## Interest filter

The hub landing page has a "What are you interested in?" dropdown. Cards and sections have `data-interests="music gigs teaching ..."` attributes. JS sorts matching content to the top. Section-level `data-interests` on hub-section divs (e.g. the music bio section) also participate in sorting.

## Adding a project card

Copy an existing `<a class="card">` in `index.html`, set `href`, title, description, badge, and `data-interests`:

- `<span class="badge live">Live</span>` - live project
- `<span class="badge">Coming soon</span>` + `aria-disabled="true" onclick="event.preventDefault()"` - placeholder
- `<span class="badge external">External &nearr;</span>` + `target="_blank" rel="noopener noreferrer"` - off-domain link
