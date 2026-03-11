const CACHE_NAME = 'checkin-v5';
const PRECACHE = [
  '/tracker/',
  '/tracker/icons/menu.png',
  '/tracker/icons/add.png',
  '/tracker/icons/settings.png',
  '/tracker/icon-192.png',
  '/tracker/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API requests: network only
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Don't intercept manifest — browser needs the raw response
  if (url.pathname.endsWith('/manifest.json')) {
    return;
  }

  // App shell: network first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
