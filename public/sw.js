/*
 * Service worker de Señales y Sistemas.
 *
 *  - Archivos con huella (/_next/static, tipografías) y KaTeX: caché primero.
 *  - La página: red primero; sin conexión se sirve la última copia.
 *  - Todo lo demás del mismo origen: caché y actualización en segundo plano.
 *
 * Las lecturas de Firestore no pasan por aquí: el contenido del curso se guarda
 * en IndexedDB desde la propia app.
 *
 * Al cambiar la estrategia, sube VERSION para descartar las cachés anteriores.
 */
const VERSION = 'v3';
const STATIC_CACHE = `sys-static-${VERSION}`;
const PAGE_CACHE = `sys-pages-${VERSION}`;
const KEEP = new Set([STATIC_CACHE, PAGE_CACHE]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add(new Request('/', { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !KEEP.has(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function isImmutable(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/katex/') || url.pathname.startsWith('/icons/');
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/', response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match('/');
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Datos de navegación de Next (RSC) y otros recursos del sitio.
  event.respondWith(staleWhileRevalidate(request));
});
