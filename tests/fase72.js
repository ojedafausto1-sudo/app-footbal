// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 72: el partido jugable en 3D, la tienda oficial, los
// derechos de TV y la reunión de pretemporada
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase72.js
//
// Qué blinda, y por qué:
//  1. EL 3D ARRANCA SOLO en el modo jugable, con su HUD, y la preferencia
//     de apagarlo sobrevive al partido siguiente.
//  2. EL 3D NO LE TOCA EL AZAR AL MOTOR — armar el estadio y los jugadores
//     no puede consumir Math.random(): se arma DESPUÉS de fmInit y le
//     correría el hilo al partido entero.
//  3. LOS RELOJES DE DIBUJO (_kickT/_diveT) se descuentan también en 3D: los
//     bajaba drawP3, y con el 2D apagado el arquero quedaba tirado.
//  4. EL JOYSTICK — en las cámaras de platea no cambia; en 'detras' "arriba"
//     es hacia el arco rival, de los dos lados de la cancha.
//  5. TIENDA — el óptimo cae en el precio de lista, el precio mueve el humor,
//     la alternativa sale una vez por temporada y una venta a pérdida se
//     anota como gasto.
//  6. TV — el contrato de siempre cobra EXACTAMENTE la cuenta vieja; el fijo
//     congela la reputación; el variable va de 0,70× a 1,30×.
//  7. REUNIÓN — queda pendiente, cada ambición mueve el objetivo y la plata
//     como dice, vence sola en la semana 5 y se cobra al cerrar la temporada.
//  8. SAVE VIEJO — sin merch/tvDeal/reunion carga y cobra lo de siempre.
//  9. 0 FUNCIONES EN G.
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
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {} updateUI(); });

  console.log('\n═══ PARTIDO JUGABLE EN 3D ═══');
  await pg.evaluate(() => new Promise(r => e3dCargar(r)));
  const azar = await pg.evaluate(() => {
    // ⚠️ three.js usa Math.random() para el uuid de cada objeto: se mide la
    // construcción entera tal como la hace el partido (_e3dSinAzar).
    const orig = Math.random; let n = 0; Math.random = function () { n++; return orig(); };
    try { _e3dSinAzar(() => e3dEstadio({ cap: 54000, color: '#1d4ed8', gente: 3500, asist: 0.85, clima: 'barro' })); } finally { Math.random = orig; }
    return n;
  });
  chk('armar el estadio no consume Math.random()', azar === 0, azar + ' llamadas');
  await pg.evaluate(() => { G.day = 7; startFullMatch(false); });
  await pg.waitForTimeout(1500);
  const a = await pg.evaluate(() => {
    try { fmCloseHelp(); } catch (e) {}
    return { on: _FM3.on, hud: !!document.querySelector('#fm3d .f3-sb') && !!document.querySelector('#fm3d .f3-mm'),
      oculto: document.getElementById('fm-cv').style.visibility === 'hidden', juego: !FM.watch, jug: _FM3.J.jugs.length };
  });
  chk('arranca en 3D sin tocar nada', a.on && a.oculto && a.juego);
  chk('marcador y minimapa propios', a.hud);
  chk('22 muñecos', a.jug === 22, a.jug + '');
  const azar2 = await pg.evaluate(() => {
    const orig = Math.random; let n = 0; Math.random = function () { n++; return orig(); };
    try { _FM3.J.jugs.length = 0; for (let i = 0; i < 5; i++) fm3DFrame(); } finally { Math.random = orig; }
    return n;
  });
  chk('dibujar en 3D (y rearmar los 22) no consume Math.random()', azar2 === 0, azar2 + ' llamadas');
  const hud = await pg.evaluate(() => {
    const c = FM.my[FM.ctrl]; FM.chargeA = 0.6; const b0 = FM.ball;
    fm3DHudPintar([0, 0, 0]);
    const pw = document.querySelector('.f3-pw'), bar = pw.firstElementChild;
    const vis = pw.style.display === 'block' && bar.style.width === '60%';
    FM.chargeA = 0; fm3DHudPintar([0, 0, 0]);
    const sc = document.querySelector('.f3-sc').textContent === `${FM.myG} - ${FM.oppG}`;
    return { vis, apaga: pw.style.display === 'none', sc };
  });
  chk('la barra de potencia aparece al cargar y se va al soltar', hud.vis && hud.apaga);
  chk('el marcador del HUD es el del partido', hud.sc);
  const rel = await pg.evaluate(() => {
    const p = FM.opp.find(x => x.isGK) || FM.opp[0];
    p._diveT = 5; p._kickT = 3; _FM3.J.sync(); _FM3.J.sync();
    return { dive: p._diveT, kick: p._kickT };
  });
  chk('los relojes de dibujo bajan en 3D', rel.dive === 3 && rel.kick === 1, JSON.stringify(rel));
  const joy = await pg.evaluate(() => {
    const out = {};
    _FM3.modo = 'cerca'; out.cerca = fm3DEntrada(0, -1);
    _FM3.modo = 'tv'; out.tv = fm3DEntrada(0, -1);
    _FM3.modo = 'detras';
    FM.myAttRight = true; out.der = fm3DEntrada(0, -1); out.derR = fm3DEntrada(1, 0);
    FM.myAttRight = false; out.izq = fm3DEntrada(0, -1);
    FM.myAttRight = true; _FM3.modo = 'cerca';
    return out;
  });
  chk('cámaras de platea: el joystick no cambia', joy.cerca === null && joy.tv === null);
  chk('cámara detrás: arriba es hacia el arco rival', joy.der[0] > 0 && joy.izq[0] < 0 && joy.derR[1] > 0, JSON.stringify(joy));
  const corre = await pg.evaluate(() => new Promise(r => { const m0 = FM.minute, x0 = FM.ball.x, y0 = FM.ball.y;
    setTimeout(() => r(FM.minute > m0 || Math.hypot(FM.ball.x - x0, FM.ball.y - y0) > 1), 4000); }));
  // ⚠️ 4 s y no 1,5: sin placa de video el 3D va a ~5 fps, el motor a media
  // velocidad, y un tiro libre (120 ticks) puede durar más de 2 s quieto.
  chk('el partido corre con el 3D', corre);
  const pref = await pg.evaluate(() => new Promise(r => {
    fm3DToggle();
    const apagado = !_FM3.on && localStorage.getItem('dt_fm3d') === '0';
    try { fmQuit(); } catch (e) {} document.getElementById('fm-ov')?.remove(); closeMod();
    G.day = 7; startFullMatch(false);
    setTimeout(() => { const siguiente2D = !_FM3.on;
      try { fmQuit(); } catch (e) {} document.getElementById('fm-ov')?.remove(); closeMod();
      localStorage.removeItem('dt_fm3d'); r({ apagado, siguiente2D }); }, 1200);
  }));
  chk('apagarlo se recuerda para el partido siguiente', pref.apagado && pref.siguiente2D);

  console.log('\n═══ TIENDA OFICIAL ═══');
  const t = await pg.evaluate(() => {
    const ps = []; for (let p = 0.6; p <= 1.8001; p += 0.05) ps.push([p, merchMes(p).neto]);
    const mejor = ps.reduce((a, c) => c[1] > a[1] ? c : a);
    const caro = merchMes(1.2).neto / merchMes(1).neto, barato = merchMes(0.8).neto / merchMes(1).neto;
    G.merch = { precio: 1.4 }; const m0 = G.fanMood = 60; merchCobrar(); const bajaHumor = G.fanMood < m0;
    G.merch = { precio: 0.7 }; G.fanMood = 60; merchCobrar(); const subeHumor = G.fanMood > 60;
    G.merch = { precio: 1 }; G.fanMood = 60; merchCobrar(); const neutro = G.fanMood === 60;
    G.merch = { precio: 5 }; const fuera = merchPrecio() === 1;
    G.merch = {};
    const b0 = G.budget; merchLanzarAlt(); closeMod();
    const cobro = G.budget < b0, boost = merchAltBoost();
    const b1 = G.budget; merchLanzarAlt(); closeMod();
    const unaVez = G.budget === b1;
    G.week = (G.merch.alt.desde || 1) + 20; const apagado = merchAltBoost() === 0;
    G.week = 1; G.merch = {};
    abrirTienda(); const modal = /Tienda oficial/.test(document.getElementById('modBody').innerHTML) && !!document.getElementById('merchP'); closeMod();
    return { mejor: Math.round(mejor[0] * 90), caro, barato, bajaHumor, subeHumor, neutro, fuera, cobro, boost, unaVez, apagado, modal, neto: merchMes(1).neto };
  });
  chk('el óptimo cae en el precio de lista', Math.abs(t.mejor - 90) <= 5, t.mejor + ' €');
  chk('cobrar de menos cuesta más que cobrar de más', t.barato < t.caro && t.caro < 1, `−20%: ${t.barato.toFixed(2)} · +20%: ${t.caro.toFixed(2)}`);
  chk('caro enoja, barato suma, de lista no mueve', t.bajaHumor && t.subeHumor && t.neutro);
  chk('un precio guardado fuera de rango cae al de lista', t.fuera);
  chk('la alternativa cobra, empuja y sale una vez', t.cobro && t.boost > 0.5 && t.unaVez && t.apagado, 'empuje ' + t.boost.toFixed(2));
  chk('el modal se dibuja', t.modal);
  const perd = await pg.evaluate(() => {
    G.merch = { precio: 0.6 }; const s = G.season; G.fin[s] = G.fin[s] || {};
    const o0 = G.fin[s].otros_out || 0, m0 = G.fin[s].merch || 0;
    const n = merchCobrar(); if (n >= 0) finAnota('merch', n, 't'); else finAnota('otros_out', -n, 't');
    const r = { neto: n, gasto: (G.fin[s].otros_out || 0) > o0, ingreso: (G.fin[s].merch || 0) === m0 };
    G.fin[s].otros_out = o0; G.merch = {}; return r;
  });
  chk('a pérdida se anota como gasto', perd.neto < 0 && perd.gasto && perd.ingreso, 'neto ' + perd.neto);

  console.log('\n═══ DERECHOS DE TV ═══');
  const tv = await pg.evaluate(() => {
    const r0 = G.rep, d0 = G.tvDeal;
    const viejo = [35, 50, 64, 78, 92].every(rep => { G.rep = rep; G.tvDeal = undefined; return tvMensual() === Math.round((1.15 + rep * 0.017) * 10) / 10; });
    G.rep = 80; G.tvDeal = { tipo: 'fijo', season: G.season, rep: 80 }; const f0 = tvMensual(); G.rep = 50; const f1 = tvMensual();
    G.tvDeal = { tipo: 'fijo', season: G.season - 1, rep: 80 }; const vencido = tvMensual() === Math.round((1.15 + 50 * 0.017) * 10) / 10;
    G.rep = 78; const base = 1.15 + 78 * 0.017;
    const v = tvMensual('variable'), rango = v >= Math.round(base * 0.7 * 10) / 10 && v <= Math.round(base * 1.3 * 10) / 10;
    G.rep = r0; G.tvDeal = d0;
    return { viejo, congela: f0 === f1, vencido, rango, v };
  });
  chk('sin contrato cobra EXACTAMENTE la cuenta de antes', tv.viejo);
  chk('el fijo congela la reputación de la firma', tv.congela);
  chk('el contrato es de UNA temporada', tv.vencido);
  chk('el variable queda entre 0,70× y 1,30×', tv.rango, tv.v + 'M');

  console.log('\n═══ REUNIÓN DE PRETEMPORADA ═══');
  const reu = await pg.evaluate(() => {
    const snap = JSON.stringify({ r: G.reunion, t: G.boardTarget, b: G.budget, c: G.boardConf, f: G.fanMood, tv: G.tvDeal });
    const restaurar = () => { const o = JSON.parse(snap); G.reunion = o.r; G.boardTarget = o.t; G.budget = o.b; G.boardConf = o.c; G.fanMood = o.f; G.tvDeal = o.tv; };
    const out = { pendiente: reunionPendiente(), badge: fPendientes().oficina >= 1 };
    abrirReunion(); out.modal = /Ambición/.test(document.getElementById('modBody').innerHTML); closeMod();
    const base = G.reunion.base, b0 = G.budget;
    reunionResolver('ambiciosa', 'variable');
    out.amb = { meta: G.boardTarget.maxPos === Math.max(1, base - 2), plata: G.budget > b0 && G.reunion.iny > 0, tv: tvTipo() === 'variable', cerrada: !reunionPendiente() };
    const c0 = G.boardConf; reunionCierre(99); out.fallo = G.boardConf < c0;
    const c1 = G.boardConf; reunionCierre(99); out.unaVez = G.boardConf === c1;
    restaurar(); G.reunion.hecha = false;
    reunionResolver('prudente', 'fijo'); out.pru = G.boardTarget.maxPos === base + 3 || G.boardTarget.maxPos === (leagueSorted().length);
    restaurar(); G.reunion.hecha = false; G.week = REUNION_VENCE - 1; reunionVencer(); out.noAntes = reunionPendiente();
    G.week = REUNION_VENCE; reunionVencer(); out.vence = !reunionPendiente() && G.reunion.auto && tvTipo() === 'mixto';
    const c2 = G.boardConf; reunionCierre(1); out.autoNoCobra = G.boardConf === c2;
    restaurar(); G.week = 1;
    return out;
  });
  chk('queda pendiente y avisa en la Oficina', reu.pendiente && reu.badge && reu.modal);
  chk('ambiciosa: objetivo más alto, plata ya y TV elegida', Object.values(reu.amb).every(Boolean), JSON.stringify(reu.amb));
  chk('fallar lo ambicioso se cobra una sola vez', reu.fallo && reu.unaVez);
  chk('prudente: objetivo más bajo', reu.pru);
  chk('vence sola en la semana ' + 5 + ' con lo de siempre', reu.noAntes && reu.vence && reu.autoNoCobra);

  console.log('\n═══ SAVE VIEJO Y G ═══');
  const viejo = await pg.evaluate(() => {
    saveGame();
    const s = JSON.parse(localStorage.getItem('dtg_v7'));
    delete s.merch; delete s.tvDeal; delete s.reunion;
    localStorage.setItem('dtg_v7', JSON.stringify(s));
    G = null; loadGame();
    const out = { carga: !!G, tv: tvMensual() === Math.round((1.15 + (G.rep || 50) * 0.017) * 10) / 10, precio: merchPrecio() === 1, pend: reunionPendiente() === false };
    abrirTienda(); closeMod(); abrirReunion(); closeMod(); irSec('oficina');
    out.tiles = [...document.querySelectorAll('#hubGrid .ht-t')].map(e => e.textContent).filter(x => /Tienda|Directiva/.test(x)).length;
    let fns = 0; const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 6) return; for (const k in o) { const v = o[k]; if (typeof v === 'function') fns++; else walk(v, d + 1); } };
    walk(G, 0); out.fns = fns;
    return out;
  });
  chk('un save sin los campos nuevos carga y cobra lo de siempre', viejo.carga && viejo.tv && viejo.precio && viejo.pend);
  chk('la Oficina tiene Tienda y Reunión', viejo.tiles === 2);
  chk('0 funciones en G', viejo.fns === 0, viejo.fns + '');
  const sim = await pg.evaluate(() => {
    let j = 0;
    const drenar = () => { for (let k = 0; k < 5; k++) { const d = dilemaBloqueante(); if (d) { dilemaResolver(d.id, 0); continue; } if (prensaPend()) { prensaResolver(0); continue; } break; } closeMod(); };
    const s = G.season; G.fin[s] = G.fin[s] || {}; const m0 = G.fin[s].merch || 0;
    for (let i = 0; i < 60 && j < 16; i++) { drenar(); const m = G.calendar.find(x => !x.played); if (!m) break; G.day = 7; G.week = Math.max(G.week, m.week); simMatch(true); if (m.played) j++; closeMod(); }
    return { j, merch: (G.fin[s].merch || 0) > m0 };
  });
  chk('el balance mensual cobra la tienda', sim.merch, sim.j + ' partidos');
  chk('0 errores de página', !errs.length, errs.slice(0, 3).join(' | '));

  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  await b.close();
  process.exitCode = fail ? 1 : 0;
})();
