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
// ⚠️ ¿Actualizaste este archivo y querés saber si el deploy tomó?
// Abrí  {worker}/?api=ping  en el navegador. Si dice version y historicos:true,
// está actualizado. La URL pelada devuelve "Missing API key" en TODAS las
// versiones, así que no sirve para verificar nada.
//
// api=tmcoach&path=/verein/131 → baja la página del club en
// transfermarkt.com y extrae el DT del HTML. Gratis, sin key.
// Devuelve {coach:{name,id}} o {coach:null}.
// ═══════════════════════════════════════════════════════════════

// Se sube cada vez que cambia algo que el extractor necesita saber.
// `?api=ping` la devuelve: es la forma de verificar que el deploy tomó.
const WORKER_VERSION = '2026.09-hist';

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

    // ═══ ¿ESTE WORKER ESTÁ ACTUALIZADO? ═══
    // Entrar a la URL pelada devuelve {"error":"Missing API key"} en TODAS las
    // versiones, vieja y nueva, así que no sirve para saber si el deploy tomó.
    // `?api=ping` contesta la versión y qué fuentes soporta: es lo único que
    // distingue un Worker actualizado de uno que quedó con el código de antes.
    // No pide key a propósito — tiene que poder abrirse desde el navegador.
    if (api === 'ping') {
      return json({
        ok: true,
        worker: 'sportdb-cache',
        version: WORKER_VERSION,
        apis: ['transfermarkt', 'flashscore', 'tmapi', 'tmcoach', 'tmkader', 'tmclubs'],
        historicos: true,
        cacheKV: !!env.CACHE,
      });
    }
    if (!key && api !== 'tmapi' && api !== 'tmcoach' && api !== 'tmkader' && api !== 'tmclubs') {
      return json({ error: 'Missing API key' }, 400);
    }
    if (!['transfermarkt', 'flashscore', 'tmapi', 'tmcoach', 'tmkader', 'tmclubs'].includes(api)) {
      return json({ error: 'api debe ser transfermarkt, flashscore, tmapi, tmcoach, tmkader o tmclubs' }, 400);
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
      const cid = idm[1];
      // La página de club dejó de traer al DT en el HTML del servidor. Se
      // recorren varias URLs y se usa la primera que tenga un link de entrenador:
      // la de cuerpo técnico (mitarbeiter) sí sigue siendo server-rendered.
      const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
      const urls = [
        `https://www.transfermarkt.com/-/mitarbeiter/verein/${cid}`,
        `https://www.transfermarkt.es/-/mitarbeiter/verein/${cid}`,
        `https://www.transfermarkt.de/-/mitarbeiter/verein/${cid}`,
        `https://www.transfermarkt.com/-/startseite/verein/${cid}`,
      ];
      let html = '', usedUrl = '';
      for (const u of urls) {
        try {
          const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } });
          if (r.status !== 200) continue;
          const t = await r.text();
          if (/profil\/trainer\//i.test(t)) { html = t; usedUrl = u; break; }
          if (!html) { html = t; usedUrl = u; }
        } catch (e) { /* siguiente */ }
      }
      if (!html) return json({ coach: null, error: 'TM no respondió en ninguna URL' }, 502);
      // Varios layouts posibles del link al entrenador
      let coach = null;
      const pats = [
        /href="\/([^"\/]+)\/profil\/trainer\/(\d+)"[^>]*>([^<]{3,60})</,
        /href="\/([^"\/]+)\/profil\/trainer\/(\d+)"/,
        /\/profil\/trainer\/(\d+)[^>]*>\s*([^<]{3,60})</,
      ];
      for (let i = 0; i < pats.length; i++) {
        const m = html.match(pats[i]);
        if (!m) continue;
        if (i === 2) coach = { name: (m[2] || '').trim(), id: m[1] };
        else {
          const fromSlug = m[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          coach = { name: (m[3] || '').trim() || fromSlug, id: m[2] };
        }
        if (coach && coach.name) break;
        coach = null;
      }
      res = { status: 200 };
      if (!coach) {
        // No cachear los fallos: si TM bloqueó el fetch, reintentar después
        return new Response(JSON.stringify({ coach: null, url: usedUrl, htmlLen: html.length }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-cache': 'MISS', ...CORS },
        });
      }
      text = JSON.stringify({ coach, url: usedUrl });

    } else if (api === 'tmkader' || api === 'tmclubs') {
      // ═══════════════════════════════════════════════════════════════
      // PLANTELES HISTÓRICOS — Transfermarkt guarda todas las temporadas
      //
      //   api=tmkader&path=/verein/{clubId}/saison/{año}
      //   api=tmclubs&path=/wettbewerb/{compId}/saison/{año}
      //
      // Gratis, sin key, sin créditos de SportDB: se baja el HTML
      // server-rendered de transfermarkt y se parsea. SportDB sólo tiene el
      // plantel ACTUAL, así que para los años viejos esta es la única vía.
      //
      // ⚠️ ESTO NO ESTÁ VERIFICADO CONTRA EL SITIO REAL. Se escribió sin
      // poder hacer un solo pedido a transfermarkt.com (el contenedor donde
      // se programó sólo tiene salida a GitHub). El parser es tolerante a
      // propósito y SIEMPRE devuelve un bloque `diag`: si el layout cambió,
      // `diag` dice cuántas filas encontró, cuántas parseó y trae el HTML de
      // la primera fila cruda con &debug=1, que es lo que hace falta para
      // arreglarlo en UNA vuelta en vez de cinco a ciegas.
      // ═══════════════════════════════════════════════════════════════
      const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
      const debug = u.searchParams.get('debug') === '1';
      const m = path.match(/\/(?:verein|wettbewerb)\/([^\/]+)(?:\/saison\/(\d{4}))?/);
      if (!m) return json({ error: 'path: /verein/{id}/saison/{año} o /wettbewerb/{id}/saison/{año}' }, 400);
      const id = m[1], year = m[2] || '';

      const urls = api === 'tmkader'
        ? [
            `https://www.transfermarkt.com/-/kader/verein/${id}${year ? '/saison_id/' + year : ''}/plus/1`,
            `https://www.transfermarkt.es/-/kader/verein/${id}${year ? '/saison_id/' + year : ''}/plus/1`,
            `https://www.transfermarkt.com/-/kader/verein/${id}${year ? '/saison_id/' + year : ''}`,
          ]
        : [
            `https://www.transfermarkt.com/-/startseite/wettbewerb/${id}${year ? '/plus/?saison_id=' + year : ''}`,
            `https://www.transfermarkt.es/-/startseite/wettbewerb/${id}${year ? '/plus/?saison_id=' + year : ''}`,
          ];

      let html = '', usedUrl = '', status = 0;
      for (const uu of urls) {
        try {
          const r = await fetch(uu, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } });
          status = r.status;
          if (r.status !== 200) continue;
          const t = await r.text();
          // La página buena tiene la tabla de items; si TM devolvió un
          // interstitial o un 403 maquillado, no la tiene.
          if (/\/profil\/(spieler|verein)\//.test(t)) { html = t; usedUrl = uu; break; }
          if (!html) { html = t; usedUrl = uu; }
        } catch (e) { /* siguiente URL */ }
      }
      if (!html) {
        return json({ error: 'TM no respondió en ninguna URL', status, urls }, 502);
      }

      const out = api === 'tmkader' ? parseKader(html, year) : parseClubes(html);
      out.club = id; out.season = year || null;
      out.diag = Object.assign({ url: usedUrl, htmlLen: html.length }, out.diag || {});
      if (debug) out.diag.muestraHTML = (out._rawFirst || '').slice(0, 2500);
      delete out._rawFirst;

      // Una respuesta VACÍA no se cachea: si se cachea un fallo de parseo,
      // volver a correr la liga devuelve el mismo vacío durante 30 días y
      // parece que el club no existe. Es el bug de los clubes perdidos otra vez.
      if (!(out.players || out.clubs || []).length) {
        return new Response(JSON.stringify(out), {
          status: 200, headers: { 'Content-Type': 'application/json', 'x-cache': 'MISS', ...CORS },
        });
      }
      res = { status: 200 };
      text = JSON.stringify(out);

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

// ═══════════════════════════════════════════════════════════════
// PARSERS DE HTML DE TRANSFERMARKT  ⚠️ NO VERIFICADOS CONTRA EL SITIO
// ═══════════════════════════════════════════════════════════════
// Escritos a partir del layout conocido de la tabla de plantel, sin haber
// podido hacer un pedido real. Cada uno es TOLERANTE: prueba varios patrones
// por campo y, si uno no sale, deja el campo vacío en vez de descartar al
// jugador. Un jugador con el nombre y nada más ya sirve para saber que el
// parser encuentra las filas; un jugador descartado no dice nada.

function rowsDe(html) {
  // Las filas del plantel son <tr class="odd"> / <tr class="even">. Se corta
  // por ahí en vez de parsear la tabla entera: cualquier cambio en el
  // contenedor (que TM toca seguido) no rompe esto.
  const partes = html.split(/<tr class="(?:odd|even)"[^>]*>/i);
  return partes.slice(1);
}

function txt(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function valorEnMillones(s) {
  if (!s) return 0;
  const m = String(s).match(/€\s*([\d.,]+)\s*([a-zäöü.]*)/i);
  if (!m) return 0;
  // ⚠️ La unidad se lee ENTERA, no con una alternancia. Con `(bn|m|k|mil|th)?`
  // la 'm' ganaba antes que 'mil' y "€930 mil" quedaba en 930 MILLONES.
  const u = (m[2] || '').toLowerCase().replace(/\./g, '');
  const mill = u === 'm' || u.indexOf('mill') === 0 || u === 'mio';
  const bn = u === 'bn' || u.indexOf('mrd') === 0 || u.indexOf('bil') === 0;
  const mil = !mill && !bn && (u === 'k' || u === 'th' || u === 'tsd' || u === 'mil');
  let n = m[1];
  // ⚠️ Sin unidad, los separadores son de MILES. Ésta es la que rompía:
  // "€930,000" (el formato de la .com) caía en la regla de "el último
  // separador es el decimal" y daba 930 en vez de 0,93. Con unidad sí manda
  // esa regla, porque ahí TM escribe decimales: "1,20 mill." / "1.20m".
  if (!mill && !bn && !mil) {
    n = n.replace(/[.,]/g, '');
  } else {
    const iC = n.lastIndexOf(','), iP = n.lastIndexOf('.');
    n = (iC > iP) ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, '');
  }
  let v = parseFloat(n);
  if (isNaN(v)) return 0;
  if (bn) v *= 1000;
  else if (mil) v /= 1000;
  // ⚠️ Sin unidad, el número son EUROS, siempre. El umbral que había
  // (`v>=10000 ? v/1e6 : v`) dejaba pasar "€2.500" como 2.500 millones. TM
  // nunca escribe un valor en millones sin poner la unidad.
  else if (!mill) v = v / 1e6;
  return Math.round(v * 1000) / 1000;
}

function parseKader(html, year) {
  const filas = rowsDe(html);
  const players = [];
  let raw = '';
  for (const f of filas) {
    if (!raw) raw = f;
    // nombre + id: el link al perfil es lo único que TM no cambió nunca
    const nm = f.match(/\/profil\/spieler\/(\d+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]{2,60})</i)
            || f.match(/\/profil\/spieler\/(\d+)"[^>]*>\s*([^<]{2,60})</i);
    if (!nm) continue;
    const pid = nm[1];
    const name = txt(nm[3] || nm[2] || '');
    if (!name || /^\d+$/.test(name)) continue;

    // dorsal: <div class="rn_nummer">12</div>
    const num = (f.match(/rn_nummer"[^>]*>\s*(\d{1,2})\s*</i) || [])[1] || '';
    // posición: la segunda línea de la inline-table, debajo del nombre
    let pos = (f.match(/<\/a>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td[^>]*>\s*([^<]{3,40})\s*<\/td>/i) || [])[1] || '';
    if (!pos) pos = (f.match(/<tr>\s*<td[^>]*>\s*(Goalkeeper|Centre-Back|Left-Back|Right-Back|Defensive Midfield|Central Midfield|Attacking Midfield|Left Midfield|Right Midfield|Left Winger|Right Winger|Second Striker|Centre-Forward|Midfielder|Defender|Attack)[^<]*<\/td>/i) || [])[1] || '';
    pos = txt(pos);
    // fecha de nacimiento y edad: "Jan 1, 2000 (25)" / "01/01/2000 (25)"
    const fn = f.match(/>\s*([A-Za-z]{3}\s+\d{1,2},\s*\d{4}|\d{1,2}[./]\d{1,2}[./]\d{4})\s*\((\d{1,2})\)\s*</);
    const birth = fn ? fn[1] : '';
    const age = fn ? +fn[2] : 0;
    // nacionalidades: los banderines, en orden
    const nats = [];
    const reNat = /class="flaggenrahmen"[^>]*title="([^"]+)"|title="([^"]+)"[^>]*class="flaggenrahmen"/gi;
    let mn; while ((mn = reNat.exec(f))) { const v = mn[1] || mn[2]; if (v && nats.indexOf(v) < 0) nats.push(v); }
    // altura "1,85 m" · pie "right/left/both"
    const hm = f.match(/(\d)[.,](\d{2})\s*m/);
    const height = hm ? (+hm[1] * 100 + +hm[2]) : 0;
    const foot = ((f.match(/>\s*(right|left|both|rechts|links|beidfüßig)\s*</i) || [])[1] || '').toLowerCase();
    // contrato: la ÚLTIMA fecha suelta de la fila (la columna de vencimiento)
    const fechas = f.match(/([A-Za-z]{3}\s+\d{1,2},\s*\d{4}|\d{1,2}[./]\d{1,2}[./]\d{4})/g) || [];
    const contract = fechas.length > 1 ? fechas[fechas.length - 1] : '';
    // valor de mercado: la celda de la derecha
    const value = valorEnMillones((f.match(/(€\s*[\d.,]+\s*(?:bn|m|k|mil|th)?)/i) || [])[1]);

    players.push({ id: pid, name, num, pos, age, birth,
      nat: nats[0] || '', nat2: nats[1] || '',
      height, foot, contract, value });
  }
  return { players, _rawFirst: raw,
    diag: { filas: filas.length, parseados: players.length,
      conValor: players.filter(p => p.value > 0).length,
      conNac: players.filter(p => p.nat).length,
      conPos: players.filter(p => p.pos).length,
      temporada: year || null } };
}

function parseClubes(html) {
  const clubs = [];
  const vistos = {};
  const re = /\/([^"\/]+)\/startseite\/verein\/(\d+)(?:\/saison_id\/\d+)?"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)</gi;
  let m;
  while ((m = re.exec(html))) {
    const id = m[2];
    if (vistos[id]) continue;
    const name = txt(m[3] || m[4] || '') || m[1].replace(/-/g, ' ');
    if (!name) continue;
    vistos[id] = 1;
    clubs.push({ id, name });
  }
  return { clubs, _rawFirst: html.slice(0, 2500),
    diag: { encontrados: clubs.length } };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
