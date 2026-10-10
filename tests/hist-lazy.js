// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN: temporadas históricas con carga a demanda
// ═══════════════════════════════════════════════════════════════════════
// Esto vive EN EL REPO a propósito. La regresión grande (84 checks) vivía
// sólo en el scratchpad del contenedor y se perdió dos veces con un
// reinicio: no se pudo reconstruir. Un verificador que no está commiteado
// es un verificador que no existe.
//
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/hist-lazy.js
//
// Qué blinda, y por qué cada cosa:
//  1. ARRANQUE BARATO — el juego no abre NINGÚN players-hist-AÑO.js al
//     arrancar. Es el punto de toda la fase: con 25 ligas eso son 33-43 MB.
//  2. EL SELECTOR LOS VE IGUAL — los años salen del manifiesto, no de lo
//     cargado. Si saliera de lo cargado, se vería UN año.
//  3. CARGA A DEMANDA — elegir un año lo baja y lo aplica.
//  4. EL AÑO QUE FALTA SE AVISA — `aplicarTemporada` cae a la base moderna
//     cuando el año no está, así que sin aviso te quedás jugando 2026 sin
//     saberlo.
//  5. LA PARTIDA GUARDADA VUELVE CON SU AÑO — `loadGame` es síncrono, así
//     que el año lo precarga el bloque de arranque leyendo el save. Es el
//     bug de `_LIGA_ELEGIDA` un escalón más abajo.
//  6. MODO VIEJO — una carpeta con archivos y SIN manifiesto sigue andando.
//  7. MULTILIGA — un año con varias ligas se juega. El juego ya lo soporta
//     porque todo deriva de la base cargada; esto lo blinda.
//  8. 2026 INTACTA — la partida normal no se enteró de nada.
//
// ⚠️ Ojo con el arnés: `browser.newPage()` abre un CONTEXTO nuevo, así que
// el localStorage no viaja entre páginas y el check 5 da falso negativo.
// Hay que usar un `browser.newContext()` compartido.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const F = 'file://' + path.join(RAIZ, 'director-tecnico.html');
const IDX = path.join(RAIZ, 'players-hist-index.js');

let ok = 0, fail = 0;
const chk = (nombre, cond, det) => {
  if (cond) { ok++; console.log('  ✓ ' + nombre + (det ? ' — ' + det : '')); }
  else { fail++; console.log('  ✗ ' + nombre + (det ? ' — ' + det : '')); }
};

const esperarCarga = pg => pg.evaluate(() => new Promise(r => {
  const w = () => (typeof _tsTempCargando !== 'undefined' && _tsTempCargando) ? setTimeout(w, 20) : r(1);
  setTimeout(w, 20);
}));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const errs = [];
  const nueva = async () => {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(F, { waitUntil: 'load' });
    await pg.waitForTimeout(450);
    return pg;
  };

  console.log('\n═══ 1-2) ARRANQUE Y SELECTOR ═══');
  let pg = await nueva();
  let r = await pg.evaluate(() => ({
    idx: Object.keys(window.PLAYERS_DB_HIST_IDX || {}).length,
    cargados: Object.keys(window.PLAYERS_DB_HIST || {}).length,
    sel: temporadasDB(),
    hay: hayHistoricos(),
    bytes: performance.getEntriesByType('resource')
      .filter(x => /players-hist-\d/.test(x.name)).length,
    filas: window.PLAYERS_DB.length,
    inf: temporadaInfo(temporadasDB()[0])
  }));
  chk('no se carga ningún año al arrancar', r.cargados === 0, r.cargados + ' años en memoria');
  chk('el manifiesto sí se carga', r.idx > 0, r.idx + ' años en el índice');
  chk('el selector muestra todos los años', r.sel.length === r.idx, r.sel.length + ' en el selector');
  chk('hayHistoricos() sin cargar nada', r.hay === true);
  chk('arranca con la base moderna', r.filas > 15000, r.filas + ' filas');
  chk('temporadaInfo sale del índice sin cargar', !!(r.inf && r.inf.j > 0), JSON.stringify(r.inf));

  console.log('\n═══ 3) CARGA A DEMANDA ═══');
  const y1 = r.sel.find(y => y !== 2026);
  const r3 = await pg.evaluate(y => { tsSetTemporada(y); return 1; }, y1);
  await esperarCarga(pg);
  r = await pg.evaluate(() => ({
    temp: tempActual(), filas: window.PLAYERS_DB.length, err: _tsTempErr,
    cargados: Object.keys(window.PLAYERS_DB_HIST).length, ligas: ligasJugables()
  }));
  chk('elegir un año lo carga y lo aplica', r.temp === y1 && r.filas > 200 && !r.err,
    `${y1}: ${r.filas} filas, ligas ${r.ligas.join('+')}`);
  chk('sólo ese año queda en memoria', r.cargados === 1, r.cargados + ' año(s)');
  chk('mundo cerrado', r.ligas.length <= 2 && r.ligas.includes('Liga ARG'), r.ligas.join(', '));

  console.log('\n═══ 4) EL AÑO QUE FALTA SE AVISA ═══');
  await pg.evaluate(() => { window.PLAYERS_DB_HIST_IDX[1897] = { j: 500, lg: { 'Liga ARG': 20 } }; tsSetTemporada(1897); });
  await esperarCarga(pg);
  r = await pg.evaluate(() => ({ err: _tsTempErr, temp: tempActual(), avisa: /No se pudo cargar/.test(tsTemporadas()) }));
  chk('un año que no está en la carpeta se avisa', r.err === 1897 && r.avisa);
  chk('y NO se queda jugando otro año en silencio', r.temp === y1, 'sigue en ' + r.temp);
  await pg.evaluate(() => { delete window.PLAYERS_DB_HIST_IDX[1897]; });

  console.log('\n═══ 5) LA PARTIDA GUARDADA VUELVE CON SU AÑO ═══');
  const arranque = await pg.evaluate(y => {
    try {
      tsSetTemporada(y);
      localStorage.clear();
      document.getElementById('teamSelect').style.display = 'none';
      setLigaSel('Liga ARG');
      const id = Object.keys(TEAMS).find(k => TEAMS[k].name === 'Boca Juniors');
      if (!id) return 'sin Boca en TEAMS';
      startGame(id);
      return null;
    } catch (e) { return e.message; }
  }, y1);
  chk('arranca una partida en el año histórico', !arranque, arranque || 'ok');
  await pg.waitForTimeout(700);
  r = await pg.evaluate(() => {
    try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const inv = (G.squad || []).filter(p => !window.PLAYERS_DB.some(x => x[1] === p.name)).length;
    saveGame();
    return { plantel: G.squad.length, inv, estadio: G.stadium.name, db: G.dbSeason };
  });
  chk('el plantel es del año, sin inventados', r.inv === 0 && r.plantel > 20,
    `${r.plantel} fichas, ${r.inv} inventadas, ${r.estadio}`);
  await pg.close();

  pg = await nueva();
  r = await pg.evaluate(() => {
    const pre = Object.keys(window.PLAYERS_DB_HIST || {}).map(Number);
    const cargo = loadGame();
    const riv = new Set(); (G && G.calendar || []).forEach(m => { riv.add(m.home); riv.add(m.away); });
    return { pre, cargo, db: G && G.dbSeason, temp: tempActual(), filas: window.PLAYERS_DB.length,
             plantel: G && G.squad.length, rivales: riv.size };
  });
  chk('el bloque de arranque precarga el año del save', r.pre.length === 1 && r.pre[0] === y1, 'precargado: ' + r.pre.join(','));
  chk('loadGame vuelve con el año puesto', r.cargo && r.db === y1 && r.temp === y1 && r.filas < 15000,
    `dbSeason ${r.db}, ${r.filas} filas, ${r.rivales} rivales`);

  console.log('\n═══ 6) MODO VIEJO: ARCHIVOS SIN MANIFIESTO ═══');
  // Se esconde el índice para que el onerror lo deje sin definir, que es
  // exactamente la carpeta de una extracción anterior.
  const idxTxt = fs.readFileSync(IDX, 'utf8');
  fs.renameSync(IDX, IDX + '.bak');
  try {
    const pg2 = await ctx.newPage();
    pg2.on('pageerror', e => errs.push(e.message));
    await pg2.addInitScript(() => { try { localStorage.removeItem('dtg_v7'); } catch (e) {} });
    await pg2.goto(F, { waitUntil: 'load' });
    await pg2.waitForTimeout(900);
    const r6 = await pg2.evaluate(() => ({
      idx: !!window.PLAYERS_DB_HIST_IDX,
      cargados: Object.keys(window.PLAYERS_DB_HIST || {}).length,
      sel: temporadasDB().length, hay: hayHistoricos()
    }));
    chk('sin manifiesto cae al modo viejo y carga todo', !r6.idx && r6.cargados > 20,
      `${r6.cargados} años cargados`);
    chk('y las temporadas igual se ven', r6.hay && r6.sel === r6.cargados, r6.sel + ' en el selector');
    await pg2.close();
  } finally { fs.renameSync(IDX + '.bak', IDX); }

  console.log('\n═══ 7) UN AÑO CON VARIAS LIGAS ═══');
  pg = await nueva();
  const r7 = await pg.evaluate(() => {
    // Se fabrica un año multiliga desde la base moderna: el juego no tiene
    // ninguna rama especial para esto, todo deriva de la base cargada.
    const LG = ['España', 'Premier', 'Italia', 'Liga ARG'];
    window.PLAYERS_DB_HIST[2011] = window.PLAYERS_DB.filter(r => LG.includes(r[6]))
      .map(r => { const c = r.slice(); c[7] = +((c[7] || 0) / 2.8).toFixed(2); return c; });
    aplicarTemporada(2011);
    const lg = ligasJugables();
    const cl = {}; lg.forEach(l => cl[l] = clubesDeCategoria(l).length);
    return { lg, cl };
  });
  chk('las ligas del año aparecen solas', r7.lg.length >= 4, r7.lg.join(', '));
  chk('cada liga trae sus clubes', Object.values(r7.cl).every(n => n >= 15), JSON.stringify(r7.cl));
  const r7b = await pg.evaluate(() => {
    try {
      localStorage.clear();
      document.getElementById('teamSelect').style.display = 'none';
      setLigaSel('España');
      startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === 'Real Madrid'));
      return null;
    } catch (e) { return e.message; }
  });
  await pg.waitForTimeout(700);
  const r7c = await pg.evaluate(() => {
    try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const comps = {}; (G.calendar || []).forEach(m => comps[m.comp] = (comps[m.comp] || 0) + 1);
    const inv = (G.squad || []).filter(p => !window.PLAYERS_DB.some(x => x[1] === p.name)).length;
    return { err: null, inv, estadio: G.stadium.name, comps, liga: G.miLiga };
  });
  chk('se puede dirigir en una liga de afuera en ese año', !r7b && r7c.inv === 0,
    `${r7c.liga}, ${r7c.estadio}, ${r7c.inv} inventados`);
  chk('con su liga, su copa continental y su copa nacional',
    Object.keys(r7c.comps).some(c => /LaLiga/.test(c)) &&
    Object.keys(r7c.comps).some(c => /Champions/.test(c)) &&
    Object.keys(r7c.comps).some(c => /Copa del Rey/.test(c)),
    Object.keys(r7c.comps).join(' · '));
  await pg.close();

  console.log('\n═══ 8) LA TEMPORADA 2026 NO SE ENTERÓ ═══');
  pg = await nueva();
  const r8 = await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    aplicarTemporada(2026);
    const filas = window.PLAYERS_DB.length;
    const suma = window.PLAYERS_DB.reduce((a, r) => a + (r[7] || 0), 0);
    document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('Liga ARG');
    startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === 'Boca Juniors'));
    return { filas, suma: Math.round(suma), temp: tempActual() };
  });
  await pg.waitForTimeout(700);
  const r8b = await pg.evaluate(() => {
    try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const inv = (G.squad || []).filter(p => !window.PLAYERS_DB.some(x => x[1] === p.name)).length;
    return { plantel: G.squad.length, inv, estadio: G.stadium.name, ligas: ligasJugables().length };
  });
  chk('2026 arranca normal', r8.temp === 2026 && r8.filas > 17000 && r8b.inv === 0,
    `${r8.filas} filas, ${r8b.ligas} ligas, ${r8b.plantel} fichas, ${r8b.estadio}`);

  console.log('\n═══ ERRORES DE PÁGINA ═══');
  chk('ninguna página tiró una excepción', errs.length === 0, errs.slice(0, 3).join(' | ') || 'ninguna');

  await b.close();
  console.log(`\n${fail === 0 ? '✅' : '❌'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
