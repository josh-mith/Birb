"""Generate style-locked 16-bit sprite prompt batches for birb.

$0 pipeline: you (or a Gemini creation session) generate the PNGs inside an
already-paid subscription (Gemini / ChatGPT Plus) in batches of 100, save them
under web/assets/, then run scripts/check_assets.py to validate filenames.

Each batch file contains:
  1. The shared STYLE block (paste once per session to lock the look)
  2. One per-species prompt line with the exact output filename

Filenames MUST match parse_ebird.py's image_slug(common name):
  icon: web/assets/icons/icon_{slug}.png   (square sprite, transparency on)
  full: web/assets/full/full_{slug}.png    (larger scene portrait)

Usage:
  python scripts/make_batches.py                          # current catalog (56)
  python scripts/make_batches.py --source na              # na-checklist.csv (11k)
  python scripts/make_batches.py --batch-size 100 --out assets/batches
"""

import argparse
import csv
import json
import re
from pathlib import Path

STYLE = """STYLE LOCK (apply to every sprite this session):
16-bit era monster-collector game sprite, clean pixel clusters, limited
palette, bold 2px dark outline, side 3/4 view facing left, single bird only,
no text, no watermark, no background scenery for ICONS (transparent background),
simple themed habitat vignette for FULL portraits. Match the look of the
reference: chunky readable silhouette, big expressive eye highlight, vibrant
but natural plumage colors. Square canvas. PNG output."""

ICON_SPEC = "ICON, 512x512, transparent background."
FULL_SPEC = "FULL portrait, 1024x1024, small habitat vignette behind the bird."


def image_slug(name):
    slug = name.lower().replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return slug.strip("_")


def load_catalog(repo_root):
    birds = json.loads((repo_root / "web" / "data" / "all-birds.json").read_text(encoding="utf-8"))
    return [(b["name"], b.get("scientific", ""), b.get("habitat", "")) for b in birds]


def load_na(repo_root):
    rows = list(csv.DictReader((repo_root / "web" / "data" / "na-checklist.csv").open(encoding="utf-8")))
    return [(r["comName"], r["sciName"], "") for r in rows if r.get("comName")]


def batch_text(species, batch_no):
    lines = [
        f"BIRB SPRITE BATCH {batch_no:03d} — {len(species)} species, 2 images each",
        "",
        STYLE,
        "",
        "Per-species prompts (one ICON + one FULL per species):",
        "",
    ]
    for name, sci, habitat in species:
        slug = image_slug(name)
        where = f" Lives in {habitat}." if habitat else ""
        lines.append(f"## {name} ({sci})")
        lines.append(
            f"ICON: {ICON_SPEC} {name}, {sci} game sprite. "
            f"Key field marks true to life.{where} Save as icon_{slug}.png"
        )
        lines.append(
            f"FULL: {FULL_SPEC} {name}, {sci}, same individual as the icon, "
            f"pose showing full body and tail.{where} Save as full_{slug}.png"
        )
        lines.append("")
    lines.append("Filenames are exact (lowercase, underscores). Do not rename or number them.")
    return "\n".join(lines)


def main(argv=None):
    repo_root = Path(__file__).resolve().parents[1]
    p = argparse.ArgumentParser(description="Build 16-bit sprite prompt batches.")
    p.add_argument("--source", choices=["catalog", "na"], default="catalog")
    p.add_argument("--batch-size", type=int, default=100)
    p.add_argument("--out", default=None, help="Batch dir (default web/assets/batches)")
    p.add_argument(
        "--missing-only",
        action="store_true",
        help="Only include species whose icon/full PNG is absent (the actual work queue)",
    )
    args = p.parse_args(argv)

    species = load_na(repo_root) if args.source == "na" else load_catalog(repo_root)
    if args.missing_only:
        icons = repo_root / "web" / "assets" / "icons"
        fulls = repo_root / "web" / "assets" / "full"
        species = [
            s for s in species
            if not (icons / f"icon_{image_slug(s[0])}.png").exists()
            or not (fulls / f"full_{image_slug(s[0])}.png").exists()
        ]
        if not species:
            print("Nothing missing — every species already has icon+full PNGs.")
            return
    out_dir = Path(args.out) if args.out else repo_root / "web" / "assets" / "batches"
    out_dir.mkdir(parents=True, exist_ok=True)

    for i in range(0, len(species), args.batch_size):
        chunk = species[i : i + args.batch_size]
        batch_no = i // args.batch_size + 1
        (out_dir / f"batch_{batch_no:03d}.txt").write_text(
            batch_text(chunk, batch_no), encoding="utf-8"
        )
    print(f"Wrote {(len(species) + args.batch_size - 1) // args.batch_size} batch file(s), "
          f"{len(species)} species -> {out_dir}")


if __name__ == "__main__":
    main()
