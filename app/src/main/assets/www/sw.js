/* Service worker — the whole point is that the app opens with no connection.
   The page is one self-contained file, so the cache is tiny and the strategy
   can be the simple one: serve from cache, and refresh in the background when
   there happens to be a network.

   Deliberately NOT cached: anything the app fetches at runtime (the model
   server on localhost, Wikipedia, exchange rates). Those must always be live
   or absent — a stale cached answer presented as current would be a lie, and
   a cached model response would be worse. */
const CACHE = 'attune-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only the app's own files. Everything else goes straight to the network,
  // so a lookup is never answered from a stale cache.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const live = fetch(e.request).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);           // offline: the cached copy is the answer
      return hit || live;
    })
  );
});
