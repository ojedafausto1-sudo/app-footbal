// ═══════════════════════════════════════════════════════════════════════
// DIRECTOR TÉCNICO — service worker (Fase 79): jugar sin internet
// ═══════════════════════════════════════════════════════════════════════
// El juego ya no pide nada por red para JUGAR (la partida vive en
// localStorage), pero sí para ABRIRSE: el HTML, la base y three.js. Esto los
// guarda en el teléfono la primera vez que entrás con conexión.
//
// • NÚCLEO (dt-core-<versión>): el juego, la base, los DTs, three.js, las
//   tipografías y los íconos. Se baja entero al instalar.
// • TEMPORADAS (dt-hist): los players-hist-AÑO.js pesan ~2 MB cada uno (51 MB
//   los 26), así que NO se bajan solos: se guardan cuando elegís ese año, o
//   todos juntos con el botón "Descargar temporadas" del juego. Este caché NO
//   se borra al cambiar de versión: re-bajar 51 MB por un deploy sería un
//   castigo.
//
// ⚠️ El HTML va "red primero": con conexión siempre abre la versión nueva, y
// sin conexión cae al guardado. El resto va "caché primero y se actualiza
// por atrás", que es lo que hace que abra al instante.
// ⚠️ Cambiá DT_VER en cada deploy que toque el núcleo: es lo que dispara la
// instalación nueva y la limpieza del caché viejo.
const DT_VER = 'v80-1';
const CORE = 'dt-core-' + DT_VER;
const HIST = 'dt-hist';
const CORE_FILES = [
  'director-tecnico.html', 'index.html', 'players-db.js', 'dts-db.js',
  'players-hist-index.js', 'three.min.js', 'manifest.webmanifest',
  'fonts/fonts.css', 'icons/icon-180.png', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/icon-512-maskable.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CORE);
    await c.addAll(CORE_FILES.map(u => new Request(u, { cache: 'reload' })));
    // Las tipografías salen de fonts.css (no de una lista escrita acá, que se
    // desincronizaría el día que se agregue un peso).
    try {
      const css = await (await c.match('fonts/fonts.css')).text();
      const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => 'fonts/' + m[1].replace(/['"]/g, ''));
      await c.addAll(urls);
    } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k.startsWith('dt-core-') && k !== CORE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const esHist = p => /\/players-hist-\d{4}\.js$/.test(p);

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // nada de afuera
  if (url.pathname.startsWith('/.netlify/')) return;          // el proxy del extractor no se cachea

  // El juego (o "/", que Netlify redirige al juego): red primero.
  if (req.mode === 'navigate' || url.pathname.endsWith('/director-tecnico.html')) {
    ev.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok && !r.redirected) (await caches.open(CORE)).put('director-tecnico.html', r.clone());
        return r;
      } catch (e) {
        return (await caches.match('director-tecnico.html')) || Response.error();
      }
    })());
    return;
  }

  // Todo lo demás: caché primero, y se actualiza por atrás si hay conexión.
  ev.respondWith((async () => {
    const nombre = esHist(url.pathname) ? HIST : CORE;
    const c = await caches.open(nombre);
    const hit = await c.match(req, { ignoreSearch: true });
    const red = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { ev.waitUntil(red); return hit; }
    const r = await red;
    return r || new Response('', { status: 504, statusText: 'sin conexión' });
  })());
});
