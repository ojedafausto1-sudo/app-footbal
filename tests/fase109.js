// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 109: el jugador que manejás tiene inercia, toca la
// pelota, le da comba al remate, y la pelota pica
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase109.js
//
// Qué blinda:
//  1. El 11v11 MIRADO no cambia: con FM109 prendido o apagado el arnés da el
//     mismo partido (todo lo nuevo es del que manejás o es dibujo).
//  2. Inercia: arranca con rampa, a fondo no da la vuelta en el lugar (frena y
//     sale), la velocidad máxima es la misma de antes.
//  3. Conducción: a fondo la toca adelante y la corre; al trote va pegada;
//     al girar la pelota rodea el cuerpo (no lo atraviesa) y no se pierde.
//  4. Soltando el joystick la pisa, y recién soltada (pase) no la vuelve a
//     pegar. Si un rival está más cerca de la pelota, la perdiste.
//  5. Comba: la pelota se curva y llega al mismo lugar adonde iba derecha.
//  6. El pique: al caer de un pelotazo pica cada vez más bajo, se graba en la
//     repetición y lo dibuja la altura de la pelota.
//  7. El 3D: la cámara se adelanta a la jugada, la pelota pegada se ve tocada,
//     y 0 Math.random al dibujar.
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  console.log('\n═══ EL 11v11 MIRADO NO CAMBIA ═══');
  try {
    const os = require('os'), fs = require('fs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f109-')), A = path.join(tmp, 'a.json');
    const arn = path.resolve(__dirname, '..', 'tools', 'arnes11.js');
    execFileSync('node', [arn, '2', '3', '--set=FM109.on=false', '--json=' + A], { encoding: 'utf8', env: process.env, timeout: 300000 });
    const out = execFileSync('node', [arn, '2', '3', '--vs=' + A], { encoding: 'utf8', env: process.env, timeout: 300000 });
    const lin = (out.split('PAREADO')[1] || '').split('\n').filter(l => /→/.test(l));
    const iguales = lin.length > 5 && lin.every(l => /\(0↑ 0↓\)/.test(l));
    chk('con FM109 prendido o apagado, el mismo partido (todas las métricas)', iguales, lin.length + ' métricas');
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (e) { chk('el arnés corre', false, String(e).slice(0, 200)); }

  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1100, height: 640 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); localStorage.setItem('dt_replay', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  // Un partido jugable, con la cancha vacía alrededor del que manejás
  const M = await pg.evaluate(() => {
    const rng = s => { let a = s >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    Math.random = rng(9);
    document.getElementById('teamSelect').style.display = 'none';
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0);
    G.calendar.forEach(x => { if (x.friendly) x.played = true; });
    const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7;
    const raf0 = window.requestAnimationFrame;
    window.requestAnimationFrame = cb => { if (!window._arm) { window._arm = 1; cb(performance.now()); window._arm = 0; } return 0; };
    try { startFullMatch(false); } finally { window.requestAnimationFrame = raf0; }
    fmCloseHelp(); const f = FM; cancelAnimationFrame(f.raf); f.raf = 0; f.phase = 'play'; window.matchWeather = 'soleado';
    const p = f.my.find(q => !q.isGK); f.ctrl = f.my.indexOf(p);
    window._T = {
      p, f,
      vaciar() { f.my.concat(f.opp).forEach(q => { if (q !== p) { q.x = 60; q.y = 60; q.vx = q.vy = 0; } }); },
      reset(bx) { this.vaciar(); p.x = f.VW / 2; p.y = f.VH / 2; p.vx = p.vy = 0; p.stam = 100; p._hd109 = null; p._toq109 = null; p._solto = -999;
        const B = f.ball; B.x = bx == null ? 9999 : bx; B.y = f.VH / 2; B.vx = B.vy = 0; B.air = 0; B.isShot = null; B._spin = 0; B._bote = null; B._hB = 0;
        f.slide = null; f.slideRec = 0; f.chargeA = f.chargeC = 0; f.xHold = 0; f._comba109 = null; Object.keys(f.keys).forEach(k => f.keys[k] = 0); f.phase = 'play'; f.restart = null; },
      paso(jx, jy, mag, ball) { f.joyVec = mag ? { x: jx, y: jy, mag } : null; fmCtrl(1); if (ball) fmBall(1); f.ticks++; },
      v() { return Math.hypot(p.vx || 0, p.vy || 0); },
    };
    return { ok: !!(f && p) };
  });
  chk('arranca un partido jugable', M.ok);

  console.log('\n═══ INERCIA ═══');
  const I = await pg.evaluate(() => {
    const T = window._T, f = T.f, p = T.p, o = {};
    o.on = FM109.on && FM109.inercia && FM109.toques;
    T.reset(); const vs = []; for (let t = 0; t < 120; t++) { T.paso(1, 0, 1, false); vs.push(T.v()); }
    const vmax = Math.max(...vs); o.vmax = vmax; o.t90 = vs.findIndex(x => x >= vmax * 0.9);
    o.tope = fmVelTope(p, 1, true);
    // la vuelta a fondo
    T.reset(); for (let t = 0; t < 80; t++) T.paso(1, 0, 1, false);
    const x0 = p.x; let tR = -1, largo = 0;
    for (let t = 0; t < 120; t++) { T.paso(-1, 0, 1, false); largo = Math.max(largo, p.x - x0); if (tR < 0 && (p.vx || 0) < -T.v() * 0.98) tR = t; }
    o.tVuelta = tR; o.deLargo = largo;
    // parado gira en el lugar
    T.reset(); T.paso(0, 1, 1, false); o.paradoGira = (p.vy || 0) > 0 && Math.abs(p.vx || 0) < 1e-6;
    // apagado: vuelve a fmMove (la vuelta es casi instantánea)
    FM109.inercia = false; T.reset(); for (let t = 0; t < 80; t++) T.paso(1, 0, 1, false);
    let tR2 = -1; for (let t = 0; t < 60; t++) { T.paso(-1, 0, 1, false); if (tR2 < 0 && (p.vx || 0) < 0) tR2 = t; }
    FM109.inercia = true; o.tVueltaViejo = tR2;
    return o;
  });
  chk('FM109 prendido', I.on);
  chk('arranca con rampa: 90% de la velocidad en 20-40 ticks', I.t90 >= 20 && I.t90 <= 40, I.t90 + ' ticks');
  chk('la velocidad máxima es la de siempre (fmVelTope)', Math.abs(I.vmax - I.tope) < 0.02, I.vmax.toFixed(3) + ' / ' + I.tope.toFixed(3));
  chk('a fondo no da la vuelta en el lugar: tarda 15+ ticks y se pasa de largo', I.tVuelta >= 15 && I.deLargo > 4, I.tVuelta + ' ticks, ' + I.deLargo.toFixed(1) + ' px');
  chk('sin inercia daba la vuelta en menos de 10', I.tVueltaViejo >= 0 && I.tVueltaViejo < 10, I.tVueltaViejo + ' ticks');
  chk('parado gira en el lugar', I.paradoGira);

  console.log('\n═══ CONDUCCIÓN ═══');
  const C = await pg.evaluate(() => {
    const T = window._T, f = T.f, p = T.p, o = {}, R = p.r + 27;
    const conducir = (mag) => { T.reset(f.VW / 2 + 22); const ds = []; let fuera = 0, toq = 0, lt = null;
      for (let t = 0; t < 240; t++) { T.paso(1, 0, mag, true); const d = Math.hypot(f.ball.x - p.x, f.ball.y - p.y); if (t > 40) ds.push(d); if (d > R) fuera++; if (t > 40 && p._toq109 !== lt) toq++; lt = p._toq109;
        if (p.x > f.VW - 300) { p.x -= 1500; f.ball.x -= 1500; } }
      ds.sort((a, b) => a - b); return { min: ds[0], max: ds[ds.length - 1], fuera, toq }; };
    o.spr = conducir(1); o.tro = conducir(0.7);
    // la vuelta con la pelota: la rodea, no la atraviesa
    T.reset(f.VW / 2 + 22); for (let t = 0; t < 80; t++) T.paso(1, 0, 1, true);
    let ang = Math.atan2(f.ball.y - p.y, f.ball.x - p.x), salto = 0, fuera = 0, dentro = 1e9;
    for (let t = 0; t < 120; t++) { T.paso(-1, 0, 1, true); const a = Math.atan2(f.ball.y - p.y, f.ball.x - p.x); let d = Math.abs(a - ang); if (d > Math.PI) d = 2 * Math.PI - d; salto = Math.max(salto, d); ang = a;
      const db = Math.hypot(f.ball.x - p.x, f.ball.y - p.y); if (db > R) fuera++; dentro = Math.min(dentro, db); }
    o.giroSalto = salto * 180 / Math.PI; o.giroFuera = fuera; o.giroDentro = dentro;
    // soltando el joystick la pisa
    T.reset(f.VW / 2 + 22); for (let t = 0; t < 60; t++) T.paso(1, 0, 1, true);
    let lejos = 0; for (let t = 0; t < 50; t++) { T.paso(0, 0, 0, true); lejos = Math.max(lejos, Math.hypot(f.ball.x - p.x, f.ball.y - p.y)); }
    o.pisa = Math.hypot(f.ball.x - p.x, f.ball.y - p.y); o.pisaMax = lejos; o.R = R;
    // recién soltada no la vuelve a pegar
    T.reset(f.VW / 2 + 22); for (let t = 0; t < 20; t++) T.paso(1, 0, 0.7, true);
    f.ball.vx = 6; f.ball.vy = 0; p._solto = f.ticks;
    for (let t = 0; t < 14; t++) T.paso(1, 0, 0.7, true);
    o.trasPase = Math.hypot(f.ball.x - p.x, f.ball.y - p.y);
    // un rival más cerca de la pelota: la perdiste
    T.reset(f.VW / 2 + 22); for (let t = 0; t < 10; t++) T.paso(1, 0, 0.7, true);
    const q = f.opp.find(z => !z.isGK); q.x = f.ball.x + 8; q.y = f.ball.y; const bx0 = f.ball.x, by0 = f.ball.y;
    fmConduceHumano(p, f.ball, 1, 0, false, 1, true);
    o.rivalCerca = f.ball.x === bx0 && f.ball.y === by0;
    return o;
  });
  chk('a fondo la toca adelante: entre 18 y 36 px, sin perderla', C.spr.min >= 18 && C.spr.max <= 36 && C.spr.fuera === 0, C.spr.min.toFixed(1) + '-' + C.spr.max.toFixed(1) + ' px');
  chk('y se ven los toques (uno cada 30-80 ticks)', C.spr.toq >= 2 && C.spr.toq <= 7, C.spr.toq + ' en 200 ticks');
  chk('al trote va pegada (sin toques largos)', C.tro.toq === 0 && C.tro.max - C.tro.min < 3 && C.tro.fuera === 0, C.tro.min.toFixed(1) + '-' + C.tro.max.toFixed(1) + ' px');
  chk('al dar la vuelta la pelota rodea el cuerpo (≤15° por tick)', C.giroSalto <= 15 && C.giroDentro > 10, C.giroSalto.toFixed(0) + '°, mín ' + C.giroDentro.toFixed(1) + ' px');
  chk('y no la pierde', C.giroFuera === 0);
  chk('soltando el joystick la pisa: queda al pie y nunca se va', C.pisa < 26 && C.pisaMax <= C.R, C.pisa.toFixed(1) + ' px (máx ' + C.pisaMax.toFixed(1) + ')');
  chk('recién soltada (pase) no la vuelve a pegar', C.trasPase > 60, C.trasPase.toFixed(0) + ' px a los 14 ticks');
  chk('si un rival está más cerca de la pelota, no se la vuelve a pegar', C.rivalCerca);

  console.log('\n═══ EL PASE SALE ENTERO ═══');
  const Q = await pg.evaluate(() => {
    const T = window._T, f = T.f, p = T.p, o = {}, dir = f.myAttRight ? 1 : -1;
    T.reset(); const b = f.ball; b.x = p.x + dir * 22; b.y = p.y;
    const r = f.my.find(q => q !== p && !q.isGK); r.x = p.x + dir * 320; r.y = p.y + 40; r.vx = r.vy = 0;
    // el que pasa se queda quieto y el resto lejos (la IA no tiene que llegar)
    f.opp.forEach(q => { q.x = q.isGK ? q.x : 80; q.y = q.isGK ? q.y : 80; });
    const ri = f.my.indexOf(r);
    fmPass(f.ctrl, false, { x: dir, y: 0.12, dado: true });
    const v0 = Math.hypot(b.vx, b.vy); let ctrlOk = 0, vMin = 99;
    for (let t = 0; t < 12; t++) { f.joyVec = { x: dir, y: 0, mag: 0.8 }; fmTick(1); if (f.ctrl === ri) ctrlOk++; vMin = Math.min(vMin, Math.hypot(b.vx, b.vy) / v0); }
    o.ctrlOk = ctrlOk; o.vMin = vMin; o.recv = ri;
    // la pelota que VIENE hacia el que manejás sí se amortigua (primer toque)
    T.reset(); f.ctrl = f.my.indexOf(p); b.x = p.x + dir * 30; b.y = p.y; b.vx = -dir * 6; b.vy = 0; b.air = 0;
    const vA = Math.hypot(b.vx, b.vy); T.paso(0, 0, 0, false); o.amortigua = Math.hypot(b.vx, b.vy) < vA * 0.9;
    return o;
  });
  chk('después de pasar manejás al receptor mientras viaja la pelota', Q.ctrlOk === 12, Q.ctrlOk + ' de 12 ticks');
  chk('y el pase no se frena (ni pegado ni amortiguado por el que pasó)', Q.vMin > 0.85, 'mínimo ' + (Q.vMin * 100).toFixed(0) + '% de la salida');
  chk('la pelota que viene hacia vos sí se amortigua (primer toque)', Q.amortigua);

  console.log('\n═══ COMBA ═══');
  const K = await pg.evaluate(() => {
    const T = window._T, f = T.f, o = {}, gx = f.myAttRight ? f.rightGL : f.leftGL, dir = f.myAttRight ? 1 : -1;
    const B = { x: gx - dir * 520, y: f.VH / 2 + 180, vx: dir * 10, vy: -3.2, air: 16 };
    const recta = fmCombaCruce(B, 0, 0, gx);
    const conSpin = fmCombaCruce(B, 0.009, 0, gx);
    o.mueve = Math.abs(conSpin.y - recta.y);
    // en el motor: remate, efecto, y adónde cruza
    T.reset(); const b = f.ball; Object.assign(b, B); b.isShot = 'my'; f._comba109 = { t: f.ticks, dx: dir, dy: 0 };
    let n = 0; const r0 = Math.random; Math.random = () => { n++; return r0(); };
    fmComba109(f, 0, 1, true);
    Math.random = r0; o.azar = n;
    o.spin = b._spin;
    const sim = fmCombaCruce(b, b._spin, 0, gx);
    o.llega = Math.abs(sim.y - recta.y);
    // curva de verdad: cuánto se separa de la recta en el medio
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy, sp = b._spin, bulge = 0; const ux = B.vx, uy = B.vy, L = Math.hypot(ux, uy);
    for (let t = 0; t < 80; t++) { const c = Math.cos(sp), s = Math.sin(sp), q = vx; vx = q * c - vy * s; vy = q * s + vy * c; sp *= FM109.combaDec; x += vx; y += vy;
      bulge = Math.max(bulge, Math.abs((-(x - B.x) * uy + (y - B.y) * ux) / L)); if ((x - gx) * dir > 0) break; }
    o.bulge = bulge;
    // cada patada nueva le borra el efecto
    fmPatea(T.p); o.borra = b._spin === 0;
    // el efecto se aplica en fmBall y se gasta
    Object.assign(b, { x: f.VW / 2, y: f.VH / 2, vx: 9, vy: 0, air: 0, isShot: 'my', _spin: 0.009 }); fmBall(1);
    o.gira = b.vy !== 0 && b._spin < 0.009;
    b.isShot = null; fmBall(1); o.sinRemate = b._spin === 0;
    return o;
  });
  chk('el efecto curva la pelota (sin compensar, cruzaba 60+ px más allá)', K.mueve > 60, K.mueve.toFixed(0) + ' px');
  chk('al darle efecto se aplica', K.spin !== 0 && K.spin !== undefined, 'spin ' + K.spin);
  chk('y llega al mismo lugar que derecha (±3 px)', K.llega <= 3, K.llega.toFixed(2) + ' px');
  chk('pero por un camino curvo (15+ px de panza)', K.bulge > 15, K.bulge.toFixed(1) + ' px');
  chk('sin azar', K.azar === 0);
  chk('fmBall gira la pelota y el efecto se gasta', K.gira);
  chk('si deja de ser remate, se va el efecto', K.sinRemate);
  chk('cada patada nueva borra el efecto', K.borra);

  console.log('\n═══ EL PIQUE ═══');
  const P = await pg.evaluate(() => {
    const T = window._T, f = T.f, b = f.ball, o = {};
    T.reset(); T.vaciar(); T.p.x = 60; T.p.y = f.VH - 60;
    Object.assign(b, { x: f.VW / 2 - 700, y: f.VH / 2, vx: 6, vy: 0, air: 60 }); b._air0 = 60; b._airV = 60;
    const hs = [];
    for (let t = 0; t < 200; t++) { fmBall(1); fm106Post(f); f.ticks++; hs.push(+fmAlturaPelota(f).toFixed(3)); if ((b.x || 0) > f.VW - 200) break; }
    const iCae = hs.findIndex((h, i) => i > 5 && h === 0 && hs[i - 1] > 0);
    const despues = hs.slice(iCae);
    // máximos locales después de caer
    const picos = []; for (let i = 1; i < despues.length - 1; i++) if (despues[i] > despues[i - 1] && despues[i] >= despues[i + 1] && despues[i] > 0.01) picos.push(despues[i]);
    o.picos = picos; o.max = Math.max(...hs);
    o.termina = despues.slice(-5).every(h => h === 0); o.boteMax = FM109.boteMax;
    // la repetición lo graba
    const n = f.my.length + f.opp.length; f._rp = null; fmRpGrabar(f); o.st = f._rp.st === n * 14 + 8;
    b._hB = 0.7; fmRpGrabar(f); b._hB = 0; f._rpSv = null; fmRpPoner(f, f._rp.tot - 1); o.rpH = b._hB; fmRpSacar(f); o.rpVuelve = b._hB === 0;
    // si la toca alguien, deja de picar
    Object.assign(b, { x: f.VW / 2, y: f.VH / 2, vx: 5, vy: 0, air: 30 }); b._air0 = 30; b._airV = 30;
    for (let t = 0; t < 31; t++) { fmBall(1); fm106Post(f); f.ticks++; }
    const q = f.opp.find(z => !z.isGK); q.x = b.x; q.y = b.y + 4; fmBall(1); fm106Post(f); o.cortaAlTocar = !b._bote && !b._hB;
    q.x = 60; q.y = 60;
    return o;
  });
  chk('al caer pica: dos o más piques, cada uno más bajo', P.picos.length >= 2 && P.picos.every((h, i) => i === 0 || h < P.picos[i - 1]), P.picos.map(h => h.toFixed(2)).join(' → ') + ' m');
  chk('el primer pique, un tercio del vuelo o menos', P.picos[0] <= P.max * 0.34 + 0.01 && P.picos[0] <= P.boteMax + 1e-6, P.picos[0] + ' de ' + P.max + ' m');
  chk('y termina quieta en el pasto', P.termina);
  chk('la repetición graba un campo más por la pelota', P.st);
  chk('y devuelve la altura del pique', Math.abs(P.rpH - 0.7) < 1e-6 && P.rpVuelve);
  chk('si la toca alguien, deja de picar', P.cortaAlTocar);

  console.log('\n═══ EL 3D ═══');
  await pg.evaluate(() => { try { fmClean(); } catch (e) { } FM = null; document.getElementById('fm-ov')?.remove(); closeMod();
    localStorage.setItem('dt_fm3d', '1'); localStorage.setItem('dt_fm3dcam', 'cerca');
    const d = G.calendar.find(x => !x.played); G.week = d.week; G.day = 7; startFullMatch(false); });
  await pg.waitForTimeout(800); await pg.evaluate(() => fmCloseHelp());
  await pg.waitForFunction(() => typeof _FM3 !== 'undefined' && _FM3.on && _FM3.E && _FM3.J, null, { timeout: 60000 });
  await pg.waitForTimeout(1200);
  const D = await pg.evaluate(() => {
    const f = FM, b = f.ball, o = {}; cancelAnimationFrame(f.raf); f.raf = 0;
    let n = 0; const r0 = Math.random; Math.random = () => { n++; return r0(); };
    try {
      f.phase = 'play'; f.restart = null; window.matchWeather = 'soleado';
      // la cámara se adelanta hacia donde va la pelota
      Object.assign(b, { x: f.VW / 2, y: f.VH / 2, vx: 0, vy: 0, air: 0 }); _FM3.lead = { x: 0, z: 0 };
      for (let i = 0; i < 80; i++) fm3DFrame();
      const quieta = _FM3.lead.x;
      Object.assign(b, { vx: 5, vy: 0 });
      for (let i = 0; i < 80; i++) { b.vx = 5; fm3DFrame(); }
      o.adelanta = _FM3.lead.x - quieta; o.tope = Math.hypot(_FM3.lead.x, _FM3.lead.z) <= FM109.camMax + 1e-6;
      // la pelota pegada del que la lleva se ve tocada (va y viene)
      const P = f.opp.find(q => !q.isGK); f.poss = P; P.vx = 1.6; P.vy = 0;
      const pos = [];
      for (let i = 0; i < 40; i++) { P.x = f.VW / 2 + i * 1.6; P.y = f.VH / 2; Object.assign(b, { x: P.x + 22, y: P.y, vx: 1.6, vy: 0, air: 0 }); b._hB = 0;
        const [bx] = _FM3.J.sync(); const [px] = _FM3.J.toW(P); pos.push(bx - px); }
      o.vaivien = Math.max(...pos) - Math.min(...pos);
      // el toque tuyo se ve en la pierna
      const c = f.my[f.ctrl], ci = f.my.indexOf(c); c._toq109 = f.ticks - 3; c._kickT = 0;
      fm3DFrame(); const J = _FM3.J.jugs[ci]; o.pierna = Math.abs(J.pd.cad.rotation.x);
    } finally { Math.random = r0; }
    o.azar = n;
    return o;
  });
  chk('la cámara se adelanta hacia donde va la pelota', D.adelanta > 2, D.adelanta.toFixed(2) + ' m');
  chk('con tope', D.tope);
  chk('la pelota pegada del que la lleva va y viene al ritmo del paso', D.vaivien > 0.15 && D.vaivien < 0.6, D.vaivien.toFixed(2) + ' m');
  chk('el toque de la conducción mueve la pierna', D.pierna > 0.3, D.pierna.toFixed(2));
  chk('0 Math.random al dibujar', D.azar === 0, 'llamadas ' + D.azar);

  chk('sin errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
