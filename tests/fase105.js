// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 105: el pase hacia donde apuntás, el filtrado con su
// botón, la repetición del gol y la cancha 3D nueva
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase105.js
//
// Qué blinda:
//  1. Con el joystick, el pase va al compañero que apuntás (o a uno que está
//     casi en la misma línea y más cerca). Para atrás también.
//  2. Sin joystick, el pase de siempre (mismo receptor que antes).
//  3. F = filtrado al espacio, hacia adelante; sin pelota, un compañero más presiona.
//  4. La repetición: graba sin cambiar el partido, frena el reloj mientras
//     dura, deja el estado vivo intacto, se saltea con una tecla y se apaga.
//  5. La cancha 3D: texturas en sRGB, pasto de 2048 con filtrado anisotrópico,
//     redes, carteles, cielo, la gente que se mueve, 0 Math.random al dibujar,
//     el nombre arriba de la cabeza y el radar arriba en pantallas bajas.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

const ARRANCAR = (watch) => {
  // arma un partido en el acto (rAF síncrono mientras se arma)
  document.getElementById('teamSelect').style.display = 'none';
  if (!window._t105ini) { startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } window._t105ini = 1; }
  let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0);
  G.calendar.forEach(x => { if (x.friendly) x.played = true; });
  const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7;
  const raf0 = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => { if (!window._arm) { window._arm = 1; cb(performance.now()); window._arm = 0; } return 0; };
  try { startFullMatch(watch); } finally { window.requestAnimationFrame = raf0; }
  if (!watch) fmCloseHelp();
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 640 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); localStorage.setItem('dt_sit3d', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ EL PASE HACIA DONDE APUNTÁS ═══');
  const P = await pg.evaluate((src) => {
    eval(src)(false);
    const f = FM; cancelAnimationFrame(f.raf); f.phase = 'play'; f.restart = null;
    const o = {};
    // 1) apuntándole derecho a cada compañero
    let tot = 0, exacto = 0, lejos = 0;
    for (let c = 1; c < f.my.length; c++) {
      const p = f.my[c];
      for (let t = 1; t < f.my.length; t++) {
        if (t === c) continue;
        const q = f.my[t]; f.ball.x = p.x + 5; f.ball.y = p.y; f.ball.air = 0;
        const dx = q.x - f.ball.x, dy = q.y - f.ball.y, dd = Math.hypot(dx, dy); if (dd < 45) continue;
        const got = fmReceptor(c, { x: dx / dd, y: dy / dd, dado: true }); tot++;
        if (got === t) { exacto++; continue; }
        const g = f.my[got], gx = g.x - f.ball.x, gy = g.y - f.ball.y, gd = Math.hypot(gx, gy);
        const ang = Math.acos((gx * dx + gy * dy) / (gd * dd)) * 57.3;
        // otro sólo vale si está casi en la misma línea (15°) y más cerca: está en el camino
        if (!(ang <= 15 && gd < dd) && !(gd < dd * 0.5 && ang <= 28)) lejos++;
      }
    }
    o.tot = tot; o.exacto = exacto; o.lejos = lejos;
    // 2) para atrás, por fmCtrl (como un jugador de verdad)
    const atr = f.myAttRight ? -1 : 1;
    const c = f.my.findIndex(q => !q.isGK && /MC|MCD|MI|MD/.test(q.role || '')) > 0 ? f.my.findIndex(q => !q.isGK && /MC|MCD|MI|MD/.test(q.role || '')) : 5;
    const pp = f.my[c]; f.ctrl = c; pp.vx = pp.vy = 0;
    Object.assign(f.ball, { x: pp.x + 3, y: pp.y, vx: 0, vy: 0, air: 0, _quiteDe: null });
    f.keys = { up: 0, dn: 0, lf: 0, rt: 0, z: 0, x: 0, c: 0, f: 0, tab: 0, sprint: 0 };
    f.joyVec = { x: atr, y: 0, mag: 0.5 }; f.keys.x = 1; fmCtrl(1); fmCtrl(1); f.keys.x = 0; fmCtrl(1);
    const rec = f.my[f.ctrl];
    o.atras = { vx: f.ball.vx, haciaAtras: Math.sign(f.ball.vx) === atr, receptorAtras: (rec.x - pp.x) * atr > 0, cambio: f.ctrl !== c };
    // 3) sin joystick: el mismo receptor que el pase de antes (dir = null)
    let iguales = 0, pruebas = 0;
    for (let k = 1; k < f.my.length; k++) {
      const q = f.my[k]; if (q.isGK) continue;
      const fijar = () => { f.ctrl = k; Object.assign(f.ball, { x: q.x + 3, y: q.y, vx: 0, vy: 0, air: 0 }); };
      fijar(); fmPass(k, false, null); const a = f.ctrl;
      fijar(); fmPass(k, false, { x: f.myAttRight ? 1 : -1, y: 0, dado: false }); const bb = f.ctrl;
      pruebas++; if (a === bb) iguales++;
    }
    o.sinJoy = { pruebas, iguales };
    // 4) F = filtrado hacia adelante
    const c2 = f.my.findIndex(q => /MC|MCO|MCD/.test(q.role || '')); const p2 = f.my[c2 > 0 ? c2 : 6]; f.ctrl = f.my.indexOf(p2);
    Object.assign(f.ball, { x: p2.x + 3, y: p2.y, vx: 0, vy: 0, air: 0 }); p2.vx = p2.vy = 0;
    f.keys = { up: 0, dn: 0, lf: 0, rt: 0, z: 0, x: 0, c: 0, f: 0, tab: 0, sprint: 0 }; f.fWas = 0;
    f.joyVec = { x: -atr, y: 0, mag: 0.6 }; f.keys.f = 1; fmCtrl(1); f.keys.f = 0; fmCtrl(1);
    const r2 = f.my[f.ctrl];
    o.filtrado = { haciaArco: Math.sign(f.ball.vx) === -atr, rapido: Math.hypot(f.ball.vx, f.ball.vy) > 5, receptorAdelante: (r2.x - p2.x) * -atr > 0 };
    o.teclaF = FM_ACTIONS.some(a => a.id === 'f' && a.def === 'KeyV');
    o.botonF = !!document.getElementById('fm-capF');
    o.keysF = 'f' in f.keys;
    // 5) el elevado apuntando a un costado, lejos del área, es un cambio de frente
    const banda = f.my.filter(q => !q.isGK).sort((u, v) => u.y - v.y);
    const arriba = banda[0], abajo = banda[banda.length - 1];
    f.ctrl = f.my.indexOf(abajo); Object.assign(f.ball, { x: abajo.x + 3, y: abajo.y, vx: 0, vy: 0, air: 0 });
    const dy = arriba.y - abajo.y, dx = arriba.x - abajo.x, dd = Math.hypot(dx, dy);
    fmLofted(f.ctrl, 0.8, { x: dx / dd, y: dy / dd, dado: true });
    o.cambioFrente = { vy: f.ball.vy, sube: f.ball.vy < 0, aire: f.ball.air > 10 };
    // 6) doble presión: el más cercano a la pelota acelera hacia ella
    f.possSide = 'opp'; f.phase = 'play';
    const yo = f.my.findIndex(q => !q.isGK); f.ctrl = yo;
    Object.assign(f.ball, { x: f.VW / 2, y: f.VH / 2, vx: 0, vy: 0, air: 0 });
    let cerca = null, cd = 1e9; f.my.forEach((q, i) => { if (i === yo || q.isGK) return; const d = Math.hypot(q.x - f.ball.x, q.y - f.ball.y); if (d < cd) { cd = d; cerca = q; } });
    cerca.vx = 0; cerca.vy = 0; f._presion2 = f.ticks; fmDoblePresion(1);
    const hacia = (cerca.vx * (f.ball.x - cerca.x) + cerca.vy * (f.ball.y - cerca.y)) / cd;
    o.doble = { hacia: +hacia.toFixed(3), marcado: cerca._dobleP === f.ticks };
    f._presion2 = null; cerca.vx = cerca.vy = 0; fmDoblePresion(1);
    o.dobleSinF = cerca.vx === 0 && cerca.vy === 0;
    fmClean(); FM = null; document.getElementById('fm-ov')?.remove();
    return o;
  }, ARRANCAR.toString());
  chk('apuntándole a un compañero, el pase va a él (o a uno en el camino)', P.lejos === 0, `${P.exacto}/${P.tot} exactos, ${P.lejos} a otro lado`);
  chk('apuntando para atrás, el pase va para atrás', P.atras.haciaAtras && P.atras.receptorAtras && P.atras.cambio, JSON.stringify(P.atras));
  chk('sin joystick, el mismo receptor que antes', P.sinJoy.iguales === P.sinJoy.pruebas, `${P.sinJoy.iguales}/${P.sinJoy.pruebas}`);
  chk('F = filtrado al espacio, hacia el arco', P.filtrado.haciaArco && P.filtrado.rapido && P.filtrado.receptorAdelante, JSON.stringify(P.filtrado));
  chk('F tiene tecla (V), botón y lugar en las teclas', P.teclaF && P.botonF && P.keysF);
  chk('el elevado hacia un costado cambia de frente', P.cambioFrente.sube && P.cambioFrente.aire, JSON.stringify(P.cambioFrente));
  chk('F sin pelota: un compañero más va a presionar', P.doble.hacia > 0 && P.doble.marcado && P.dobleSinF, JSON.stringify(P.doble));

  console.log('\n═══ LA REPETICIÓN DEL GOL ═══');
  // grabar no cambia el partido: el mismo partido sembrado, con y sin grabación
  const D = await pg.evaluate((src) => {
    const rng = s => { let a = s >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    const oInit = window.fmInit; window.fmInit = function () { Math.random = rng(99); return oInit.apply(this, arguments); };
    const correr = (grabar) => {
      const g0 = window.fmRpGrabar; if (!grabar) window.fmRpGrabar = () => { };
      Math.random = rng(5); eval(src)(true); const f = FM; cancelAnimationFrame(f.raf);
      for (let i = 0; i < 4000 && f.phase !== 'done'; i++) fmTick(1);
      let h = 0; f.my.concat(f.opp).forEach(p => { h = (h * 31 + Math.round(p.x * 10) + Math.round(p.y * 10) * 7) % 1e9; }); h = (h + Math.round(f.ball.x * 10)) % 1e9;
      const out = { h, g: [f.myG, f.oppG], tot: f._rp ? f._rp.tot : 0 };
      window.fmRpGrabar = g0; fmClean(); FM = null; document.getElementById('fm-ov')?.remove();
      return out;
    };
    const a = correr(true), c = correr(false);
    window.fmInit = oInit;
    return { a, c };
  }, ARRANCAR.toString());
  chk('grabar la repetición no cambia el partido (mismo hash)', D.a.h === D.c.h && D.a.tot > 0, `${D.a.h} / ${D.c.h}, ${D.a.tot} ticks grabados`);

  // un gol de verdad, en tiempo real
  const golArmado = () => {
    const f = FM, dir = f.myAttRight ? 1 : -1, gx = f.myAttRight ? f.rightGL : f.leftGL;
    const gk = f.opp.find(q => q.isGK); gk.x = gx - dir * 400; gk.y = 100; gk.vx = gk.vy = 0;
    Object.assign(f.ball, { x: gx - dir * 40, y: f.VH / 2, vx: dir * 9, vy: 0, air: 0, isShot: 'my' }); f._lastTouch = 'my';
  };
  await pg.evaluate(() => { localStorage.setItem('dt_fm3d', '0'); const d = G.calendar.find(x => !x.played); G.week = d.week; G.day = 7; window.matchWeather = 'soleado'; startFullMatch(false); });
  await pg.waitForTimeout(700); await pg.evaluate(() => fmCloseHelp());
  await pg.waitForFunction(() => FM && FM.phase === 'play' && FM._rp && FM._rp.tot > 120, null, { timeout: 60000 });
  await pg.evaluate(golArmado);
  await pg.waitForFunction(() => FM && FM._rpOn, null, { timeout: 20000 });
  const r1 = await pg.evaluate(() => ({ t: FM.ticks, fase: FM.phase, vis: getComputedStyle(document.getElementById('fm-rp')).display, b: [FM.ball.x, FM.ball.y], p: FM.my.map(q => q.x + q.y).reduce((a, x) => a + x, 0), c: FM._rpOn.c, largo: FM._rpOn.fin - FM._rpOn.ini }));
  await pg.waitForTimeout(500);
  const r2 = await pg.evaluate(() => ({ t: FM.ticks, fase: FM.phase, b: [FM.ball.x, FM.ball.y], p: FM.my.map(q => q.x + q.y).reduce((a, x) => a + x, 0), c: FM._rpOn && FM._rpOn.c }));
  chk('al gol arranca la repetición, con el cartel', r1.vis === 'block' && r1.fase === 'goal_my' && r1.largo >= 60, `${r1.largo} ticks`);
  chk('mientras dura, el partido no avanza y el estado vivo queda intacto', r2.t === r1.t && r2.fase === r1.fase && r2.b[0] === r1.b[0] && r2.p === r1.p && r2.c > r1.c, `reloj ${r1.t}→${r2.t}, cuadro ${Math.round(r1.c)}→${Math.round(r2.c)}`);
  await pg.keyboard.press('KeyX');
  await pg.waitForTimeout(150);
  const r3 = await pg.evaluate(() => ({ on: !!FM._rpOn, vis: getComputedStyle(document.getElementById('fm-rp')).display }));
  chk('una tecla la saltea', !r3.on && r3.vis === 'none');
  await pg.waitForFunction(() => FM && (FM.phase === 'kickoff' || FM.phase === 'play'), null, { timeout: 20000 });
  chk('después sigue el saque del medio', true);
  // apagada: no hay repetición
  await pg.evaluate(() => { localStorage.setItem('dt_replay', '0'); window._v0 = FM._rpVistas || 0; });
  await pg.waitForFunction(() => FM && FM.phase === 'play' && FM._rp && FM._rp.tot - (FM._rpCorte || 0) > 100, null, { timeout: 60000 });
  await pg.evaluate(golArmado);
  await pg.waitForFunction(() => FM && FM.phase === 'goal_my' && FM.phaseT > 90, null, { timeout: 20000 });
  const r4 = await pg.evaluate(() => ({ on: !!FM._rpOn, v: (FM._rpVistas || 0) - window._v0 }));
  chk('con la preferencia apagada no hay repetición', !r4.on && r4.v === 0);
  const r5 = await pg.evaluate(() => { localStorage.setItem('dt_replay', '1'); const f = FM; f.watch = true; f.speed = 4; fmRpEmpezar(); const a = !!f._rpOn; f.watch = false; f.speed = 1; return a; });
  chk('mirando a más de ×1 no hay repetición', r5 === false);
  await pg.evaluate(() => { try { fmQuit(); } catch (e) { } try { fmClean(); } catch (e) { } FM = null; document.getElementById('fm-ov')?.remove(); closeMod(); });

  console.log('\n═══ LA CANCHA 3D ═══');
  await pg.evaluate(() => { localStorage.setItem('dt_fm3d', '1'); localStorage.setItem('dt_fm3dcam', 'cerca'); localStorage.setItem('dt_replay', '0');
    const d = G.calendar.find(x => !x.played); G.week = d.week; G.day = 7; window.matchWeather = 'soleado'; startFullMatch(false); });
  await pg.waitForTimeout(800); await pg.evaluate(() => fmCloseHelp());
  await pg.waitForFunction(() => typeof _FM3 !== 'undefined' && _FM3.on && _FM3.E, null, { timeout: 60000 });
  await pg.waitForTimeout(2500);
  const G3 = await pg.evaluate(async () => {
    const E = _FM3.E, S = E.S, T = THREE, o = {};
    const mallas = []; S.traverse(m => { if (m.isMesh || m.isSprite || m.isInstancedMesh) mallas.push(m); });
    const pasto = mallas.find(m => m.geometry && m.geometry.parameters && m.geometry.parameters.width === 117 && m.material.map);
    o.pasto = pasto ? { w: pasto.material.map.image.width, cs: pasto.material.map.colorSpace, an: pasto.material.map.anisotropy } : null;
    const tex = new Set(); mallas.forEach(m => [].concat(m.material || []).forEach(mt => { if (mt && mt.map && mt.map.isCanvasTexture) tex.add(mt.map); }));
    o.texturas = tex.size; o.noSrgb = [...tex].filter(t => t.colorSpace !== T.SRGBColorSpace).length;   // la sombra (sólo alfa) queda afuera
    o.redes = mallas.filter(m => m.material && m.material.map && m.material.map.wrapS === T.RepeatWrapping && m.material.transparent && m.material.side === T.DoubleSide).length;
    o.carteles = mallas.filter(m => m.material && m.material.map === E.pub).length;
    o.cielo = mallas.some(m => m.material && m.material.side === T.BackSide && m.material.vertexColors);
    o.gente = mallas.some(m => m.isInstancedMesh && typeof m.material.onBeforeCompile === 'function' && m.material.customProgramCacheKey() === 'hinchas105');
    const t0 = E.hinchas.uT.value, off0 = E.pub.offset.x;
    // 0 Math.random al dibujar
    let n = 0; const fr0 = window.fm3DFrame;
    window.fm3DFrame = function () { const r = Math.random; Math.random = function () { n++; return r(); }; try { return fr0.apply(this, arguments); } finally { Math.random = r; } };
    await new Promise(r => setTimeout(r, 2500));
    window.fm3DFrame = fr0;
    o.azar = n; o.tAvanza = E.hinchas.uT.value > t0; o.ledCorre = E.pub.offset.x !== off0;
    // el nombre arriba de la cabeza del que manejás
    const H = _FM3.hud, c = FM.my[FM.ctrl];
    o.chip = { vis: H.chip.style.display !== 'none', txt: H.chipN.textContent, nom: String(c.name).split(' ').slice(-1)[0].toUpperCase(), tr: H.chip.style.transform };
    const m = /translate\((-?\d+)px, ?(-?\d+)px\)/.exec(H.chip.style.transform || '');
    o.chipDentro = !!m && +m[1] >= 0 && +m[1] <= _FM3.R.domElement.clientWidth && +m[2] >= 0 && +m[2] <= _FM3.R.domElement.clientHeight;
    // la gente salta con el gol de la casa
    const loc = !FM.m || FM.m.home === G.teamName; FM.phase = loc ? 'goal_my' : 'goal_opp'; FM.phaseT = 0;
    await new Promise(r => setTimeout(r, 2500));
    o.salto = E.hinchas.uS.value;
    o.mmAbajo = getComputedStyle(H.mm).bottom;
    return o;
  });
  chk('el pasto: 2048 px, sRGB y filtrado anisotrópico', G3.pasto && G3.pasto.w === 2048 && G3.pasto.cs === 'srgb' && G3.pasto.an > 1, JSON.stringify(G3.pasto));
  chk('todas las texturas dibujadas van en sRGB (menos la sombra)', G3.noSrgb <= 1, `${G3.texturas} texturas, ${G3.noSrgb} sin sRGB`);
  chk('los arcos tienen red (costados, techo y fondo)', G3.redes >= 8, `${G3.redes} paños`);
  chk('carteles LED alrededor de la cancha, que corren', G3.carteles === 4 && G3.ledCorre, `${G3.carteles} tiras`);
  chk('cielo con degradé', G3.cielo);
  chk('la gente se mueve y salta con el gol de la casa', G3.gente && G3.tAvanza && G3.salto > 0.25, `salto ${G3.salto.toFixed(2)}`);
  chk('dibujar el 3D no gasta azar', G3.azar === 0, `${G3.azar} llamadas`);
  chk('el nombre del que manejás va arriba de su cabeza, adentro de la pantalla', G3.chip.vis && G3.chip.txt === G3.chip.nom && G3.chipDentro, `${G3.chip.txt} · ${G3.chip.tr}`);
  await pg.setViewportSize({ width: 844, height: 390 });
  await pg.waitForTimeout(800);
  const mm = await pg.evaluate(() => { const c = getComputedStyle(_FM3.hud.mm); return { top: c.top, right: c.right, w: c.width }; });
  chk('celular acostado: el radar va arriba a la derecha y más chico', mm.top === '10px' && mm.right === '10px' && parseFloat(mm.w) <= 130, JSON.stringify(mm));
  await pg.setViewportSize({ width: 1100, height: 640 });
  await pg.evaluate(() => { try { fmQuit(); } catch (e) { } try { fmClean(); } catch (e) { } FM = null; document.getElementById('fm-ov')?.remove(); closeMod(); });
  // el estadio del menú (visor) se arma con la cancha nueva sin errores
  const e0 = errs.length;
  await pg.evaluate(() => { try { abrirEstadio3D(); } catch (e) { window._eV = String(e); } });
  await pg.waitForTimeout(3500);
  const vis = await pg.evaluate(() => ({ err: window._eV || null, ok: !!document.querySelector('canvas') }));
  await pg.evaluate(() => { try { e3dCerrar(); } catch (e) { } });
  chk('el visor del estadio se arma con la cancha nueva', !vis.err && errs.length === e0, vis.err || '');

  chk('sin errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${ok} ✓  ·  ${fail} ✗`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
