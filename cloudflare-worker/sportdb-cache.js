// ═══════════════════════════════════════════════════════════════
// SPORTDB CACHE WORKER — Cloudflare Worker + KV
// Proxy con caché para la API de SportDB (datos TransferMarkt).
// Cada respuesta se guarda en KV: repetir una consulta NO gasta
// créditos de SportDB. Con 1.000 créditos/mes bien cacheados se
// pueden cubrir todas las ligas.
//
// CÓMO DESPLEGARLO (2 minutos, dashboard de Cloudflare):
//   1. Workers & Pages → Create → Worker → nombre: sportdb-cache → Deploy
//   2. Edit code → borrar todo → pegar este archivo → Deploy
//   3. Settings → Bindings → Add → KV Namespace:
//        Variable name: CACHE
//        Namespace:     sportdb-cache  (ya creado, id 19c7db2eaab94b39bd73a87b765b3363)
//   4. Copiar la URL del worker (https://sportdb-cache.TUCUENTA.workers.dev)
//      y pegarla en el campo "Worker de Cloudflare" del extractor.
//
// Uso:  GET {worker}/?api=transfermarkt&key=API_KEY&path=/clubs/123/players
//   - &ttl=SEGUNDOS  (opcional, default 30 días)
//   - &fresh=1       (opcional, ignora el caché y fuerza consulta real)
// Respuestas con header  x-cache: HIT | MISS
//
// api=tmapi → proxy a transfermarkt-api.fly.dev (API LIBRE, sin key,
// no gasta créditos de SportDB). Sirve para completar nacionalidades.
//
// api=tmcoach&path=/verein/131 → baja la página del club en
// transfermarkt.com y extrae el DT del HTML. Gratis, sin key.
// Devuelve {coach:{name,id}} o {coach:null}.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TTL = 60 * 60 * 24 * 30; // 30 días — los valores TM cambian pocas veces por temporada

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const u = new URL(request.url);
    const api = u.searchParams.get('api') || 'flashscore';
    const path = u.searchParams.get('path') || '/football';
    const key = u.searchParams.get('key') || '';
    const ttl = Math.max(300, parseInt(u.searchParams.get('ttl') || DEFAULT_TTL, 10));
    const fresh = u.searchParams.get('fresh') === '1';

    if (!key && api !== 'tmapi' && api !== 'tmcoach') {
      return json({ error: 'Missing API key' }, 400);
    }
    if (!['transfermarkt', 'flashscore', 'tmapi', 'tmcoach'].includes(api)) {
      return json({ error: 'api debe ser transfermarkt, flashscore, tmapi o tmcoach' }, 400);
    }

    // La clave de caché NO incluye la API key: si cambiás de cuenta
    // de SportDB, el caché acumulado se sigue aprovechando.
    const cacheKey = `${api}:${path}`;

    // 1. ¿Está en KV?
    if (!fresh && env.CACHE) {
      const hit = await env.CACHE.get(cacheKey);
      if (hit !== null) {
        return new Response(hit, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-cache': 'HIT', ...CORS },
        });
      }
    }

    // 2. No está: consultar el upstream
    //    - transfermarkt/flashscore → SportDB (gasta 1 crédito)
    //    - tmapi → transfermarkt-api.fly.dev (gratis, sin key)
    //    - tmcoach → transfermarkt.com (HTML del club, gratis, sin key)
    let res, text;

    if (api === 'tmcoach') {
      const idm = path.match(/(\d+)/);
      if (!idm) return json({ error: 'path debe incluir el id del club' }, 400);
      try {
        res = await fetch(`https://www.transfermarkt.com/-/startseite/verein/${idm[1]}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
      } catch (e) {
        return json({ error: 'Upstream: ' + e.message }, 502);
      }
      if (res.status !== 200) {
        return json({ error: 'TM devolvió ' + res.status, coach: null }, res.status === 404 ? 404 : 502);
      }
      const html = await res.text();
      // El DT actual: primer link a /profil/trainer/{id} de la página
      const m = html.match(/href="\/([^"\/]+)\/profil\/trainer\/(\d+)"[^>]*>([^<]{3,60})</) ||
                html.match(/href="\/([^"\/]+)\/profil\/trainer\/(\d+)"/);
      let coach = null;
      if (m) {
        const fromSlug = m[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const name = (m[3] || '').trim() || fromSlug;
        coach = { name, id: m[2] };
      }
      if (!coach) {
        // No cachear los fallos: si TM bloqueó el fetch, reintentar después
        return new Response(JSON.stringify({ coach: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-cache': 'MISS', ...CORS },
        });
      }
      text = JSON.stringify({ coach });
      res = { status: 200 }; // para el guardado en caché de abajo
    } else {
      const upstream = api === 'tmapi'
        ? `https://transfermarkt-api.fly.dev${path}`
        : `https://api.sportdb.dev/api/${api}${path}`;
      try {
        res = await fetch(upstream, {
          headers: api === 'tmapi'
            ? { 'Accept': 'application/json' }
            : { 'X-API-Key': key, 'Accept': 'application/json' },
        });
      } catch (e) {
        return json({ error: 'Upstream: ' + e.message }, 502);
      }
      text = await res.text();
    }

    // 3. Guardar en KV solo respuestas exitosas y que parezcan JSON válido
    if (res.status === 200 && env.CACHE && text && text.length > 2) {
      try {
        JSON.parse(text);
        await env.CACHE.put(cacheKey, text, { expirationTtl: ttl });
      } catch (_) { /* no era JSON: no cachear */ }
    }

    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'x-cache': 'MISS', ...CORS },
    });
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
