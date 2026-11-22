/* Overload service worker: makes the app open instantly and work offline.
   The version and the precache list below are filled in at build time by
   scripts/inject-sw.mjs, so every new build refreshes the cache. */
const VERSION = '__VERSION__';
const PRECACHE = /*__PRECACHE__*/[];
// Cache names keep the original prefix so updates can tidy up older caches.
const CACHE = 'gym-log-' + VERSION;
const FONTS = 'gym-log-fonts';
const scope = self.registration.scope;
const url = (path) => new URL(path, scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map(url)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gym-log-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background.
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const cached = await cache.match(req);
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      }),
    );
    return;
  }

  if (u.origin !== self.location.origin) return;

  // Opening the app: try the network (so updates arrive), fall back to the saved copy.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url('index.html'), copy));
          return res;
        })
        .catch(() => caches.match(url('index.html')).then((r) => r || caches.match(url('./')))),
    );
    return;
  }

  // Everything else (scripts, styles, icons): saved copy first.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Tapping a notification (rest over, stopwatch running) brings the app back.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(scope));
      return open ? open.focus() : self.clients.openWindow(scope);
    }),
  );
});
