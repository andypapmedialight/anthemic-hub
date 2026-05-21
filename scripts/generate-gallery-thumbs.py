#!/usr/bin/env python3
"""Build 176×176 gallery thumbnails (2× 88px grid) under assets/gallery/thumbs/."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "assets" / "gallery"
THUMBS = GALLERY / "thumbs"
THUMB_SIZE = 176
EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def main() -> int:
    try:
        from PIL import Image
    except ImportError:
        print("generate-gallery-thumbs: Pillow not installed; skip", file=sys.stderr)
        return 0

    if not GALLERY.is_dir():
        print(f"generate-gallery-thumbs: missing {GALLERY}", file=sys.stderr)
        return 1

    THUMBS.mkdir(parents=True, exist_ok=True)
    n = 0
    for path in sorted(GALLERY.iterdir()):
        if not path.is_file() or path.suffix.lower() not in EXTS:
            continue
        out = THUMBS / path.name
        img = Image.open(path)
        img = img.convert("RGB") if img.mode not in ("RGB", "L") else img
        img.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS)
        save_kw = {"optimize": True, "quality": 82}
        if path.suffix.lower() in (".jpg", ".jpeg"):
            img.save(out, "JPEG", **save_kw)
        elif path.suffix.lower() == ".png":
            img.save(out, "PNG", optimize=True)
        elif path.suffix.lower() == ".webp":
            img.save(out, "WEBP", quality=82)
        else:
            img.save(out.with_suffix(".jpg"), "JPEG", **save_kw)
        n += 1
        print(f"  {path.name} -> thumbs/{out.name}")

    print(f"generate-gallery-thumbs: {n} thumbnail(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
