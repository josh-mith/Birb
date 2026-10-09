"""Validate birb artwork against the catalog. $0 pipeline companion.

Checks every species in web/data/all-birds.json for its expected
  web/assets/icons/icon_{slug}.png
  web/assets/full/full_{slug}.png
where slug = parse_ebird.image_slug(common name).

Reports present / missing / empty files and exits non-zero if anything is
missing (CI-friendly). Silhouette-SVG catalog entries are skipped — they
intentionally have no PNG yet.

Usage:
  python scripts/check_assets.py
  python scripts/check_assets.py --source na   # check na-checklist.csv slugs
"""

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_batches import image_slug  # noqa: E402


def expected(repo_root, source):
    if source == "na":
        rows = csv.DictReader((repo_root / "web" / "data" / "na-checklist.csv").open(encoding="utf-8"))
        names = [r["comName"] for r in rows if r.get("comName")]
    else:
        birds = json.loads((repo_root / "web" / "data" / "all-birds.json").read_text(encoding="utf-8"))
        names = [
            b["name"]
            for b in birds
            if not str(b.get("icon_path", "")).startswith("assets/silhouettes/")
        ]
    return [(n, image_slug(n)) for n in names]


def main(argv=None):
    p = argparse.ArgumentParser(description="Validate birb sprite coverage.")
    p.add_argument("--source", choices=["catalog", "na"], default="catalog")
    args = p.parse_args(argv)
    repo_root = Path(__file__).resolve().parents[1]
    icons = repo_root / "web" / "assets" / "icons"
    fulls = repo_root / "web" / "assets" / "full"

    missing, empty, ok = [], [], 0
    for name, slug in expected(repo_root, args.source):
        for folder, prefix in ((icons, "icon_"), (fulls, "full_")):
            f = folder / f"{prefix}{slug}.png"
            if not f.exists():
                missing.append(str(f.relative_to(repo_root)))
            elif f.stat().st_size == 0:
                empty.append(str(f.relative_to(repo_root)))
            else:
                ok += 1

    total = ok + len(missing) + len(empty)
    print(f"artwork: {ok}/{total} files present", end="")
    print(f" ({len(missing)} missing, {len(empty)} empty)" if (missing or empty) else " — complete!")
    for m in missing[:30]:
        print(f"  MISSING {m}")
    if len(missing) > 30:
        print(f"  ... and {len(missing) - 30} more")
    for e in empty:
        print(f"  EMPTY {e}")
    raise SystemExit(1 if (missing or empty) else 0)


if __name__ == "__main__":
    main()
