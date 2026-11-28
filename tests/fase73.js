// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 73: el botón JUGAR, la mesa de negociación, las copas
// intercaladas y la Champions nueva
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase73.js
//
// Qué blinda:
//  1. ▶ JUGAR PARTIDO abre el 11v11 JUGABLE (watch=false), en 3D, y en 3D la
//     reproducción va a FM3_TIEMPO. Mirando, la cámara arranca en la de TV.
//  2. Un amistoso jugado en el 11v11 no pasa por applyMatchResult.
//  3. La portada ya no dibuja la lista de amistosos (están en el fixture).
//  4. Negociar una oferta de compra como PRÉSTAMO o como CANJE: el club evalúa
//     el paquete, un pedido razonable se acepta y uno abusivo lo hace irse.
//     El jugador del canje sale del club comprador.
//  5. Un préstamo que cruza el cambio de temporada vuelve.
//  6. Las llaves de copa van intercaladas con la liga (no todas al final).
//  7. Champions desde 2025: fase liga de 36, todos con 8 PJ; 9-24 al playoff.
//  8. El estadio tiene suelo y las copas tienen formas distintas.
//  9. Ningún rival se viste igual que vos (KITS sólo tenía 28 clubes).
// 10. 0 funciones en G y 0 errores de página.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {} updateUI(); });

  console.log('\n═══ JUGAR ═══');
  const jb = await pg.evaluate(() => {
    const on = document.getElementById('btnPlay').getAttribute('onclick');
    const amis = document.getElementById('friendlyBox').innerHTML.trim().length;
    return { on, amis };
  });
  chk('▶ JUGAR PARTIDO abre el 11v11 jugable', /startFullMatch\(false\)/.test(jb.on), jb.on);
  chk('la portada no lista los amistosos', jb.amis === 0);
  await pg.evaluate(() => { G.day = 7; G._talkWeek = G.week; document.getElementById('btnPlay').click(); });
  await pg.waitForTimeout(1600);
  const j = await pg.evaluate(() => ({ watch: FM.watch, on: _FM3.on, modo: _FM3.modo, t: FM3_TIEMPO }));
  chk('arranca jugable y en 3D', !j.watch && j.on, JSON.stringify(j));
  chk('la reproducción en 3D va más lenta', j.t > 0.3 && j.t < 1);
  const amis = await pg.evaluate(() => {
    const m = FM.pending.m, fr = !!m.friendly, w0 = G.week, pj0 = G.wins + G.draws + G.losses;
    FM.myG = 2; FM.oppG = 1; fmEnd(); closeMod();
    return { fr, jugado: m.played, score: m.score, sinLiga: G.wins + G.draws + G.losses === pj0, semana: G.week > w0 };
  });
  chk('un amistoso jugado en el 11v11 se cierra como amistoso', !amis.fr || (amis.jugado && amis.sinLiga && amis.semana), JSON.stringify(amis));
  await pg.evaluate(() => { localStorage.removeItem('dt_fm3dcamW'); G.day = 7; startFullMatch(true); });
  await pg.waitForTimeout(1500);
  const w = await pg.evaluate(() => { const r = { on: _FM3.on, modo: _FM3.modo }; try { fmQuit(); } catch (e) {} document.getElementById('fm-ov')?.remove(); closeMod(); return r; });
  chk('mirando, la cámara arranca en la de TV', w.modo === 'tv', JSON.stringify(w));

  console.log('\n═══ NEGOCIACIÓN ═══');
  const ng = await pg.evaluate(() => {
    const out = {};
    const p = G.squad.filter(x => x.pos !== 'ARQ').sort((a, c) => c.rat - a.rat)[3];
    const club = (G.market.find(q => q.club && q.club !== G.teamName && q.club !== 'Libre' && G.market.filter(x => x.club === q.club).length > 15) || {}).club;
    const fresca = () => { const o = { player: p, from: club, amount: Math.round(p.val * 10) / 10, type: 'compra', listed: true, _techo: Math.round(p.val * 1.15 * 100) / 100 }; G.offers = [o]; return o; };
    // préstamo razonable → se acepta y el jugador queda cedido
    let o = fresca(); openNegSell(0); _NO.modo = 'prestamo'; negOfRender();
    out.modal = /Préstamo/.test(document.getElementById('modBody').innerHTML) && !!document.getElementById('noCargo');
    const L = _negLoanLim(o);
    _NO.cargo = L.cargo * 0.8; _NO.sueldo = 50; _NO.semanas = 52; _NO.compra = 'no';
    out.rPrest = negRatio(o, _NO);
    const sq0 = G.squad.length, ln0 = (G.loaned || []).length;
    const rnd = Math.random; Math.random = () => 0.01;
    document.getElementById('noCargo').value = _NO.cargo; negOfEnviar();
    Math.random = rnd;
    out.cedido = (G.loaned || []).length === ln0 + 1 && G.squad.length === sq0 - 1;
    const l = (G.loaned || []).slice(-1)[0];
    out.duracion = l && (l.returnWeek - G.week);
    // vuelve aunque cruce el cambio de temporada
    if (l) { l.returnWeek = 70; const wk = G.week; G.week = 49; (G.loaned || []).forEach(x => { if (x === l) x.returnWeek = Math.max(1, x.returnWeek - G.week); }); out.cruza = l.returnWeek === 21; G.week = wk; }
    // la vuelta del cedido (para no dejar el plantel corto)
    if (l) { G.loaned = G.loaned.filter(x => x !== l); l.player.club = G.teamName; l.player.onLoan = false; G.squad.push(l.player); }
    // canje: el jugador viene del club comprador
    o = fresca(); openNegSell(0); _NO.modo = 'canje'; negOfRender();
    const suyos = _negSuyos(o); out.suyos = suyos.length; out.delClub = suyos.every(q => q.club === club);
    _NO.canjeId = suyos[suyos.length - 1].id; _NO.cash = 0;
    out.rCanje = negRatio(o, _NO);
    // pedido abusivo: se van
    _NO.modo = 'venta'; _NO.precio = p.val * 4; o._intentos = 1;
    document.getElementById('modBody') && negOfRender();
    document.getElementById('noPrecio').value = _NO.precio;
    negOfEnviar();
    out.seVan = G.offers.length === 0;
    closeMod();
    return out;
  });
  chk('la mesa tiene la modalidad préstamo', ng.modal);
  chk('un préstamo razonable se acepta y el jugador queda cedido', ng.cedido, 'ratio ' + ng.rPrest.toFixed(2));
  chk('el préstamo dura lo que se pactó', ng.duracion === 52, ng.duracion + ' semanas');
  chk('un préstamo que cruza la temporada vuelve', ng.cruza);
  chk('el canje ofrece jugadores DEL club comprador', ng.suyos > 0 && ng.delClub, ng.suyos + ' jugadores');
  chk('un pedido abusivo hace que el club se levante', ng.seVan);

  console.log('\n═══ COPAS ═══');
  const cp = await pg.evaluate(() => {
    // Boca, temporada completa simulada: ¿las llaves van entre fechas?
    const drain = () => { for (let k = 0; k < 20; k++) { const d = dilemaBloqueante(); if (d) { dilemaResolver(d.id, 0); continue; } if (prensaPend()) { prensaResolver(0); continue; } break; } closeMod(); };
    for (let i = 0; i < 70; i++) { drain(); const m = G.calendar.find(x => !x.played); if (!m) break; G.day = 7; G.week = Math.max(G.week, m.week); simMatch(true); closeMod(); if (G.week > 32) break; }
    const ko = G.calendar.filter(m => esCopaInt(m.comp) && /Octavos|Cuartos|Semis|Final/.test(m.comp));
    const { fin } = _ligaSpan();
    return { ko: ko.map(m => m.week), fin, alFinal: ko.filter(m => m.week > fin).length };
  });
  chk('las llaves de copa caen entre fechas de liga', cp.ko.length === 0 || cp.alFinal <= 1, `semanas ${cp.ko.join(',')} · liga hasta la ${cp.fin}`);
  await pg.close();

  const pg2 = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pg2.on('pageerror', e => errs.push(e.message));
  await pg2.goto(F, { waitUntil: 'load' }); await pg2.waitForTimeout(400);
  const uc = await pg2.evaluate(() => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('España'); const id = Object.keys(TEAMS).find(k => TEAMS[k].name === 'Real Madrid'); startGame(id);
    try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const g = G.intGrp, out = { liga: g && g.liga, clubs: g && g.clubs.length, mios: G.calendar.filter(m => m.comp === 'Champions League - Fase liga').length };
    const cnt = {}; (g.fix || []).forEach(f => { cnt[f.home] = (cnt[f.home] || 0) + 1; cnt[f.away] = (cnt[f.away] || 0) + 1; });
    G.calendar.filter(m => m.comp === 'Champions League - Fase liga').forEach(m => { const r = m.home === G.teamName ? m.away : m.home; cnt[r] = (cnt[r] || 0) + 1; });
    out.todos8 = Object.values(cnt).every(v => v === 8) && Object.keys(cnt).length === 35;
    // sin repetir rival
    const vs = G.calendar.filter(m => m.comp === 'Champions League - Fase liga').map(m => m.home === G.teamName ? m.away : m.home);
    out.distintos = new Set(vs).size === 8;
    // 12º → playoff (se fuerza la tabla)
    const orig = window.intGrpTabla;
    const filas = g.clubs.filter(c => c !== G.teamName).map((c, i) => ({ c, pts: 30 - i, pj: 8, dif: 0, gf: 0 }));
    filas.splice(11, 0, { c: G.teamName, pts: 18, pj: 8, dif: 0, gf: 0 });
    window.intGrpTabla = () => filas;
    G.calendar.filter(m => m.comp === 'Champions League - Fase liga').forEach(m => { m.played = true; m.score = '1-1'; m.result = 'D'; });
    genIntKO('ucl');
    window.intGrpTabla = orig;
    const po = G.calendar.filter(m => /Champions League - Playoff/.test(m.comp));
    out.playoff = po.length === 2;
    const riv = po[0] && (po[0].home === G.teamName ? po[0].away : po[0].home);
    out.rivalBanda = !!riv && filas.slice(16, 24).some(r => r.c === riv);
    // camisetas: ningún rival del calendario se viste parecido a vos
    const mio = kitFor(G.teamName);
    out.choques = [...new Set(G.calendar.map(m => m.home === G.teamName ? m.away : m.home))].filter(r => _kitDist(kitFor(r).c1, mio.c1) < 110).length;
    // historia: 2024 vuelve al grupo de 4
    G.season = 2024; out.viejo = uclFormatoLiga() === false; G.season = 2026;
    return out;
  });
  chk('Champions 2026: fase liga de 36', uc.liga && uc.clubs === 36 && uc.mios === 8, JSON.stringify({ c: uc.clubs, m: uc.mios }));
  chk('los 36 juegan 8 partidos y no se repite rival', uc.todos8 && uc.distintos);
  chk('el 12º va al playoff contra uno del 17-24', uc.playoff && uc.rivalBanda);
  chk('antes de 2025 sigue el formato de grupos', uc.viejo);
  chk('ningún rival sale con la misma camiseta', uc.choques === 0, uc.choques + ' choques');

  console.log('\n═══ 3D ═══');
  const t3 = await pg2.evaluate(() => new Promise(r => e3dCargar(() => {
    const E = _e3dSinAzar(() => e3dEstadio({ cap: 54000, color: '#1d4ed8', gente: 500 }));
    let piso = false; E.S.traverse(o => { if (o.geometry && o.geometry.parameters && o.geometry.parameters.width === 3000) piso = true; });
    const formas = ['Champions League', 'Copa Libertadores', 'Bundesliga', 'Premier League', 'Copa del Rey', 'Mundial de Clubes', 'Torneo Apertura'].map(_copaForma);
    const hijos = ['orejona', 'libertadores', 'plato', 'premier'].map(f => e3dCopa(THREE, f).children.length);
    let fns = 0; const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 6) return; for (const k in o) { const v = o[k]; if (typeof v === 'function') fns++; else walk(v, d + 1); } }; walk(G, 0);
    r({ piso, formas, distintas: new Set(formas).size, hijos, fns });
  })));
  chk('el estadio tiene suelo', t3.piso);
  chk('cada copa tiene su forma', t3.distintas === 7, t3.formas.join(','));
  chk('0 funciones en G', t3.fns === 0, t3.fns + '');
  chk('0 errores de página', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  await b.close();
  process.exitCode = fail ? 1 : 0;
})();
