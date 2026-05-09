import csv
import json
import os
from datetime import datetime

def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        pass
    try:
        return datetime.strptime(date_str, "%m/%d/%Y")
    except ValueError:
        pass
    try:
        return datetime.strptime(date_str, "%m-%d-%Y")
    except ValueError:
        pass

    return datetime.max # Fallback

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(base_dir, "MyEBirdData.csv")
    out_file = os.path.join(base_dir, "../web/data/dex.json")

    sightings = {}

    if not os.path.exists(csv_file):
        print(f"File not found: {csv_file}")
        return

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Common Name", "")
            if not name:
                continue

            date_str = row.get("Date", "")
            dt = parse_date(date_str)

            if name not in sightings:
                sightings[name] = {
                    "row": row,
                    "dt": dt
                }
            else:
                if dt < sightings[name]["dt"]:
                    sightings[name] = {
                        "row": row,
                        "dt": dt
                    }

    # Sort sightings by earliest date first
    sorted_sightings = sorted(sightings.values(), key=lambda x: x["dt"])

    dex_data = []
    count = 1
    for sighting in sorted_sightings:
        if count > 24:
            break

        row = sighting["row"]
        name = row.get("Common Name", "")
        scientific = row.get("Scientific Name", "")
        date_str = row.get("Date", "")
        location = row.get("Location", "")

        # Ensure spaces and hyphens are converted to lowercase underscores
        sprite_name = name.lower().replace(' ', '_').replace('-', '_').replace('\'', '')
        sprite_path = f"/assets/icons/icon_{sprite_name}.png"

        # ID is 3 digits padded with zeros
        bird_id = f"{count:03d}"

        # Format date back to YYYY-MM-DD
        formatted_date = sighting["dt"].strftime("%Y-%m-%d") if sighting["dt"] != datetime.max else date_str

        bird_data = {
            "id": bird_id,
            "name": name,
            "scientific": scientific,
            "date": formatted_date,
            "location": location,
            "sprite": sprite_path,
            "is_unlocked": True
        }

        dex_data.append(bird_data)
        count += 1

    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(dex_data, f, indent=2)

if __name__ == "__main__":
    main()
