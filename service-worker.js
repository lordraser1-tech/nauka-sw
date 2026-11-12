// Po każdej zmianie plików zwiększ numer wersji, żeby telefony pobrały nowe pliki.
const CACHE = 'nauka-sw-v22';
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'pytania_sw.json',
  'skrypt_unitarna.md',
  'skrypt_psycholog.md',
  'instrukcje_stanowiskowe.md',
  'ikony/icon.svg',
  'ikony/icon-192.png',
  'ikony/icon-512.png',
  'ikony/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // Pojedynczy brakujący plik (np. skrypt .md) nie blokuje instalacji.
      // cache: 'reload' – pobierz z serwera, z pominięciem pamięci HTTP przeglądarki (GitHub Pages trzyma pliki do 10 min).
      Promise.all(FILES.map(f => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Najpierw pamięć podręczna (szybko i offline), w tle odświeżenie z sieci.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || /^\/admin(\.html)?$/.test(url.pathname)) return; // panel i logowanie – zawsze z sieci
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      // no-cache: zawsze sprawdź u serwera, czy plik się zmienił (żądanie typu navigate trzeba podać jako URL).
      const network = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' })
        .then(async res => {
          if (res.ok) cache.put(req, res.clone());
          // 401 = brak lub cofnięty kod dostępu (wersja z kodami) → kasujemy kopię, żeby przy następnym otwarciu pokazało się logowanie.
          if (res.status === 401) await caches.delete(CACHE);
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })
  );
});
