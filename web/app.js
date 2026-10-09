const REGION_NAME = "Travis County, TX";
const LEGACY_STORAGE_KEY = "birb-travis-county-collection";
const PROFILE_KEY = "birb-active-profile";
const TOKEN_KEY = "birb-ebird-token";
const REGION_KEY = "birb-ebird-region";
const TAXONOMY_KEY = "birb-taxonomy";
const TAXONOMY_TS_KEY = "birb-taxonomy-ts";
const TAXONOMY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REGION = "US-TX-453";

const PROFILES = [
    { id: "me", label: "Me" },
    { id: "partner", label: "Partner" },
    { id: "team", label: "Team" },
];

const grid = document.getElementById("pokedex-grid");
const caughtCounter = document.getElementById("caught-counter");
const totalCounter = document.getElementById("total-counter");
const loadingMessage = document.getElementById("loading-message");
const resultMessage = document.getElementById("result-message");
const questContent = document.getElementById("quest-content");
const questProgressLabel = document.getElementById("quest-progress-label");
const questProgressPercent = document.getElementById("quest-progress-percent");
const questProgressBar = document.getElementById("quest-progress-bar");
const questLevel = document.getElementById("quest-level");
const searchInput = document.getElementById("search-input");
const habitatFilter = document.getElementById("habitat-filter");
const rarityFilter = document.getElementById("rarity-filter");
const clearFilters = document.getElementById("clear-filters");
const modal = document.getElementById("detail-modal");
const closeButton = document.getElementById("modal-close");

const modalImage = document.getElementById("modal-image");
const modalId = document.getElementById("modal-id");
const modalName = document.getElementById("modal-name");
const modalBio = document.getElementById("modal-bio");
const modalScientific = document.getElementById("modal-scientific");
const modalDate = document.getElementById("modal-date");
const modalLocation = document.getElementById("modal-location");
const modalHabitat = document.getElementById("modal-habitat");
const modalRarity = document.getElementById("modal-rarity");

// Sync / profile UI (may be absent in older index.html — guard everything)
const profileButtons = document.getElementById("profile-buttons");
const csvInput = document.getElementById("csv-input");
const dropZone = document.getElementById("drop-zone");
const importStatus = document.getElementById("import-status");
const apiKeyInput = document.getElementById("ebird-key");
const regionInput = document.getElementById("ebird-region");
const syncButton = document.getElementById("sync-button");
const saveKeyButton = document.getElementById("save-key-button");

let allBirds = [];
let customBirds = [];
let collectedBirdIds = new Set();
let activeProfile = localStorage.getItem(PROFILE_KEY) || "me";

function birdKey(bird) {
    return bird.code || bird.id;
}

function displayNum(bird) {
    return bird.num || bird.id;
}

function isTeam() {
    return activeProfile === "team";
}

function collectionKey(profile = activeProfile) {
    return `birb-collection-${profile}`;
}

function customKey(profile = activeProfile) {
    return `birb-custom-${profile}`;
}

function slugify(value) {
    return (value || "")
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function stableCode(name, scientific) {
    return slugify(scientific || name) || slugify(name) || "unknown";
}

function readStoredList(key) {
    try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        return Array.isArray(saved) ? saved : null;
    } catch {
        return null;
    }
}

function loadCollection(birds) {
    const numToCode = new Map();
    birds.forEach((b) => {
        if (b.num) numToCode.set(String(b.num), birdKey(b));
    });
    // Slug index lets old scientific-slug saves resolve even if a future
    // catalog switches primary codes to eBird speciesCode.
    const slugToCode = new Map();
    birds.forEach((b) => {
        slugToCode.set(slugify(b.scientific || b.name), birdKey(b));
        const sc = (b.speciesCode || "").toLowerCase();
        if (sc) slugToCode.set(sc, birdKey(b));
    });
    const migrate = (list) => {
        const out = new Set();
        (Array.isArray(list) ? list : []).forEach((saved) => {
            const s = String(saved);
            if (birds.some((b) => birdKey(b) === s)) {
                out.add(s);
            } else if (numToCode.has(s)) {
                out.add(numToCode.get(s));
            } else if (numToCode.has(s.padStart(3, "0"))) {
                out.add(numToCode.get(s.padStart(3, "0")));
            } else if (slugToCode.has(s.toLowerCase())) {
                out.add(slugToCode.get(s.toLowerCase()));
            }
        });
        return out;
    };

    // Team view = union of Me + Partner collections (computed, not stored).
    if (isTeam()) {
        const union = new Set();
        migrate(readStoredList(collectionKey("me")) || []).forEach((c) => union.add(c));
        migrate(readStoredList(collectionKey("partner")) || []).forEach((c) => union.add(c));
        if (union.size === 0) {
            const legacy = readStoredList(LEGACY_STORAGE_KEY);
            if (legacy) migrate(legacy).forEach((c) => union.add(c));
        }
        collectedBirdIds = union.size > 0
            ? union
            : new Set(birds.filter((b) => b.is_unlocked).map((b) => birdKey(b)));
        return;
    }

    try {
        const saved = readStoredList(collectionKey());
        if (saved) {
            collectedBirdIds = migrate(saved);
            // Legacy numeric collections (001..024) pre-stable-ids: all dex birds
            // were unlocked, so a numeric-only save maps to at least the same count.
            if (collectedBirdIds.size === 0 && saved.length > 0) {
                collectedBirdIds = new Set(
                    birds.filter((b) => b.is_unlocked).map((b) => birdKey(b))
                );
            }
            return;
        }
        // First run for this profile: fall back to legacy shared key, then defaults.
        const legacy = readStoredList(LEGACY_STORAGE_KEY);
        if (Array.isArray(legacy)) {
            collectedBirdIds = migrate(legacy);
            if (collectedBirdIds.size === 0 && legacy.length > 0) {
                collectedBirdIds = new Set(
                    birds.filter((b) => b.is_unlocked).map((b) => birdKey(b))
                );
            }
            saveCollection();
            return;
        }
        collectedBirdIds = new Set(birds.filter((b) => b.is_unlocked).map((b) => birdKey(b)));
    } catch {
        collectedBirdIds = new Set(birds.filter((b) => b.is_unlocked).map((b) => birdKey(b)));
    }
}

function saveCollection() {
    if (isTeam()) {
        // Team is a computed union: persist spotting to both personal dexes.
        for (const profile of ["me", "partner"]) {
            const existing = new Set(readStoredList(collectionKey(profile)) || []);
            collectedBirdIds.forEach((c) => existing.add(c));
            localStorage.setItem(collectionKey(profile), JSON.stringify([...existing]));
        }
        return;
    }
    localStorage.setItem(collectionKey(), JSON.stringify([...collectedBirdIds]));
}

function loadCustom() {
    const readCustom = (profile) => readStoredList(customKey(profile)) || [];
    try {
        if (isTeam()) {
            // Union of both partners' custom birds, deduplicated by key.
            const seen = new Set();
            customBirds = [...readCustom("me"), ...readCustom("partner")].filter((b) => {
                const k = birdKey(b);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        } else {
            customBirds = readCustom(activeProfile);
        }
    } catch {
        customBirds = [];
    }
}

function saveCustom() {
    if (isTeam()) {
        // Attribute team-view discoveries to Me to keep one writer.
        const existing = new Set((readStoredList(customKey("me")) || []).map((b) => birdKey(b)));
        const merged = [...(readStoredList(customKey("me")) || [])];
        customBirds.forEach((b) => {
            if (!existing.has(birdKey(b))) {
                merged.push(b);
                existing.add(birdKey(b));
            }
        });
        localStorage.setItem(customKey("me"), JSON.stringify(merged));
        return;
    }
    localStorage.setItem(customKey(), JSON.stringify(customBirds));
}

function updateCollectionState() {
    allBirds.forEach((bird) => {
        bird.is_unlocked = collectedBirdIds.has(birdKey(bird));
    });
}

function getQuestBird() {
    return allBirds.find((bird) => !bird.is_unlocked);
}

function getLevel(collectedCount) {
    return Math.floor(collectedCount / 3) + 1;
}

function setStatus(message, isError = false) {
    if (!importStatus) return;
    importStatus.textContent = message;
    importStatus.classList.toggle("error", isError);
}

function renderQuest() {
    const collectedCount = collectedBirdIds.size;
    const total = allBirds.length;
    const percentage = total === 0 ? 0 : Math.round((collectedCount / total) * 100);
    const questBird = getQuestBird();

    questProgressLabel.textContent = `${collectedCount} / ${total} discovered in ${REGION_NAME}`;
    questProgressPercent.textContent = `${percentage}%`;
    questProgressBar.style.width = `${percentage}%`;
    questLevel.textContent = `LEVEL ${String(getLevel(collectedCount)).padStart(2, "0")}`;

    if (!questBird) {
        questContent.innerHTML = `
            <div class="quest-complete">
                <p class="quest-kicker">REGION MASTERED</p>
                <h2>You completed the collection!</h2>
                <p>Every bird in your home region has been discovered. Keep exploring to spot them all again.</p>
            </div>
        `;
        return;
    }

    questContent.innerHTML = `
        <div class="mystery-card">
            <div class="mystery-art">
                <img src="${questBird.icon_path}" alt="Mystery bird silhouette">
                <span class="mystery-number">NO. ${displayNum(questBird)}</span>
            </div>
            <div class="mystery-copy">
                <p class="quest-kicker">MISSING FROM YOUR DEX</p>
                <h2>Who’s that bird?</h2>
                <p class="mystery-rarity">${questBird.rarity} challenge</p>
                <p class="mystery-clue">Look for it around ${String(questBird.habitat || "").toLowerCase()}.</p>
                <button id="spotted-button" class="spotted-button" type="button">I spotted this bird!</button>
            </div>
        </div>
    `;
    document.getElementById("spotted-button").addEventListener("click", () => collectBird(questBird));
}

function collectBird(bird) {
    collectedBirdIds.add(birdKey(bird));
    saveCollection();
    updateCollectionState();
    caughtCounter.textContent = collectedBirdIds.size;
    renderQuest();
    renderFilteredBirds();
    openModal(bird);
}

function displayValue(value, fallback = "???") {
    return value || fallback;
}

function populateFilter(select, values) {
    select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    const options = [...values].sort().map((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        return option;
    });

    select.append(...options);
}

function renderBirdCard(bird) {
    const card = document.createElement("button");
    card.className = "bird-card";
    card.type = "button";
    card.setAttribute("aria-label", bird.is_unlocked ? `Open ${bird.name}` : "Undiscovered bird");

    const spriteFrame = document.createElement("div");
    spriteFrame.className = "sprite-frame";

    const icon = document.createElement("img");
    icon.className = "bird-icon";
    icon.src = bird.icon_path;
    icon.alt = bird.is_unlocked ? bird.name : "Undiscovered bird silhouette";
    icon.loading = "lazy";
    icon.onerror = () => {
        if (!icon.dataset.fallback) {
            icon.dataset.fallback = "1";
            icon.src = "assets/silhouettes/songbird.svg";
        }
    };
    if (!bird.is_unlocked) {
        icon.classList.add("silhouette");
    }

    const number = document.createElement("p");
    number.className = "bird-number";
    number.textContent = `No. ${displayNum(bird)}`;

    const name = document.createElement("p");
    name.className = "bird-name";
    name.textContent = bird.is_unlocked ? bird.name : "???";

    const location = document.createElement("p");
    location.className = "bird-location";
    location.textContent = bird.is_unlocked ? bird.location : "???";

    const badges = document.createElement("div");
    badges.className = "badge-row";

    const habitat = document.createElement("span");
    habitat.className = "badge habitat-badge";
    habitat.textContent = bird.is_unlocked ? bird.habitat : "???";

    const rarity = document.createElement("span");
    rarity.className = "badge rarity-badge";
    rarity.textContent = bird.is_unlocked ? bird.rarity : "???";

    badges.append(habitat, rarity);
    spriteFrame.appendChild(icon);
    card.append(spriteFrame, number, name, location, badges);
    card.addEventListener("click", () => openModal(bird));

    return card;
}

function birdMatchesFilters(bird) {
    const query = searchInput.value.trim().toLowerCase();
    const habitat = habitatFilter.value;
    const rarity = rarityFilter.value;
    const searchableText = [bird.name, bird.scientific, bird.location, bird.habitat, bird.rarity]
        .join(" ")
        .toLowerCase();

    return (!query || searchableText.includes(query))
        && (!habitat || bird.habitat === habitat)
        && (!rarity || bird.rarity === rarity);
}

function renderFilteredBirds() {
    const filteredBirds = allBirds.filter(birdMatchesFilters);
    grid.replaceChildren(...filteredBirds.map(renderBirdCard));

    resultMessage.hidden = false;
    resultMessage.textContent = `${filteredBirds.length} result${filteredBirds.length === 1 ? "" : "s"} shown`;

    if (filteredBirds.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "system-message empty-message";
        emptyState.textContent = "No birds match those filters. Try a different habitat or rarity.";
        grid.appendChild(emptyState);
    }
}

function openModal(bird) {
    const unlocked = bird.is_unlocked;

    modalImage.src = bird.full_path;
    modalImage.alt = unlocked ? bird.name : "Undiscovered bird silhouette";
    modalImage.classList.toggle("silhouette", !unlocked);
    modalImage.onerror = () => {
        if (!modalImage.dataset.fallback) {
            modalImage.dataset.fallback = "1";
            modalImage.src = "assets/silhouettes/songbird.svg";
        }
    };
    modalImage.dataset.fallback = "";
    modalId.textContent = `No. ${displayNum(bird)}`;
    modalName.textContent = unlocked ? bird.name : "Undiscovered Bird";
    modalBio.textContent = unlocked ? bird.bio : "Keep birding to reveal this mysterious creature.";
    modalScientific.textContent = unlocked ? displayValue(bird.scientific) : "???";
    modalDate.textContent = unlocked ? displayValue(bird.date) : "???";
    modalLocation.textContent = unlocked ? displayValue(bird.location) : "???";
    modalHabitat.textContent = unlocked ? displayValue(bird.habitat) : "???";
    modalRarity.textContent = unlocked ? displayValue(bird.rarity) : "???";

    modal.hidden = false;
    closeButton.focus();
}

function closeModal() {
    modal.hidden = true;
}

// ---- Profiles ----
function renderProfiles() {
    if (!profileButtons) return;
    profileButtons.replaceChildren(
        ...PROFILES.map((p) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "profile-button" + (p.id === activeProfile ? " active" : "");
            btn.textContent = p.label;
            btn.setAttribute("aria-pressed", p.id === activeProfile ? "true" : "false");
            btn.addEventListener("click", () => switchProfile(p.id));
            return btn;
        })
    );
}

function switchProfile(id) {
    if (id === activeProfile) return;
    activeProfile = id;
    localStorage.setItem(PROFILE_KEY, id);
    bootFromStorage();
    renderProfiles();
}

function bootFromStorage() {
    loadCustom();
    // Rebuild merged list from cached static + custom (static kept on window for profile switches)
    const base = window.__birbStatic || [];
    const seen = new Set(base.map(birdKey));
    const merged = [...base];
    customBirds.forEach((b) => {
        if (!seen.has(birdKey(b))) {
            merged.push(b);
            seen.add(birdKey(b));
        }
    });
    allBirds = merged;
    loadCollection(allBirds);
    updateCollectionState();
    caughtCounter.textContent = `${collectedBirdIds.size}`;
    totalCounter.textContent = `${allBirds.length}`;
    renderQuest();
    renderFilteredBirds();
}

// ---- CSV import (client-side, no backend) ----
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else if (c === "\r") {
            // skip, handled by \n
        } else {
            field += c;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    if (rows.length === 0) return [];
    const header = rows[0].map((h) => h.replace(/^\uFEFF/, "").trim());
    return rows.slice(1).filter((r) => r.some((v) => v.trim() !== "")).map((r) => {
        const obj = {};
        header.forEach((h, idx) => {
            obj[h] = (r[idx] || "").trim();
        });
        return obj;
    });
}

function findBird({ name, scientific, code, speciesCode }) {
    const n = (name || "").toLowerCase();
    const s = (scientific || "").toLowerCase();
    const c = (code || "").toLowerCase();
    const sc = (speciesCode || "").toLowerCase();
    return allBirds.find((b) =>
        birdKey(b).toLowerCase() === c
        || (sc && (b.speciesCode || "").toLowerCase() === sc)
        || (n && b.name.toLowerCase() === n)
        || (s && (b.scientific || "").toLowerCase() === s)
    );
}

function applySighting({ name, scientific, date, location, speciesCode }) {
    if (!name) return null;
    const code = stableCode(name, scientific);
    let bird = findBird({ name, scientific, code, speciesCode });
    if (bird) {
        // Keep earliest date like the python parser
        if (date && (!bird.date || date < bird.date)) {
            bird.date = date;
            if (location) bird.location = location;
        }
        if (scientific && !bird.scientific) bird.scientific = scientific;
        if (speciesCode && !bird.speciesCode) bird.speciesCode = speciesCode;
        collectedBirdIds.add(birdKey(bird));
        return bird;
    }
    const slug = slugify(name);
    const num = String(900 + customBirds.length + 1).padStart(3, "0");
    bird = {
        id: code,
        code,
        num,
        name,
        scientific: scientific || "",
        date: date || "",
        location: location || "",
        habitat: "Unknown Habitat",
        rarity: "Common",
        bio: "A mysterious feathered friend waiting for its Pokédex legend.",
        icon_path: "assets/silhouettes/songbird.svg",
        full_path: "assets/silhouettes/songbird.svg",
        icon_slug: slug,
        is_unlocked: true,
    };
    if (speciesCode) bird.speciesCode = speciesCode;
    // Prefer real art if the slug happens to exist (onerror falls back anyway)
    bird.icon_path = `assets/icons/icon_${slug}.png`;
    bird.full_path = `assets/full/full_${slug}.png`;
    customBirds.push(bird);
    allBirds.push(bird);
    collectedBirdIds.add(birdKey(bird));
    return bird;
}

function importCSVText(text) {
    const rows = parseCSV(text);
    if (rows.length === 0) {
        setStatus("No rows found in that CSV.", true);
        return;
    }
    const hasRequired = rows[0] && ("Common Name" in rows[0]);
    if (!hasRequired) {
        setStatus("That doesn't look like an eBird CSV (missing 'Common Name').", true);
        return;
    }
    let count = 0;
    rows.forEach((r) => {
        const bird = applySighting({
            name: r["Common Name"] || "",
            scientific: r["Scientific Name"] || "",
            date: (r["Date"] || "").trim(),
            location: r["Location"] || "",
        });
        if (bird) count++;
    });
    saveCustom();
    saveCollection();
    updateCollectionState();
    // Renumber custom birds after max static num
    caughtCounter.textContent = `${collectedBirdIds.size}`;
    totalCounter.textContent = `${allBirds.length}`;
    renderQuest();
    renderFilteredBirds();
    setStatus(`Imported ${count} sighting${count === 1 ? "" : "s"} from CSV.`);
}

async function importCSVFile(file) {
    if (!file) return;
    setStatus(`Reading ${file.name}…`);
    const text = await file.text();
    importCSVText(text);
}

// ---- eBird API (BYO key, browser-direct, no backend) ----
// Taxonomy lookup: cached 7 days, best-effort — sync still works without it.
function getCachedTaxonomy() {
    try {
        const ts = Number(localStorage.getItem(TAXONOMY_TS_KEY) || 0);
        if (!ts || Date.now() - ts > TAXONOMY_TTL_MS) return null;
        const raw = JSON.parse(localStorage.getItem(TAXONOMY_KEY) || "null");
        return Array.isArray(raw) ? raw : null;
    } catch {
        return null;
    }
}

function taxonomyLookup(taxonomy) {
    const map = new Map();
    (taxonomy || []).forEach((t) => {
        const code = t.speciesCode || "";
        if (!code) return;
        if (t.sciName) map.set(t.sciName.toLowerCase(), code);
        if (t.comName) map.set(t.comName.toLowerCase(), code);
    });
    return (name, scientific) =>
        map.get((scientific || "").toLowerCase()) || map.get((name || "").toLowerCase()) || "";
}

async function refreshTaxonomy(key) {
    const cached = getCachedTaxonomy();
    if (cached) return cached;
    const res = await fetch("https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json", {
        headers: { "X-eBirdApiToken": key },
    });
    if (!res.ok) throw new Error(`taxonomy fetch failed: ${res.status}`);
    const taxonomy = await res.json();
    try {
        localStorage.setItem(TAXONOMY_KEY, JSON.stringify(taxonomy));
        localStorage.setItem(TAXONOMY_TS_KEY, String(Date.now()));
    } catch {
        // quota exceeded — taxonomy still usable this session
    }
    return taxonomy;
}

async function syncEBird() {
    const key = (apiKeyInput?.value || localStorage.getItem(TOKEN_KEY) || "").trim();
    const region = (regionInput?.value || localStorage.getItem(REGION_KEY) || DEFAULT_REGION).trim() || DEFAULT_REGION;
    if (!key) {
        setStatus("Paste your eBird API key first (get one at ebird.org/api/keygen).", true);
        return;
    }
    localStorage.setItem(TOKEN_KEY, key);
    localStorage.setItem(REGION_KEY, region);
    setStatus(`Syncing recent observations for ${region}…`);
    try {
        // Best-effort taxonomy for speciesCode aliases; obs sync works regardless.
        let lookup = () => "";
        try {
            lookup = taxonomyLookup(await refreshTaxonomy(key));
        } catch (taxErr) {
            console.warn("taxonomy refresh skipped:", taxErr);
            const cached = getCachedTaxonomy();
            if (cached) lookup = taxonomyLookup(cached);
        }
        const res = await fetch(
            `https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent?back=30&maxResults=500&includeProvisional=true`,
            { headers: { "X-eBirdApiToken": key } }
        );
        if (res.status === 403) {
            throw new Error("eBird rejected the key (403). Check the key and try again.");
        }
        if (!res.ok) {
            throw new Error(`eBird request failed: ${res.status}`);
        }
        const obs = await res.json();
        let count = 0;
        obs.forEach((o) => {
            const bird = applySighting({
                name: o.comName || "",
                scientific: o.sciName || "",
                date: (o.obsDt || "").slice(0, 10),
                location: o.locName || region,
                speciesCode: o.speciesCode || lookup(o.comName, o.sciName),
            });
            if (bird) count++;
        });
        saveCustom();
        saveCollection();
        updateCollectionState();
        caughtCounter.textContent = `${collectedBirdIds.size}`;
        totalCounter.textContent = `${allBirds.length}`;
        renderQuest();
        renderFilteredBirds();
        setStatus(`Synced ${count} recent observation${count === 1 ? "" : "s"} from eBird (${region}).`);
    } catch (err) {
        console.error(err);
        setStatus(`Sync failed: ${err.message} — CSV upload still works offline.`, true);
    }
}

async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Unable to load ${path}: ${res.status}`);
    return res.json();
}

async function loadDex() {
    try {
        loadingMessage.hidden = false;
        // Preferred split model: all-birds.json (species catalog) +
        // user-sightings.json (first-seen records). Falls back to legacy
        // dex.json + travis-county.json when the split files are absent.
        let catalog = null;
        try {
            const [birds, sightings] = await Promise.all([
                fetchJSON("data/all-birds.json"),
                fetchJSON("data/user-sightings.json"),
            ]);
            const seenByCode = new Map(sightings.map((s) => [s.code, s]));
            catalog = birds.map((b) => {
                const s = seenByCode.get(birdKey(b));
                return {
                    ...b,
                    date: s?.date || "",
                    location: s?.location || "Travis County, TX",
                    is_unlocked: Boolean(s),
                };
            });
        } catch {
            const [discoveredBirds, regionalBirds] = await Promise.all([
                fetchJSON("data/dex.json"),
                fetchJSON("data/travis-county.json"),
            ]);
            catalog = [...discoveredBirds, ...regionalBirds];
        }
        window.__birbStatic = catalog;
        loadCustom();
        const seen = new Set(window.__birbStatic.map(birdKey));
        allBirds = [...window.__birbStatic];
        customBirds.forEach((b) => {
            if (!seen.has(birdKey(b))) allBirds.push(b);
        });
        loadCollection(allBirds);
        updateCollectionState();
        const caught = collectedBirdIds.size;
        const habitats = new Set(allBirds.map((bird) => bird.habitat).filter(Boolean));
        const rarities = new Set(allBirds.map((bird) => bird.rarity).filter(Boolean));

        populateFilter(habitatFilter, habitats);
        populateFilter(rarityFilter, rarities);
        if (apiKeyInput) apiKeyInput.value = localStorage.getItem(TOKEN_KEY) || "";
        if (regionInput) regionInput.value = localStorage.getItem(REGION_KEY) || DEFAULT_REGION;
        renderProfiles();
        loadingMessage.hidden = true;
        caughtCounter.textContent = `${caught}`;
        totalCounter.textContent = `${allBirds.length}`;
        renderQuest();
        renderFilteredBirds();
    } catch (error) {
        console.error(error);
        loadingMessage.textContent = "Could not load the Bird Pokédex. Try refreshing once you are back online.";
    }
}

searchInput.addEventListener("input", renderFilteredBirds);
habitatFilter.addEventListener("change", renderFilteredBirds);
rarityFilter.addEventListener("change", renderFilteredBirds);
clearFilters.addEventListener("click", () => {
    searchInput.value = "";
    habitatFilter.value = "";
    rarityFilter.value = "";
    renderFilteredBirds();
    searchInput.focus();
});
closeButton.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        closeModal();
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
        closeModal();
    }
});

csvInput?.addEventListener("change", (e) => importCSVFile(e.target.files?.[0]));
dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragging");
});
dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
    importCSVFile(e.dataTransfer.files?.[0]);
});
saveKeyButton?.addEventListener("click", () => {
    localStorage.setItem(TOKEN_KEY, (apiKeyInput.value || "").trim());
    localStorage.setItem(REGION_KEY, (regionInput.value || DEFAULT_REGION).trim() || DEFAULT_REGION);
    setStatus("eBird key saved in this browser only.");
});
syncButton?.addEventListener("click", syncEBird);

document.addEventListener("DOMContentLoaded", loadDex);
