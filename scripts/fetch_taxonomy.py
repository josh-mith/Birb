"""Fetch eBird taxonomy (and optional NA species checklist) for birb.

Requires an eBird API key: https://ebird.org/api/keygen
Never commit the key — pass via --api-key flag or EBIRD_API_KEY env var.

Outputs (default under web/data/):
  taxonomy.json   - raw eBird taxonomy (species + subspecies etc.)
  na-checklist.csv - species-level checklist (category == 'species'), the
                     starting point for the Phase-2 1161-bird expansion.

Usage:
  EBIRD_API_KEY=xxxxxx python scripts/fetch_taxonomy.py
  python scripts/fetch_taxonomy.py --api-key xxxxxx --out web/data
"""

import argparse
import csv
import json
import os
import sys
import urllib.request
from pathlib import Path

TAXONOMY_URL = "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json"


def build_parser():
    repo_root = Path(__file__).resolve().parents[1]
    p = argparse.ArgumentParser(description="Fetch eBird taxonomy for birb Phase 2.")
    p.add_argument("--api-key", default=os.environ.get("EBIRD_API_KEY", ""), help="eBird API key")
    p.add_argument("--out", default=str(repo_root / "web" / "data"), help="Output directory")
    p.add_argument("--locale", default="en", help="Taxonomy locale")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    if not args.api_key:
        raise SystemExit("Missing eBird API key: pass --api-key or set EBIRD_API_KEY.")
    out_dir = Path(args.out)
    url = f"{TAXONOMY_URL}&locale={args.locale}"
    req = urllib.request.Request(url, headers={"X-eBirdApiToken": args.api_key})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            taxonomy = json.load(res)
    except Exception as exc:  # noqa: BLE001 - surface any fetch failure plainly
        raise SystemExit(f"Failed to fetch taxonomy: {exc}") from exc

    species = [t for t in taxonomy if t.get("category") == "species"]
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "taxonomy.json").open("w", encoding="utf-8") as f:
        json.dump(taxonomy, f, indent=2)
        f.write("\n")
    with (out_dir / "na-checklist.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["speciesCode", "comName", "sciName", "order"])
        w.writeheader()
        for t in sorted(species, key=lambda t: (t.get("taxonOrder", 0))):
            w.writerow(
                {
                    "speciesCode": t.get("speciesCode", ""),
                    "comName": t.get("comName", ""),
                    "sciName": t.get("sciName", ""),
                    "order": t.get("taxonOrder", ""),
                }
            )
    print(f"taxonomy: {len(taxonomy)} taxa, {len(species)} species -> {out_dir}")
    print("Tip: feed taxonomy.json to parse_ebird.py --taxonomy to attach speciesCode aliases.")


if __name__ == "__main__":
    sys.exit(main())
