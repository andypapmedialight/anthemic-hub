# Stage graphics — licensing & attribution

This experiment uses **placeholder SVGs** in `graphics/` until you import licensed files into `graphics/vendor/`.

## Vecteezy (free license)

- Download from [vecteezy.com](https://www.vecteezy.com/) (free account).
- **Attribution required** for free downloads — credit the contributor named on each asset page.
- See curated links in [`sources.json`](./sources.json).

Example attribution line (adjust per file):

> Graphics by [Contributor Name] on [Vecteezy](https://www.vecteezy.com/)

## Freepik / Flaticon (free license)

- Download from [freepik.com](https://www.freepik.com/) or [flaticon.com](https://www.flaticon.com/) (same group).
- **Attribution required** on free tier — typically:

> Designed by [Author] / [Freepik](https://www.freepik.com)

## Importing

1. Pick assets from `sources.json` (Vecteezy **Music band** / **Concert** collections or Freepik **Concert** / **Stage** searches).
2. Download as **SVG** (not PNG) when possible.
3. Run from repo root:

   ```bash
   ./scripts/import-stage-graphics.sh ~/Downloads
   ```

   Or copy files manually to `graphics/vendor/<filename>` (see `sources.json` → `layers.*.file`).

4. Reload `/design/stop-making-sense/` — vendor files load first; placeholders are fallback.

## Do not

- Hotlink Vecteezy/Freepik preview CDN URLs in production.
- Commit vendor SVGs without confirming license tier (free vs Pro) matches your use.
