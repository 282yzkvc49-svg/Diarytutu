// Офлайн-кеш. При ЛЮБОМ изменении файлов увеличь CACHE (app-v1 → app-v2),
// иначе пользователь может долго видеть старую версию.
const CACHE = 'diary-v1';

// Все файлы приложения. Пути — только относительные (./...), без "/" в начале.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Страница присылает 'skipWaiting', когда пользователь нажал «Обновить».
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Страница: сначала сеть (свежая версия), при плохой сети или офлайн — из кеша.
  if (req.mode === 'navigate') {
    event.respondWith(
      withTimeout(fetch(req), 3000)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Остальные файлы: сначала кеш, затем сеть (и докладываем в кеш).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
    )
  );
});
