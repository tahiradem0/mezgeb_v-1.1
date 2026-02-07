/* ===================================
   EXPENSE TRACKER - Service Worker
   For offline capability and caching
   =================================== */

const CACHE_NAME = 'expense-tracker-v16';
const STATIC_CACHE = 'expense-tracker-static-v16';
const DYNAMIC_CACHE = 'expense-tracker-dynamic-v16';

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/components.css',
    '/css/pages.css',
    '/js/data.js',
    '/js/utils.js',
    '/js/chart.js',
    '/js/api.js',
    '/js/app.js',
    '/js/i18n.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon.svg',
    '/icons/badge-72.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Static assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Cache failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name !== STATIC_CACHE && name !== DYNAMIC_CACHE;
                        })
                        .map((name) => {
                            console.log('[Service Worker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Chrome extensions
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle API requests differently (network first)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // For static assets, use cache first strategy
    event.respondWith(cacheFirst(request));
});

// Cache First Strategy
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            // Return cached response
            return cachedResponse;
        }

        // Fetch from network
        const networkResponse = await fetch(request);

        // Cache the new response
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);

        // Return offline fallback page if available
        const cachedResponse = await caches.match('/index.html');
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return a basic offline response
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// Network First Strategy (for API calls)
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network request failed, trying cache...');

        // Try to get from cache
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline response for API
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'You are currently offline. Data will sync when connection is restored.'
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'application/json'
            })
        });
    }
}

// Background Sync for offline data
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync triggered:', event.tag);

    if (event.tag === 'sync-expenses') {
        event.waitUntil(syncExpenses());
    }
});

// Sync offline expenses
async function syncExpenses() {
    console.log('[Service Worker] Syncing offline expenses...');

    // In a service worker, we can't easily import api.js if it's not a module
    // But we can notify the client to perform the sync, or use importScripts if it was structured for it.
    // For simplicity, we'll notify the open client to trigger the sync.

    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
        client.postMessage({ type: 'TRIGGER_SYNC' });
    }
}

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received');

    let data = {
        title: 'Expense Tracker',
        body: 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'expense-notification',
        renotify: true,
        requireInteraction: false,
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            renotify: data.renotify,
            requireInteraction: data.requireInteraction,
            actions: data.actions,
            data: data.url || '/'
        })
    );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Otherwise, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data || '/');
                }
            })
    );
});

// Message handling from main app
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.addAll(event.data.urls))
        );
    }
});

console.log('[Service Worker] Loaded');
