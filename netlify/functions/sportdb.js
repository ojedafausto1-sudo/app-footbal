// Proxy para el extractor. Soporta cuatro upstreams:
//   transfermarkt / flashscore → SportDB (necesita API key, gasta créditos)
//   tmapi   → transfermarkt-api.fly.dev (LIBRE, sin key) — nacionalidades,
//             contratos, estadísticas y 2ª posición
//   tmcoach → transfermarkt.com (HTML del club, LIBRE) — el DT de cada club
//
// Antes esta función sólo conocía transfermarkt/flashscore: cualquier pedido
// con api=tmapi o api=tmcoach se mandaba igual a SportDB con un path que no
// existe y volvía 400. Por eso las nacionalidades salían todas 'UNK' y no se
// extraía ningún DT salvo que tuvieras el Worker de Cloudflare desplegado.

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const params = event.queryStringParameters || {};
  const path = params.path || '/football';
  const key = params.key || '';
  const api = params.api || 'flashscore';

  if (!['transfermarkt', 'flashscore', 'tmapi', 'tmcoach'].includes(api)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'api debe ser transfermarkt, flashscore, tmapi o tmcoach' }) };
  }
  // Sólo SportDB necesita key; las dos fuentes libres no
  if (!key && api !== 'tmapi' && api !== 'tmcoach') {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  try {
    // ── DT del club: se lee del HTML de Transfermarkt ──
    if (api === 'tmcoach') {
      const idm = String(path).match(/(\d+)/);
      if (!idm) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'path debe incluir el id del club' }) };
      const res = await fetch(`https://www.transfermarkt.com/-/startseite/verein/${idm[1]}`, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      });
      if (res.status !== 200) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ coach: null, upstream: res.status }) };
      }
      const html = await res.text();
      // Transfermarkt sirve el DT de formas distintas según el layout, y a veces
      // devuelve una página de bloqueo. Probamos varios patrones y, si no hay
      // ninguno, informamos POR QUÉ en vez de devolver null a secas.
      const pats = [
        /href="\/([^"\/]+)\/profil\/trainer\/(\d+)"[^>]*>([^<]{3,60})</,
        /href="\/([^"\/]+)\/profil\/trainer\/(\d+)"/,
        /\/profil\/trainer\/(\d+)[^>]*>\s*([^<]{3,60})</,
        /"trainer"[^}]*"name"\s*:\s*"([^"]{3,60})"/i,
      ];
      let coach = null;
      for (const re of pats) {
        const m = html.match(re);
        if (!m) continue;
        if (re === pats[2]) { coach = { name: (m[2] || '').trim(), id: m[1] }; }
        else if (re === pats[3]) { coach = { name: m[1].trim(), id: '' }; }
        else {
          const fromSlug = m[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          coach = { name: (m[3] || '').trim() || fromSlug, id: m[2] };
        }
        if (coach && coach.name) break;
        coach = null;
      }
      const blocked = /captcha|just a moment|access denied|cf-browser-verification|challenge/i.test(html);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        coach,
        // pistas para diagnosticar sin adivinar
        diag: coach ? undefined : { blocked, htmlLen: html.length, hasTrainerWord: /trainer/i.test(html) },
      }) };
    }

    // ── Resto: SportDB o la TM-API libre ──
    const upstream = api === 'tmapi'
      ? `https://transfermarkt-api.fly.dev${path}`
      : `https://api.sportdb.dev/api/${api}${path}`;

    const res = await fetch(upstream, {
      headers: api === 'tmapi'
        ? { 'Accept': 'application/json', 'User-Agent': UA }
        : { 'X-API-Key': key, 'Accept': 'application/json' },
    });
    const text = await res.text();
    return { statusCode: res.status, headers: CORS, body: text };
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Upstream: ' + e.message }) };
  }
};
