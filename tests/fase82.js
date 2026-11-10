// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 82: tus partidos con la misma vara que los de la IA
// ═══════════════════════════════════════════════════════════════════════
// Antes Boca sacaba 2,47 puntos por partido donde un club de la IA con el
// mismo plantel saca 1,93: mi lado se medía con el once (y la racha) y el
// rival con sus 15 mejores, la diferencia de plantel entraba dos veces y el
// bonus táctico estaba siempre en el techo.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase82.js
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
  const ARRANCA = (lg, club) => `(()=>{localStorage.clear();localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    setLigaSel('${lg}'); const id=Object.keys(TEAMS).find(k=>TEAMS[k].name==='${club}');
    startGame(id); try{autoFill();preseasonSaltear();closeMod();}catch(e){} })()`;

  console.log('\n═══ LA CUENTA ═══');
  const c = await pg.evaluate(() => {
    const o = {};
    o.defNormal = document.getElementById('diff-1').classList.contains('diff-sel') && !document.getElementById('diff-0').classList.contains('diff-sel');
    // mismo club, mismo rival, nada de gestión: tiene que dar EXACTO lo de la IA
    const ia = (pa, pb) => { const d = Math.max(-8, Math.min(8, pa - pb)) / 26; return [Math.max(0.25, 1.35 + d * 2.6), Math.max(0.25, 1.35 - d * 2.5)]; };
    const S = { myRatEq: 76, modF: 1, tacMod: TAC_CENTRO, diffMod: 0, oppRat: 70, homeBonus: 0.032 };
    const x = xgDeS(S), r = ia(78, 70);
    o.local = Math.abs(x.my - r[0]) < 1e-9 && Math.abs(x.op - r[1]) < 1e-9;
    const xv = xgDeS({ ...S, homeBonus: -0.032 }), rv = ia(72, 76);
    o.visit = Math.abs(xv.my - rv[1]) < 1e-9 && Math.abs(xv.op - rv[0]) < 1e-9;
    // el techo de ±8 como en la IA
    o.techo = xgDeS({ ...S, myRatEq: 99 }).my === xgDeS({ ...S, myRatEq: 90 }).my;
    // el planteo al tope suma poco (antes era el estado normal)
    o.tac = +(xgDeS({ ...S, myRatEq: 70, tacMod: 0.045 }).my - xgDeS({ ...S, myRatEq: 70 }).my).toFixed(3);
    // una S vieja sin myRatEq sigue dando un número
    const viejo = xgDeS({ myS: 0.78, oppS: 0.70, avgR: 78, oppRat: 70, homeBonus: 0.032 });
    o.viejo = viejo.my > 0 && viejo.op > 0;
    return o;
  });
  chk('la pantalla de inicio marca NORMAL (antes marcaba FÁCIL y jugabas en normal)', c.defNormal);
  chk('con gestión neutra, mi partido de local da EXACTO lo de la IA', c.local);
  chk('y de visitante también', c.visit);
  chk('techo de ±8 puntos, igual que la IA', c.techo);
  chk('el planteo al tope suma poco (+' + c.tac + ' goles esperados)', c.tac > 0 && c.tac < 0.05);
  chk('una medición vieja guardada sigue funcionando', c.viejo);

  console.log('\n═══ UNA TEMPORADA CONTRA LA VARA DE LA IA ═══');
  const temp = async (lg, club) => pg.evaluate(([A]) => {
    eval(A);
    let yo = 0, ia = 0, n = 0;
    const _x = window.xgDeS;
    window.xgDeS = function (S) {
      const o = _x(S);
      if (S.myRatEq !== undefined) {
        const r = G.squad.map(p => p.rat).sort((a, b) => b - a).slice(0, 15), mp = r.reduce((a, x) => a + x, 0) / r.length;
        const loc = (S.homeBonus || 0) >= 0, pa = loc ? mp + 2 : (S.oppRat || 70) + 2, pb = loc ? (S.oppRat || 70) : mp;
        const d = Math.max(-8, Math.min(8, pa - pb)) / 26, xL = Math.max(0.25, 1.35 + d * 2.6), xV = Math.max(0.25, 1.35 - d * 2.5);
        ia += loc ? puntosEsperados(xL, xV) : puntosEsperados(xV, xL); yo += puntosEsperados(o.my, o.op); n++;
      }
      return o;
    };
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0);
      (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0); } catch (e) {} });
      if (prensaPend()) prensaResolver(0); };
    let g = 0;
    while (G.calendar.some(m => !m.played) && g++ < 400) { dr(); G.day = 7; simMatch(true); closeMod(); }
    window.xgDeS = _x;
    return { yo: +(yo / n).toFixed(2), ia: +(ia / n).toFixed(2), n };
  }, [ARRANCA(lg, club)]);
  const boca = await temp('Liga ARG', 'Boca Juniors');
  chk('Boca: tus puntos esperados quedan cerca de los de la IA con el mismo plantel (±0,25)', Math.abs(boca.yo - boca.ia) <= 0.25, boca.yo + ' contra ' + boca.ia + ' en ' + boca.n + ' partidos');
  const sm = await temp('Liga ARG', 'San Martín (SJ)');
  chk('San Martín (SJ): también, del otro lado de la tabla (±0,25)', Math.abs(sm.yo - sm.ia) <= 0.25, sm.yo + ' contra ' + sm.ia);

  console.log('\n═══ LA DIFICULTAD SE CAMBIA EN LA PARTIDA ═══');
  const d = await pg.evaluate((A) => {
    eval(A); const o = {};
    gTab('pres'); try { rPresTab(); } catch (e) {}
    o.ui = !!document.getElementById('difBox');
    // contra el rival MÁS FUERTE: con uno flojo el techo de ±8 iguala fácil y
    // normal y el check dependía de quién tocaba en la primera fecha
    const _op = x => x.home === G.teamName ? x.away : x.home;
    const m = G.calendar.filter(x => !x.played && esLigaLocal(x.comp)).sort((a, b) => clubPower(_op(b)) - clubPower(_op(a)))[0];
    G.diff = 1; const n = xgDeS(matchStrengths(m));
    setDiffPartida(2); const h = xgDeS(matchStrengths(m));
    setDiffPartida(0); const f = xgDeS(matchStrengths(m));
    o.orden = f.my > n.my && n.my > h.my && f.op < n.op && n.op < h.op;
    o.g = G.diff;
    return o;
  }, ARRANCA('Liga ARG', 'Boca Juniors'));
  chk('la tarjeta de dificultad está en Presidente', d.ui);
  chk('fácil > normal > difícil, en goles a favor y en contra', d.orden && d.g === 0);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
