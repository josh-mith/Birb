const CACHE_NAME = "bird-pokedex-v4";
const IMAGE_CACHE = "bird-pokedex-images-v4";
const IMAGE_CACHE_LIMIT = 300;

// App shell only — never precache the 2322 bird PNGs (see Roadmap Phase 2).
// Icons/full art are runtime-cached on first view instead.
const CORE_ASSETS = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "manifest.json",
    "data/dex.json",
    "data/travis-county.json",
    "assets/icons/icon_unknown_bird.svg",
    "assets/silhouettes/songbird.svg",
    "assets/silhouettes/warbler.svg",
    "assets/silhouettes/sparrow.svg",
    "assets/silhouettes/blackbird.svg",
    "assets/silhouettes/jay.svg",
    "assets/silhouettes/titmouse.svg",
    "assets/silhouettes/flycatcher.svg",
    "assets/silhouettes/scissor-tailed-flycatcher.svg",
    "assets/silhouettes/hummingbird.svg",
    "assets/silhouettes/swift.svg",
    "assets/silhouettes/woodpecker.svg",
    "assets/silhouettes/raptor.svg",
    "assets/silhouettes/heron.svg",
    "assets/silhouettes/ibis.svg",
    "assets/silhouettes/shorebird.svg",
    "assets/silhouettes/kingfisher.svg",
    "assets/silhouettes/swallow.svg",
    "assets/silhouettes/cormorant.svg"
];

function isImageRequest(url) {
    return url.pathname.includes("/assets/icons/")
        || url.pathname.includes("/assets/full/");
}

async function trimImageCache() {
    try {
        const cache = await caches.open(IMAGE_CACHE);
        const keys = await cache.keys();
        if (keys.length > IMAGE_CACHE_LIMIT) {
            await cache.delete(keys[0]);
            // Recurse once if still over (cheap LRU approximation)
            const rest = await cache.keys();
            if (rest.length > IMAGE_CACHE_LIMIT) {
                await cache.delete(rest[0]);
            }
        }
    } catch {
        // ignore quota errors — offline still works from shell cache
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE)
                .map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    // Bird art: cache-first + runtime fill, so 1161x2 images never block install.
    if (isImageRequest(url)) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then((cache) =>
                cache.match(event.request).then((cached) => {
                    if (cached) return cached;
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                            trimImageCache();
                        }
                        return networkResponse;
                    }).catch(() => cached);
                })
            )
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                const responseCopy = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
                return networkResponse;
            });
        })
    );
});
