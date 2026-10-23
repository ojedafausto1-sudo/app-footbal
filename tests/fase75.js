// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 75: plantel de 50, el DT con cinco atributos que se
// mueven (y renuncia), y la media del jugador que la mueve la cancha
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase75.js
//
// Qué blinda:
//  1. PLANTEL_MAX es 50.
//  2. Los atributos de fábrica promedian el `rat` de siempre, son
//     deterministas y el rasgo los inclina (el Formador es mejor con los pibes).
//  3. Cada atributo mueve lo suyo, y la Preparación física no puede crear
//     cansancio donde no lo hay (arriba del 70% sigue en cero).
//  4. Sacar menos de lo esperado baja al DT; sacar más, lo sube.
//  5. Una racha muy mala abre un dilema que FRENA el club y sobrevive al
//     guardado; ratificarlo lo deja, y si sigue mal se va solo. Aceptar la
//     renuncia deja un interino y el pool recuerda lo que aprendió.
//  6. Contratar un DT copia sus atributos (no comparte la referencia).
//  7. El veterano que juega bien no baja por la edad: sube; el que juega mal
//     baja. Un año entero de entrenamiento a los 34 no le toca la media,
//     sólo las piernas (VEL/FIS).
//  8. Un save sin nada de esto carga. 0 funciones en G, 0 errores.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d !== undefined ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d !== undefined ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {} updateUI(); });

  console.log('\n═══ PLANTEL ═══');
  chk('PLANTEL_MAX es 50', await pg.evaluate(() => PLANTEL_MAX === 50));

  console.log('\n═══ ATRIBUTOS DEL DT ═══');
  const at = await pg.evaluate(() => {
    let peor = 0, n = 0;
    DTS.forEach(d => { const a = dtAttrs(d); const m = DT_ATTRS.reduce((t, x) => t + a[x.k], 0) / 5;
      if (d.rat < 95) { peor = Math.max(peor, Math.abs(m - d.rat)); n++; } });
    const u = DTS.find(d => d.trait === 'Formador'), A = dtAttrs(u);
    const det = JSON.stringify(dtAttrs(Object.assign({}, u))) === JSON.stringify(dtAttrs(Object.assign({}, u)));
    return { peor, n, jov: A.jov, tac: A.tac, det, enMS: /dtFuerza\(G\.dt\)/.test(String(matchStrengths)) };
  });
  chk('de fábrica promedian el rat de siempre', at.peor <= 0.6, `peor desvío ${at.peor.toFixed(2)} en ${at.n} DTs`);
  chk('son deterministas', at.det);
  chk('el Formador es mejor con los pibes que con la pizarra', at.jov > at.tac, `jov ${at.jov} · tac ${at.tac}`);
  chk('la fuerza del once usa dtFuerza', at.enMS);

  const fx = await pg.evaluate(() => {
    const mk = v => ({ name: 'X', rat: 70, attrs: { tac: v, lec: v, mot: v, fis: v, jov: v } });
    const hi = mk(90), lo = mk(50);
    // defCansada con la defensa entera y el peor preparador físico
    const dt0 = G.dt; G.dt = lo;
    G.squad.forEach(p => p.fit = 100);
    const m = G.calendar.find(x => !x.played) || G.calendar[0];
    const S = matchStrengths(m);
    G.dt = dt0;
    return {
      fis: [dtFisMult(hi), dtFisMult(lo)], lecP: dtLecturaMult(0, 1, hi).my, lecPlo: dtLecturaMult(0, 1, lo).my,
      lecG: dtLecturaMult(2, 0, hi).op, jov: [dtJovMult(hi), dtJovMult(lo)], mot: [dtMotDelta(hi), dtMotDelta(lo)],
      tac: [dtTacMult(hi), dtTacMult(lo)], defC: S.defCansada,
    };
  });
  chk('preparación física: el bueno acorta el desgaste, el malo lo estira', fx.fis[0] < 1 && fx.fis[1] > 1, fx.fis.map(x => x.toFixed(2)).join(' / '));
  chk('…pero con la defensa entera el cansancio sigue en cero', fx.defC === 0, fx.defC);
  chk('lectura: perdiendo al entretiempo el bueno reacciona y el malo no', fx.lecP > 1 && fx.lecPlo < 1, fx.lecP.toFixed(3) + ' / ' + fx.lecPlo.toFixed(3));
  chk('lectura: ganando, el bueno cierra el partido', fx.lecG < 1, fx.lecG.toFixed(3));
  chk('juveniles, motivación y táctica en la dirección correcta',
    fx.jov[0] > 1 && fx.jov[1] < 1 && fx.mot[0] > 0 && fx.mot[1] < 0 && fx.tac[0] > 1 && fx.tac[1] < 1);

  console.log('\n═══ VALORACIÓN DINÁMICA DEL DT ═══');
  const ev = await pg.evaluate(() => {
    const m = { comp: 'Liga', week: 5 };
    const fav = { myS: 0.95, oppS: 0.55, avgR: 80, oppRat: 68, homeBonus: 0.05, diffMod: 0, tacMod: 0 };
    const und = { myS: 0.55, oppS: 0.85, avgR: 66, oppRat: 78, homeBonus: 0, diffMod: 0, tacMod: 0 };
    const dt0 = G.dt;
    G.dt = Object.assign({}, dt0, { attrs: null, _eval: 0, _ult: [], _xpUlt: [] }); delete G.dt.attrs;
    const r0 = G.dt.rat; G._S = fav; for (let i = 0; i < 10; i++) dtEvaluarPartido(m, 0, 1);
    const rBaja = G.dt.rat;
    G.dt = Object.assign({}, dt0, { _eval: 0, _ult: [], _xpUlt: [] }); delete G.dt.attrs;
    G._S = und; for (let i = 0; i < 10; i++) dtEvaluarPartido(m, 2, 0);
    const rSube = G.dt.rat;
    const xpFav = (() => { const x = xgDeS(fav); return puntosEsperados(x.my, x.op); })();
    G.dt = dt0;
    return { r0, rBaja, rSube, xpFav };
  });
  chk('perder siendo favorito baja la valoración', ev.rBaja < ev.r0, `${ev.r0} → ${ev.rBaja} (esperaba ${ev.xpFav.toFixed(2)} pts por partido)`);
  chk('ganar siendo el débil la sube', ev.rSube > ev.r0, `${ev.r0} → ${ev.rSube}`);

  console.log('\n═══ RENUNCIA POR MALOS RESULTADOS ═══');
  const rn = await pg.evaluate(() => {
    const fuerza = () => { G.dt._ult = [0, 0, 1, 0, 0, 1, 0, 0]; G.dt._xpUlt = Array(8).fill(1.6); G._dilemaAbierto = null;
      const o = Math.random; Math.random = () => 0.1; weeklyDtRachaRenuncia(); Math.random = o; };
    const nom = G.dt.name;
    fuerza();
    const d1 = dilemaBloqueante();
    const frena = dilemaFrena();
    saveGame(); G = null; loadGame();
    const d2 = dilemaBloqueante();
    const rel0 = G.dtRel === undefined ? 65 : G.dtRel;
    dilemaResolver(d2.id, 1);                               // ratificarlo
    const sigue = G.dt.name === nom && G.dt._ratificado === G.season;
    const relUp = (G.dtRel || 0) > rel0;
    fuerza();                                               // la racha sigue
    const seFue = G.dt.name !== nom && !dilemaBloqueante();
    // aceptar: otra vez con un DT nuevo del pool
    ensureDtPool();
    const cand = G.dtPool.find(x => !x.club && x.name !== nom && !/Interino/.test(x.name));
    G._dtQuit = false;
    G.dt = Object.assign({}, cand); G.dt.attrs = Object.assign({}, dtAttrs(cand)); G.dt.attrs.tac = 40; dtRecalc(G.dt);
    fuerza();
    const d3 = dilemaBloqueante();
    dilemaResolver(d3.id, 0);
    const pool = G.dtPool.find(x => x.name === cand.name);
    const recuerda = pool && pool.attrs && pool.attrs.tac === 40;
    const interino = /Interino/.test(G.dt.name);
    // contratar copia los atributos
    _dtNeg = { name: cand.name, offer: cand.salary || 50, years: 2, clause: 1, objs: [] };
    let copia = null;
    try { const o = Math.random; Math.random = () => 0; confirmDtNeg(0); Math.random = o; copia = G.dt.attrs && G.dt.attrs !== pool.attrs && G.dt.attrs.tac === 40; } catch (e) { copia = 'ERR ' + e.message; }
    return { d1: !!d1, frena, d2: !!d2, sigue, relUp, seFue, d3: !!d3, interino, recuerda, copia };
  });
  chk('la racha mala abre un dilema que frena el club', rn.d1 && rn.frena);
  chk('el dilema sobrevive al guardado', rn.d2);
  chk('ratificarlo: sigue y la relación sube', rn.sigue && rn.relUp);
  chk('si la racha sigue, la segunda vez se va sin preguntar', rn.seFue);
  chk('aceptar la renuncia deja un interino', rn.d3 && rn.interino);
  chk('el pool recuerda lo que aprendió', rn.recuerda);
  chk('contratar copia los atributos (no la referencia)', rn.copia === true, rn.copia);

  console.log('\n═══ MEDIA DEL JUGADOR ═══');
  await pg.evaluate(() => { localStorage.clear(); startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {} });
  const pl = await pg.evaluate(() => {
    const xi = Object.values(G.slots).filter(Boolean).map(id => G.squad.find(p => p.id === id)).filter(p => p && p.pos !== 'ARQ');
    const bueno = xi[0], malo = xi[1];
    bueno.age = 34; bueno.pot = bueno.rat + 10; malo.age = 31;
    const r0b = bueno.rat, r0m = malo.rat;
    const orig = window.calcNotas;
    window.calcNotas = (x) => { const o = {}; x.forEach(p => o[p.id] = p === bueno ? 9.0 : p === malo ? 3.5 : 6.5); return o; };
    // Fase 76: la regla son ventanas de 8 partidos (más de 8,5 → +3, menos de 4
    // → −3), así que se juega hasta que los dos tengan 9 partidos de verdad.
    let jug = 0; const a0b = bueno.apps || 0, a0m = malo.apps || 0;
    for (let i = 0; i < 900 && ((bueno.apps || 0) - a0b < 9 || (malo.apps || 0) - a0m < 9); i++) {
      let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 1);
      while (typeof prensaPend === 'function' && prensaPend()) prensaResolver(0);
      // que sigan en el once: el DT podría sacarlos
      const sl = Object.keys(G.slots);
      const enXI = id => Object.values(G.slots).includes(id);
      [bueno, malo].forEach((p, k) => { p.injured = false; p.susp = 0; if (!enXI(p.id)) G.slots[sl[1 + k]] = p.id; });
      const pend = G.calendar.find(m => !m.played && m.week <= G.week);
      if (pend && G.day >= 7) { const n = G.calendar.filter(m => m.played).length; simMatch(true); try { closeMod(); } catch (e) {} if (G.calendar.filter(m => m.played).length > n) jug++; }
      else advanceDay();
    }
    window.calcNotas = orig;
    const bFin = bueno.rat, mFin = malo.rat;   // ANTES del año de entrenamiento: entrena a todos
    // un año de entrenamiento a los 34, jugando: la media no se toca
    const v = G.squad.find(p => p !== bueno && p !== malo && p.pos !== 'ARQ');
    ensureAttrs(v); v.age = 34; v.apps = 40; v.form = 1; v.decl = 0; v._piernas = 0;
    const vr0 = v.rat, vel0 = v.attrs.VEL;
    G.slots[Object.keys(G.slots)[3]] = v.id;
    for (let w = 0; w < 49; w++) weeklyTraining();
    return { jug, mApps: malo.apps, mNota: malo.notaProm,  b: [r0b, bFin], m: [r0m, mFin], prom: bueno.notaProm, v: [vr0, v.rat], vel: [vel0, v.attrs.VEL] };
  });
  chk('el veterano de 34 que juega bien sube (+3 en 8 partidos)', pl.b[1] >= pl.b[0] + 3, `${pl.b[0]} → ${pl.b[1]} en ${pl.jug} partidos (promedio ${pl.prom})`);
  chk('el que juega mal baja (−3 en 8 partidos)', pl.m[1] <= pl.m[0] - 3, `${pl.m[0]} → ${pl.m[1]} (jugó ${pl.mApps}, nota ${pl.mNota})`);
  chk('un año de entrenamiento a los 34 no le baja la media', pl.v[1] >= pl.v[0], `${pl.v[0]} → ${pl.v[1]}`);
  chk('…pero las piernas sí', pl.vel[1] < pl.vel[0], `VEL ${pl.vel[0]} → ${pl.vel[1]}`);

  console.log('\n═══ SAVE VIEJO ═══');
  const sv = await pg.evaluate(() => {
    saveGame();
    const raw = JSON.parse(localStorage.getItem('dtg_v7'));
    ['attrs', '_eval', '_ult', '_xpUlt', '_rat0', '_ratificado', '_tend'].forEach(k => { if (raw.dt) delete raw.dt[k]; });
    (raw.squad || []).forEach(p => { ['notaProm', '_nAcc', '_nCnt', '_nTAcc', '_nTCnt', '_piernas'].forEach(k => delete p[k]); });
    localStorage.setItem('dtg_v7', JSON.stringify(raw));
    G = null; loadGame();
    let ok = true;
    try { dtAttrs(G.dt); rStaff(); rDtProfile(); const m = G.calendar.find(x => !x.played); if (m) { G.day = 7; G.week = Math.max(G.week, m.week); simMatch(true); try { closeMod(); } catch (e) {} } } catch (e) { ok = 'ERR ' + e.message; }
    const fns = []; (function sc(o, d) { if (!o || d > 6) return; for (const k in o) { if (typeof o[k] === 'function') fns.push(k); else if (typeof o[k] === 'object') sc(o[k], d + 1); } })(G, 0);
    const ficha = (document.getElementById('curDT') || {}).innerText || '';
    return { ok, fns: fns.length, ficha: /Atributos del técnico/i.test(ficha) && /Táctica/.test(ficha) };
  });
  chk('un save sin los campos nuevos carga y juega', sv.ok === true, sv.ok);
  chk('la ficha del DT muestra los atributos', sv.ficha);
  chk('0 funciones en G', sv.fns === 0, sv.fns);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
