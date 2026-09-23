const CACHE_NAME = "acc-mobile-v1";
const APP_SHELL = ["/manifest.json", "/styles/mobile.css", "/scripts/mobile.js", "/favicon.svg"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => { if (event.request.method !== "GET") return; const requestUrl = new URL(event.request.url); if (requestUrl.origin !== self.location.origin || event.request.mode === "navigate") { event.respondWith(fetch(event.request).catch(() => caches.match("/mobile"))); return; } event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response; }))); });
