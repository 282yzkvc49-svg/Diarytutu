// Офлайн-кеш. При ЛЮБОМ изменении файлов увеличь CACHE (app-v1 → app-v2),
// иначе пользователь может долго видеть старую версию.
const CACHE = 'diary-v4';

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
  // cache: 'reload' — берём файлы прямо с сервера, а не из кеша браузера (GitHub Pages разрешает ему хранить их 10 минут).
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
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
  // cache: 'no-cache' — сверяемся с сервером, а не берём страницу из кеша браузера: GitHub Pages разрешает
  // хранить её 10 минут, и без этого после «Обновить» могла остаться старая версия.
  if (req.mode === 'navigate') {
    let net;
    try { net = fetch(new Request(req, { cache: 'no-cache' })); } catch (e) { net = fetch(req); }
    event.respondWith(
      withTimeout(net, 3000)
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
