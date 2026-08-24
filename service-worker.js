// rootQuest — service worker
// Cache-first app shell so the game works fully offline after first load.

// Cache-first means a returning visitor NEVER sees new JS/CSS until this
// string changes — the fetch handler below returns the cached response
// without ever re-checking the network. Bump this on every release that
// touches any file in CORE_ASSETS (kept in lockstep with package.json's
// version — tests/harness.js asserts the two match, so drifting apart
// fails `npm run test:logic` / CI instead of silently shipping stale
// assets to already-installed users).
const CACHE_VERSION = 'rootquest-v1.43.0';
// Must list every <script> in index.html: an asset missing here is a file an
// offline visitor's page references and the cache has never heard of.
// tests/harness.js compares this list against the markup, so adding a module
// without listing it fails the suite instead of only breaking offline mode.
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './manifest.webmanifest',
    './js/i18n.js',
    './js/modes.js',
    './js/gtfobins.js',
    './js/levels.js',
    './js/walkthrough.js',
    './js/fs.js',
    './js/commands.js',
    './js/mentormode.js',
    './js/mentor.js',
    './js/stealth.js',
    './js/timeattack.js',
    './js/exam.js',
    './js/chaos.js',
    './js/story.js',
    './js/ghost.js',
    './js/terminal.js',
    './js/sfx.js',
    './js/walkmode.js',
    './js/proof.js',
    './js/nano.js',
    './js/boxbuilder.js',
    './js/boxeditor.js',
    './js/main.js',
    './js/rogue.js',
    './js/fx.js',
    './assets/fonts/fonts.css',
    './assets/fonts/jetbrainsmono-400-latin.woff2',
    './assets/fonts/jetbrainsmono-400-latin-ext.woff2',
    './assets/fonts/jetbrainsmono-500-latin.woff2',
    './assets/fonts/jetbrainsmono-500-latin-ext.woff2',
    './assets/fonts/jetbrainsmono-700-latin.woff2',
    './assets/fonts/jetbrainsmono-700-latin-ext.woff2',
    './assets/fonts/orbitron-500-latin.woff2',
    './assets/fonts/orbitron-700-latin.woff2',
    './assets/fonts/orbitron-900-latin.woff2',
    './assets/fonts/spacegrotesk-500-latin.woff2',
    './assets/fonts/spacegrotesk-500-latin-ext.woff2',
    './assets/fonts/spacegrotesk-700-latin.woff2',
    './assets/fonts/spacegrotesk-700-latin-ext.woff2',
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

    // Only handle GET requests from our own origin (fonts are now self-hosted,
    // so the app has no external dependencies); let anything else pass through.
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
