"""Tonight's sprite run: 32 species x icon + full = 64 images, 4 sessions.

Workflow per session (about 30-45 min each, take breaks):
  1. python scripts/tonight.py plan        # writes session packs (once)
  2. Open web/assets/batches/tonight/session_0N.txt, paste the STYLE LOCK
     block + one existing sprite as reference into Gemini, work the 8 species
  3. Save PNGs with the EXACT filenames into web/assets/icons + web/assets/full
  4. python scripts/tonight.py status       # watch the count climb
  5. After session 4: python scripts/tonight.py verify  # rebuilds catalog

Commands:
  plan     write session_01..04.txt from whatever art is still missing
  status   per-session + overall progress
  verify   check_assets + parser rebuild (run when complete)
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_batches import batch_text, image_slug  # noqa: E402

SESSION_SIZE = 8
TONIGHT_DIR = "web/assets/batches/tonight"


def repo():
    return Path(__file__).resolve().parents[1]


def missing_species(root):
    birds = json.loads((root / "web" / "data" / "all-birds.json").read_text(encoding="utf-8"))
    icons = root / "web" / "assets" / "icons"
    fulls = root / "web" / "assets" / "full"
    out = []
    for b in birds:
        slug = image_slug(b["name"])
        if not (icons / f"icon_{slug}.png").exists() or not (fulls / f"full_{slug}.png").exists():
            out.append((b["name"], b.get("scientific", ""), b.get("habitat", ""), slug))
    return out


def session_files(root):
    d = root / TONIGHT_DIR
    return sorted(d.glob("session_*.txt")) if d.exists() else []


def cmd_plan(root):
    missing = missing_species(root)
    if not missing:
        print("Nothing missing — catalog art is complete!")
        return 0
    d = root / TONIGHT_DIR
    d.mkdir(parents=True, exist_ok=True)
    for old in session_files(root):
        old.unlink()
    sessions = [missing[i : i + SESSION_SIZE] for i in range(0, len(missing), SESSION_SIZE)]
    for n, chunk in enumerate(sessions, start=1):
        species = [(name, sci, hab) for name, sci, hab, _ in chunk]
        (d / f"session_{n:02d}.txt").write_text(
            "TONIGHT'S RUN — "
            "paste STYLE LOCK + one existing sprite as reference, then work top to bottom.\n"
            "Save with EXACT filenames, then run: python scripts/tonight.py status\n\n"
            + batch_text(species, n),
            encoding="utf-8",
        )
    print(f"Tonight: {len(missing)} species, {len(missing) * 2} images, "
          f"{len(sessions)} sessions of up to {SESSION_SIZE} ({TONIGHT_DIR}/)")
    for n, chunk in enumerate(sessions, start=1):
        print(f"  session_{n:02d}: " + ", ".join(name for name, _, _, _ in chunk[:3]) + ", ...")
    return 0


def cmd_status(root):
    missing = {s[3] for s in missing_species(root)}
    birds = json.loads((root / "web" / "data" / "all-birds.json").read_text(encoding="utf-8"))
    total_png_species = sum(
        1 for b in birds
        if not str(b.get("icon_path", "")).startswith("assets/silhouettes/")
    )
    files = session_files(root)
    if not files:
        print("No session packs yet — run: python scripts/tonight.py plan")
    for f in files:
        names = [ln[3:].split(" (")[0] for ln in f.read_text(encoding="utf-8").splitlines() if ln.startswith("## ")]
        done = sum(1 for n in names if image_slug(n) not in missing)
        bar = "#" * done + "-" * (len(names) - done)
        print(f"{f.name}: [{bar}] {done}/{len(names)}")
    have = total_png_species
    print(f"catalog PNG-backed species: {have}/{len(birds)} "
          f"({len(missing)} still silhouette-or-missing)")
    return 0


def cmd_verify(root):
    birds = json.loads((root / "web" / "data" / "all-birds.json").read_text(encoding="utf-8"))
    silhouetted = [b["name"] for b in birds
                   if str(b.get("icon_path", "")).startswith("assets/silhouettes/")]
    if silhouetted:
        print(f"Tonight's goal: {len(silhouetted)} species still on silhouette art:")
        for n in silhouetted:
            print(f"  ... {n}")
        print("Finish the sessions, drop PNGs in web/assets, then re-run verify.")
        return 1
    r1 = subprocess.run([sys.executable, "scripts/check_assets.py"], cwd=root).returncode
    if r1 != 0:
        return r1
    r2 = subprocess.run(
        [sys.executable, "scripts/parse_ebird.py", "--input", "MyEBirdData.csv",
         "--out", "web/data"], cwd=root
    ).returncode
    if r2 != 0:
        return r2
    print("Catalog rebuilt with new art. Commit it: git add web/assets web/data && git commit")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description="Tonight's 64-image sprite run.")
    p.add_argument("command", choices=["plan", "status", "verify"])
    args = p.parse_args(argv)
    root = repo()
    if args.command == "plan":
        return cmd_plan(root)
    if args.command == "status":
        return cmd_status(root)
    return cmd_verify(root)


if __name__ == "__main__":
    raise SystemExit(main())
