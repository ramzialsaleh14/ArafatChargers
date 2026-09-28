/*
 * Minimal service worker for Arafat Chargers.
 *
 * It deliberately caches NOTHING: charger data, car numbers and receipts have
 * to be fresh every time, and a stale bundle is worse than a slow load. Its
 * only job is to satisfy the PWA installability requirement of browsers that
 * still expect a registered service worker.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Presence of a fetch handler is what makes the app installable. No
// respondWith() call means every request is handled by the network as usual.
self.addEventListener('fetch', () => {});
