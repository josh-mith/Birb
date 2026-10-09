import argparse
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path


BIOS = {
    "American Crow": "A clever black-feathered trickster who remembers every snack spot and every rival.",
    "American Goldfinch": "A tiny sunbeam flitting through the weeds, powered by seeds and pure sparkle.",
    "American Robin": "A cheerful lawn scout with a berry-bright belly and an excellent worm radar.",
    "Bewick's Wren": "A bold little tail-flicker that sings like it has a whole orchestra hidden in its chest.",
    "Blue-gray Gnatcatcher": "A silvery sprite that zips through branches faster than a blink spell.",
    "Brown-headed Cowbird": "A sneaky prairie wanderer with shiny armor and mysterious parenting tactics.",
    "Canada Goose": "A honking sky tank that travels in formation and guards picnic turf with confidence.",
    "Carolina Chickadee": "A pocket-sized forest friend calling its name like a secret password.",
    "Carolina Wren": "A cinnamon song-blaster whose voice is far bigger than its round little body.",
    "Cedar Waxwing": "A silky masked berry-ninja with polished feathers and a sweet tooth.",
    "Dark-eyed Junco": "A snow-colored shadow hopper that appears when the air turns crisp and magical.",
    "Eurasian Collared-Dove": "A soft gray peace-messenger with a neat collar and a gentle coo attack.",
    "House Finch": "A rosy-headed rooftop bard that turns ordinary mornings into concerts.",
    "House Sparrow": "A scrappy city companion that can find crumbs in any kingdom.",
    "Marsh Wren": "A reed-dwelling chatterbox that builds secret forts in the cattails.",
    "Mourning Dove": "A gentle dawn crooner whose wings whistle softly when it launches into the sky.",
    "Northern Cardinal": "A fiery red guardian of the garden with a sharp, cheerful song.",
    "Northern Flicker": "A spotted ground-forager with a flash of wing-magic and a woodpecker's spark.",
    "Red-bellied Woodpecker": "A striped tree-knocker with a hidden blush and a powerful beak drill.",
    "Tufted Titmouse": "A tiny gray knight with a crest, bright eyes, and fearless curiosity.",
    "White-eyed Vireo": "A bright-eyed leaf wizard singing questions from deep inside the green.",
    "White-throated Sparrow": "A crisp little traveler with a whistle that sounds like a forest spell.",
    "White-winged Dove": "A desert-soft flyer marked with moonlit wings and a mellow coo.",
    "Yellow-rumped Warbler": "A butter-flashed bug hunter that zips through trees like a tiny lightning bolt.",
}


HABITATS = {
    "American Crow": "Urban / Woodland",
    "American Goldfinch": "Fields / Backyard",
    "American Robin": "Lawn / Woodland",
    "Bewick's Wren": "Brush / Woodland Edge",
    "Blue-gray Gnatcatcher": "Woodland",
    "Brown-headed Cowbird": "Fields / Pasture",
    "Canada Goose": "Lakeside",
    "Carolina Chickadee": "Woodland",
    "Carolina Wren": "Brush / Backyard",
    "Cedar Waxwing": "Orchard / Woodland Edge",
    "Dark-eyed Junco": "Woodland Edge",
    "Eurasian Collared-Dove": "Urban / Backyard",
    "House Finch": "Backyard / Urban",
    "House Sparrow": "Urban",
    "Marsh Wren": "Wetland",
    "Mourning Dove": "Backyard / Open Country",
    "Northern Cardinal": "Backyard / Woodland Edge",
    "Northern Flicker": "Open Woodland",
    "Red-bellied Woodpecker": "Woodland",
    "Tufted Titmouse": "Woodland",
    "White-eyed Vireo": "Thicket",
    "White-throated Sparrow": "Brush / Woodland Edge",
    "White-winged Dove": "Backyard / Open Country",
    "Yellow-rumped Warbler": "Woodland Edge",
}


RARITIES = {
    "American Crow": "Common",
    "American Goldfinch": "Common",
    "American Robin": "Common",
    "Bewick's Wren": "Special",
    "Blue-gray Gnatcatcher": "Uncommon",
    "Brown-headed Cowbird": "Common",
    "Canada Goose": "Common",
    "Carolina Chickadee": "Common",
    "Carolina Wren": "Common",
    "Cedar Waxwing": "Uncommon",
    "Dark-eyed Junco": "Common",
    "Eurasian Collared-Dove": "Special",
    "House Finch": "Common",
    "House Sparrow": "Common",
    "Marsh Wren": "Uncommon",
    "Mourning Dove": "Common",
    "Northern Cardinal": "Legendary Yard Visitor",
    "Northern Flicker": "Uncommon",
    "Red-bellied Woodpecker": "Common",
    "Tufted Titmouse": "Common",
    "White-eyed Vireo": "Uncommon",
    "White-throated Sparrow": "Common",
    "White-winged Dove": "Special",
    "Yellow-rumped Warbler": "Uncommon",
}


DATE_FORMATS = ("%Y-%m-%d", "%d %b %Y", "%m/%d/%Y", "%m-%d-%Y")


def parse_date(value):
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            continue
    return datetime.max


def image_slug(name):
    slug = name.lower().replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return slug.strip("_")


def stable_code(name, scientific=""):
    # Stable across runs: prefer scientific-name slug, fall back to common-name slug.
    # eBird CSVs don't include speciesCode, so this is our stable key (survives reordering).
    base = scientific or name
    slug = base.lower().replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return slug or image_slug(name)


def guess_habitat(name):
    return HABITATS.get(name, "Unknown Habitat")


def guess_rarity(name):
    return RARITIES.get(name, "Common")


def guess_bio(name):
    return BIOS.get(name, "A mysterious feathered friend waiting for its Pokédex legend.")


def build_parser():
    repo_root = Path(__file__).resolve().parents[1]
    default_csv = repo_root / "MyEBirdData.csv"
    if not default_csv.exists():
        alt = Path(__file__).resolve().parent / "MyEBirdData.csv"
        if alt.exists():
            default_csv = alt
    p = argparse.ArgumentParser(description="Build birb PWA data files from an eBird CSV export.")
    p.add_argument("--input", default=str(default_csv), help="Path to MyEBirdData.csv")
    p.add_argument("--out", default=str(repo_root / "web" / "data"), help="Output directory for JSON files")
    p.add_argument(
        "--regional",
        default=str(repo_root / "web" / "data" / "travis-county.json"),
        help="Regional undiscovered-species catalog to merge into all-birds.json",
    )
    p.add_argument("--no-check-images", action="store_true", help="Skip missing-artwork warnings")
    p.add_argument("--strict", action="store_true", help="Exit non-zero if artwork is missing")
    p.add_argument("--no-legacy", action="store_true", help="Skip writing legacy dex.json")
    return p


def check_images(entries, web_dir, strict=False):
    missing = []
    for e in entries:
        for key in ("icon_path", "full_path"):
            rel = e.get(key, "")
            if not rel or rel.startswith("assets/silhouettes/"):
                continue
            if not (web_dir / rel).exists():
                missing.append(f"{e.get('code')}: {rel}")
    if missing:
        print(f"WARNING: {len(missing)} artwork file(s) missing:", file=sys.stderr)
        for m in missing[:20]:
            print(f"  - {m}", file=sys.stderr)
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more", file=sys.stderr)
        if strict:
            raise SystemExit(f"strict: {len(missing)} missing artwork file(s)")
    else:
        print("Artwork check: all icon/full files present (silhouette fallbacks excluded).")
    return missing


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    repo_root = Path(__file__).resolve().parents[1]
    csv_file = Path(args.input)
    out_dir = Path(args.out)
    regional_file = Path(args.regional)
    web_dir = repo_root / "web"
    first_sightings = {}

    with csv_file.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        required_fields = {"Common Name", "Scientific Name", "Date", "Location"}
        missing_fields = required_fields - set(reader.fieldnames or [])
        if missing_fields:
            raise ValueError(f"Missing required CSV fields: {', '.join(sorted(missing_fields))}")

        for row in reader:
            name = row.get("Common Name", "").strip()
            if not name:
                continue

            sighting_date = parse_date(row.get("Date", "").strip())
            if name not in first_sightings or sighting_date < first_sightings[name]["date"]:
                first_sightings[name] = {"date": sighting_date, "row": row}

    # Deterministic order: earliest sighting first, then name. Display numbers
    # (num) follow this order, but `code`/`id` stay stable across re-runs.
    ordered = sorted(first_sightings.values(), key=lambda s: (s["date"], s["row"].get("Common Name", "")))
    sightings = []
    catalog_by_code = {}
    for sighting in ordered:
        row = sighting["row"]
        name = row["Common Name"].strip()
        scientific = row.get("Scientific Name", "").strip()
        sighting_date = sighting["date"]
        formatted_date = row.get("Date", "").strip()
        if sighting_date != datetime.max:
            formatted_date = sighting_date.strftime("%Y-%m-%d")

        slug = image_slug(name)
        code = stable_code(name, scientific)
        sightings.append(
            {
                "code": code,
                "name": name,
                "scientific": scientific,
                "date": formatted_date,
                "location": row.get("Location", "").strip(),
            }
        )
        catalog_by_code[code] = {
            "id": code,
            "code": code,
            "name": name,
            "scientific": scientific,
            "habitat": guess_habitat(name),
            "rarity": guess_rarity(name),
            "bio": guess_bio(name),
            "icon_path": f"assets/icons/icon_{slug}.png",
            "full_path": f"assets/full/full_{slug}.png",
        }

    # Merge regional undiscovered-species catalog (hand-curated) so all-birds.json
    # is the single species catalog. Regional file already uses stable code ids.
    regional_count = 0
    if regional_file.exists():
        try:
            regional = json.loads(regional_file.read_text(encoding="utf-8"))
            for entry in regional if isinstance(regional, list) else []:
                code = entry.get("code") or stable_code(entry.get("name", ""), entry.get("scientific", ""))
                if code not in catalog_by_code:
                    catalog_by_code[code] = {
                        "id": code,
                        "code": code,
                        "name": entry.get("name", ""),
                        "scientific": entry.get("scientific", ""),
                        "habitat": entry.get("habitat", "Unknown Habitat"),
                        "rarity": entry.get("rarity", "Common"),
                        "bio": entry.get("bio", guess_bio(entry.get("name", ""))),
                        "icon_path": entry.get("icon_path", "assets/silhouettes/songbird.svg"),
                        "full_path": entry.get("full_path", "assets/silhouettes/songbird.svg"),
                    }
                    regional_count += 1
        except (json.JSONDecodeError, OSError) as exc:
            print(f"WARNING: could not read regional file {regional_file}: {exc}", file=sys.stderr)

    # Assign display numbers: sighted species first (by earliest date), then regional extras by name.
    all_birds = []
    for index, s in enumerate(sightings, start=1):
        entry = dict(catalog_by_code[s["code"]])
        entry["num"] = f"{index:03d}"
        all_birds.append(entry)
    extras = sorted(
        (c for code, c in catalog_by_code.items() if code not in {s["code"] for s in sightings}),
        key=lambda c: c["name"],
    )
    for offset, entry in enumerate(extras, start=len(sightings) + 1):
        row = dict(entry)
        row["num"] = f"{offset:03d}"
        all_birds.append(row)

    out_dir.mkdir(parents=True, exist_ok=True)
    all_birds_file = out_dir / "all-birds.json"
    sightings_file = out_dir / "user-sightings.json"
    with all_birds_file.open("w", encoding="utf-8") as file:
        json.dump(all_birds, file, indent=2)
        file.write("\n")
    with sightings_file.open("w", encoding="utf-8") as file:
        json.dump(sightings, file, indent=2)
        file.write("\n")
    print(f"Wrote {len(all_birds)} species ({len(sightings)} sighted + {regional_count} regional) -> {all_birds_file}")
    print(f"Wrote {len(sightings)} sightings from {csv_file} -> {sightings_file}")

    if not args.no_legacy:
        legacy = []
        sighted_codes = {s["code"] for s in sightings}
        sight_by_code = {s["code"]: s for s in sightings}
        for entry in all_birds:
            row = dict(entry)
            s = sight_by_code.get(entry["code"])
            row["date"] = s["date"] if s else ""
            row["location"] = s["location"] if s else "Travis County, TX"
            row["is_unlocked"] = entry["code"] in sighted_codes
            legacy.append(row)
        with (out_dir / "dex.json").open("w", encoding="utf-8") as file:
            json.dump(legacy, file, indent=2)
            file.write("\n")
        print(f"Wrote legacy {len(legacy)} entries -> {out_dir / 'dex.json'} (deprecated: prefer all-birds.json)")

    if not args.no_check_images:
        check_images(all_birds, web_dir, strict=args.strict)


if __name__ == "__main__":
    main()
