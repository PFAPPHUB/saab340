// SAAB 340 Cruise Data — offline support
// Stores the app on the device so it opens without an internet connection.
// When the device is online the page is fetched fresh, so a new index.html
// uploaded to GitHub is picked up automatically (no need to edit this file).
const CACHE = 'saab340-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const NET_TIMEOUT_MS = 3000;   // how long to wait for the network before using the stored copy

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const good = res => res && res.ok && res.type === 'basic';

// Fetch from the network and store a good copy for offline use
function refresh(req) {
  return fetch(req.url, {cache: 'no-cache'}).then(res => {
    if (!good(res)) return res;
    const copy = res.clone();
    return caches.open(CACHE).then(c => c.put(req.url, copy)).then(() => res);
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const stored = caches.match(req, {ignoreSearch: true});
  const fresh  = refresh(req);
  e.waitUntil(fresh.catch(() => {}));

  if (req.mode === 'navigate' || req.destination === 'document') {
    // The app page: network first (latest version when online), stored copy when offline or slow
    e.respondWith(
      Promise.race([
        fresh.then(res => good(res) ? res : Promise.reject(new Error('bad response'))),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT_MS))
      ]).catch(() => stored.then(hit => hit || fresh))
    );
  } else {
    // Icons and manifest: stored copy first, refreshed in the background
    e.respondWith(stored.then(hit => hit || fresh));
  }
});
