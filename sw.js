// Nanatsuka Volley - network-first updates; no offline HTML cache.
const VERSION = '2026-10-23-2';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate' || new URL(event.request.url).pathname.endsWith('/cloud.js')) {
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })).catch(() => fetch(event.request)));
  }
});
