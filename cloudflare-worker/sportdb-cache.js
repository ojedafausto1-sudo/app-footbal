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

    if (!key) {
      return json({ error: 'Missing API key' }, 400);
    }
    if (api !== 'transfermarkt' && api !== 'flashscore') {
      return json({ error: 'api debe ser transfermarkt o flashscore' }, 400);
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

    // 2. No está: consultar SportDB (esto sí gasta 1 crédito)
    const upstream = `https://api.sportdb.dev/api/${api}${path}`;
    let res;
    try {
      res = await fetch(upstream, {
        headers: { 'X-API-Key': key, 'Accept': 'application/json' },
      });
    } catch (e) {
      return json({ error: 'Upstream: ' + e.message }, 502);
    }

    const text = await res.text();

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
