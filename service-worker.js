// Po każdej zmianie plików zwiększ numer wersji, żeby telefony pobrały nowe pliki.
const CACHE = 'nauka-sw-v38';
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'gra.js',
  'gra-dane.js',
  'obrazy/gra/mapa.webp',
  'manifest.json',
  'pytania_sw.json',
  'skrypt_unitarna.md',
  'skrypt_psycholog.md',
  'instrukcje_stanowiskowe.md',
  'glock17.md',
  'skrypt_penitencjarny.md',
  'obrazy/penit/rys1-cele-kary.jpg',
  'obrazy/penit/rys2-struktura-sw.jpg',
  'obrazy/glock/safe-action.jpg',
  'obrazy/glock/bezpiecznik-spustu.jpg',
  'obrazy/glock/blokada-iglicy.jpg',
  'obrazy/glock/zaczep-spustowy.jpg',
  'obrazy/glock/budowa.jpg',
  'obrazy/glock/rozlozony-opis.jpg',
  'obrazy/glock/czesci.jpg',
  'obrazy/glock/konserwacja.jpg',
  'obrazy/odznaki/alarm.webp',
  'obrazy/odznaki/apel.webp',
  'obrazy/odznaki/bezblednie.webp',
  'obrazy/odznaki/kancelista100.webp',
  'obrazy/odznaki/kancelista1000.webp',
  'obrazy/odznaki/kancelista2500.webp',
  'obrazy/odznaki/kancelista500.webp',
  'obrazy/odznaki/kodeks.webp',
  'obrazy/odznaki/komplet.webp',
  'obrazy/odznaki/m-bron.webp',
  'obrazy/odznaki/m-ewidencja.webp',
  'obrazy/odznaki/m-kkw.webp',
  'obrazy/odznaki/m-ochrona.webp',
  'obrazy/odznaki/m-pp.webp',
  'obrazy/odznaki/m-psych.webp',
  'obrazy/odznaki/m-spb.webp',
  'obrazy/odznaki/nocna.webp',
  'obrazy/odznaki/porzadek.webp',
  'obrazy/odznaki/pudelko.webp',
  'obrazy/odznaki/recydywa.webp',
  'obrazy/odznaki/seria14.webp',
  'obrazy/odznaki/seria3.webp',
  'obrazy/odznaki/seria30.webp',
  'obrazy/odznaki/seria7.webp',
  'obrazy/odznaki/slubowanie.webp',
  'obrazy/odznaki/sowa.webp',
  'obrazy/odznaki/start.webp',
  'obrazy/odznaki/szczesciarz.webp',
  'obrazy/odznaki/szybka.webp',
  'obrazy/odznaki/trzy-medale.webp',
  'obrazy/odznaki/weekend.webp',
  'obrazy/odznaki/weteran.webp',
  'obrazy/odznaki/wzorowo.webp',
  'obrazy/odznaki/zdany.webp',
  'obrazy/odznaki/zupp.webp',
  'obrazy/odznaki/zwrot.webp',
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

// Powiadomienia od Chorążego Bielika: push przychodzi bez treści, tekst pobieramy z serwera.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let m = { title: 'Chorąży Bielik', body: 'Kursancie, czas na naukę!' };
    try {
      const r = await fetch('/api/push/wiadomosc', { cache: 'no-store', credentials: 'include' });
      if (r.ok) m = await r.json();
    } catch (e) { /* bez sieci – tekst domyślny */ }
    await self.registration.showNotification(m.title || 'Chorąży Bielik', {
      body: m.body, icon: 'ikony/icon-192.png', badge: 'ikony/icon-192.png', tag: 'bielik', renotify: true, data: { url: './' },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
