/**
 * SmartDesk PWA service worker — minimal.
 *
 * Goals:
 *   - Satisfy the browser's installability criteria
 *     (fetch handler + start_url reachable).
 *   - Provide a polite "online-first" passthrough so we NEVER serve
 *     stale tenant data — this app is multi-tenant and any aggressive
 *     caching would risk leaking another company's data when an admin
 *     impersonates someone. The shell (HTML/CSS/JS bundles) is
 *     opportunistically cached for fast cold-start when offline.
 */

const VERSION = 'smartdesk-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Network-first for everything; cache the navigation/shell only as
  // a last-resort offline fallback so the user sees something rather
  // than the browser's offline page. NEVER cache API responses
  // (multi-tenant risk).
  if (req.method !== 'GET' || req.url.includes('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only cache static assets (Vite chunks, icons, manifest).
        const url = new URL(req.url);
        const isStatic =
          url.origin === self.location.origin &&
          (url.pathname.startsWith('/assets/') ||
            url.pathname.startsWith('/icons/') ||
            url.pathname === '/manifest.json' ||
            url.pathname === '/');
        if (isStatic && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
  );
});
