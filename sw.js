// Service worker: offline app shell with a network-first strategy so online
// users always get the latest code, and offline users still get the app.
// Cross-origin requests (Supabase API/Storage, CDN libraries) are never
// intercepted — they always go straight to the network.
const CACHE = 'firearms-db-v6';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/app.js',
  './js/cloud-sync.js',
  './js/auth.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDN + Supabase pass through

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
