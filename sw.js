const CACHE_NAME = "bird-pokedex-v1";

const CORE_ASSETS = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "manifest.json",
    "data/dex.json"
];

const IMAGE_ASSETS = [
    "assets/icons/icon_american_crow.png",
    "assets/icons/icon_american_goldfinch.png",
    "assets/icons/icon_american_robin.png",
    "assets/icons/icon_bewicks_wren.png",
    "assets/icons/icon_blue_gray_gnatcatcher.png",
    "assets/icons/icon_brown_headed_cowbird.png",
    "assets/icons/icon_canada_goose.png",
    "assets/icons/icon_carolina_chickadee.png",
    "assets/icons/icon_carolina_wren.png",
    "assets/icons/icon_cedar_waxwing.png",
    "assets/icons/icon_dark_eyed_junco.png",
    "assets/icons/icon_eurasian_collared_dove.png",
    "assets/icons/icon_house_finch.png",
    "assets/icons/icon_house_sparrow.png",
    "assets/icons/icon_marsh_wren.png",
    "assets/icons/icon_mourning_dove.png",
    "assets/icons/icon_northern_cardinal.png",
    "assets/icons/icon_northern_flicker.png",
    "assets/icons/icon_red_bellied_woodpecker.png",
    "assets/icons/icon_tufted_titmouse.png",
    "assets/icons/icon_white_eyed_vireo.png",
    "assets/icons/icon_white_throated_sparrow.png",
    "assets/icons/icon_white_winged_dove.png",
    "assets/icons/icon_yellow_rumped_warbler.png",
    "assets/full/full_american_crow.png",
    "assets/full/full_american_goldfinch.png",
    "assets/full/full_american_robin.png",
    "assets/full/full_bewicks_wren.png",
    "assets/full/full_blue_gray_gnatcatcher.png",
    "assets/full/full_brown_headed_cowbird.png",
    "assets/full/full_canada_goose.png",
    "assets/full/full_carolina_chickadee.png",
    "assets/full/full_carolina_wren.png",
    "assets/full/full_cedar_waxwing.png",
    "assets/full/full_dark_eyed_junco.png",
    "assets/full/full_eurasian_collared_dove.png",
    "assets/full/full_house_finch.png",
    "assets/full/full_house_sparrow.png",
    "assets/full/full_marsh_wren.png",
    "assets/full/full_mourning_dove.png",
    "assets/full/full_northern_cardinal.png",
    "assets/full/full_northern_flicker.png",
    "assets/full/full_red_bellied_woodpecker.png",
    "assets/full/full_tufted_titmouse.png",
    "assets/full/full_white_eyed_vireo.png",
    "assets/full/full_white_throated_sparrow.png",
    "assets/full/full_white_winged_dove.png",
    "assets/full/full_yellow_rumped_warbler.png"
];

const PRECACHE_ASSETS = [...CORE_ASSETS, ...IMAGE_ASSETS];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
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
