// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 100: el 11v11 que se entiende, los técnicos de cada año
// y el jugador recién fichado
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase100.js
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..');
const F = 'file://' + path.join(RAIZ, 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  // ── 1 · el 11v11, con el arnés determinista (4 partidos mirados de Boca) ──
  console.log('11v11 (tools/arnes11.js, 4 partidos):');
  const J = path.join(os.tmpdir(), 'fase100-arnes-' + process.pid + '.json');
  let A = null;
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'arnes11.js'), '4', '3', '--json=' + J], { cwd: RAIZ, stdio: 'pipe', timeout: 480000, env: process.env });
    A = JSON.parse(fs.readFileSync(J, 'utf8'));
  } catch (e) { console.log('  (el arnés falló: ' + String(e.message).slice(0, 200) + ')'); }
  try { fs.unlinkSync(J); } catch (e) { }
  const R = (A && A.resumen) || {}, res = (A && A.res) || [];
  const X = k => res.reduce((a, x) => a + ((x.x || {})[k] || 0), 0) / Math.max(1, res.length);
  chk('el arnés juega los 4 partidos sin error', R.partidos === 4, (R.partidos || 0) + ' partidos');
  chk('el que acaba de patear no la vuelve a "patear" en el tick siguiente', X('repase') < 20, X('repase').toFixed(1) + ' por partido (antes ~250)');
  chk('el arquero saca una vez por pelota (no 200 veces por partido)', R.gkN >= 5 && R.gkN <= 70, R.gkN + ' por partido (antes 217)');
  chk('el saque de arco conserva la pelota la mayoría de las veces', R.sacaRet >= 65, R.sacaRet + '% (antes 68%)');
  chk('el saque de arco no deja la pelota al rival en tu área', R.sacaPeligro <= 18, R.sacaPeligro + '% (antes 27%)');
  chk('no se cobra falta por cualquier cosa', R.faltas <= 14, R.faltas + ' por partido');
  chk('el fuera de juego se cobra cuando juega el adelantado (pocos)', R.offsides <= 3, R.offsides + ' por partido');
  chk('hay remates de afuera del área', R.remLejos >= 2, R.remLejos + ' por partido');
  chk('hay gambetas', R.gambetas >= 10, R.gambetas + ' por partido');
  chk('no se amontonan 8 de un equipo alrededor de la pelota', R.mont8 <= 3, R.mont8 + '% de los ticks');
  chk('goles en rango', R.goles >= 0.75 && R.goles <= 5, R.goles + ' por partido');
  chk('el partido no se pasa parado', R.parado <= 35, R.parado + '% del tiempo');

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  // ── 2 · el motor: código que no tiene que volver ──
  console.log('El motor:');
  const c = await pg.evaluate(() => {
    const fa = String(fmAI), tp = String(fmTeamPass), t99 = String(fm99Tick);
    return { solto: /_solto/.test(fa) && /iHave/.test(fa), offPend: /_offPend=\{/.test(tp) && !/fmSetRestart\('freekick'[^)]*FUERA DE JUEGO/.test(tp),
      tick: /fmOffsideTick\(\)/.test(t99), saca: typeof fmArqueroSaca === 'function', FM100: (0, eval)('JSON.stringify(FM100)'), rem: (0, eval)('FM77.remArea') };
  });
  chk('"tener la pelota" excluye al que la acaba de soltar', c.solto);
  chk('el pase al adelantado NO se cobra en el acto: queda pendiente', c.offPend);
  chk('el fuera de juego pendiente se juzga en cada tick', c.tick);
  chk('el arquero tiene su propia distribución', c.saca);
  chk('constantes de remates calibradas', c.rem === 1 && /lejos/.test(c.FM100), c.FM100 + ' · remArea ' + c.rem);

  // ── 3 · fuera de juego diferido, determinista ──
  console.log('Fuera de juego:');
  const o = await pg.evaluate(() => {
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    G.day = 7;
    const raf = window.requestAnimationFrame; window.requestAnimationFrame = fn => { try { fn(performance.now()); } catch (e) { } return 0; };
    try { startFullMatch(true); } catch (e) { }
    window.requestAnimationFrame = raf;
    const f = FM; if (!f) return { err: 'sin FM' };
    f.phase = 'play'; f.restart = null;
    const t = f.my[9], from = f.my[6], b = f.ball;
    // (a) lo juega un rival antes: se anula
    f._offPend = { team: 'my', t, from, desde: f.ticks }; f._lastTouch = 'opp';
    fmOffsideTick(); const anula = f._offPend === null && f.phase === 'play';
    // (b) la toca el adelantado: se cobra
    f._offPend = { team: 'my', t, from, desde: f.ticks - 12 }; f._lastTouch = 'my';
    b.x = t.x + 5; b.y = t.y; b.vx = 0; b.vy = 0; b.air = 0; f.poss = t;
    fmOffsideTick();
    const cobra = f.phase === 'restart' && f.restart && f.restart.type === 'freekick' && f.restart.team === 'opp';
    const r = { anula, cobra, off: (f.stat && f.stat.my && f.stat.my.off) || 0 };
    try { fmClean(); } catch (e) { } FM = null;
    return r;
  });
  chk('si un rival la toca antes, el adelantado queda habilitado', o.anula);
  chk('si la juega el adelantado, tiro libre para el rival', o.cobra, 'off=' + o.off);

  // ── 4 · técnicos de cada año ──
  console.log('Técnicos de cada año:');
  const casos = [[2000, 'Liga ARG', 'Boca Juniors', 'Carlos Bianchi'], [2000, 'España', 'Real Madrid', 'Vicente del Bosque'],
    [2000, 'Premier', 'Man Utd', 'Alex Ferguson'], [2008, 'España', 'Barcelona', 'Pep Guardiola'], [2012, 'España', 'Atlético', 'Diego Simeone']];
  for (const [y, lg, club, dt] of casos) {
    await pg.evaluate(y => new Promise(res => cargarTemporada(y, res)), y);
    const r = await pg.evaluate(([y, lg, club]) => {
      aplicarTemporada(y); setLigaSel(lg);
      const id = Object.keys(TEAMS).find(k => TEAMS[k].name === club); if (!id) return { err: 'sin ' + club };
      startGame(id); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
      const pool = G.dtPool || [], N = n => pool.find(d => d.name === n);
      const jugaban = pool.filter(d => { const a = (window.DTS_ANIOS || {})[d.name]; return a && a[1] >= y; }).map(d => d.name);
      const chicos = pool.filter(d => !d.generado && !d.exJugador && dtNacimiento(d) && y - dtNacimiento(d) < DT_EDAD_MIN).map(d => d.name);
      const riv = [...new Set(G.calendar.slice(0, 12).map(m => m.home === G.teamName ? m.away : m.home))].filter(c => c !== G.teamName);
      const anacr = riv.map(c => dtDelRival(c)).filter(d => d && !dtDisponibleEn(d, y)).map(d => d.name);
      return { dt: G.dt.name, edad: G.dt.age, guardiola: N('Pep Guardiola') ? (N('Pep Guardiola').club || 'libre') : 'no', jugaban, chicos, anacr, libres: pool.filter(d => !d.club).length };
    }, [y, lg, club]);
    if (r.err) { chk(y + ' ' + club, false, r.err); continue; }
    chk(`${club} ${y} arranca con ${dt}`, r.dt === dt, r.dt + ' (' + r.edad + ')');
    chk(`${y}: nadie en el mercado que ese año jugaba`, r.jugaban.length === 0, r.jugaban.slice(0, 4).join(', ') || 'ninguno');
    chk(`${y}: nadie menor de ${34} dirigiendo`, r.chicos.length === 0, r.chicos.slice(0, 4).join(', ') || 'ninguno');
    chk(`${y}: los rivales tienen técnicos de ese año`, r.anacr.length === 0, r.anacr.join(', ') || 'ok');
    chk(`${y}: hay técnicos libres para contratar`, r.libres >= 80, r.libres + ' libres');
    if (y === 2000) chk('2000: Guardiola no está (jugaba en el Barcelona)', r.guardiola === 'no', r.guardiola);
    if (y === 2008) chk('2008: Guardiola dirige al Barcelona', r.guardiola === 'Barcelona', r.guardiola);
  }
  // pasan los años en la misma partida: el que se retira como jugador vuelve como técnico
  const e = await pg.evaluate(() => new Promise(res => cargarTemporada(2000, () => {
    aplicarTemporada(2000); setLigaSel('Liga ARG');
    const id = Object.keys(TEAMS).find(k => TEAMS[k].name === 'Boca Juniors');
    startGame(id); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const dt0 = G.dt.name, sim0 = !!G.dtPool.find(d => d.name === 'Diego Simeone');
    G.season = 2007; ensureDtPool();
    const s = G.dtPool.find(d => d.name === 'Diego Simeone'), vb = G.dtPool.find(d => d.name === 'Vicente del Bosque'), fe = G.dtPool.find(d => d.name === 'Alex Ferguson'), bi = G.dtPool.find(d => d.name === 'Carlos Bianchi');
    const r = { dt0, sim0, sim7: s ? (s.club || 'libre') + ' ' + s.age : 'no', delb: vb ? (vb.club || 'libre') : 'no', ferg: fe ? fe.club : 'no', bianchi: bi ? bi.club : 'no', dt7: G.dt.name };
    saveGame(); const raw = localStorage.getItem('dt_v7') || localStorage.getItem('dtg_v7'); G = null; loadGame();
    r.vuelve = (G.dtEspera || []).length > 0 && G._dtPoolAnio === 2007 && !!G.dtPool.find(d => d.name === 'Diego Simeone');
    res(r);
  })));
  chk('2000: Simeone no está (jugaba en la Lazio)', !e.sim0);
  chk('2007: Simeone ya se retiró y entra al mercado de técnicos', /libre 3[67]/.test(e.sim7), e.sim7);
  chk('2007: Del Bosque ya no está en el Madrid (terminó su ciclo)', e.delb === 'libre', e.delb);
  chk('2007: Ferguson sigue en el United', e.ferg === 'Man Utd', e.ferg);
  chk('2007: tu técnico (Bianchi) sigue en tu club aunque su ciclo real terminó', e.bianchi === 'Boca Juniors', e.bianchi);
  chk('tu técnico no se toca al cambiar de año', e.dt7 === e.dt0, e.dt0 + ' → ' + e.dt7);
  chk('el pool de ese año sobrevive al guardado', e.vuelve);
  // con la base de hoy no cambia nada
  const h = await pg.evaluate(() => { aplicarTemporada(2026); setLigaSel('Liga ARG'); startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    return { mundo: dtAnioMundo(), espera: (G.dtEspera || []).length, guard: (G.dtPool.find(d => d.name === 'Pep Guardiola') || {}).name, dt: G.dt.name, riv: (dtDelRival('River Plate') || {}).name, base: (dtDeClub('River Plate', 'Liga ARG') || {}).name }; });
  chk('2026: no filtra nada', h.mundo === 0 && h.espera === 0 && h.guard === 'Pep Guardiola', 'Guardiola en el pool · ' + h.dt);
  chk('2026: el rival sale con el técnico de la base, como siempre', h.riv === h.base, h.riv);

  // ── 5 · el recién fichado ──
  console.log('El recién fichado:');
  const f = await pg.evaluate(() => {
    G.week = 2;
    const p = G.market.filter(x => x.rat >= 81 && !x.injured && x.club !== G.teamName && !esLibre(x)).sort((a, b) => b.rat - a.rat)[0];
    G.budget = 500;
    firmaProgramar(p, { price: 1, wage: 50, years: 3, motivo: 'test' });
    G.firmas.forEach(x => x.dias = 0); firmasTick();
    const sp = G.squad.find(x => x.id === p.id); if (!sp) return { err: 'no entró' };
    const r = { nombre: sp.name, rat: sp.rat, marca: sp._llegoS === G.season && sp._llegoW === 2, recien: recienFichado(sp) };
    // ofertas espontáneas: nunca por él
    let porEl = 0;
    for (let i = 0; i < 300; i++) { genOffers().forEach(o => { if (o.player.id === sp.id) porEl++; }); }
    G.offers = []; for (let i = 0; i < 300; i++) { weeklyOffers(); G.offers = G.offers.filter(o => { if (o.player.id === sp.id) porEl++; return false; }); }
    r.porEl = porEl;
    // rechazar una oferta de un grande no lo enoja
    let rebel = 0;
    for (let i = 0; i < 30; i++) { sp.wantsOut = false; sp.morale = 80; const o = buildBuyOffer(sp, false); o.from = 'Real Madrid'; G.offers = [o]; rejOff(0); if (sp.wantsOut) rebel++; }
    r.rebel = rebel;
    r.ofertaza = DILEMAS.find(d => d.id === 'ofertaza').cuando();
    r.figura = _dilFigura() && _dilFigura().id === sp.id;
    // a las 20 semanas ya es uno más
    G.week = 22; r.recien22 = recienFichado(sp);
    let rebel2 = 0;
    for (let i = 0; i < 30; i++) { sp.wantsOut = false; sp.morale = 80; const o = buildBuyOffer(sp, false); o.from = 'Real Madrid'; G.offers = [o]; rejOff(0); if (sp.wantsOut) rebel2++; }
    r.rebel2 = rebel2; sp.wantsOut = false;
    // ponerlo en venta: las ofertas llegan igual
    G.week = 3; sp.listed = 'sale'; sp.askPrice = sp.val; let lis = 0;
    for (let i = 0; i < 100; i++) { G.offers = []; weeklyOffers(); if (G.offers.some(o => o.player.id === sp.id)) lis++; }
    r.lis = lis; sp.listed = null;
    saveGame(); const id = sp.id; G = null; loadGame();
    const q = G.squad.find(x => x.id === id); r.guarda = q && q._llegoS !== undefined && recienFichado(q);
    return r;
  });
  if (f.err) chk('el fichaje entra', false, f.err);
  else {
    chk('al entrar queda la fecha de llegada', f.marca, f.nombre + ' (' + f.rat + ')');
    chk('recién llegado', f.recien);
    chk('ningún club ofrece por él sin que lo pongas en venta', f.porEl === 0, f.porEl + ' ofertas en 600 sorteos');
    chk('rechazar a un grande no lo enoja', f.rebel === 0, f.rebel + ' de 30');
    chk('la "oferta irrechazable" no es por el que acaba de llegar', f.figura ? f.ofertaza === false : true, f.figura ? 'es la figura del plantel' : 'no es la figura');
    chk('a las 20 semanas ya es uno más del plantel', f.recien22 === false);
    chk('…y rechazar a un grande puede volver a enojarlo', f.rebel2 >= 8, f.rebel2 + ' de 30');
    chk('si lo ponés en venta, las ofertas llegan igual', f.lis >= 20, f.lis + ' de 100 semanas');
    chk('la fecha de llegada sobrevive al guardado', f.guarda);
  }
  const fn = await pg.evaluate(() => { const v = []; const w = (o, p) => { if (typeof o === 'function') v.push(p); else if (o && typeof o === 'object') for (const k in o) w(o[k], p + '.' + k); }; w(G, 'G'); return v; });
  chk('ninguna función en G', fn.length === 0, fn.slice(0, 3).join(', '));
  chk('sin errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? "❌" : "✅"} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
