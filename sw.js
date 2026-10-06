const CACHE_NAME = "birthday-assistant-v1-8-2b-corrected";
const APP_SHELL = [
  "/birthday-assistant/",
  "/birthday-assistant/index.html",
  "/birthday-assistant/style.css",
  "/birthday-assistant/app.js",
  "/birthday-assistant/manifest.json",
  "/birthday-assistant/icons/icon-192.png",
  "/birthday-assistant/icons/icon-512.png",
  "/birthday-assistant/logos/avakerolos-sonntagsschule.png",
  "/birthday-assistant/logos/malayka-sonntagsschule.png",
  "/birthday-assistant/logos/abounfaltaous-sonntagsschule.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isAppShell =
    url.pathname === "/birthday-assistant/" ||
    url.pathname === "/birthday-assistant/index.html" ||
    url.pathname === "/birthday-assistant/app.js" ||
    url.pathname === "/birthday-assistant/style.css" ||
    url.pathname === "/birthday-assistant/manifest.json";

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
