// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 74: el plantel histórico se corta por puesto, y el
// jugador que Transfermarkt no tasó recibe su tasación de otro año
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase74.js
//
// Qué blinda (el reporte: "en el Boca del 2000 faltan Palermo y Riquelme"):
//  1. Boca 2000 arranca con Riquelme, Palermo y Delgado, y el once los usa.
//  2. El corte a 30 respeta las líneas: 3 arqueros como mucho y los mínimos.
//  3. Un precio REAL de TM no se toca nunca; sin columnas nuevas, r[7] tal cual.
//  4. La tasación futura de un pibe vale menos que la de un consagrado.
//  5. Los que quedaron afuera del tope no están a la venta en tu propio club.
//  6. El extractor no mezcla homónimos y volver a correrlo no acumula.
//  7. La ficha dice "Valor estimado"; valRef sobrevive al guardado.
//  8. 2026 no se movió: 0 valores estimados. 0 funciones en G, 0 errores.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  // ── El extractor, en node, con la función real (no una copia) ──
  console.log('\n═══ EXTRACTOR ═══');
  const ex = fs.readFileSync(path.resolve(__dirname, '..', 'extractor.html'), 'utf8');
  const i0 = ex.indexOf('function histRefValores('), i1 = ex.indexOf('// 🧮 sobre los archivos', i0);
  const histRefValores = new Function(ex.slice(i0, i1) + ';return histRefValores;')();
  const fila = (n, club, edad, v) => [9, n, 'DC', edad, 'ARG', club, 'Liga ARG', v, 'der', 0, 180, '', 0, 0, 0, 0, ''];
  const H = {
    2000: [fila('Crack', 'A', 23, 0.1), fila('Homonimo', 'A', 19, 0.1), fila('Tasado', 'A', 27, 2), fila('Nadie', 'A', 18, 0.1)],
    2002: [fila('Crack', 'B', 25, 11), fila('Homonimo', 'C', 35, 6), fila('Tasado', 'A', 29, 3)],
  };
  const r1 = histRefValores(H);
  const crack = H[2000][0], homo = H[2000][1], tas = H[2000][2], nadie = H[2000][3];
  chk('el sin tasar recibe la tasación del año vecino', crack[17] === 11 && crack[18] === 2002, JSON.stringify(crack.slice(17)));
  chk('un homónimo de otra edad no cuenta', !homo[17], 'edad 19 vs 35 dos años después');
  chk('un precio real no se toca', tas[7] === 2 && tas.length === 17);
  chk('el que nunca fue tasado queda sin referencia', !nadie[17]);
  histRefValores(H);
  chk('volver a correrlo no acumula columnas', crack.length === 19 && r1.conRef === 1, 'largo ' + crack.length);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ VALOR DE LA FILA ═══');
  const vf = await pg.evaluate(() => {
    const base = [9, 'X', 'DC', 27, 'ARG', 'C', 'Liga ARG', 0.1, 'der', 0, 180, '', 0, 0, 0, 0, ''];
    return {
      sinCols: valDeFila(base, 2000),
      real: valDeFila([...base.slice(0, 7), 3.5, ...base.slice(8), 9, 2002], 2000),
      vet: valDeFila([...base, 9, 2002], 2000),
      pibe: valDeFila([...base.slice(0, 3), 18, ...base.slice(4), 9, 2002], 2000),
      mismo: valDeFila([...base, 7.6, 2000], 2000),
      g26: (() => { aplicarTemporada(2026); return PLAYERS_DB.filter(r => valDeFila(r) !== r[7]).length; })(),
    };
  });
  chk('sin columnas nuevas devuelve r[7]', vf.sinCols === 0.1);
  chk('un precio real gana siempre', vf.real === 3.5);
  chk('mismo año en otro club: el valor tal cual', vf.mismo === 7.6);
  chk('la tasación futura del pibe vale menos que la del consagrado', vf.pibe < vf.vet && vf.pibe >= 0.1, vf.pibe + ' vs ' + vf.vet);
  chk('2026 no tiene ni un valor estimado', vf.g26 === 0, vf.g26);

  console.log('\n═══ BOCA 2000 ═══');
  const bo = await pg.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0');
    await new Promise(res => cargarTemporada(2000, res));
    aplicarTemporada(2000);
    document.getElementById('teamSelect').style.display = 'none';
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const nombres = G.squad.map(p => p.name);
    const xi = Object.values(G.slots || {}).map(id => (G.squad.find(p => p.id === id) || {}).name);
    const lin = { ARQ: 0, DEF: 0, MED: 0, DEL: 0 }; G.squad.forEach(p => lin[pgr(p.pos)]++);
    const rq = G.squad.find(p => p.name === 'Juan Román Riquelme') || {};
    const meds = G.squad.map(p => p.rat).sort((a, c) => a - c);
    const propios = G.market.filter(p => p.club === G.teamName).length;
    // la ficha
    let ficha = '';
    try { openP(rq.id, true); ficha = document.getElementById('modOv').innerText; } catch (e) { ficha = 'ERR ' + e.message; }
    try { closeMod(); } catch (e) {}
    saveGame(); const id = rq.id; G = null; loadGame();
    const rq2 = G.squad.find(p => p.id === id) || {};
    const fns = []; (function scan(o, d) { if (!o || d > 6) return; for (const k in o) { if (typeof o[k] === 'function') fns.push(k); else if (typeof o[k] === 'object') scan(o[k], d + 1); } })(G, 0);
    return { n: G.squad.length, nombres, xi, lin, rq: { rat: rq.rat, val: rq.val, ref: rq.valRef }, med: meds[meds.length >> 1], propios, ficha, ref2: rq2.valRef, fns: fns.length };
  });
  for (const n of ['Juan Román Riquelme', 'Martín Palermo', 'Marcelo Delgado'])
    chk(n + ' está en el plantel', bo.nombres.includes(n));
  chk('Riquelme y Palermo son titulares', bo.xi.includes('Juan Román Riquelme') && bo.xi.includes('Martín Palermo'), bo.xi.join(', '));
  chk('Riquelme rinde arriba de la mediana del plantel', bo.rq.rat > bo.med + 8, bo.rq.rat + ' vs ' + bo.med + ' (~€' + bo.rq.val + 'M por su tasación de ' + bo.rq.ref + ')');
  chk('plantel de 30', bo.n === 30, bo.n);
  chk('las líneas: ≤3 arqueros y los mínimos', bo.lin.ARQ <= 3 && bo.lin.ARQ >= 2 && bo.lin.DEF >= 9 && bo.lin.MED >= 9 && bo.lin.DEL >= 5, JSON.stringify(bo.lin));
  chk('nadie de tu club a la venta en el mercado', bo.propios === 0, bo.propios);
  chk('valRef sobrevive al guardado', bo.ref2 === bo.rq.ref && !!bo.ref2, bo.ref2);
  chk('0 funciones en G', bo.fns === 0, bo.fns);

  chk('la ficha de Riquelme dice "Valor estimado"', /valor estimado/i.test(bo.ficha) && /tasación de 2002/.test(bo.ficha), bo.ficha.slice(0, 80).replace(/\s+/g, ' '));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
