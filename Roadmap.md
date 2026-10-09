# Roadmap — birb: eBird Pokédex for All Birders

Vision (from interview 2026-10-09): gamify any birder's eBird history as a Pokédex.
Keep current game feel: LEVEL = floor(count/3)+1, FIELD QUEST silhouette ("Who's that bird?"), habitat/rarity badges, localStorage collection.

## Where we're at (v1 done, Phase-1 cleanup done)
- Static PWA works locally: `web/index.html` + `app.js` + `data/all-birds.json` + `data/user-sightings.json` + `sw.js` (56 Travis County birds: 24 sighted + 32 silhouettes).
- Pipeline: `python scripts/parse_ebird.py --input MyEBirdData.csv --out web/data/` builds the split model + legacy `dex.json` (deprecated) and warns on missing artwork (`--strict` to fail, `--no-legacy` to skip).
- In-app CSV drag-drop + BYO eBird key sync (`X-eBirdApiToken`, default region `US-TX-453`) + Me/Partner profile toggle all client-side, no backend.
- `sw.js` (v5 shell) precaches shell + JSON + SVGs only; bird PNGs runtime-cache (300 cap). BIOS/HABITATS/RARITIES still hardcoded for the original 24 — unknown species fall back to generic meta.

## Phase 1 — Automate pipeline (unblock everything else)
1. Make `parse_ebird.py` generic: fallback bio/habitat/rarity for unknown species, stable IDs (eBird species code, not `001..024` enumeration), merge `dex.json` + `travis-county.json` into one `all-birds.json` + `user-sightings.json` split.
2. One-command: `python scripts/parse_ebird.py --input MyEBirdData.csv --out web/data/` + validate image slugs exist.
3. Add drag-drop CSV upload in-app as stopgap (parse in browser, store sightings in localStorage, link user to eBird download URL).

## Phase 2 — Full NA dex: 1161 birds x bio + 2 pics
1. Source checklist: eBird taxonomy / regional checklist for North America → `na-checklist.csv`.
2. Generate bios + habitats/rarities in batches of 100 (Gemini sessions) into `species-meta.json`.
3. Generate icon (pixel-style) + full art per species: `assets/icons/icon_{slug}.png`, `assets/full/full_{slug}.png`. Lazy-load + runtime SW cache (see Tech Note 3).
4. Ship full dex day-one per interview (not regional packs).

## Phase 3 — eBird API integration (v1: BYO key, client-only)
1. Settings modal: paste eBird API key → store in `localStorage` (`birb-ebird-token`), never commit.
2. Fetch `GET https://api.ebird.org/v2/data/obs/{regionCode}/recent` + `/v2/taxonomy/ebird?fmt=json` directly from browser with `X-eBirdApiToken` header.
3. "Sync my sightings" button → mark `is_unlocked`, save first-seen date/location. Keep CSV upload as fallback.
4. No backend needed for v1.

## Phase 4 — Profiles (birding partners)
1. Simple toggle first (per interview): `birb-profile-{id}` localStorage namespaces, e.g. Me / Wife. Switcher in header.
2. Later: combined team dex view (union of sightings). Defer friends/leaderboard.

## Phase 5 — Scale + polish (defer)
- Keep LEVEL/quest/silhouette system as-is for 1161.
- Undiscovered cards stay `???` + silhouette SVG by family (reuse `assets/silhouettes/*.svg`).
- PWA install, offline field mode, share card.

## Tech Notes
1. **Keep static PWA for v1.** No backend required if users bring their own eBird key. Host on GitHub Pages / Netlify as-is.
2. **Add backend only when:** you want hosted accounts, shared team dex, proxying eBird to hide a shared key, or serving 2322 images via CDN. Minimal option: Cloudflare Worker proxy + R2 for images.
3. **Fix SW scaling now:** stop precaching PNGs. Precache shell + JSON + SVGs only; runtime-cache `assets/icons/*` + `assets/full/*` on fetch (cache-first, LRU cap).
4. **IDs:** switch from `001` enumeration to eBird `speciesCode` (e.g. `norcar`) before NA expansion, or all saved collections break.
