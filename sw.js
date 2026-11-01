// Network first, so updates always win when online; the cache is the offline fallback.
const CACHE_NAME = 'rare-word-finder-v1';
const APP_FILES = [
    './',
    'index.html',
    'styles.css',
    'app.js',
    'theme-init.js',
    'packages/rare-word-analyzer/index.js',
    'data/words-common.csv',
    'data/words-rest.csv',
    'texts/list.json',
    'favicons/favicon.svg',
    'favicons/favicon-96x96.png',
    'favicons/site.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || Promise.reject(new Error('Offline'))))
    );
});
