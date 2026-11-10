// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 92: la pantalla de inicio nueva (el marcador de chapa)
// ═══════════════════════════════════════════════════════════════════════
// Dos columnas en la compu (tablero, rol y dificultad a la izquierda; el
// selector a la derecha), apilada en el celular, rótulos en minúscula, los
// eventos debajo de los países, y los mismos ids y clases de siempre.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase92.js
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
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(600);

  const d = await pg.evaluate(() => {
    const q = s => document.querySelector(s), r = el => el.getBoundingClientRect();
    const placas = [...document.querySelectorAll('.tablero .tab-fila .placa')];
    const side = r(q('.ts-side')), main = r(q('.ts-main'));
    const w = q('#tsWizard'), ev = w.querySelector('.ev-sec'), grid = w.querySelector('.ts-grid');
    const mayus = [...document.querySelectorAll('#teamSelect h3, #teamSelect .ts-step, #teamSelect .ev-t, #teamSelect .ts-temp-t')]
      .filter(e => getComputedStyle(e).textTransform === 'uppercase').length;
    return {
      placas: placas.map(p => p.textContent).join(''), fuente: getComputedStyle(placas[0]).fontFamily,
      lado: side.right <= main.left && side.width > 280 && side.width < 360,
      roles: [...document.querySelectorAll('.modo-btn')].map(b => b.dataset.m + ':' + (b.querySelector('span') ? b.querySelector('span').textContent.length : 0)),
      dif: ['diff-0', 'diff-1', 'diff-2'].map(id => !!document.getElementById(id)).every(Boolean) && q('#diff-1').classList.contains('diff-sel'),
      evDespues: !!(ev && grid && (grid.compareDocumentPosition(ev) & Node.DOCUMENT_POSITION_FOLLOWING)),
      mayus, placaTemp: q('#tsTempPlaca').textContent,
      ids: ['tsWizard', 'continueSaveBtn', 'continueSaveLbl', 'apoyoBtn', 'impSave'].every(id => !!document.getElementById(id)),
    };
  });
  chk('el título es un tablero de 15 placas', d.placas === 'DIRECTORTÉCNICO', d.placas);
  chk('las placas usan Chakra Petch (local)', /Chakra Petch/.test(d.fuente));
  chk('en la compu: dos columnas, el panel a la izquierda', d.lado);
  chk('los dos roles explican qué hace cada uno adentro del botón', d.roles.length === 2 && d.roles.every(x => +x.split(':')[1] > 30), d.roles.join(' '));
  chk('la dificultad sigue con sus ids y arranca en Normal', d.dif);
  chk('los eventos van debajo de los países', d.evDespues);
  chk('ningún rótulo en mayúsculas forzadas', d.mayus === 0, d.mayus + ' rótulos');
  chk('la placa de temporada dice el año cargado', d.placaTemp === '2026');
  chk('los ids que usa el juego siguen estando', d.ids);

  // ── elegir rol y dificultad ──
  const sel = await pg.evaluate(() => {
    setModo('dt', document.querySelector('.modo-btn[data-m="dt"]')); setDiff(2, document.getElementById('diff-2'));
    const o = { dt: document.querySelector('.modo-btn[data-m="dt"]').classList.contains('diff-sel'), dif: document.getElementById('diff-2').classList.contains('diff-sel'),
      pres: document.querySelector('.modo-btn[data-m="pres"]').classList.contains('diff-sel') };
    setModo('pres', document.querySelector('.modo-btn[data-m="pres"]')); setDiff(1, document.getElementById('diff-1')); return o;
  });
  chk('elegir rol y dificultad marca uno de cada grupo', sel.dt && sel.dif && !sel.pres);

  // ── la placa sigue a la temporada histórica ──
  const hay = await pg.evaluate(() => typeof hayHistoricos === 'function' && hayHistoricos());
  if (hay) {
    await pg.evaluate(() => tsSetTemporada(2015));
    await pg.waitForFunction(() => tempActual() === 2015, null, { timeout: 15000 }).catch(() => {});
    const t = await pg.evaluate(() => document.getElementById('tsTempPlaca').textContent);
    chk('elegir 2015 cambia la placa', t === '2015', t);
    await pg.evaluate(() => tsSetTemporada(2026));
  }

  // ── teclado ──
  await pg.focus('.modo-btn[data-m="dt"]'); await pg.keyboard.press('Tab');
  const foco = await pg.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
  chk('el foco del teclado se ve', foco);

  // ── movimiento reducido ──
  const pr = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
  await pr.goto(F, { waitUntil: 'load' }); await pr.waitForTimeout(300);
  const anim = await pr.evaluate(() => getComputedStyle(document.querySelector('.placa')).animationName);
  chk('con movimiento reducido las placas no se animan', anim === 'none', anim);
  await pr.close();

  // ── celular ──
  await pg.setViewportSize({ width: 360, height: 740 });
  await pg.waitForTimeout(200);
  const m = await pg.evaluate(() => {
    const side = document.querySelector('.ts-side').getBoundingClientRect(), main = document.querySelector('.ts-main').getBoundingClientRect();
    const root = document.getElementById('teamSelect');
    const chica = [...root.querySelectorAll('*')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10).map(e => e.textContent.trim().slice(0, 20));
    return { apilado: main.top >= side.bottom - 1, w: root.scrollWidth, cw: root.clientWidth, chica };
  });
  chk('a 360 px se apila: primero el panel, después el selector', m.apilado);
  chk('a 360 px no hay scroll horizontal', m.w <= m.cw, m.w + ' de ' + m.cw);
  chk('a 360 px no hay letra de menos de 10 px', m.chica.length === 0, m.chica.slice(0, 4).join(' | '));

  // ── seguir la partida ──
  await pg.setViewportSize({ width: 1280, height: 860 });
  await pg.evaluate(() => { localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } saveGame(); });
  await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(600);
  const sg = await pg.evaluate(() => { const c = document.getElementById('continueSaveBtn'); return { vis: getComputedStyle(c).display !== 'none', lbl: document.getElementById('continueSaveLbl').textContent }; });
  chk('con una partida guardada aparece "Seguir la partida"', sg.vis && /Boca Juniors/.test(sg.lbl), sg.lbl);
  await pg.click('.ts-seguir'); await pg.waitForTimeout(500);
  const dentro = await pg.evaluate(() => !!G && document.getElementById('game').classList.contains('on'));
  chk('y la carga', dentro);

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
