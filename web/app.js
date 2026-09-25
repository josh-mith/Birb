const TOTAL_BIRDS = 24;
const STORAGE_KEY = "birb-home-region-collection";

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

let allBirds = [];
let collectedBirdIds = new Set();

function loadCollection() {
    try {
        const savedCollection = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        collectedBirdIds = new Set(Array.isArray(savedCollection) ? savedCollection : []);
    } catch {
        collectedBirdIds = new Set();
    }
}

function saveCollection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collectedBirdIds]));
}

function updateCollectionState() {
    allBirds.forEach((bird) => {
        bird.is_unlocked = collectedBirdIds.has(bird.id);
    });
}

function getQuestBird() {
    return allBirds.find((bird) => !bird.is_unlocked);
}

function getLevel(collectedCount) {
    return Math.floor(collectedCount / 3) + 1;
}

function renderQuest() {
    const collectedCount = collectedBirdIds.size;
    const total = allBirds.length;
    const percentage = total === 0 ? 0 : Math.round((collectedCount / total) * 100);
    const questBird = getQuestBird();

    questProgressLabel.textContent = `${collectedCount} / ${total} discovered`;
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
                <span class="mystery-number">NO. ${questBird.id}</span>
            </div>
            <div class="mystery-copy">
                <p class="quest-kicker">MISSING FROM YOUR DEX</p>
                <h2>Who’s that bird?</h2>
                <p class="mystery-rarity">${questBird.rarity} challenge</p>
                <p class="mystery-clue">Look for it around ${questBird.habitat.toLowerCase()}.</p>
                <button id="spotted-button" class="spotted-button" type="button">I spotted this bird!</button>
            </div>
        </div>
    `;
    document.getElementById("spotted-button").addEventListener("click", () => collectBird(questBird));
}

function collectBird(bird) {
    collectedBirdIds.add(bird.id);
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
    if (!bird.is_unlocked) {
        icon.classList.add("silhouette");
    }

    const number = document.createElement("p");
    number.className = "bird-number";
    number.textContent = `No. ${bird.id}`;

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
    modalId.textContent = `No. ${bird.id}`;
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

async function loadDex() {
    try {
        loadingMessage.hidden = false;
        const response = await fetch("data/dex.json");
        if (!response.ok) {
            throw new Error(`Unable to load dex.json: ${response.status}`);
        }

        allBirds = await response.json();
        loadCollection();
        updateCollectionState();
        const caught = allBirds.filter((bird) => bird.is_unlocked).length;
        const habitats = new Set(allBirds.map((bird) => bird.habitat).filter(Boolean));
        const rarities = new Set(allBirds.map((bird) => bird.rarity).filter(Boolean));

        populateFilter(habitatFilter, habitats);
        populateFilter(rarityFilter, rarities);
        loadingMessage.hidden = true;
        caughtCounter.textContent = `${caught}`;
        totalCounter.textContent = `${TOTAL_BIRDS}`;
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

document.addEventListener("DOMContentLoaded", loadDex);
