/* ============================================================
   Service Worker — Pronos Foot PWA
   - App shell en cache (fonctionnement hors-ligne)
   - /api/predictions : network-first, bascule sur le dernier
     jeu de données mis en cache si le réseau échoue
   - Assets statiques (_next/static, icônes, manifest) : cache-first
   ============================================================ */

const VERSION = "v1";
const STATIC_CACHE = `pronos-static-${VERSION}`;
const API_CACHE = `pronos-api-${VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/* API : réseau d'abord, cache en secours (données hors-ligne) */
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await withTimeout(fetch(request), 12000);
    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    throw new Error("Réponse invalide du serveur");
  } catch (err) {
    const cached =
      (await cache.match(request)) ||
      (await cache.match("/api/predictions")) ||
      (await cache.match("/api/predictions?refresh=1"));
    if (cached) return cached;
    return Response.json(
      {
        ok: false,
        error: "Hors-ligne : aucune donnée de prédictions en cache",
        leagues: [],
        fallback: "none",
      },
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* Statique : cache d'abord, réseau en secours */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return Response.error();
  }
}

/* Navigations : réseau d'abord, app shell en cache en secours */
async function networkFirstNavigation(request) {
  try {
    const response = await withTimeout(fetch(request), 10000);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
      return response;
    }
    throw new Error("Réponse invalide");
  } catch (err) {
    const cached = (await caches.match(request)) || (await caches.match("/"));
    if (cached) return cached;
    return new Response(
      "<h1 style='font-family:sans-serif;text-align:center;margin-top:20vh'>⚠ Hors-ligne</h1>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/predictions" || url.pathname.startsWith("/api/predictions/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/sw.js" ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cacheFirst(request));
  }
});
