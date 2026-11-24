// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 99: el celular con "versión para compu" y el árbitro del 11v11
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase99.js
const path = require('path');
const { chromium, devices } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };
const arrancar = (pg) => pg.evaluate(() => {
  document.getElementById('teamSelect').style.display = 'none'; startGame('boca');
  try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const nuevo = async (cf) => { const ctx = await b.newContext(cf); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); } catch (e) { } });
    await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400); return { ctx, pg }; };

  // ── 1 · el caso del presidente: teléfono con la "versión para computadoras" (la página a 980px) ──
  const DESK = { viewport: { width: 980, height: 2177 }, deviceScaleFactor: 900 / 980, hasTouch: true, screen: { width: 412, height: 915 } };
  {
    const { ctx, pg } = await nuevo(DESK);
    const r0 = await pg.evaluate(() => ({ z: window._celZ, zoom: document.documentElement.style.zoom, vw: getComputedStyle(document.documentElement).getPropertyValue('--vw') }));
    chk('detecta el teléfono con la página a 980px y le pone zoom', r0.z > 2.2 && r0.z < 2.5 && +r0.zoom > 2.2, 'zoom ' + (+r0.zoom).toFixed(2));
    chk('las unidades vw/vh del juego pasan a la variable', /px/.test(r0.vw), r0.vw);
    await arrancar(pg); await pg.waitForTimeout(400);
    const r1 = await pg.evaluate(() => { gTab('sq'); const n = document.getElementById('fnav').getBoundingClientRect(), ph = document.getElementById('phoneBtn').getBoundingClientRect();
      const plc = document.querySelector('.plc'); const pr = plc && plc.getBoundingClientRect();
      return { navAbajo: n.bottom >= innerHeight - 2 && n.top > innerHeight * 0.85, telEnBarra: ph.top >= n.top - 2 && ph.bottom <= n.bottom + 2, sw: document.documentElement.scrollWidth, iw: innerWidth, plcW: pr ? pr.width : 0 }; });
    chk('la barra de secciones va abajo, como en el celular', r1.navAbajo);
    chk('el botón del celular va dentro de la barra (no tapa el contenido)', r1.telEnBarra);
    chk('nada se sale por la derecha', r1.sw <= r1.iw + 1, r1.sw + ' / ' + r1.iw);
    chk('las tarjetas del plantel ocupan el ancho del teléfono', r1.plcW > r1.iw * 0.85, Math.round(r1.plcW) + 'px');
    // un modal entra en la pantalla (max-height con --vh)
    const r2 = await pg.evaluate(() => { showMod('<div style="height:3000px">x</div>'); const m = document.querySelector('#modOv .modal'); const r = m.getBoundingClientRect(); const o = { h: r.height, ih: innerHeight }; closeMod(); return o; });
    chk('un modal largo entra en la pantalla y scrollea adentro', r2.h <= r2.ih + 1, Math.round(r2.h) + ' / ' + r2.ih);
    // el joystick del 11v11 aparece donde está el dedo
    await pg.evaluate(() => { G.day = 7; const nx = G.calendar.find(x => !x.played && !x.friendly); if (nx) G.week = nx.week; startFullMatch(false); });
    await pg.waitForTimeout(1200); await pg.evaluate(() => { try { fmCloseHelp(); } catch (e) { } }); await pg.waitForTimeout(200);
    const cdp = await ctx.newCDPSession(pg); const x = 216, y = 1742;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await pg.waitForTimeout(80);
    const j = await pg.evaluate(() => { const a = document.getElementById('fm-joy').getBoundingClientRect(); return [a.left + a.width / 2, a.top + a.height / 2]; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    chk('el joystick se planta debajo del dedo aunque haya zoom', Math.abs(j[0] - x) < 6 && Math.abs(j[1] - y) < 6, j.map(Math.round).join(','));
    await pg.evaluate(() => { try { fmQuit(); } catch (e) { } });
    // a mano: "compu" lo saca, "auto" lo vuelve a poner
    const r3 = await pg.evaluate(() => { setVista('pc'); const a = window._celZ; setVista('auto'); return [a, window._celZ]; });
    chk('la vista se puede forzar a mano (compu / automática)', r3[0] === 1 && r3[1] > 2, r3.map(v => (+v).toFixed(2)).join(' → '));
    await ctx.close();
  }
  // ── 2 · un teléfono normal y una compu no cambian ──
  {
    const { ctx, pg } = await nuevo({ ...devices['Pixel 7'] });
    const z = await pg.evaluate(() => [window._celZ, document.documentElement.style.zoom]);
    chk('en un teléfono normal no hay zoom', z[0] === 1 && !z[1]);
    await ctx.close();
    const c2 = await nuevo({ viewport: { width: 1280, height: 800 } });
    const r = await c2.pg.evaluate(() => { const z = window._celZ; document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { closeMod(); } catch (e) { }
      const n = document.getElementById('fnav').getBoundingClientRect(); return { z, navArriba: n.top < 200 }; });
    chk('en la compu nada cambia (sin zoom, barra arriba)', r.z === 1 && r.navArriba);
    await c2.ctx.close();
  }

  // ── 3 · el árbitro y las faltas (determinista: se arman las jugadas) ──
  const { ctx, pg } = await nuevo({ viewport: { width: 1280, height: 800 } });
  await arrancar(pg);
  const A = await pg.evaluate(() => {
    window.requestAnimationFrame = (cb) => { if (!window._a) { window._a = 1; cb(performance.now()); window._a = 0; } return 0; };
    // los amistosos no cuentan tarjetas: se dan por jugados para que arranque uno oficial
    G.calendar.forEach(x => { if (x.friendly || /Amistoso/.test(x.comp || '')) x.played = true; });
    G.day = 7; const nx = G.calendar.find(x => !x.played && !x.friendly); G.week = nx.week; startFullMatch(true);
    const f = FM; for (let i = 0; i < 200; i++) fmTick(1);
    const o = { oficial: !(f.pending.m.friendly || /Amistoso/.test(f.pending.m.comp || '')) };
    const R = fmRef();
    o.ref = !!R && !!R.name && R.rigor > 0.7 && R.rigor < 1.3 && f.asis.length === 2;
    o.refDist = Math.min(_kitDist(R.kit.c1, f.myKit.c1), _kitDist(R.kit.c1, f.oppKit.c1));
    const dGoal = (team) => ((team === 'my') === f.myAttRight ? f.leftGL : f.rightGL);
    const prep = () => { f.phase = 'play'; f.restart = null; f._ventaja = null; f._sacar = []; };
    // último hombre: atacante rival solo, lanzado, frente al arco propio
    prep();
    const gx = dGoal('my'), dir = gx > f.VW / 2 ? 1 : -1;
    const vic = f.opp.find(q => !q.isGK), off = f.my.find(q => !q.isGK);
    f.my.forEach(q => { if (!q.isGK && q !== off) { q.x = f.VW / 2 - dir * 900; } });
    vic.x = gx - dir * 520; vic.y = f.VH / 2; vic.vx = dir * 2; vic.vy = 0;
    f.ball.x = vic.x + dir * 10; f.ball.y = vic.y; off.x = vic.x - dir * 12; off.y = vic.y; off.vx = dir * 2; off.vy = 0;
    const J = fmJuzgar('my', off, vic, false, gx, 'entrada');
    o.dogso = J.dogso; o.dogsoC = J.c;
    // de atrás con barrida = temeraria; de frente = común
    prep(); off._fc = 0;
    off.vx = 2; off.vy = 0; vic.vx = 2; vic.vy = 0; f.ball.x = vic.x; f.ball.y = vic.y + 400;
    o.sevAtras = fmJuzgar('my', off, vic, false, gx, 'barrida').sev;
    off.vx = -1; vic.vx = 1;
    o.sevFrente = fmJuzgar('my', off, vic, false, gx, 'entrada').sev;
    // segunda amarilla = roja: lo saca
    prep();
    const n0 = f.opp.length, cul = f.opp.find(q => !q.isGK);
    fmTarjeta('opp', cul, 'y', 'test'); const yc1 = cul._yc;
    fmTarjeta('opp', cul, 'r2', 'segunda amarilla');
    o.doble = yc1 === 1 && f.opp.length === n0 - 1 && f.opp.indexOf(cul) < 0;
    o.statYel = f.stat.opp.yel; o.statRed = f.stat.opp.red;
    // ventaja: el que recibió la falta ataca y un compañero tiene la pelota
    prep();
    const at = f.my.find(q => !q.isGK), comp = f.my.filter(q => !q.isGK)[1], df = f.opp.find(q => !q.isGK);
    const atacaDer = f.myAttRight, gR = atacaDer ? f.rightGL : f.leftGL, d2 = atacaDer ? 1 : -1;
    at.x = gR - d2 * 900; at.y = f.VH / 2 + 300; at.vx = 0; at.vy = 0; df.x = at.x - d2 * 15; df.y = at.y; df.vx = -d2; df.vy = 0;
    comp.x = gR - d2 * 820; comp.y = f.VH / 2; f.ball.x = comp.x + 5; f.ball.y = comp.y; f.ball.vx = 0; f.ball.vy = 0;
    df._fc = 0;
    fmFoul('opp', df, at, 'entrada');
    o.ventaja = !!f._ventaja && f.phase === 'play';
    // la ventaja no prospera: la pelota pasa al rival → vuelve a la falta
    if (f._ventaja) { f._ventaja.desde -= 20; f.possSide = 'opp'; fmVentajaTick(); }
    o.vuelve = f.phase === 'restart' && f.restart && f.restart.type === 'freekick';
    // en el área: penal o siga, NUNCA un tiro libre dentro del área
    let libresEnArea = 0, penales = 0, siga = 0;
    for (let i = 0; i < 60; i++) {
      prep(); const v2 = f.opp.find(q => !q.isGK), o2 = f.my.find(q => !q.isGK);
      v2.x = gx - dir * 120; v2.y = f.VH / 2 + 60; v2.vx = 0; v2.vy = 0; o2.vx = 0; o2.vy = 0; o2._fc = 0; o2._yc = 0;
      fmFoul('my', o2, v2, 'entrada');
      if (f.phase === 'restart' && f.restart) { if (f.restart.type === 'penalty') penales++; else if (f.restart.type === 'freekick') libresEnArea++; } else siga++;
      if (f.my.indexOf(o2) < 0) break;
    }
    o.area = { libresEnArea, penales, siga };
    // lesión grave: sale y entra uno del banco en la pelota parada
    prep();
    const herido = f.my.filter(q => !q.isGK)[3], idx = f.my.indexOf(herido), subs0 = f.subsLeft, nm0 = herido.name;
    const rnd = Math.random; Math.random = () => 0.97; fmLesion('my', herido, true); Math.random = rnd;
    o.lesGrave = herido._lesion && herido._lesion.grav === 'grave';
    f.phase = 'restart'; f.restart = { type: 'throw', team: 'my', x: f.VW / 2, y: 20 }; fm99Tick(1);
    o.cambio = f.subsLeft === subs0 - 1 && f.my[idx].name !== nm0 && !f.my[idx]._lesion && !f.my[idx]._yc;
    return o;
  });
  chk('el partido de prueba es oficial', A.oficial);
  chk('hay árbitro (nombre, rigor) y dos asistentes', A.ref);
  chk('la ropa del árbitro no se confunde con ninguno de los dos equipos', A.refDist > 90, Math.round(A.refDist));
  chk('el último hombre que corta un mano a mano ve roja (o amarilla en el área)', A.dogso && (A.dogsoC === 'r' || A.dogsoC === 'y'), A.dogsoC);
  chk('una barrida de atrás es más grave que una entrada de frente', A.sevAtras >= 0.75 && A.sevFrente < 0.75, A.sevAtras.toFixed(2) + ' / ' + A.sevFrente.toFixed(2));
  chk('la segunda amarilla es roja y el jugador sale', A.doble && A.statYel === 2 && A.statRed === 1);
  chk('ventaja: si el atacado sigue con la pelota, se sigue jugando', A.ventaja);
  chk('si la ventaja no prospera, se vuelve a la falta', A.vuelve);
  chk('en el área no hay tiro libre: es penal o siga', A.area.libresEnArea === 0 && A.area.penales > 0 && A.area.siga > 0, JSON.stringify(A.area));
  chk('el lesionado grave sale y entra uno del banco (sin heredar tarjeta ni lesión)', A.lesGrave && A.cambio);

  // ── 4 · córner armado y centro a la cabeza ──
  const C = await pg.evaluate(() => {
    const f = FM, o = {};
    f.phase = 'play'; f.restart = null; f._sacar = [];
    const gR = f.myAttRight ? f.rightGL : f.leftGL;
    fmSetRestart('corner', 'my', gR, 16, 'CÓRNER');
    let t = 0; while (f.phase === 'restart' && t < 400) { fmTick(1); t++; }
    o.espera = t; const plan = (f._cornerPlan && f._cornerPlan.plan) || [];
    o.zonas = plan.length;
    // el que patea tira el centro (lo hace la IA en modo mirar; acá no: forzamos al pateador)
    let k = 0, kick = null;
    while (k < 200 && !kick) { const air0 = f.ball.air; fmTick(1); k++; if (f.ball.air > 30 && !(air0 > 30)) kick = { air: f.ball.air, v: Math.hypot(f.ball.vx, f.ball.vy), x: f.ball.x, y: f.ball.y }; }
    o.pateo = !!kick;
    if (kick) {
      const tgt = plan.map(z => z.p).filter(p => p._recvTick && Math.abs(p._recvTick - (f.ticks - 1)) < 3)[0];
      o.blanco = !!tgt;
      if (tgt) { const d = Math.hypot(tgt.x - kick.x, tgt.y - kick.y); o.llegaCabeza = kick.air - d / kick.v; }
    }
    return o;
  });
  chk('el córner arma 4 zonas en el área y espera a que lleguen', C.zonas === 4 && C.espera > 90 && C.espera <= 262, 'espera ' + C.espera + ' ticks');
  chk('el centro sale hacia uno de los que subieron', C.pateo && C.blanco);
  chk('y llega a la altura de la cabeza donde está él (no "a la nada")', C.llegaCabeza > 2 && C.llegaCabeza <= 13, (C.llegaCabeza || 0).toFixed(1));

  // ── 5 · offside: no hay fuera de juego de un lateral, saque de arco o córner ──
  const O = await pg.evaluate(() => {
    const f = FM; f.phase = 'play'; f.restart = null;
    fmSetRestart('throw', 'opp', f.VW / 2, f.VH - 10, ''); fmDoRestart();
    const flag = !!(f._sinOffside && f._sinOffside.team === 'opp');
    const src = fmTeamPass.toString();
    return { flag, usa: /_exento&&|!_exento/.test(src) && /_sinOffside=null/.test(src) };
  });
  chk('el primer pase de un lateral no puede ser offside', O.flag && O.usa);

  // ── 6 · tarjetas y lesiones de TU plantel pasan a la temporada ──
  const T = await pg.evaluate(() => {
    const f = FM; f.phase = 'play';
    const pY = f.my.find(q => !q.isGK && q._srcId && !q._yc), pL = f.my.find(q => !q.isGK && q._srcId && q !== pY);
    const sY = G.squad.find(q => q.id === pY._srcId), sL = G.squad.find(q => q.id === pL._srcId);
    const y0 = sY.yellows || 0;
    fmTarjeta('my', pY, 'y', 'test');
    f._lesiones.push({ team: 'my', id: pL._srcId, name: pL.name, grav: 'grave', min: 50, falta: true });
    fmEnd();
    try { closeMod(); } catch (e) { }
    return { y: (sY.yellows || 0) - y0, susp: sY.susp || 0, yel5: y0 === 4, les: !!sL.injured, sem: sL.injuredWeeks || 0 };
  });
  chk('la amarilla del 11v11 se anota en la temporada', T.y === 1 || (T.yel5 && T.susp > 0), JSON.stringify(T));
  chk('la lesión grave del 11v11 lo deja afuera varias semanas', T.les && T.sem >= 4, T.sem + ' semanas');

  // ── 7 · cuatro partidos mirados: tarjetas en rango real, sin congelarse ──
  const P = await pg.evaluate(() => {
    const out = [];
    for (let m = 0; m < 4; m++) {
      try { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); } catch (e) { }
      G.day = 7; const nx = G.calendar.find(x => !x.played && !x.friendly); if (!nx) break; G.week = nx.week;
      startFullMatch(true); const f = FM; let t = 0, q = 0, qmax = 0;
      while (FM === f && f.phase !== 'done' && t < 40000) { fmTick(1); t++;
        if (f.phase === 'play' && Math.hypot(f.ball.vx, f.ball.vy) < 0.05 && !f.poss) { q++; qmax = Math.max(qmax, q); } else q = 0; }
      const s = f.stat;
      out.push({ min: f.minute, yel: (s.my.yel || 0) + (s.opp.yel || 0), red: (s.my.red || 0) + (s.opp.red || 0), pass: s.my.pass + s.opp.pass, qmax });
      try { fmClean(); } catch (e) { } FM = null; nx.played = true; nx.score = '0-0';
    }
    return out;
  });
  const prom = k => P.reduce((a, x) => a + x[k], 0) / P.length;
  chk('los cuatro partidos llegan al minuto 90', P.length === 4 && P.every(x => x.min >= 90));
  chk('amarillas en rango (0,5 a 8 por partido)', prom('yel') >= 0.5 && prom('yel') <= 8, prom('yel').toFixed(1));
  chk('rojas raras (menos de 1,5 por partido)', prom('red') < 1.5, prom('red').toFixed(2));
  chk('el partido no se congela (pelota muerta sin nadie)', P.every(x => x.qmax < 200), P.map(x => x.qmax).join(' '));
  chk('se sigue jugando la pelota (pases en rango del motor)', prom('pass') > 280, Math.round(prom('pass')));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
