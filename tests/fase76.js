// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 76: la media se mueve por ventanas de notas, el 11v11
// sin teletransportes ni goles fantasma, más cosas en la mesa de
// negociación y las jugadas clave en 3D
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase76.js
//
// Qué blinda:
//  1. Las ventanas: 8 notas de más de 8,5 → +3, de menos de 4 → −3; 15 de 7+
//     → +1, de 5,5 o menos → −1; en el medio no se mueve. La edad no suma.
//  2. El arco del 11v11 es el REAL (±86 px): una pelota que entra a 120 px
//     del centro es saque de arco, no gol.
//  3. Dos partidos tick a tick: 0 goles fuera del arco real, 0 saltos de la
//     pelota en juego, faltas en rango.
//  4. Negociación: comisión del representante, primas, contraoferta, la
//     promesa de rol que se cobra y negStep3 que pasa por los términos.
//  5. Las cinco jugadas clave arrancan en 3D, el HUD proyecta con la misma
//     cámara, la jugada termina igual y el botón vuelve al 2D.
//  6. 0 funciones en G, 0 Math.random() del 3D, 0 errores.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 480, height: 820 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0');
    document.getElementById('teamSelect').style.display = 'none';
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
  });

  console.log('\n═══ VENTANAS DE NOTAS ═══');
  const nv = await pg.evaluate(() => {
    const corre = (notas) => { const p = { name: 'X', _nVent: [] }; const d = notas.map(n => notaVentana(p, n)); return { d, quedan: p._nVent.length }; };
    const r = {
      alto8: corre(Array(8).fill(9.0)), bajo8: corre(Array(8).fill(3.5)),
      bueno15: corre(Array(15).fill(7.2)), malo15: corre(Array(15).fill(5.4)),
      medio: corre(Array(20).fill(6.3)), justo85: corre(Array(8).fill(8.5)),
    };
    // notaAplicar mueve media, potencial y valor
    const p = JSON.parse(JSON.stringify(G.squad.find(q => q.rat < 85)));
    const r0 = p.rat, v0 = p.val; notaAplicar(p, 3);
    r.aplica = { r0, r1: p.rat, sube: p.val > v0, pot: p.pot >= p.rat };
    const q = { ...JSON.parse(JSON.stringify(G.squad[0])), rat: 90 }; notaAplicar(q, 3); r.tope = q.rat;
    // la edad no suma: entrenar diez semanas no sube a ningún mayor de 23
    const antes = G.squad.filter(p => p.age > 23).map(p => [p.id, p.rat]);
    for (let i = 0; i < 10; i++) try { weeklyTraining(); } catch (e) {}
    r.subieron = antes.filter(([id, rt]) => { const p = G.squad.find(x => x.id === id); return p && p.rat > rt; }).length;
    return r;
  });
  chk('8 notas de 9 → +3 en la 8ª', nv.alto8.d[7] === 3 && nv.alto8.d.slice(0, 7).every(x => x === 0) && nv.alto8.quedan === 0, JSON.stringify(nv.alto8.d));
  chk('8 notas de 3,5 → −3', nv.bajo8.d[7] === -3);
  chk('8,5 justo NO alcanza (tiene que ser más)', nv.justo85.d.every(x => x === 0));
  chk('15 notas de 7,2 → +1 en la 15ª', nv.bueno15.d[14] === 1 && nv.bueno15.d.slice(0, 14).every(x => x === 0));
  chk('15 notas de 5,4 → −1', nv.malo15.d[14] === -1);
  chk('6,3 sostenido no mueve nada', nv.medio.d.every(x => x === 0) && nv.medio.quedan === 15, nv.medio.quedan + ' en la ventana');
  chk('notaAplicar sube media, valor y potencial', nv.aplica.r1 === nv.aplica.r0 + 3 && nv.aplica.sube && nv.aplica.pot, nv.aplica.r0 + ' → ' + nv.aplica.r1);
  chk('el tope de la escala es 91', nv.tope === 91, nv.tope);
  chk('entrenar no sube a ningún mayor de 23', nv.subieron === 0, nv.subieron);

  console.log('\n═══ EL ARCO DEL 11v11 ═══');
  const arco = await pg.evaluate(() => {
    G.calendar.forEach(m => { if (m.friendly) m.played = true; });
    const m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7;
    const q = []; const rAF = window.requestAnimationFrame; window.requestAnimationFrame = cb => { q.push(cb); return 1; };
    startFullMatch(true);
    for (let i = 0; i < 5 && q.length; i++) { const c = q.shift(); try { c(performance.now()); } catch (e) {} }
    window.requestAnimationFrame = rAF;
    const f = FM, mid = f.VH / 2, res = { GM: f.GM };
    const prueba = (dy) => {
      f.phase = 'play'; f._gkHold = null; const g0 = f.myG + f.oppG;
      Object.assign(f.ball, { x: f.rightGL + 4, y: mid + dy, vx: 4, vy: 0, air: 0 }); f._lastTouch = f.myAttRight ? 'my' : 'opp';
      fmBall(1); const gol = f.myG + f.oppG > g0; f.myG = 0; f.oppG = 0; return { gol, fase: f.phase };
    };
    res.adentro = prueba(40); res.afuera = prueba(120); res.palo = prueba(85);
    try { fmClean(); } catch (e) {}
    return res;
  });
  chk('el motor usa el arco real (GM 86)', arco.GM === 86, arco.GM);
  chk('a 40 px del centro es gol', arco.adentro.gol);
  chk('a 120 px (adentro del arco viejo de ±180) NO es gol', !arco.afuera.gol, arco.afuera.fase);
  chk('a 85 px, contra el palo, entra', arco.palo.gol);

  console.log('\n═══ DOS PARTIDOS TICK A TICK ═══');
  const m11 = await pg.evaluate(() => {
    const A = { fouls: 0, goals: 0, fuera: 0, saltos: 0, min: 0, pases: 0, shots: 0, manos: 0, manosMax: 0 };
    for (let k = 0; k < 2; k++) {
      startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
      G.calendar.forEach(m => { if (m.friendly) m.played = true; });
      const m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7;
      const q = []; const rAF = window.requestAnimationFrame; window.requestAnimationFrame = cb => { q.push(cb); return 1; };
      const oF = window.fmFoul; window.fmFoul = function () { if (FM && FM.phase === 'play') A.fouls++; return oF.apply(this, arguments); };
      startFullMatch(true);
      for (let i = 0; i < 5 && q.length; i++) { const c = q.shift(); try { c(performance.now()); } catch (e) {} }
      window.requestAnimationFrame = rAF;
      for (let t = 0; t < 40000 && FM && FM.phase !== 'done'; t++) {
        const b = FM.ball, x0 = b.x, y0 = b.y, ph0 = FM.phase, sp = Math.hypot(b.vx, b.vy), g0 = FM.myG + FM.oppG, hold0 = !!FM._gkHold;
        fmTick(1); if (!FM) break;
        const d = Math.hypot(FM.ball.x - x0, FM.ball.y - y0);
        // con el arquero reteniéndola la pelota se DESLIZA a las manos (35% por
        // tick): eso no es un teletransporte, pero se mide aparte con su tope
        // +45: el rebote en un cuerpo empuja la pelota fuera del jugador (hasta ~25 px)
        if (ph0 === 'play' && FM.phase === 'play' && d > sp * 1.6 + 45) { if (hold0 && !FM._gkHold) {} /* el arquero la saca jugando: es un pase, no un salto */ else if (FM._gkHold) { A.manos++; A.manosMax = Math.max(A.manosMax, d); } else A.saltos++; }
        if (FM.myG + FM.oppG > g0 && ph0 === 'play') { A.goals++; if (Math.abs(y0 - FM.VH / 2) > 86) A.fuera++; }
      }
      A.min += FM ? FM.minute : 0;
      if (FM && FM.stat) { A.pases += FM.stat.my.pass + FM.stat.opp.pass; A.shots += FM.stat.my.shots + FM.stat.opp.shots; }
      window.fmFoul = oF; try { fmClean(); } catch (e) {}
    }
    return A;
  });
  const p90 = x => (x / Math.max(1, m11.min) * 90).toFixed(1);
  chk('los dos partidos llegan al final', m11.min >= 170, m11.min + ' min');
  chk('0 goles fuera del arco real', m11.fuera === 0, m11.goals + ' goles');
  chk('0 saltos de la pelota en juego', m11.saltos === 0, m11.saltos);
  chk('la pelota llega a las manos deslizándose, nunca de un salto largo', m11.manosMax < 70, m11.manos + ' toques · máx ' + Math.round(m11.manosMax) + ' px por tick');
  chk('faltas en rango (no se cobra todo)', p90(m11.fouls) >= 3 && p90(m11.fouls) <= 24, p90(m11.fouls) + ' por 90');
  chk('el partido se juega: hay pases y remates', p90(m11.pases) > 200 && p90(m11.shots) > 8, p90(m11.pases) + ' pases · ' + p90(m11.shots) + ' remates por 90');

  console.log('\n═══ NEGOCIACIÓN ═══');
  const ng = await pg.evaluate(() => {
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const r = {};
    const p = G.market.find(x => x.rat >= 72 && x.rat <= 80 && !esLibre(x) && x.club !== G.teamName && !jerarquiaBloquea(x));
    openPlayerTerms({ p, icon: '📋', fee: 5, feeLbl: 'test', onAccept: () => {} });
    const t = ptTerms();
    r.comisEsp = t.comisEsp; r.comis = t.comis;
    const s0 = ptScore(p, t), sBaja = ptScore(p, { ...t, comis: 0 }), sAlta = ptScore(p, { ...t, comis: 15 });
    r.comisPesa = sBaja < s0 && sAlta > s0;
    r.primaPesa = ptScore(p, { ...t, prima: 2 }) > s0;
    const malo = { ...t, wage: Math.round(t.wageExp * 0.75) };
    const w = ptContra(p, malo); r.contra = w; r.contraFirma = w && ptScore(p, { ...malo, wage: w }) >= 3.5 && w > malo.wage;
    r.monto = ptComisMonto(_PT, 10); r.prima = ptPrimaMonto(p, 1, 40);
    closeMod();
    // pacto: la comisión se cobra al entrar, las primas y el rol quedan en el jugador
    const q = JSON.parse(JSON.stringify(G.squad.find(x => x.pos === 'DC') || G.squad[1]));
    q.id = 'pacto1'; q._pacto = { comis: 0.3, primaTipo: 'gol', prima: 0.05, rol: 0 };
    const b0 = G.budget; pactoActivar(q);
    r.cobro = Math.round((b0 - G.budget) * 100) / 100; r.quedaPrima = q.prima === 0.05 && q.primaTipo === 'gol'; r.rol = q.rolProm; r.sinPacto = !q._pacto;
    // primas de un partido: dos goles suyos
    const b1 = G.budget; const tot = primasPartido([q], [{ name: q.name }, { name: q.name }], 1);
    r.primas = tot; r.primasCobradas = Math.round((b1 - G.budget) * 100) / 100;
    // la promesa de rol: titular que no juega dos meses → pide salir
    G.squad.push(q); q.injured = false; q.wantsOut = false; q.morale = 70;
    q._rolSeason = G.season; q._rolPJ0 = (G.wins || 0) + (G.draws || 0) + (G.losses || 0); q._rolApps0 = q.apps || 0;
    const w0 = G.week;
    for (const mes of [1, 2]) { G.wins = (G.wins || 0) + 4; G.week = 4 * mes; weeklyPromesas(); if (mes === 1) r.strike1 = q._rolStrikes; }
    r.pideSalir = q.wantsOut; r.moral = q.morale;
    G.squad = G.squad.filter(x => x.id !== 'pacto1'); G.wins -= 8; G.week = w0;
    const fn = negStep3.toString(); r.delega = /openPlayerTerms/.test(fn) && /negStep3Cierre/.test(fn);
    return r;
  });
  chk('el representante espera 5 o 10%', [5, 10].includes(ng.comisEsp) && ng.comis === ng.comisEsp, ng.comisEsp + '%');
  chk('pagar menos comisión enfría, más ayuda', ng.comisPesa);
  chk('las primas suman en su decisión', ng.primaPesa);
  chk('la contraoferta dice con cuánto firma seguro', ng.contraFirma, ng.contra + 'k');
  chk('la comisión es un % de la operación', ng.monto > 0, '10% = ' + ng.monto + 'M');
  chk('al entrar al plantel se cobra la comisión y queda el pacto', ng.cobro === 0.3 && ng.quedaPrima && ng.rol === 0 && ng.sinPacto, ng.cobro + 'M');
  chk('las primas se cobran por gol', ng.primas === 0.1 && ng.primasCobradas === 0.1, ng.primas + 'M');
  chk('promesa incumplida: un mes = un strike', ng.strike1 === 1);
  chk('dos incumplimientos → pide salir', ng.pideSalir && ng.moral <= 50, 'moral ' + ng.moral);
  chk('negStep3 pasa por los términos personales', ng.delega);

  console.log('\n═══ JUGADAS CLAVE EN 3D ═══');
  await pg.evaluate(() => {
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    window.esDiaDePartido = () => true; window._lmRunOrig = window.lmRun; window.lmRun = () => {};
    G.calendar.forEach(m => { if (m.friendly) m.played = true; });
    playMatch();
    window.matchWeather = 'soleado';     // la lluvia pinta un velo encima del HUD
  });
  const tipos = ['penalty', 'freekick', 'corner', 'attack', 'defense'];
  const vistas = {};
  for (const t of tipos) {
    await pg.evaluate(t => { if (SIT) { cancelAnimationFrame(SIT.raf); SIT = null; } startSituation({ type: t, side: 'my' }); }, t);
    await pg.waitForFunction(() => SIT && SIT._3d, null, { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(300);
    vistas[t] = await pg.evaluate(() => {
      const s = SIT, W = s.W, H = s.H, r = { d3: !!s._3d };
      const host = document.getElementById('lmS3'); r.host = !!host && host.style.display !== 'none';
      const ctx = document.getElementById('lmCanvas').getContext('2d');
      r.alfa = ctx.getImageData(W >> 1, H * 0.6 | 0, 1, 1).data[3];       // el 2D quedó transparente
      if (s._m3.tipo === 'p') {
        const a = s.proj(0, 1, 0.5), b3 = s._pj(0, 1, 0.5);
        r.mismo = Math.abs(a.x - b3.x) < 0.01 && Math.abs(a.y - b3.y) < 0.01;
        const pa = s.proj(-0.6, 1, 0), pb = s.proj(0.6, 1, 0);
        r.arcoAdentro = pa.x > 0 && pb.x < W && pa.y > 0 && pa.y < H;
        r.cercaAbajo = s.proj(0, s._m3.near, 0).y > s.proj(0, 1, 0).y;
      } else {
        const g = s._g2s(W / 2, s.glY, 0);
        r.mismo = true; r.arcoAdentro = g.x > W * 0.4 && g.x < W * 0.6 && g.y > 0 && g.y < H * 0.3;
        r.cercaAbajo = s._g2s(W / 2, H - 20, 0).y > g.y;
      }
      // el 3D no toca el azar de la jugada
      let n = 0; const o = Math.random; Math.random = function () { n++; return o(); };
      for (let i = 0; i < 10; i++) sit3DFrame(s, 1);
      Math.random = o; r.azar = n;
      return r;
    });
  }
  for (const t of tipos) {
    const v = vistas[t];
    chk(t + ': arranca en 3D', v.d3 && v.host);
    chk(t + ': el 2D queda de HUD (transparente)', v.alfa === 0, 'alfa ' + v.alfa);
    chk(t + ': el arco cae en pantalla y lo cercano abajo', v.arcoAdentro && v.cercaAbajo && v.mismo);
    chk(t + ': 0 Math.random() del 3D', v.azar === 0, v.azar);
  }
  const fin = await pg.evaluate(async () => {
    const r = {};
    if (SIT) { cancelAnimationFrame(SIT.raf); SIT = null; }
    startSituation({ type: 'penalty', side: 'my' });
    await new Promise(res => { const t0 = Date.now(); const w = () => (SIT && SIT._3d) || Date.now() - t0 > 8000 ? res() : setTimeout(w, 50); w(); });
    const gf0 = LM.gf, feed0 = document.getElementById('lmFeed').children.length;
    SIT._fire(0.9, 0.3, 1.1);
    await new Promise(res => { const t0 = Date.now(); const w = () => !SIT || Date.now() - t0 > 6000 ? res() : setTimeout(w, 50); w(); });
    r.termino = !SIT; r.feed = document.getElementById('lmFeed').children.length > feed0;
    // el botón vuelve al 2D: se dibuja el césped y no hay capa 3D
    startSituation({ type: 'attack', side: 'my' });
    await new Promise(res => { const t0 = Date.now(); const w = () => (SIT && SIT._3d) || Date.now() - t0 > 8000 ? res() : setTimeout(w, 50); w(); });
    sit3DToggle();
    await new Promise(res => setTimeout(res, 200));
    const s = SIT, ctx = document.getElementById('lmCanvas').getContext('2d');
    r.d3off = !s._3d; r.alfa2D = ctx.getImageData(s.W >> 1, s.H * 0.6 | 0, 1, 1).data[3];
    r.pref = localStorage.getItem('dt_sit3d');
    sit3DToggle(); r.pref2 = localStorage.getItem('dt_sit3d');
    cancelAnimationFrame(SIT.raf); SIT = null;
    const fns = []; (function scan(o, d) { if (!o || d > 6) return; for (const k in o) { if (typeof o[k] === 'function') fns.push(k); else if (typeof o[k] === 'object') scan(o[k], d + 1); } })(G, 0);
    r.fns = fns.length;
    return r;
  });
  chk('el penal en 3D termina y lo cuenta el relato', fin.termino && fin.feed);
  chk('el botón vuelve al 2D y se dibuja la cancha', fin.d3off && fin.alfa2D === 255 && fin.pref === '0', 'alfa ' + fin.alfa2D);
  chk('y se puede volver a prender', fin.pref2 === '1');
  chk('0 funciones en G', fin.fns === 0, fin.fns);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
