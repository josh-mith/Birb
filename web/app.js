const TOTAL_BIRDS = 24;

const grid = document.getElementById("pokedex-grid");
const caughtCounter = document.getElementById("caught-counter");
const totalCounter = document.getElementById("total-counter");
const loadingMessage = document.getElementById("loading-message");
const modal = document.getElementById("detail-modal");
const closeButton = document.getElementById("modal-close");

const modalImage = document.getElementById("modal-image");
const modalId = document.getElementById("modal-id");
const modalName = document.getElementById("modal-name");
const modalBio = document.getElementById("modal-bio");
const modalScientific = document.getElementById("modal-scientific");
const modalDate = document.getElementById("modal-date");
const modalLocation = document.getElementById("modal-location");

function displayValue(value, fallback = "???") {
    return value || fallback;
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

    spriteFrame.appendChild(icon);
    card.append(spriteFrame, number, name, location);
    card.addEventListener("click", () => openModal(bird));

    return card;
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

        const birds = await response.json();
        const caught = birds.filter((bird) => bird.is_unlocked).length;

        loadingMessage.hidden = true;
        grid.replaceChildren(...birds.map(renderBirdCard));
        caughtCounter.textContent = `${caught}`;
        totalCounter.textContent = `${TOTAL_BIRDS}`;
    } catch (error) {
        console.error(error);
        loadingMessage.textContent = "Could not load the Bird Pokédex. Try refreshing once you are back online.";
    }
}

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
