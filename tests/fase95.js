// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 95: el predio se ve y los jugadores parecen personas
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase95.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await b.newContext()).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  const R = await pg.evaluate(async () => {
    localStorage.setItem('dt_fondo3d', '0');
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const o = {};
    o.vacio = predioObras().hechas.length;
    const k0 = fondo3DKey();
    ['store', 'museum', 'hotel', 'ct', 'medical', 'hd'].forEach(id => { const u = G.stadium.upgrades.find(x => x.id === id); if (u) u.built = true; });
    ['yf', 'yd'].forEach(id => { const u = G.youth.upgrades.find(x => x.id === id); if (u) u.built = true; });
    G.activeConstructions = [{ id: 'academy', tipo: 'stadium', name: 'Academia', sem: 3, total: 8 }];
    const P = predioObras(); o.hechas = P.hechas; o.enObra = P.enObra;
    o.cambiaFondo = fondo3DKey() !== k0;
    o.boton = /predio en 3D/.test(predioBoton()) && /7 construidas/.test(predioBoton());
    await new Promise(r => e3dCargar(r));
    let n = 0; const R0 = Math.random; Math.random = function () { n++; return R0(); };
    const E = _e3dSinAzar(() => e3dEstadio({ cap: 54000, color: '#10316b', gente: 500, asist: 0.5, predio: P, rotulos: true, mejoras: ['hd'] }));
    Math.random = R0; o.azar = n;
    o.enEscena = E.predio.slice().sort();
    const grupos = E.S.children.filter(c => c.userData && c.userData.predio);
    o.grupos = grupos.length;
    o.rotulos = grupos.filter(g => g.children.some(c => c.isSprite)).length;
    const anillo = Math.max(E.L / 2 + E.M + E.offMax, E.A / 2 + E.M + E.offMax);
    o.afuera = grupos.every(g => Math.hypot(g.position.x, g.position.z) > anillo + 10);
    o.grua = grupos.find(g => g.userData.predio === 'academy').children.length > grupos.find(g => g.userData.predio === 'store').children.length;
    // los muñecos: cápsulas, codos y el número en la espalda
    const F3 = _e3dSinAzar(() => e3dFab(E.S, 1));
    const J = _e3dSinAzar(() => F3.muneco({ name: 'Riquelme', num: 10 }, { c1: '#10316b', c2: '#f59e0b' }));
    o.codo = !!J.bi.userData.codo;
    F3.posar(J, { x: 0, z: 0, mv: 2, dt: 1 }); o.dobla = J.bi.userData.codo.rotation.x < -0.8;
    const meshes = []; J.cuerpo.traverse(m => { if (m.isMesh) meshes.push(m); });
    o.capsulas = meshes.filter(m => m.geometry.type === 'CapsuleGeometry').length;
    o.numero = meshes.some(m => m.material.map && m.position.z < 0);
    // 2D: la cabeza es chica (1/8 del alto) y se dibuja sin errores
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const ctx = cv.getContext('2d');
    let arcos = []; const el0 = ctx.ellipse.bind(ctx); ctx.ellipse = function (x, y, rx, ry) { arcos.push(ry); return el0.apply(null, arguments); };
    sitDrawFigure(ctx, 100, 180, 120, '#10316b', '#f59e0b', { run: 0.3, label: 'Riquelme' });
    sitDrawFigure(ctx, 100, 180, 120, '#10316b', '#f59e0b', { dive: true, diveDir: 1 });
    o.cabeza = arcos.filter(r => r > 5 && r < 60).sort((a, b) => b - a)[0];
    return o;
  });
  chk('partida nueva: el predio arranca vacío', R.vacio === 0);
  chk('lo construido (estadio y juveniles) y lo que está en obra se listan', R.hechas.length === 7 && R.enObra.join() === 'academy', R.hechas.join(' ') + ' · obra ' + R.enObra.join(' '));
  chk('cada instalación es un edificio en la escena', R.grupos === 8 && R.enEscena.length === 8, R.enEscena.join(' '));
  chk('todas con su cartel en el visor', R.rotulos === 8);
  chk('van alrededor del estadio, no adentro', R.afuera);
  chk('la obra en curso tiene andamio y grúa', R.grua);
  chk('construir cambia el fondo 3D del menú', R.cambiaFondo);
  chk('las pestañas Estadio y Juveniles tienen el botón al predio', R.boton);
  chk('armar el predio no gasta azar', R.azar === 0, R.azar);
  chk('los jugadores 3D tienen volumen (cápsulas), codos y número en la espalda', R.capsulas >= 8 && R.codo && R.numero, R.capsulas + ' cápsulas');
  chk('al correr doblan los codos', R.dobla);
  chk('en 2D la cabeza es de persona (≈1/8 del alto)', R.cabeza > 0 && R.cabeza < 120 * 0.10, R.cabeza && R.cabeza.toFixed(1) + ' px de 120');
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
