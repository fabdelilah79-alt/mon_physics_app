// =====================================================
// Service Worker — SSPOE Physics PWA
// =====================================================
// Cache-first strategy for offline support
// Update CACHE_VERSION when deploying new content
// =====================================================

const CACHE_VERSION = 'sspoe-v12';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './data-core.js',
    './data-1ac.js',
    './data-2ac.js',
    './data-3ac.js',
    './manifest.json',
    './icons/icon-192.svg',
    // Bibliothèques pour les simulations (offline)
    './libs/three.min.js',
    './libs/p5.min.js',
    './libs/matter.min.js',
    './libs/tailwindcss.js'
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => {
                console.log('[SW] Pre-caching app shell');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key !== CACHE_VERSION)
                        .map((key) => {
                            console.log('[SW] Removing old cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch — Dynamic Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network-First for data files (data-*.js, metadata.json)
    if (url.pathname.includes('data-') || url.pathname.includes('metadata.json')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Update cache with freshest data
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_VERSION).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Offline fallback to cache
                    console.log('[SW] App offline, serving data from cache:', event.request.url);
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache-First for static assets (images, css, libs, etc.)
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((networkResponse) => {
                        // Dynamically cache new assets
                        if (
                            networkResponse &&
                            networkResponse.status === 200 &&
                            event.request.url.startsWith(self.location.origin)
                        ) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_VERSION).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});
