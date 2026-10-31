// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 81: los jugadores ya no se quieren ir todos
// ═══════════════════════════════════════════════════════════════════════
// Antes: a la segunda temporada de Boca, 13 de 29 pedían irse. La relación
// con el DT bajaba igual para todo el que no era titular, nunca se
// reseteaba, la figura feliz "se plantaba" por sorteo y el pedido de salir no
// se retiraba nunca.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase81.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  const ARRANCA = (club) => `(()=>{localStorage.clear();localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    startGame('${club}'); try{autoFill();preseasonSaltear();closeMod();}catch(e){} })()`;

  console.log('\n═══ CADA UNO SABE QUÉ LE CORRESPONDE ═══');
  const r = await pg.evaluate((A) => {
    eval(A); const o = {};
    const xi = Object.values(G.slots).filter(Boolean);
    const linea = G.squad.filter(p => pgr(p.pos) === 'DEF' && !p.injured).sort((a, b) => b.rat - a.rat);
    const enXi = G.squad.filter(p => xi.includes(p.id) && pgr(p.pos) === 'DEF').length;
    o.mejor = rolEsperado(linea[0], xi);
    o.recambio = rolEsperado(linea[enXi], xi);
    o.ultimo = rolEsperado(linea[linea.length - 1], xi);
    // 40 semanas sin jugar, con el once fijo
    const sup = linea[linea.length - 1], tit = linea[0];
    sup.dtRel = 60; tit.dtRel = 60; sup.injured = 0; tit.injured = 0;
    const slots0 = JSON.parse(JSON.stringify(G.slots));
    Object.keys(G.slots).forEach(k => { if (G.slots[k] === tit.id) G.slots[k] = null; });   // al titular lo sacan
    const m0 = Math.random; Math.random = () => 0.99;    // que nadie pida salir por sorteo
    for (let i = 0; i < 40; i++) weeklyPlayerDt();
    Math.random = m0;
    o.supRel = sup.dtRel; o.titRel = tit.dtRel;
    G.slots = slots0;
    // al empezar la temporada se acerca a 60
    tit.dtRel = 10; pdRelTemporada(); o.reset = tit.dtRel;
    return o;
  }, ARRANCA('boca'));
  chk('el mejor de su línea espera ser titular; el último sabe que es suplente', r.mejor === 'titular' && r.recambio === 'recambio' && r.ultimo === 'suplente', [r.mejor, r.recambio, r.ultimo].join(' / '));
  chk('el suplente que no juega 40 semanas NO se rompe con el DT', r.supRel >= 45, 'relación ' + r.supRel);
  chk('el titular que el DT deja afuera sí se calienta', r.titRel < 30, 'relación ' + r.titRel);
  chk('la temporada nueva acerca la relación a 60 (la mitad del camino)', r.reset === 35, String(r.reset));

  console.log('\n═══ LA FIGURA FELIZ NO SE PLANTA, Y EL QUE PIDIÓ IRSE SE PUEDE ARREPENTIR ═══');
  const s = await pg.evaluate((A) => {
    eval(A); const o = {};
    const star = G.squad.slice().sort((a, b) => b.rat - a.rat)[0];
    star.rat = Math.max(star.rat, 82); star.morale = 90; star.wantsOut = false;
    G.week = 2;                                          // ventana abierta
    const m0 = Math.random; Math.random = () => 0.001;  // el sorteo más desfavorable
    for (let i = 0; i < 20; i++) { try { weeklyChats(); } catch (e) {} }
    Math.random = m0;
    o.feliz = !star.wantsOut;
    // un descontento con moral baja sí se planta
    const otro = G.squad.find(p => p !== star); otro.morale = 20; otro.wantsOut = false;
    G.squad.forEach(p => { if (p !== otro) p.morale = 90; });
    Math.random = () => 0.001; for (let i = 0; i < 5; i++) { try { weeklyChats(); } catch (e) {} } Math.random = m0;
    o.mal = !!otro.wantsOut;
    // arrepentirse: contento varias semanas seguidas
    const q = G.squad.find(p => p !== star && p !== otro && !p.injured);
    q.wantsOut = true; q.morale = 80; q.dtRel = 85; q.colgado = false;
    const xi = Object.values(G.slots).filter(Boolean);
    Math.random = () => 0.1; for (let i = 0; i < 6; i++) { q.morale = 80; weeklyPlayerDt(); } Math.random = m0;
    o.arrepentido = !q.wantsOut;
    // y si sigue mal, no
    q.wantsOut = true; q.morale = 40; q.dtRel = 30;
    Math.random = () => 0.1; for (let i = 0; i < 10; i++) { q.morale = 40; weeklyPlayerDt(); } Math.random = m0;
    o.sigueQueriendo = q.wantsOut;
    return o;
  }, ARRANCA('boca'));
  chk('una figura con moral 90 no se planta aunque el sorteo salga (antes 6% por semana)', s.feliz);
  chk('el que está mal sí se planta', s.mal);
  chk('el que pidió irse y vuelve a estar contento retira el pedido', s.arrepentido);
  chk('el que sigue mal no lo retira', s.sigueQueriendo);

  console.log('\n═══ DOS TEMPORADAS ENTERAS ═══');
  const t = await pg.evaluate((A) => {
    eval(A);
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0);
      (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0); } catch (e) {} });
      if (prensaPend()) prensaResolver(0); };
    let max = 0;
    for (let tt = 0; tt < 2; tt++) {
      let g = 0;
      while (G.calendar.some(m => !m.played) && g++ < 400) { dr(); G.day = 7; simMatch(true); closeMod();
        max = Math.max(max, G.squad.filter(p => p.wantsOut).length); }
      if (tt === 0) { try { nextSeason(); } catch (e) {} dr(); try { closeMod(); preseasonSaltear(); closeMod(); } catch (e) {} }
    }
    const fn = (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return 0; let r = 0; for (const k in x) { if (typeof x[k] === 'function') r++; else if (x[k] && typeof x[k] === 'object') r += scan(x[k], d + 1); } return r; })(G, 0);
    return { max, n: G.squad.length, season: G.season, fn };
  }, ARRANCA('boca'));
  chk('en dos temporadas de Boca, nunca más de 4 piden irse a la vez (antes 13 de 29)', t.max <= 4, t.max + ' de ' + t.n);
  chk('0 funciones en G', t.fn === 0);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
