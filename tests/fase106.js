// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 106: el movimiento interpolado, la pelota por el aire,
// el arquero que vuela y achica, el lateral con las manos, cabezazos,
// chilenas, voleas y tacos, y la línea del pase
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase106.js
//
// Qué blinda:
//  1. El observador del motor (fm106Post y compañía) NO usa azar ni cambia el
//     partido: el arnés da el mismo hash dos veces seguidas.
//  2. La interpolación dibuja entre el paso anterior y el actual y deja el
//     estado vivo intacto; un salto grande (pelota parada) no se interpola.
//  3. La altura de la pelota es una parábola sobre el vuelo entero y a 13
//     ticks del final está a la altura de la cabeza (lo que supone el motor).
//  4. Cada toque se clasifica: cabezazo, chilena, volea, pecho, taco, pie y
//     el lateral con las manos.
//  5. El arquero se tira hacia donde le pasa el remate, hasta su alcance; no
//     se tira a un remate que se va lejos y cancela si lo desvían antes.
//  6. El pase que se marca mientras cargás es el mismo que sale al soltar.
//  7. El arquero achica el mano a mano y se para en el ángulo.
//  8. La repetición guarda los toques y la estirada, y se dibuja interpolada.
//  9. El 3D: la estirada rueda el cuerpo, la pelota del lateral va en las
//     manos, hay estela y línea del pase, y 0 Math.random al dibujar.
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

const ARRANCAR = (watch) => {
  document.getElementById('teamSelect').style.display = 'none';
  if (!window._t106ini) { startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } window._t106ini = 1; }
  let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0);
  G.calendar.forEach(x => { if (x.friendly) x.played = true; });
  const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7;
  const raf0 = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => { if (!window._arm) { window._arm = 1; cb(performance.now()); window._arm = 0; } return 0; };
  try { startFullMatch(watch); } finally { window.requestAnimationFrame = raf0; }
  if (!watch) fmCloseHelp();
};

(async () => {
  // ── 1) el arnés: mismo partido dos veces (el observador no toca el azar) ──
  console.log('\n═══ EL OBSERVADOR NO CAMBIA EL PARTIDO ═══');
  try {
    const out = execFileSync('node', [path.resolve(__dirname, '..', 'tools', 'arnes11.js'), '3', '7', '--det'], { encoding: 'utf8', env: process.env, timeout: 300000 });
    chk('el arnés es determinista con todo lo nuevo puesto', /ES DETERMINISTA\? SÍ/.test(out), (out.match(/ES DETERMINISTA\?[^\n]*/) || [''])[0].slice(0, 70));
    const c = out.match(/contadores del motor[^\n]*/); const X = c ? JSON.parse(c[0].replace(/^[^{]*/, '')) : {};
    chk('el motor clasifica toques (pie, cabezazo, lateral)', (X.t_pie || 0) > 50 && (X.t_cabeza || 0) > 0 && (X.t_lateral || 0) > 0, JSON.stringify({ pie: X.t_pie, cabeza: X.t_cabeza, lateral: X.t_lateral, taco: X.t_taco, achica: X.achica }));
    chk('tacos raros (no cada pase para atrás)', (X.t_taco || 0) < 5, 't_taco ' + (X.t_taco || 0));
  } catch (e) { chk('el arnés corre', false, String(e).slice(0, 200)); }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 640 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); localStorage.setItem('dt_sit3d', '0'); localStorage.setItem('dt_replay', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ INTERPOLACIÓN ═══');
  const I = await pg.evaluate((src) => {
    eval(src)(true);
    const f = FM; cancelAnimationFrame(f.raf); f.raf = 0;
    for (let i = 0; i < 200; i++) fmTick(1);
    const o = {};
    // sin azar
    let n = 0; const r0 = Math.random; Math.random = () => { n++; return r0(); };
    fmInterpGuardar(f);
    Math.random = r0;
    const p = f.my[5], x0 = p.x, y0 = p.y; p.x += 10; p.y -= 6;
    const q = f.my[6]; const qx = q.x; q.x += 200;                 // un salto: no se interpola
    const bx = f.ball.x; f.ball.x += 8;
    Math.random = () => { n++; return r0(); };
    const ip = fmInterpPoner(f, 0.5);
    o.medio = Math.abs(p.x - (x0 + 5)) < 1e-6 && Math.abs(p.y - (y0 - 3)) < 1e-6;
    o.salto = q.x === qx + 200;
    o.pelota = Math.abs(f.ball.x - (bx + 4)) < 1e-6;
    fmInterpSacar(f);
    Math.random = r0;
    o.ip = ip; o.vuelve = p.x === x0 + 10 && p.y === y0 - 6 && f.ball.x === bx + 8;
    o.azar = n;
    // en la repetición no se interpola encima
    f._rpOn = { ini: 0, fin: 1, c: 0 }; o.noEnRp = fmInterpPoner(f, 0.5) === false; f._rpOn = null;
    return o;
  }, ARRANCAR.toString());
  chk('a mitad de camino entre el paso anterior y el actual', I.ip && I.medio && I.pelota);
  chk('un salto grande (pelota parada) no se interpola', I.salto);
  chk('después de dibujar el estado vivo queda intacto', I.vuelve);
  chk('sin Math.random', I.azar === 0, 'llamadas ' + I.azar);
  chk('durante la repetición no se interpola encima', I.noEnRp);

  console.log('\n═══ LA PELOTA POR EL AIRE ═══');
  const H = await pg.evaluate(() => {
    const o = {};
    o.cabeza = [30, 60, 200].map(T => +fmAlturaM(13, T).toFixed(2));
    o.salida = fmAlturaM(60, 60); o.llegada = fmAlturaM(0, 60);
    o.medioLargo = +fmAlturaM(100, 200).toFixed(2);
    // monótona hasta el medio y simétrica
    o.sim = Math.abs(fmAlturaM(150, 200) - fmAlturaM(50, 200)) < 1e-9;
    o.viejo = +(Math.sin(Math.min(1, 100 / 60) * Math.PI) * 5).toFixed(2);
    return o;
  });
  chk('a 13 ticks del final está a la altura de la cabeza (2,2 m)', H.cabeza.every(h => Math.abs(h - 2.2) < 0.05), H.cabeza.join(' / '));
  chk('sale del pie y vuelve al pasto', H.salida === 0 && H.llegada === 0);
  chk('un pelotazo largo va alto por el medio (antes rodaba)', H.medioLargo > 5 && H.viejo === 0, H.medioLargo + ' m (antes ' + H.viejo + ')');
  chk('la parábola es simétrica', H.sim);

  console.log('\n═══ CADA TOQUE, CLASIFICADO ═══');
  const C = await pg.evaluate(() => {
    const f = FM, b = f.ball, o = {};
    f.phase = 'play'; f.restart = null;
    const at = f.myAttRight ? 1 : -1;
    const toque = (p, ini, after, aereo) => {   // ini: pelota antes; after: cómo sale
      Object.assign(b, ini); f._bAirIni = b.air || 0; b._air0 = ini._air0 || 0;
      Object.assign(b, after); p._toqK = 0;
      if (aereo) fmToqueAereo(p); else fmPatea(p);
      const n0 = f._kq && f._kq.length; fm106Post(f);
      return TOQ106_NOM[p._toqK] || '';
    };
    const p = f.my[7];
    // cabezazo: viene a 2 m
    p.vx = 0.5 * at; p.vy = 0;
    o.cabeza = toque(p, { air: 13, _air0: 60 }, { vx: 5 * at, vy: 0, air: 0, isShot: 'my' }, false);
    // chilena: viene a la altura de la cintura, él va para atrás y la pelota sale al arco
    p.vx = -1.4 * at; p.vy = 0;
    o.chilena = toque(p, { air: 5, _air0: 60 }, { vx: 7 * at, vy: 0, air: 0, isShot: 'my' }, false);
    // volea: misma altura, de frente
    p.vx = 1.2 * at;
    o.volea = toque(p, { air: 5, _air0: 60 }, { vx: 7 * at, vy: 0, air: 0, isShot: 'my' }, false);
    // pecho: la baja sin rematar
    o.pecho = toque(p, { air: 6, _air0: 40 }, { vx: 1 * at, vy: 0, air: 0, isShot: null }, true);
    // taco: corriendo rápido para adelante, la pelota sale para atrás
    p.vx = 2.6 * at; p.vy = 0;
    o.taco = toque(p, { air: 0, _air0: 0 }, { vx: -4 * at, vy: 0.1, air: 0, isShot: null }, false);
    // si va despacio, no es taco (gira y la toca)
    p.vx = 1.2 * at;
    o.giro = toque(p, { air: 0, _air0: 0 }, { vx: -4 * at, vy: 0.1, air: 0, isShot: null }, false);
    // pie: un pase para adelante
    o.pie = toque(p, { air: 0, _air0: 0 }, { vx: 4 * at, vy: 0, air: 0, isShot: null }, false);
    // lateral: el que lo saca, con las manos
    f._lat106 = { p, t: f.ticks }; b._mano = 0;
    o.lateral = toque(p, { air: 0, _air0: 0 }, { vx: 3, vy: 3, air: 0, isShot: null }, false);
    o.mano = b._mano === f.ticks && fmAlturaPelota(f) > 2;
    // la animación dura y se termina
    o.anim = (fmAnim106(p, f) || {}).k;
    p._toqT = f.ticks - 30; o.fin = fmAnim106(p, f);
    // el lateral esperando: el más cercano del equipo, con la pelota arriba
    f.phase = 'restart'; f.restart = { type: 'throw', team: 'my', x: f.VW / 2, y: 18 };
    Object.assign(b, { x: f.VW / 2, y: 18, vx: 0, vy: 0, air: 0 }); p.x = f.VW / 2; p.y = 34;
    o.espera = (fmAnim106(p, f) || {}).k; o.otro = fmAnim106(f.my[8], f);
    f.phase = 'play'; f.restart = null;
    return o;
  });
  chk('cabezazo', C.cabeza === 'cabeza', C.cabeza);
  chk('chilena (de espaldas, la pelota a la cintura, al arco)', C.chilena === 'chilena', C.chilena);
  chk('volea', C.volea === 'volea', C.volea);
  chk('de pecho', C.pecho === 'pecho', C.pecho);
  chk('taco (corriendo, la toca para atrás)', C.taco === 'taco', C.taco);
  chk('despacio no es taco', C.giro === 'pie', C.giro);
  chk('un pase común es con el pie', C.pie === 'pie', C.pie);
  chk('el lateral se saca con las manos y sale de arriba de la cabeza', C.lateral === 'lateral' && C.mano, C.lateral);
  chk('la animación corre y se termina', C.anim === 'lateral' && C.fin === null);
  chk('esperando el lateral tiene la pelota en las manos (sólo él)', C.espera === 'latEspera' && !C.otro);

  console.log('\n═══ EL ARQUERO VUELA ═══');
  const D = await pg.evaluate(() => {
    const f = FM, b = f.ball, o = {};
    f.phase = 'play'; f.restart = null;
    const atR = f.myAttRight, gx = atR ? f.rightGL : f.leftGL, g = f.opp.find(q => q.isGK);
    const armar = (ty, from) => {
      g._dvT0 = 0; g.x = gx - (atR ? 40 : -40); g.y = f.VH / 2;
      const bx = gx - (atR ? 1 : -1) * 520, by = f.VH / 2 + (from || 160);
      const dx = gx - bx, dy = ty - by, d = Math.hypot(dx, dy);
      Object.assign(b, { x: bx, y: by, vx: dx / d * 9.6, vy: dy / d * 9.6, air: 18, isShot: 'my' });
      fmEstiradaArmar(f, 'my');
      return { t0: g._dvT0, tc: g._dvTc, dy: g._dvY - g.y };
    };
    // al palo lejano: se tira para ese lado, hasta el alcance
    const A = armar(f.VH / 2 - (f.GM || 86) * 0.92);
    o.armo = A.t0 > 0 && A.tc > 10; o.lado = A.dy < -30;
    const ref = (g.attrs && (g.attrs.REF || g.attrs.ATA || g.rat)) || 70;
    const R = ((g.r + 22) + f.GH * (0.26 + ref / 100 * 0.38)) * ((f.GM || 86) / f.GH) * FM76.alcance;
    o.alcance = Math.abs(A.dy) <= R * 1.05 + 1e-6;
    // la curva: 0 antes de arrancar, crece hasta el contacto, en el piso, se levanta
    const at = el => { g._dvT0 = f.ticks - el; return fmAnim106(g, f); };
    const tc = A.tc, D0 = Math.min(tc, 24);
    o.antes = at(tc - D0 - 2) === null;
    const es = [tc - D0 + 4, tc - 12, tc - 4, tc].map(el => (at(el) || {}).e || 0);
    o.crece = es.every((e, i) => i === 0 || e >= es[i - 1]) && es[3] === 1;
    const piso = at(tc + 16); o.piso = piso && piso.piso === 1 && piso.tipo === 'vuelo';
    o.termina = at(tc + 40) === null;
    // a un remate que se va lejos no se tira
    armar(f.VH / 2 - (f.GM || 86) * 4); o.afuera = !g._dvT0;
    // si lo desvían antes de que arranque, cancela
    armar(f.VH / 2 - (f.GM || 86) * 0.9);
    b.vx = -b.vx * 0.5; fm106Post(f); o.cancela = !g._dvT0;
    // la que viene al cuerpo: se agacha (no vuela)
    const F2 = armar(f.VH / 2 - 4, 0); g._dvT0 = f.ticks - F2.tc + 4; g._dvK106 = null;
    o.frente = (fmAnim106(g, f) || {}).tipo;
    g._dvT0 = 0;
    return o;
  });
  chk('al remate al palo lejano se tira para ese lado', D.armo && D.lado);
  chk('hasta donde le da el alcance', D.alcance);
  chk('arranca antes del contacto y se estira de a poco', D.antes && D.crece);
  chk('después queda en el piso y se levanta', D.piso && D.termina);
  chk('al que se va lejos no se tira', D.afuera);
  chk('si lo desvían antes, no se tira', D.cancela);
  chk('la que viene al cuerpo la espera agachado', D.frente === 'frente', D.frente);

  console.log('\n═══ EL PASE QUE SE MARCA ES EL QUE SALE ═══');
  const P = await pg.evaluate(() => {
    const f = FM, b = f.ball, o = {}; let iguales = 0, n = 0;
    f.phase = 'play'; f.restart = null;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], null];
    for (let c = 1; c < f.my.length; c++) {
      if (f.my[c].isGK) continue;
      for (const th of [false, true]) for (const d of dirs) {
        const p = f.my[c]; Object.assign(b, { x: p.x + 3, y: p.y, vx: 0, vy: 0, air: 0 });
        const dir = d ? { x: d[0], y: d[1], dado: true } : { x: f.myAttRight ? 1 : -1, y: 0, dado: false };
        const marca = fmPaseQuien(c, th, dir);
        f.ctrl = c; const r0 = Math.random; let s = 1; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        fmPass(c, th, dir); Math.random = r0;
        n++; if (f.ctrl === (marca >= 0 ? marca : c)) iguales++;
      }
    }
    o.iguales = iguales; o.n = n;
    // mientras cargás B se marca, y si soltás deja de marcarse
    const c = 6, p = f.my[c]; f.ctrl = c; Object.assign(b, { x: p.x + 3, y: p.y, vx: 0, vy: 0, air: 0 }); p.vx = p.vy = 0;
    f.keys = { up: 0, dn: 0, lf: 0, rt: 0, z: 0, x: 1, c: 0, f: 0, tab: 0, sprint: 0 }; f.joyVec = null; const w0 = f.watch; f.watch = false;
    fmCtrl(1); o.marca = !!fmPaseVista(f);
    f.ticks += 10; o.vence = !fmPaseVista(f); f.watch = w0; f.keys.x = 0; f.xHold = 0;
    return o;
  });
  chk('el receptor marcado es el que recibe al soltar', P.iguales === P.n, P.iguales + '/' + P.n);
  chk('mientras cargás se marca, y después se borra', P.marca && P.vence);

  console.log('\n═══ EL ARQUERO ACHICA ═══');
  const A = await pg.evaluate(() => {
    const f = FM, b = f.ball, o = {};
    f.phase = 'play'; f.restart = null;
    // el arquero MÍO contra un delantero rival solo
    const atR = f.myAttRight, own = atR ? f.leftGL : f.rightGL, s = atR ? 1 : -1, mid = f.VH / 2;
    const g = f.my.find(q => q.isGK), gi = f.my.indexOf(g), paW = (f.rightGL - f.leftGL) * 0.175;
    const c = f.opp.find(q => !q.isGK);
    const escena = (conDefensa) => {
      f.my.forEach(q => { if (!q.isGK) { q.x = own + s * 1600; q.y = mid; } });
      g.x = own + s * 20; g.y = mid; g.vx = g.vy = 0;
      c.x = own + s * paW * 1.25; c.y = mid + 150; Object.assign(b, { x: c.x + s * -6, y: c.y, vx: -s * 1.5, vy: 0, air: 0 });
      if (conDefensa) { const d = f.my.find(q => !q.isGK); d.x = own + s * paW * 0.6; d.y = mid + 150 * 0.6 / 1.25 * 1.0 * (paW * 0.6) / (paW * 0.6); }
      f.poss = c; f.possSide = 'opp';
      for (let i = 0; i < 60; i++) { f.poss = c; fmAI(g, 'my', gi, 1); }
      return { sale: Math.abs(g.x - own), y: g.y, uno: !!g._uno106 };
    };
    const S1 = escena(false);
    o.sale = S1.sale > paW * 0.25; o.uno = S1.uno;
    // sobre la línea pelota–centro del arco
    const yLinea = mid + (b.y - mid) * (S1.sale / Math.abs(b.x - own));
    o.enLinea = Math.abs(S1.y - yLinea) < 40; o.yDif = Math.round(S1.y - yLinea);
    const S2 = escena(true);
    o.conDefensa = !S2.uno && S2.sale < S1.sale;
    // en el ángulo: con la pelota abierta a 30 m no se pega al palo
    f.poss = null; Object.assign(b, { x: own + s * paW * 1.6, y: mid + 520, vx: 0, vy: 0, air: 0 });
    c.x = b.x + s * 300; g.x = own + s * 30; g.y = mid;
    for (let i = 0; i < 160; i++) fmAI(g, 'my', gi, 1);
    o.angY = Math.round(g.y - mid); o.palo = Math.round((f.GM || 86) * 1.1);
    o.angulo = g.y - mid > 0 && g.y - mid < (f.GM || 86) * 0.9;
    return o;
  });
  chk('mano a mano: sale de la línea', A.sale && A.uno);
  chk('sobre la línea pelota–centro del arco', A.enLinea, 'desvío ' + A.yDif + ' px');
  chk('con un defensor en el medio no sale', A.conDefensa);
  chk('con la pelota abierta se para en el ángulo, no pegado al palo', A.angulo, A.angY + ' px del centro (palo ' + A.palo + ')');

  console.log('\n═══ LA REPETICIÓN ═══');
  const R = await pg.evaluate(() => {
    const f = FM, o = {};
    f.phase = 'play'; f._rp = null;
    const p = f.my[7], g = f.opp.find(q => q.isGK);
    for (let i = 0; i < 40; i++) { if (i === 10) { p._toqK = TOQ106.chilena; p._toqT = f.ticks; } if (i === 12) { g._dvT0 = f.ticks; g._dvTc = 20; g._dvY = g.y - 60; g._dvH = 1.2; } p.x += 3; fmRpGrabar(f); f.ticks++; }
    // 14 por jugador + 8 de la pelota (la Fase 109 sumó el pique, b._hB)
    o.stride = f._rp.st === (f.my.length + f.opp.length) * 14 + 8;
    const vivo = { x: p.x, k: p._toqK, t: p._toqT, gt: g._dvT0 };
    fmRpPoner(f, 20.5);
    o.toq = p._toqK === TOQ106.chilena && Math.abs((f.ticks - p._toqT) - 10.5) < 1e-6;
    o.dive = Math.abs((f.ticks - g._dvT0) - 8.5) < 1e-6 && g._dvTc === 20;
    o.interp = p.x !== Math.round(p.x);       // entre dos cuadros grabados
    fmRpSacar(f);
    o.vuelve = p.x === vivo.x && p._toqK === vivo.k && p._toqT === vivo.t && g._dvT0 === vivo.gt;
    g._dvT0 = 0; p._toqK = 0;
    return o;
  });
  chk('la repetición guarda los toques y la estirada (14 por jugador)', R.stride && R.toq && R.dive);
  chk('y se dibuja entre dos cuadros grabados', R.interp);
  chk('el estado vivo vuelve intacto', R.vuelve);
  await pg.evaluate(() => { try { fmClean(); } catch (e) { } FM = null; document.getElementById('fm-ov')?.remove(); closeMod(); });

  console.log('\n═══ EL 3D ═══');
  await pg.evaluate(() => { localStorage.setItem('dt_fm3d', '1'); localStorage.setItem('dt_fm3dcam', 'tv');
    const d = G.calendar.find(x => !x.played); G.week = d.week; G.day = 7; window.matchWeather = 'soleado'; startFullMatch(false); });
  await pg.waitForTimeout(800); await pg.evaluate(() => fmCloseHelp());
  await pg.waitForFunction(() => typeof _FM3 !== 'undefined' && _FM3.on && _FM3.E && _FM3.J, null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  const T = await pg.evaluate(async () => {
    const f = FM, b = f.ball, o = {}; cancelAnimationFrame(f.raf); f.raf = 0;
    let n = 0; const r0 = Math.random; Math.random = () => { n++; return r0(); };
    try {
      f.phase = 'play'; f.restart = null;
      // la estirada: el cuerpo rueda de costado y sube
      const atR = f.myAttRight, gx = atR ? f.rightGL : f.leftGL, g = f.opp.find(q => q.isGK), gi = f.my.length + f.opp.indexOf(g);
      g.x = gx - (atR ? 40 : -40); g.y = f.VH / 2; g._dvT0 = f.ticks - 30; g._dvTc = 30; g._dvY = g.y - 60; g._dvH = 1.5; g._dvK106 = null;
      for (let i = 0; i < 6; i++) fm3DFrame();
      const J = _FM3.J.jugs[gi];
      o.roll = Math.abs(J.raiz.rotation.z); o.sube = J.raiz.position.y;
      g._dvT0 = 0;
      // el lateral: la pelota en las manos, arriba de la cabeza
      const t = f.my[7]; f.phase = 'restart'; f.restart = { type: 'throw', team: 'my', x: f.VW / 2, y: 18 };
      Object.assign(b, { x: f.VW / 2, y: 18, vx: 0, vy: 0, air: 0 }); t.x = f.VW / 2; t.y = 32;
      for (let i = 0; i < 4; i++) fm3DFrame();
      o.pelotaManos = _FM3.J.pel.position.y; f.phase = 'play'; f.restart = null;
      // la estela y la línea del pase
      Object.assign(b, { x: f.VW / 2, y: f.VH / 2, vx: 8, vy: 0, air: 0 });
      for (let i = 0; i < 12; i++) { b.x += 8; fm3DFrame(); }
      const S = _FM3.E.S; let est = 0; S.traverse(m => { if (m.isMesh && m.visible && m.material && m.material.opacity === 0.14) est++; });
      o.estela = est;
      const c = f.my[f.ctrl]; Object.assign(b, { x: c.x + 3, y: c.y, vx: 0, vy: 0, air: 0 });
      f._pv106 = { i: fmPaseQuien(f.ctrl, false, { x: f.myAttRight ? 1 : -1, y: 0, dado: false }), t: f.ticks };
      fm3DFrame(); let linea = false; S.traverse(m => { if (m.isMesh && m.visible && m.material && m.material.opacity === 0.32) linea = true; });
      o.linea = linea && f._pv106.i >= 0; f._pv106 = null;
    } finally { Math.random = r0; }
    o.azar = n;
    return o;
  });
  chk('la estirada rueda el cuerpo de costado', T.roll > 1.0, 'roll ' + T.roll.toFixed(2));
  chk('y lo levanta del piso', T.sube > 0.4, T.sube.toFixed(2) + ' m');
  chk('la pelota del lateral va arriba de la cabeza', T.pelotaManos > 2.2, T.pelotaManos.toFixed(2) + ' m');
  chk('la pelota rápida deja estela', T.estela >= 5, T.estela + ' esferas');
  chk('mientras cargás, la línea del pase', T.linea);
  chk('0 Math.random al dibujar', T.azar === 0, 'llamadas ' + T.azar);

  chk('sin errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${ok} ok · ${fail} fallan`);
  process.exit(fail ? 1 : 0);
})();
