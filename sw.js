const CACHE_NAME = 'studio-beauty-v6';
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=6',
  './app.js?v=6',
  './manifest.webmanifest',
  './logo-studio-beauty-clean.png?v=6',
  './icon-192.png',
  './icon-512.png',
  './inicio-agenda.png',
  './manicure-tradicional.jpg',
  './semipermanente-manos.jpg',
  './soft-gel.jpg',
  './acrilicas-esculpidas.jpg',
  './recubrimiento-polygel.jpg',
  './builder-gel.jpg',
  './dipping.jpg',
  './pedicure-tradicional.jpg',
  './pedicure-semipermanente.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // No interceptar Supabase ni CDN externos.
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return resp;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
