// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 88: exportar e importar la base de jugadores en JSON
// ═══════════════════════════════════════════════════════════════════════
// La base sale a un archivo, entra desde un archivo o una URL (base completa
// o parche), se guarda en IndexedDB, se aplica al arrancar sobre la original
// y se puede deshacer. Los textos del archivo se limpian antes de dibujarse.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase88.js
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
  const red = []; pg.on('request', r => { if (/^https?:/.test(r.url())) red.push(r.url()); });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  const listo = () => pg.waitForFunction(() => typeof baseLista === 'function' && baseLista() && !document.getElementById('baseCarga'), null, { timeout: 20000 });
  const recarga = async () => { await pg.waitForEvent('load', { timeout: 20000 }); await pg.waitForTimeout(300); await listo(); };

  console.log('\n═══ Sin base importada ═══');
  const r0 = await pg.evaluate(() => ({ est: _baseCom.estado, n: PLAYERS_DB.length, ov: !!document.getElementById('baseCarga'), meta: baseMeta(), btn: !![...document.querySelectorAll('#teamSelect button')].find(x => /Base de jugadores/.test(x.textContent)) }));
  chk('sin ficha no hay nada que esperar: arranca síncrono', r0.est === 'nada' && !r0.ov && r0.meta === null);
  chk('el botón 🗃️ está en la pantalla de inicio', r0.btn);
  const N0 = r0.n;

  // ─── validación ───
  const v = await pg.evaluate(() => {
    const e = t => { try { baseLeer(t); return null; } catch (x) { return x.message; } };
    const f = baseValidarFila;
    return {
      noJson: e('{hola'), formato: e('{"jugadores":[]}'), version: e('{"formato":"dt-base","version":9,"jugadores":[]}'), vacio: e('{"formato":"dt-base","version":1,"jugadores":[[1,"x"]]}'),
      xss: f([1, '<img src=x onerror=alert(1)>Pibe "Malo"', 'DC', 22, 'ARG', 'Boca<b>', 'Liga ARG', 3]).fila,
      apos: f([1, "N'Golo Kanté", 'MC', 34, 'FRA', 'Al-Ittihad', 'Arabia', 4]).fila,
      pos: f([1, 'Juan', 'XX', 22, 'ARG', 'Boca Juniors', 'Liga ARG', 3]).err,
      edad: f([1, 'Juan', 'DC', 9, 'ARG', 'Boca Juniors', 'Liga ARG', 3]).err,
      valor: f([1, 'Juan', 'DC', 22, 'ARG', 'Boca Juniors', 'Liga ARG', 500]).err,
      corta: f([1, 'Juan', 'DC', 22, 'ARG', 'Boca Juniors', 'Liga ARG', 3]).fila,
      arr: (() => { try { return baseLeer(JSON.stringify(PLAYERS_DB.slice(0, 50))).modo; } catch (x) { return x.message; } })(),
    };
  });
  chk('un JSON roto, sin "formato" o de una versión más nueva se rechaza', /JSON/.test(v.noJson) && /dt-base/.test(v.formato) && /versión/.test(v.version));
  chk('sin una sola fila válida se rechaza y dice por qué', /ninguna fila válida/.test(v.vacio || ''), v.vacio);
  chk('a los textos se les saca el HTML', v.xss && !/[<>"]/.test(v.xss[1]) && !/[<>]/.test(v.xss[5]), v.xss && v.xss[1]);
  chk("el apóstrofo se queda (N'Golo)", v.apos && v.apos[1] === "N'Golo Kanté");
  chk('puesto, edad y valor imposibles se descartan', v.pos === 'puesto' && v.edad === 'edad' && v.valor === 'valor');
  chk('una fila de 8 columnas se completa a 17', v.corta && v.corta.length === 17 && v.corta[8] === 'der');
  chk('un array pelado (players-db.js) se lee como base completa', v.arr === 'reemplazar', v.arr);

  // ─── exportar e ida y vuelta ───
  const ex = await pg.evaluate(() => {
    const o = baseExportar(); const t = JSON.stringify(o); const imp = baseLeer(t);
    const igual = imp.jugadores.every((f, i) => JSON.stringify(f) === JSON.stringify(PLAYERS_DB[i]));
    return { n: o.jugadores.length, dts: o.dts.length, mb: t.length / 1e6, vuelta: imp.jugadores.length, igual, desc: Object.keys(imp.desc).length, dtsV: imp.dts.length };
  });
  chk('exportar saca la base entera', ex.n === N0 && ex.dts > 600, ex.n + ' jugadores · ' + ex.dts + ' DTs · ' + ex.mb.toFixed(1) + ' MB');
  chk('importar lo exportado da la MISMA base, fila por fila', ex.vuelta === N0 && ex.igual && ex.desc === 0, ex.vuelta + ' filas, 0 descartadas');

  // ─── un parche, con vista previa ───
  console.log('\n═══ Un parche: alta, cambio, cambio de club y baja ═══');
  const datos = await pg.evaluate(() => {
    const boca = PLAYERS_DB.filter(r => r[5] === 'Boca Juniors');
    const cambio = boca[0].slice(); cambio[7] = 77;                     // mismo club, otro valor
    const otro = PLAYERS_DB.find(r => r[5] === 'River Plate' && r[3] < 30);
    const tras = otro.slice(); tras[5] = 'Boca Juniors';                // mismo nombre y nac, otro club
    const baja = boca[1];
    const alta = [99, 'Pibe <script>Fase88', 'DC', 19, 'ARG', 'Boca Juniors', 'Liga ARG', 60];
    return { cambio, tras, baja: [baja[1], baja[5]], alta, nCambio: cambio[1], nTras: otro[1], nBaja: baja[1] };
  });
  const parche = JSON.stringify({ formato: 'dt-base', version: 1, nombre: 'Parche de prueba', modo: 'parche', jugadores: [datos.cambio, datos.tras, datos.alta, [1, 'Xavi Prueba', 'ZZ', 22, 'ARG', 'Boca Juniors', 'Liga ARG', 1]], bajas: [datos.baja], dts: [['DT Fase88', 50, 'ARG', 'Boca Juniors', 'Liga ARG']] });
  await pg.evaluate(() => baseModal());
  const pv = await pg.evaluate(t => { const r = basePrevia(t); return { rep: r && r.rep, ap: r && r.aplicable, txt: document.getElementById('baseMsg').textContent, n: PLAYERS_DB.length }; }, parche);
  chk('la vista previa cuenta 1 alta · 1 cambio · 1 cambio de club · 1 baja', pv.rep && pv.rep.altas === 1 && pv.rep.cambios === 1 && pv.rep.traspasos === 1 && pv.rep.bajas === 1, JSON.stringify(pv.rep));
  chk('…y avisa la fila descartada', /descartadas: 1 puesto/.test(pv.txt));
  chk('la vista previa NO toca la base', pv.n === N0);
  const vis = await pg.evaluate(() => { const ov = document.getElementById('baseOv'); const r = ov.getBoundingClientRect(); return getComputedStyle(ov).display !== 'none' && document.elementFromPoint(r.width / 2, r.height / 2).closest('#baseOv') !== null; });
  chk('el modal se ve encima de la pantalla de inicio', vis);
  await pg.evaluate(() => baseConfirmar());
  await recarga();
  const r1 = await pg.evaluate(d => {
    const f = n => PLAYERS_DB.filter(r => r[1] === n);
    return {
      est: _baseCom.estado, n: PLAYERS_DB.length, meta: baseMeta(),
      cambio: f(d.nCambio).map(r => r[7]), tras: f(d.nTras).map(r => r[5]), baja: PLAYERS_DB.filter(r => r[1] === d.nBaja && r[5] === 'Boca Juniors').length,
      alta: PLAYERS_DB.filter(r => /Pibe/.test(r[1]) && /Fase88/.test(r[1])).map(r => r[1]),
      dt: DTS_DB.some(t => t[0] === 'DT Fase88'), ref: _PDB_ACTUAL === null || _PDB_ACTUAL === window.PLAYERS_DB,
    };
  }, datos);
  chk('al recargar, la base importada entra sola', r1.est === 'lista' && r1.meta && r1.meta.nombre === 'Parche de prueba');
  chk('el cambio de valor quedó', r1.cambio.includes(77), r1.cambio.join(','));
  chk('el cambio de club se movió en vez de duplicarse', r1.tras.length === 1 && r1.tras[0] === 'Boca Juniors', r1.tras.join(','));
  chk('la baja se fue y el alta entró, con el nombre limpio', r1.baja === 0 && r1.alta.length === 1 && !/[<>]/.test(r1.alta[0]), r1.alta[0]);
  chk('el largo cuadra: +1 alta −1 baja', r1.n === N0);
  chk('el DT nuevo entró', r1.dt);
  chk('la base se cambió en el mismo array (esHistorica no se rompe)', r1.ref);

  // ─── se juega con ella ───
  const juego = await pg.evaluate(() => {
    localStorage.setItem('dt_fondo3d', '0');
    document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('Liga ARG'); setModo('pres'); startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const pibe = G.squad.find(p => /Pibe/.test(p.name) && /Fase88/.test(p.name));
    saveGame(); const t = G.teamName;
    return { pibe: !!pibe, rat: pibe && pibe.rat, t, hist: esHistorica() };
  });
  chk('Boca arranca con el pibe del parche en el plantel', juego.pibe, 'media ' + juego.rat);
  chk('esHistorica() sigue dando false con la base importada', juego.hist === false);
  await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(300); await listo();
  const carga = await pg.evaluate(() => { const ok = loadGame(); return { ok, pibe: G && G.squad.some(p => /Fase88/.test(p.name)) }; });
  chk('la partida guardada con la base importada carga después de recargar', carga.ok && carga.pibe);

  // ─── una base completa sin ligas jugables no se aplica ───
  const chica = JSON.stringify({ formato: 'dt-base', version: 1, nombre: 'Chica', modo: 'reemplazar', jugadores: Array.from({ length: 40 }, (_, i) => [i + 1, 'Jugador ' + i, 'MC', 25, 'ARG', 'Club ' + (i % 3), 'Liga Inventada', 1]) });
  const ch = await pg.evaluate(t => { document.getElementById('teamSelect').style.display = 'flex'; baseModal(); const r = basePrevia(t); return { ap: r && r.aplicable, txt: document.getElementById('baseMsg').textContent, boton: /Aplicar/.test(document.getElementById('baseMsg').innerHTML) }; }, chica);
  chk('una base sin ninguna liga jugable se frena antes de guardar', ch.ap === false && !ch.boton && /ninguna liga jugable/.test(ch.txt));

  // ─── desde una URL ───
  await pg.route('https://bases.example/parche.json', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ formato: 'dt-base', version: 1, nombre: 'Por URL', modo: 'parche', jugadores: [[7, 'Llegó Por URL', 'EI', 24, 'URU', 'River Plate', 'Liga ARG', 9]] }) }));
  await pg.route('https://bases.example/no.json', route => route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'no' }));
  const u = await pg.evaluate(async () => {
    const msg = () => document.getElementById('baseMsg').textContent;
    document.getElementById('baseUrl').value = 'ftp://x'; baseImportarUrl(); const m0 = msg();
    document.getElementById('baseUrl').value = 'https://bases.example/no.json'; baseImportarUrl();
    for (let i = 0; i < 40 && /Bajando/.test(msg()); i++) await new Promise(r => setTimeout(r, 50)); const m404 = msg();
    document.getElementById('baseUrl').value = 'https://bases.example/parche.json'; baseImportarUrl();
    for (let i = 0; i < 40 && !/Por URL/.test(msg()); i++) await new Promise(r => setTimeout(r, 50));
    return { m0, m404, m: msg(), pend: _baseCom.pend && _baseCom.pend.nombre };
  });
  chk('una dirección que no es http(s) se rechaza', /https/.test(u.m0));
  chk('un 404 se dice, no se rompe nada', /404/.test(u.m404), u.m404.slice(0, 60));
  chk('la URL baja, valida y muestra la vista previa', u.pend === 'Por URL' && /1 altas/.test(u.m));
  await pg.evaluate(() => baseConfirmar()); await recarga();
  const r2 = await pg.evaluate(() => ({ meta: baseMeta(), L: _baseCom.imports.map(x => x.nombre), url: PLAYERS_DB.some(r => r[1] === 'Llegó Por URL'), pibe: PLAYERS_DB.some(r => /Fase88/.test(r[1])) }));
  chk('los parches se apilan en orden', r2.L.join('|') === 'Parche de prueba|Por URL' && r2.url && r2.pibe, r2.L.join(' + '));

  // ─── el modal en el celular ───
  await pg.setViewportSize({ width: 360, height: 740 });
  const mob = await pg.evaluate(() => { baseModal(); const m = document.getElementById('baseBody'); return { w: m.scrollWidth, cw: document.documentElement.clientWidth, chica: [...m.querySelectorAll('*')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10).length }; });
  chk('a 360 px el modal no se sale y no hay letra de menos de 10 px', mob.w <= mob.cw && mob.chica === 0, mob.w + ' de ' + mob.cw);
  await pg.setViewportSize({ width: 1280, height: 800 });

  // ─── volver a la original ───
  await pg.evaluate(() => baseVolverOriginal()); await recarga();
  const r3 = await pg.evaluate(() => ({ n: PLAYERS_DB.length, meta: baseMeta(), est: _baseCom.estado, fase: PLAYERS_DB.some(r => /Fase88|Por URL/.test(r[1])), dt: DTS_DB.some(t => t[0] === 'DT Fase88') }));
  chk('↩️ deja la base original exacta', r3.n === N0 && !r3.fase && !r3.dt && r3.meta === null && r3.est === 'nada', r3.n + ' jugadores');
  const carga2 = await pg.evaluate(() => { const ok = loadGame(); return { ok, t: G && G.teamName }; });
  chk('la partida hecha con la base importada igual carga con la original', carga2.ok, carga2.t);

  // ─── si IndexedDB falla ───
  await pg.evaluate(() => { localStorage.setItem(BASE_META, JSON.stringify({ nombre: 'fantasma' })); });
  await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(300); await listo();
  const r4 = await pg.evaluate(() => ({ meta: baseMeta(), n: PLAYERS_DB.length, est: _baseCom.estado }));
  chk('una ficha sin base en IndexedDB se limpia sola y se juega con la original', r4.meta === null && r4.n === N0 && r4.est === 'nada');

  chk('lo único que salió a la red fue la URL que se pidió', red.every(u => /bases\.example/.test(u)), red.length + ' pedidos');
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
