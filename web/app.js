async function loadDex() {
    try {
        const response = await fetch('/data/dex.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const grid = document.getElementById('pokedex-grid');
        let unlockedCount = 0;

        data.forEach(bird => {
            if (bird.is_unlocked) {
                unlockedCount++;
            }

            const card = document.createElement('div');
            card.className = 'bird-card';

            const spriteContainer = document.createElement('div');
            spriteContainer.className = 'sprite-container';

            const icon = document.createElement('img');
            icon.src = bird.sprite;
            icon.alt = bird.is_unlocked ? bird.name : 'Unknown Bird';
            icon.className = 'bird-icon';
            if (!bird.is_unlocked) {
                icon.classList.add('silhouette');
            }

            spriteContainer.appendChild(icon);

            const info = document.createElement('div');
            info.className = 'bird-info';

            const idEl = document.createElement('div');
            idEl.className = 'bird-id';
            idEl.textContent = `No. ${bird.id}`;

            const nameEl = document.createElement('div');
            nameEl.className = 'bird-name';
            nameEl.textContent = bird.is_unlocked ? bird.name : '???';

            info.appendChild(idEl);
            info.appendChild(nameEl);

            if (bird.is_unlocked) {
                const dateEl = document.createElement('div');
                dateEl.className = 'bird-date';
                dateEl.textContent = bird.date;
                info.appendChild(dateEl);
            }

            card.appendChild(spriteContainer);
            card.appendChild(info);

            grid.appendChild(card);
        });

        document.getElementById('caught-counter').textContent = unlockedCount;

    } catch (error) {
        console.error("Failed to load pokedex data:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadDex);