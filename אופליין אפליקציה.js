/* Offline shell for the trip dossier.
   The app itself is one self-contained file, so caching it (plus the icons) is
   enough to open the whole thing on a plane or in a metro tunnel. Live data —
   weather, exchange rates, Firebase sync — simply resumes when there's signal. */
const CACHE = "trip-dossier-v1";
const SHELL = ["./", "./index.html", "./sync.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Live endpoints: always try the network, never serve a stale rate or forecast. */
  if (url.origin !== self.location.origin) return;

  /* The app shell: serve from cache instantly, refresh in the background. */
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
