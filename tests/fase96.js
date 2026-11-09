// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 96: toda la interfaz con el idioma del inicio (chapa)
// ═══════════════════════════════════════════════════════════════════════
// La cabecera es el marcador de chapa con los números en placas, la sección
// activa es una placa, el tablero son tablas de chapa (no tarjetas blancas),
// sin mayúsculas forzadas en navegación, títulos y botones, y los ids de
// siempre se siguen llenando. En el celular la barra sigue abajo.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase96.js
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
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(500);
  await pg.evaluate(() => { localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { } updateUI(); });
  await pg.waitForTimeout(500);
  const d = await pg.evaluate(() => {
    const cs = s => getComputedStyle(document.querySelector(s));
    const rgb = c => c.replace(/\s/g, '');
    const o = {};
    o.chapa = /linear-gradient/.test(cs('.fpill').backgroundImage) && /31,63,48|23,50,38/.test(rgb(cs('.fpill').backgroundImage));
    o.placaNum = rgb(cs('#sPts').backgroundColor) === 'rgb(236,228,207)' && rgb(cs('#sPts').color) === 'rgb(22,25,26)';
    o.activa = rgb(cs('#fnav .fs.on').backgroundColor) === 'rgb(236,228,207)';
    o.tileOscura = !/240,243,247/.test(rgb(cs('.ht:not(.big)').backgroundImage));
    const mayus = [...document.querySelectorAll('#fnav .fs, .ht-t, .ctitle, .stitle, .btn, th, .hm-play, .fr-mini, .ph-tab')]
      .filter(e => getComputedStyle(e).textTransform === 'uppercase').map(e => e.className || e.tagName);
    o.mayus = mayus.length; o.mayusEj = mayus.slice(0, 4);
    o.ids = ['bTop', 'wTop', 'rTop', 'sPts', 'repTop', 'fAprob', 'mktStatusTop', 'teamNameTop', 'dtTop'].every(id => { const e = document.getElementById(id); return e && e.textContent.trim().length > 0; });
    o.rep = getComputedStyle(document.getElementById('repTop')).position === 'static';
    o.botones = ['btnPlay', 'dayBtn', 'btnHastaPartido'].map(id => document.getElementById(id).textContent.trim());
    o.vidrio = getComputedStyle(document.querySelector('.card')).backdropFilter !== 'none';
    o.fondo = rgb(getComputedStyle(document.documentElement).getPropertyValue('--dark').trim()) === '#0b0e14';
    return o;
  });
  chk('la cabecera es una tabla de chapa', d.chapa);
  chk('los números de la cabecera van en placas crema con tinta', d.placaNum);
  chk('la sección activa es una placa', d.activa);
  chk('el tablero ya no son tarjetas blancas brillantes', d.tileOscura);
  chk('sin mayúsculas forzadas en navegación, títulos, botones y tablas', d.mayus === 0, d.mayus + ' ' + d.mayusEj.join(', '));
  chk('los ids de la cabecera se siguen llenando', d.ids);
  chk('la barra de reputación muestra el número adentro (no corrido)', d.rep);
  chk('los botones del partido dicen lo que hacen, en minúscula', d.botones.every(t => !/[A-ZÁÉÍÓÚ]{5,}/.test(t.replace(/11v11/, ''))), d.botones.join(' | '));
  chk('el vidrio sigue en las tarjetas y el fondo maestro no cambió', d.vidrio && d.fondo);
  // teclado
  await pg.focus('#fnav .fs'); await pg.keyboard.press('Tab');
  const foco = await pg.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; });
  chk('el foco del teclado se ve en la navegación', foco);
  // celular
  await pg.setViewportSize({ width: 360, height: 740 }); await pg.waitForTimeout(300);
  const m = await pg.evaluate(() => {
    const n = document.getElementById('fnav'), r = n.getBoundingClientRect();
    const chica = [...document.querySelectorAll('.fhead *, #fnav *')].filter(e => e.offsetParent && [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10).length;
    return { fija: getComputedStyle(n).position, abajo: Math.round(innerHeight - r.bottom), w: document.documentElement.scrollWidth, chica,
      alto: Math.min(...[...document.querySelectorAll('#fnav .fs')].map(x => x.getBoundingClientRect().height)) };
  });
  chk('en el celular la barra sigue abajo y cómoda (≥54 px)', m.fija === 'fixed' && m.abajo <= 1 && m.alto >= 54, m.alto + ' px');
  chk('en el celular no hay scroll horizontal', m.w <= 360, m.w + ' px');
  chk('en el celular la cabecera no tiene letra de menos de 10 px', m.chica === 0, m.chica);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
