// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 110: la lista para DLS (a quién buscar y a quién crear)
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase110.js
//
// Qué blinda:
//  1. Nombre y apellido por separado (con las partículas: Di María, van der Sar)
//     y una sigla de DLS para cada puesto del juego.
//  2. La estimación sale de los planteles de 2018: el que no jugaba en primera
//     se crea, el que jugaba en Europa se busca, el de otra liga probablemente
//     se crea. Sin la temporada cargada, dice que no sabe (no inventa).
//  3. Las casillas se guardan en el navegador por CLUB: sobreviven a otra
//     carrera con el mismo club, no se mezclan con otro club, y un fichaje
//     nuevo aparece pendiente. No se escribe nada en G.
//  4. Se abre desde el Plantel y desde la planilla, entra en un celular y no
//     pide nada por red.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const red = []; pg.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) red.push(u); });
  await pg.addInitScript(() => { try { if (!sessionStorage.getItem('_f110')) { localStorage.clear(); sessionStorage.setItem('_f110', '1'); } localStorage.setItem('dt_fondo3d', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' });
  await pg.waitForTimeout(400);

  console.log('\n═══ NOMBRE, APELLIDO Y SIGLAS ═══');
  const nm = await pg.evaluate(() => [dlsNombre('Ángel Di María'), dlsNombre('Edwin van der Sar'), dlsNombre('Rodrygo'), dlsNombre('Juan Carlos Portillo'), dlsNombre('Kevin De Bruyne'), dlsNombre('Leandro Paredes')]);
  chk('Di María y De Bruyne llevan la partícula en el apellido', nm[0].n === 'Ángel' && nm[0].a === 'Di María' && nm[4].a === 'De Bruyne', JSON.stringify([nm[0], nm[4]]));
  chk('van der Sar: las dos partículas', nm[1].n === 'Edwin' && nm[1].a === 'van der Sar');
  chk('una sola palabra va al apellido', nm[2].n === '' && nm[2].a === 'Rodrygo');
  chk('dos nombres de pila quedan en el nombre', nm[3].n === 'Juan Carlos' && nm[3].a === 'Portillo' && nm[5].n === 'Leandro' && nm[5].a === 'Paredes');
  await pg.evaluate(() => { document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } });
  const pos = await pg.evaluate(() => { const s = new Set(); G.squad.concat(G.market).forEach(p => s.add(p.pos)); return [...s].filter(x => !DLS_POS[x]); });
  chk('todos los puestos del juego tienen sigla de DLS', pos.length === 0, pos.join(',') || 'ninguno sin sigla');
  const siglas = await pg.evaluate(() => [...new Set(Object.values(DLS_POS))].sort().join(','));
  chk('las siglas son las de las tarjetas de DLS 19', siglas === 'CN,DC,EX,LD,LI,MC,MD,MI,MO,PO', siglas);

  console.log('\n═══ LA ESTIMACIÓN ═══');
  const sinAnio = await pg.evaluate(() => dlsEstima(G.squad[0]).k);
  chk('sin la temporada 2018 cargada no inventa', sinAnio === '?', sinAnio);
  // se abre desde el Plantel: carga 2018 a demanda
  await pg.evaluate(() => gTab('sq'));
  await pg.waitForTimeout(200);
  chk('el botón está en el Plantel', await pg.$eval('#btnDls', e => !!e.offsetParent));
  await pg.click('#btnDls');
  await pg.waitForFunction(() => document.querySelectorAll('#modOv .dls-f').length > 0, null, { timeout: 15000 });
  const est = await pg.evaluate(() => {
    const by = n => { const p = G.squad.find(q => q.name === n); return p ? dlsEstima(p) : null; };
    const all = G.squad.map(p => dlsEstima(p).k);
    const c = k => all.filter(x => x === k).length;
    return { paredes: by('Leandro Paredes'), brey: by('Leandro Brey'), marchesin: by('Agustín Marchesín'), crear: c('crear'), buscar: c('buscar'), quizas: c('quizas'), q: c('?'), n: all.length,
      filas: document.querySelectorAll('#modOv .dls-f').length };
  });
  chk('Paredes: buscalo (en 2018 jugaba en el PSG)', est.paredes && est.paredes.k === 'buscar' && /PSG/.test(est.paredes.club), JSON.stringify(est.paredes));
  chk('Brey: crealo (en 2018 no jugaba en primera)', est.brey && est.brey.k === 'crear', JSON.stringify(est.brey));
  chk('Marchesín: probablemente crearlo (en 2018, Liga MX)', est.marchesin && est.marchesin.k === 'quizas', JSON.stringify(est.marchesin));
  chk('el plantel entero queda clasificado, sin "no sé"', est.q === 0 && est.crear + est.buscar + est.quizas === est.n, `crear ${est.crear} · buscar ${est.buscar} · probablemente ${est.quizas}`);
  chk('al arrancar aparecen todos como pendientes', est.filas === est.n, est.filas + ' de ' + est.n);
  const orden = await pg.evaluate(() => { const f = dlsDatos(); const p = { crear: 0, quizas: 1, buscar: 2 }; for (let i = 1; i < f.length; i++) if (!f[i].hecho && !f[i - 1].hecho && p[f[i].e.k] < p[f[i - 1].e.k]) return false; return true; });
  chk('primero los que hay que crear, después los de buscar', orden);
  const hdr = await pg.$eval('#modOv', e => e.textContent);
  chk('el encabezado cuenta para crear, para buscar y listos', /Para crear: \d+/.test(hdr) && /Para buscar: \d+/.test(hdr) && /Listos: 0 de \d+/.test(hdr));
  chk('cada fila trae sigla, dorsal, pie, país y media', await pg.evaluate(() => { const t = document.querySelector('#modOv .dls-f .dls-d').textContent; return /(PO|LD|LI|CN|MC|MO|MI|MD|EX|DC)/.test(t) && /#/.test(t) && /pie [DIA]/.test(t) && /media \d+/.test(t); }));
  chk('el país sale con nombre, no con el código', await pg.evaluate(() => { const p = G.squad.find(q => q.nat === 'ARG'); return dlsFila(p, { k: 'crear' }, false).pais === 'Argentina'; }));

  console.log('\n═══ LAS CASILLAS ═══');
  const idP = await pg.evaluate(() => G.squad.find(q => q.name === 'Leandro Paredes').id);
  await pg.click(`#modOv .dls-ck[onclick="dlsMarcar('${idP}')"]`);
  await pg.waitForTimeout(100);
  const m1 = await pg.evaluate(() => ({ filas: document.querySelectorAll('#modOv .dls-f').length, n: G.squad.length, ls: JSON.parse(localStorage.getItem('dt_dls_creados') || '{}'), txt: window._dlsTxt }));
  chk('tachado, desaparece de "lo que falta"', m1.filas === m1.n - 1, m1.filas + ' filas');
  chk('se guarda por club en el navegador', (m1.ls['Boca Juniors'] || []).includes('leandro paredes'), JSON.stringify(m1.ls));
  chk('la lista para copiar no lo trae', !/Paredes/.test(m1.txt) && /\[CREAR\]/.test(m1.txt) && /\[BUSCAR\]/.test(m1.txt));
  await pg.evaluate(() => { _dls.solo = false; dlsRender(); });
  chk('"Todos" lo muestra tachado', await pg.evaluate(() => document.querySelectorAll('#modOv .dls-f.hecho').length === 1 && document.querySelectorAll('#modOv .dls-f').length === G.squad.length));
  await pg.evaluate(id => dlsMarcar(id), idP);
  chk('tocarlo otra vez lo destacha', await pg.evaluate(() => document.querySelectorAll('#modOv .dls-f.hecho').length === 0));
  await pg.evaluate(id => { dlsMarcar(id); _dls.solo = true; closeMod(); }, idP);
  chk('no se escribe nada en G', await pg.evaluate(() => !Object.keys(G).some(k => /dls/i.test(k)) && !JSON.stringify(G).includes('dt_dls')));

  // otra carrera con el mismo club: sigue tachado
  await pg.evaluate(() => { startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } });
  const otra = await pg.evaluate(() => { dlsRender(); return { hechos: dlsDatos().filter(f => f.hecho).map(f => f.apellido), filas: document.querySelectorAll('#modOv .dls-f').length, n: G.squad.length }; });
  chk('otra carrera con el mismo club: sigue tachado', otra.hechos.join() === 'Paredes' && otra.filas === otra.n - 1, JSON.stringify(otra.hechos));
  // un fichaje nuevo aparece pendiente
  const fichaje = await pg.evaluate(() => { const m = G.market.find(p => p.rat > 70 && !G.squad.some(q => q.name === p.name)); const p = Object.assign({}, m, { id: 'f110x', club: G.teamName }); G.squad.push(p); dlsRender(); const f = dlsDatos().find(x => x.id === 'f110x'); G.squad.pop(); return f && !f.hecho && !!document.querySelector(`#modOv .dls-ck[onclick="dlsMarcar('f110x')"]`); });
  chk('el que fichás aparece pendiente', fichaje);
  // otro club: no se mezcla
  await pg.evaluate(() => { closeMod(); startGame('river'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } });
  const river = await pg.evaluate(() => ({ club: G.teamName, hechos: dlsDatos().filter(f => f.hecho).length }));
  chk('otro club arranca sin tachados', river.club !== 'Boca Juniors' && river.hechos === 0, river.club);

  console.log('\n═══ DESDE LA PLANILLA, EN EL CELULAR ═══');
  await pg.evaluate(() => { startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    G.calendar.forEach(x => { if (x.friendly || /Amistoso/.test(x.comp || '')) x.played = true; });
    const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7; ojPlanilla(); });
  chk('la planilla tiene el botón de la lista', await pg.evaluate(() => [...document.querySelectorAll('#modOv button')].some(x => /Para DLS/.test(x.textContent))));
  await pg.setViewportSize({ width: 360, height: 760 });
  await pg.evaluate(() => { _dls.solo = false; dlsRender(); });
  await pg.waitForTimeout(150);
  const cel = await pg.evaluate(() => { const m = document.querySelector('#modOv .modal') || document.querySelector('#modOv'); const out = []; m.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > window.innerWidth + 1) out.push(e.className || e.tagName); }); return out.slice(0, 5); });
  chk('en un celular de 360 no se sale nada por el costado', cel.length === 0, cel.join(' | ') || 'nada');
  const blur = await pg.evaluate(() => [...document.querySelectorAll('#modOv .dls-f,#modOv .dls-ck,#modOv .dls-d i')].some(e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); }));
  chk('las filas no llevan vidrio (backdrop-filter)', !blur);
  chk('la casilla se puede tocar con el dedo (30 px o más)', await pg.evaluate(() => { const r = document.querySelector('#modOv .dls-ck').getBoundingClientRect(); return r.width >= 30 && r.height >= 30; }));

  chk('sin errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  chk('no pide nada por red', red.length === 0, red.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${ok} bien · ${fail} mal`);
  process.exit(fail ? 1 : 0);
})();
