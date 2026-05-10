import csv
import json
import re
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


def main():
    repo_root = Path(__file__).resolve().parents[1]
    csv_file = repo_root / "MyEBirdData.csv"
    out_file = repo_root / "web" / "data" / "dex.json"
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

    dex_entries = []
    for index, sighting in enumerate(first_sightings.values(), start=1):
        row = sighting["row"]
        name = row["Common Name"].strip()
        sighting_date = sighting["date"]
        formatted_date = row.get("Date", "").strip()
        if sighting_date != datetime.max:
            formatted_date = sighting_date.strftime("%Y-%m-%d")

        slug = image_slug(name)
        dex_entries.append(
            {
                "id": f"{index:03d}",
                "name": name,
                "scientific": row.get("Scientific Name", "").strip(),
                "date": formatted_date,
                "location": row.get("Location", "").strip(),
                "habitat": HABITATS.get(name, "Unknown Habitat"),
                "rarity": RARITIES.get(name, "Common"),
                "bio": BIOS.get(name, "A mysterious feathered friend waiting for its Pokédex legend."),
                "icon_path": f"assets/icons/icon_{slug}.png",
                "full_path": f"assets/full/full_{slug}.png",
                "is_unlocked": True,
            }
        )

    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", encoding="utf-8") as file:
        json.dump(dex_entries, file, indent=2)
        file.write("\n")


if __name__ == "__main__":
    main()
