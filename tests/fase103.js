// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 103: las valoraciones de cada año
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase103.js
//
// El reporte: "año 2014, Enzo Pérez tiene mejor valoración que Messi".
// Qué blinda:
//  1. Los históricos no traen más el TRASPASO como valor: no queda ningún
//     tramo de 2+ temporadas contiguas con el mismo valor de €5M+ sin marcar,
//     Cristiano no vale 94 de 2009 a 2017 y lo reparado guarda el traspaso.
//  2. La herramienta es idempotente: correrla sobre los archivos del repo da
//     exactamente los mismos archivos (lo commiteado ES su salida).
//  3. El Worker separa valor de mercado y traspaso; el extractor guarda el
//     traspaso en r[19] y la tasación de otro año no lo borra.
//  4. PERF_ADJ sólo en la base de hoy y para el de 28+.
//  5. La curva de edad no salta más de un punto entre dos años; el arquero
//     envejece tres años más tarde; ratToVal sigue siendo la inversa.
//  6. 2014: Messi 91 y arriba de Enzo Pérez; a igual media el mercado ordena
//     por valor; la ficha dice "Llegó al club por".
//  7. 2026 casi no se movió. 0 funciones en G, 0 errores.
const path = require('path'), fs = require('fs'), vm = require('vm'), os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const F = 'file://' + path.join(ROOT, 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  console.log('\n═══ LOS ARCHIVOS HISTÓRICOS ═══');
  const H = {};
  for (let y = 2000; y <= 2025; y++) {
    const f = path.join(ROOT, `players-hist-${y}.js`); if (!fs.existsSync(f)) continue;
    const c = { window: {} }; vm.createContext(c); vm.runInContext(fs.readFileSync(f, 'utf8'), c);
    H[y] = c.window.PLAYERS_DB_HIST[y];
  }
  const anios = Object.keys(H).map(Number);
  chk('están las temporadas', anios.length >= 20, anios.length + ' archivos');
  // tramos contiguos con el mismo valor ≥5M, sin la marca de reconstruido
  // el mismo jugador = nombre + año de nacimiento ±1 (la edad de TM salta),
  // igual que la herramienta
  const porNom = {};
  for (const y of anios) H[y].forEach(r => (porNom[r[1]] = porNom[r[1]] || []).push({ y, r, b: y - r[3] }));
  const tram = {};
  for (const n in porNom) {
    const gr = []; for (const e of porNom[n].sort((a, b) => a.b - b.b)) { const g = gr.find(g => Math.abs(g.b - e.b) <= 1); if (g) g.f.push(e); else gr.push({ b: e.b, f: [e] }); }
    gr.forEach((g, gi) => g.f.forEach(e => { const k = n + '|' + g.b + '|' + e.r[5]; (tram[k] = tram[k] || []).push(e); }));
  }
  // (un valor de mercado de verdad PUEDE repetirse dos años dentro de un tramo
  // que varía: Palermo en Boca. Lo que no puede quedar es un tramo ENTERO igual)
  let sinMarcar = 0, ej = '';
  for (const k in tram) {
    const f = tram[k].sort((a, b) => a.y - b.y); const runs = [];
    for (const e of f) { const u = runs[runs.length - 1]; if (u && e.y - u[u.length - 1].y <= 2) u.push(e); else runs.push([e]); }
    for (const run of runs) {
      if (run.length < 2 || run.some(e => e.r[20] === 1 || e.r[20] === 2 || e.r[19] > 0)) continue;
      const tas = run.filter(e => e.r[7] > 0.1);
      if (tas.length >= 2 && tas[0].r[7] >= 5 && tas.every(e => e.r[7] === tas[0].r[7])) { sinMarcar++; if (!ej) ej = k + ' ' + tas[0].r[7]; }
    }
  }
  chk('ningún tramo entero con el mismo valor de €5M+ sin marcar', sinMarcar === 0, sinMarcar + (ej ? ' ej. ' + ej : ''));
  const cr = anios.filter(y => y >= 2009 && y <= 2017).map(y => (H[y].find(r => r[1] === 'Cristiano Ronaldo' && r[5] === 'Real Madrid') || [])[7]);
  chk('Cristiano en el Madrid ya no vale 94 todos los años', new Set(cr).size >= 5 && !cr.every(v => v === 94), cr.join(' · '));
  const rec = []; for (const y of anios) H[y].forEach(r => { if (r[20] === 1 || r[20] === 2) rec.push(r); });
  chk('lo reconstruido guarda el traspaso en r[19]', rec.length > 1000 && rec.every(r => r[19] > 0), rec.length + ' filas');
  chk('el traspaso del futuro queda sin tasar', rec.filter(r => r[20] === 2).every(r => r[7] <= 0.1));
  const ne = (H[2008] || []).find(r => r[1] === 'Pavel Nedved');
  chk('Nedved a los 36 ya no vale los €45M que pagó la Juve en 2001', ne && ne[7] < 10 && ne[19] === 45, ne && ne[7] + 'M');
  const pg2010 = (H[2010] || []).find(r => r[1] === 'Paul Pogba' && r[5] === 'Man Utd');
  chk('Pogba 2010 no trae los €105M de 2016', pg2010 && pg2010[7] <= 0.1 && pg2010[20] === 2, pg2010 && JSON.stringify(pg2010.slice(17)));

  console.log('\n═══ LA HERRAMIENTA ES IDEMPOTENTE ═══');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hv103-'));
  for (const y of anios) fs.copyFileSync(path.join(ROOT, `players-hist-${y}.js`), path.join(tmp, `players-hist-${y}.js`));
  const out = execFileSync('node', ['--max-old-space-size=6144', path.join(ROOT, 'tools/hist-valores.js'), '--dir=' + tmp, '--escribir'], { encoding: 'utf8' });
  const dif = anios.filter(y => fs.readFileSync(path.join(tmp, `players-hist-${y}.js`), 'utf8') !== fs.readFileSync(path.join(ROOT, `players-hist-${y}.js`), 'utf8'));
  chk('correrla sobre lo commiteado da lo mismo', dif.length === 0, dif.length ? 'difieren: ' + dif.join(',') : out.split('\n')[0].slice(0, 110));
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('\n═══ WORKER Y EXTRACTOR ═══');
  const wfull = fs.readFileSync(path.join(ROOT, 'cloudflare-worker/sportdb-cache.js'), 'utf8');
  const wsrc = wfull.replace(/export default \{[\s\S]*?\n\};\n/, '');
  const parseKader = new Function(wsrc + ';return parseKader;')();
  const fila = (nom, tit, mv) => `<tr class="odd"><td><a href="/x/profil/spieler/1">${nom}</a></td><td>Feb 5, 1985 (29)</td><td>Jul 1, 2009</td><td><a ${tit ? `title="${tit}"` : ''} href="/c/startseite/verein/9"><img></a></td><td class="rechts hauptlink">${mv ? `<a href="/x/marktwertverlauf/spieler/1">${mv}</a>` : '-'}</td></tr>`;
  const pk = parseKader('<table>' + fila('Cristiano', 'Manchester United: Ablöse €94.00m', '€120.00m') + fila('Messi', 'FC Barcelona B', '€120.00m')
    + fila('Pibe', 'Club X: Ablöse €2,50 mill.', '') + fila('Otro', 'Club Y: Leihgebühr €500 Tsd.', '€3,50 mill.') + '</table>', 2014).players;
  chk('el valor es la celda, no el traspaso', pk[0].value === 120 && pk[0].fee === 94, pk[0].value + ' / ' + pk[0].fee);
  chk('sin traspaso: valor tal cual y traspaso 0', pk[1].value === 120 && pk[1].fee === 0);
  chk('sin valor de mercado: valor 0, el traspaso aparte', pk[2].value === 0 && pk[2].fee === 2.5);
  chk('las unidades del .es y del .de', pk[3].value === 3.5 && pk[3].fee === 0.5);
  chk('el caché de planteles lleva la versión del parser', /`\$\{api\}:\$\{KADER_PARSER\}:/.test(wfull) && /valorDeMercado:\s*true/.test(wfull));
  const ex = fs.readFileSync(path.join(ROOT, 'extractor.html'), 'utf8');
  const i0 = ex.indexOf('function histRefValores('), i1 = ex.indexOf('// 🧮 sobre los archivos', i0);
  const histRefValores = new Function(ex.slice(i0, i1) + ';return histRefValores;')();
  const fl = (n, edad, v, fee) => { const r = [9, n, 'DC', edad, 'ARG', 'A', 'Liga ARG', v, 'der', 0, 180, '', 0, 0, 0, 0, '']; if (fee) r.push(0, 0, fee); return r; };
  const HH = { 2000: [fl('Crack', 23, 0.1, 7), fl('Real', 25, 3, 12)], 2001: [fl('Crack', 24, 4)] };
  histRefValores(HH); histRefValores(HH);
  chk('la tasación de otro año no borra el traspaso', HH[2000][0][19] === 7 && HH[2000][0][17] === 4 && HH[2000][1][19] === 12, JSON.stringify(HH[2000][0].slice(17)));
  chk('el extractor avisa si el Worker no separa el valor', /valorDeMercado/.test(ex) && /if \(p\.fee > 0\) fila\.push\(0, 0, p\.fee\)/.test(ex));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ LA CUENTA ═══');
  const cu = await pg.evaluate(async () => {
    const saltos = []; for (let a = 15; a < 42; a++) saltos.push(Math.abs(ageAdj(a + 1) - ageAdj(a)));
    const ida = []; for (const pos of ['ARQ', 'DFC', 'MC', 'DC']) for (const age of [19, 24, 29, 33, 36]) for (const v of [0.5, 3, 20, 80]) {
      const r = valToRat(v, age, pos, 2026); if (r <= 55 || r >= 91) continue;
      ida.push(Math.abs(valToRat(ratToVal(r, age, pos, 2026), age, pos, 2026) - r));
    }
    aplicarTemporada(2026);
    const p26 = [perfAdj('Enzo Pérez', 40), perfAdj('Enzo Pérez', 24), perfAdj('Nadie', 33)];
    await new Promise(res => cargarTemporada(2014, res)); aplicarTemporada(2014);
    const p14 = perfAdj('Enzo Pérez', 29);
    return { saltos: Math.max(...saltos), arq: [ageAdjPos(35, 'ARQ'), ageAdj(32), ageAdjPos(22, 'ARQ'), ageAdj(22)], ida: Math.max(...ida), p26, p14,
      extremos: [ageAdj(16), ageAdj(17), ageAdj(27), ageAdj(36), ageAdj(40)] };
  });
  chk('la curva de edad no salta más de un punto', cu.saltos <= 1, 'máximo ' + cu.saltos);
  chk('mismas puntas que el Excel (−5 a los 17, +8 desde los 36)', cu.extremos.join() === '-5,-5,1,8,8', cu.extremos.join(' '));
  chk('el arquero de 35 envejece como uno de campo de 32', cu.arq[0] === cu.arq[1] && cu.arq[2] === cu.arq[3], cu.arq.join(' '));
  chk('ratToVal sigue siendo la inversa (±1)', cu.ida <= 1, 'peor ' + cu.ida);
  chk('PERF_ADJ en 2026 para el veterano', cu.p26[0] === 5 && cu.p26[1] === 0 && cu.p26[2] === 0, cu.p26.join(' '));
  chk('PERF_ADJ no existe en 2014', cu.p14 === 0, cu.p14);

  console.log('\n═══ VALENCIA 2014 ═══');
  const va = await pg.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0');
    await new Promise(res => cargarTemporada(2014, res)); aplicarTemporada(2014);
    setLigaSel('España'); const id = Object.keys(TEAMS).find(k => TEAMS[k].name === 'Valencia');
    startGame(id); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const enzo = G.squad.find(p => p.name === 'Enzo Pérez') || {};
    const messi = G.market.find(p => p.name === 'Lionel Messi') || {};
    const top91 = G.market.filter(p => p.rat >= 91).length;
    // el mercado ordenado por media: a igual media, primero el que más vale
    let orden = [];
    try {
      gTab('mkt');
      const s = document.getElementById('mkSort'); if (s) { s.value = 'rat'; }
      ['mkLg', 'mkNat', 'mkTeam'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
      renderMkt();
      orden = [...document.querySelectorAll('#mkList .mkrow')].slice(0, 40).map(el => (el.getAttribute('onclick').match(/openP\('([^']+)'/) || [])[1]);
    } catch (e) { orden = ['ERR ' + e.message]; }
    const ordP = orden.map(i => G.market.find(p => p.id === i)).filter(p => p && isKnown(p) && p.rat >= 90);
    let ficha = '';
    try { openP(enzo.id, true); ficha = document.getElementById('modOv').innerText; closeMod(); } catch (e) { ficha = 'ERR ' + e.message; }
    // si se muda, el traspaso a SU club viejo deja de mostrarse
    let fichaOtro = '';
    try { const c0 = enzo.club; enzo.club = 'Otro Club'; openP(enzo.id, true); fichaOtro = document.getElementById('modOv').innerText; closeMod(); enzo.club = c0; } catch (e) { fichaOtro = 'ERR ' + e.message; }
    saveGame(); const eid = enzo.id; G = null; loadGame();
    const enzo2 = G.squad.find(p => p.id === eid) || {};
    const fns = []; (function scan(o, d) { if (!o || d > 6) return; for (const k in o) { if (typeof o[k] === 'function') fns.push(k); else if (typeof o[k] === 'object') scan(o[k], d + 1); } })(G, 0);
    return { enzo: { rat: enzo.rat, val: enzo.val, tr: enzo.traspaso, rec: enzo.valRec }, messi: { rat: messi.rat, val: messi.val, conocido: isKnown(messi) },
      top91, ord: ordP.map(p => p.name + ' ' + p.rat + '/' + p.val), ordOk: ordP.every((p, i) => i === 0 || p.rat < ordP[i - 1].rat || (p.rat === ordP[i - 1].rat && p.val <= ordP[i - 1].val)),
      ficha, fichaOtro, enzo2: { tr: enzo2.traspaso, rec: enzo2.valRec }, fns: fns.length };
  });
  chk('Messi es 91 y lo ve el Valencia (misma liga)', va.messi.rat === 91 && va.messi.conocido, va.messi.rat + ' · €' + va.messi.val + 'M');
  chk('Enzo Pérez queda claramente abajo de Messi', va.enzo.rat <= 87 && va.enzo.rat < va.messi.rat, va.enzo.rat + ' · €' + va.enzo.val + 'M (llegó por €' + va.enzo.tr + 'M)');
  chk('en 91 hay pocos, no un amontonamiento', va.top91 <= 14, va.top91);
  chk('el mercado por media ordena por valor a igual media', va.ordOk && va.ord.length >= 3, va.ord.slice(0, 5).join(' | '));
  chk('la ficha dice "Valor estimado" y "Llegó al club por"', /valor estimado/i.test(va.ficha) && /Llegó al club por/.test(va.ficha), (va.ficha.match(/Llegó al club por[^.]*\./) || [''])[0]);
  chk('si se muda de club, ya no dice "Llegó al club por"', !/Llegó al club por/.test(va.fichaOtro) && !/ERR/.test(va.fichaOtro));
  chk('el traspaso sobrevive al guardado', va.enzo2.tr === va.enzo.tr && va.enzo2.rec === 1);
  chk('0 funciones en G', va.fns === 0, va.fns);

  console.log('\n═══ 2026 CASI NO SE MOVIÓ ═══');
  const h = await pg.evaluate(() => {
    aplicarTemporada(2026);
    const R = PLAYERS_DB.map(r => Math.min(91, Math.max(55, valToRat(valDeFila(r), r[3], r[2]) + perfAdj(r[1], r[3])))).sort((a, b) => a - b);
    const top = PLAYERS_DB.map(r => [r[1], valToRat(valDeFila(r), r[3], r[2])]).filter(x => x[1] >= 91).map(x => x[0]);
    return { med: R[R.length >> 1], n88: R.filter(x => x >= 88).length, n91: R.filter(x => x >= 91).length, top };
  });
  chk('mediana 66', h.med === 66, h.med);
  chk('88 o más: entre 55 y 80 (antes 71)', h.n88 >= 55 && h.n88 <= 80, h.n88);
  chk('Haaland y Mbappé siguen en 91', h.top.includes('Erling Haaland') && h.top.includes('Kylian Mbappé'), h.n91 + ' en 91');
  chk('0 errores de página', errs.length === 0, errs.slice(0, 2).join(' | '));

  await b.close();
  console.log(`\n${ok} ok · ${fail} fallas`);
  process.exit(fail ? 1 : 0);
})();
