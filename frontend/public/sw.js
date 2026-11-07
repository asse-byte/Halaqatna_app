// Halaqtna — the service worker that makes the web client installable and lets it open offline.
//
// It keeps the application shell only: the page, its hashed scripts and styles, the icons and
// the manifest. It never touches /api/ or /p/: student data and report links always go to the
// network and are never written to a device's cache, where anyone else using the device could
// read them. Saving a session while offline is the existing queue's job (src/lib/offline.js),
// not this file's.
//
// main.jsx registers /sw.js?v=<build id>. A new build therefore installs a new worker, which
// clears the previous build's cache when it takes over.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `halaqtna-shell-${VERSION}`;
const SHELL = ["/", "/manifest.json", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("halaqtna-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;                                   // fonts and the like: the browser's own cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/p/")) return;   // data: network only, never stored

  // Pages: the network first, so an update is seen at once; the stored shell when offline.
  // Every route of the SPA is the same index.html, which is kept under "/".
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  // Scripts, styles and images: their names change with every build, so a stored copy is never stale.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
