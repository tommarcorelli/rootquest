// rootQuest — service worker
// Cache-first app shell so the game works fully offline after first load.

const CACHE_VERSION = 'rootquest-v2';
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './manifest.webmanifest',
    './js/i18n.js',
    './js/levels.js',
    './js/fs.js',
    './js/commands.js',
    './js/terminal.js',
    './js/sfx.js',
    './js/main.js',
    './js/fx.js',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/icon-maskable-192.png',
    './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests from our own origin; let everything else
    // (e.g. Google Fonts CDN) pass straight through to the network.
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            return fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => {
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
        })
    );
});
