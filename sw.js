// sw.js — offline fallback cache for the Todo PWA.
//
// Previously this used cache-first-with-background-refresh: on every
// request it returned whatever was already cached immediately, and only
// used the network response to update the cache for the *next* load. That
// meant a device that had the app open once would keep serving the exact
// files from that first install indefinitely — a code fix shipped later
// would only become visible after TWO reloads (one to silently refresh the
// cache in the background, a second to finally receive it), and if the
// installed home-screen icon is never fully closed/reopened it can look
// like a shipped fix "did nothing" even though the deployed files are
// correct. Network-first fixes that: every load tries the network first
// (so a new deploy is visible immediately when online), and only falls
// back to the cache when offline or the request fails.
const CACHE_VERSION = "v3-debug";
const CACHE_NAME = "todo-app-cache-" + CACHE_VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./calendar.html",
  "./style.css",
  "./store.js",
  "./app.js",
  "./calendar.js",
  "./debug-overflow.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  // Take over from any older service worker as soon as this one finishes
  // installing, without waiting for every open tab/PWA instance to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
