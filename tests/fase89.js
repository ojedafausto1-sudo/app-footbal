// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 89: el botón ☕ Apoyar el proyecto
// ═══════════════════════════════════════════════════════════════════════
// Sin usuario configurado no aparece; con usuario abre un modal con links a
// Cafecito / Ko-fi en otra pestaña; un usuario mal escrito no arma un link;
// no desbloquea nada y no pide nada por red hasta que se toca.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase89.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await b.newContext()).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const red = []; pg.on('request', r => { if (/^https?:/.test(r.url())) red.push(r.url()); });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  const ev = s => pg.evaluate(s => (0, eval)(s), s);

  const r0 = await pg.evaluate(() => ({ btn: !!document.getElementById('apoyoBtn'), vis: getComputedStyle(document.getElementById('apoyoBtn')).display !== 'none', n: apoyoLinks().length }));
  chk('el botón existe en la pantalla de inicio', r0.btn);
  chk('sin usuario configurado no se muestra (no hay botón muerto)', !r0.vis && r0.n === 0);
  await pg.evaluate(() => apoyoModal());
  chk('apoyoModal sin links no abre nada', await pg.evaluate(() => { const o = document.getElementById('baseOv'); return !o || o.style.display === 'none'; }));

  // usuarios mal escritos: no arman link
  const malo = await ev(`APOYO.cafecito='x"><img src=x onerror=alert(1)>'; APOYO.kofi='https://otro.sitio/robo'; apoyoLinks().length`);
  chk('un usuario con HTML o una URL entera no arma ningún link', malo === 0);

  await ev(`APOYO.cafecito='directortecnico'; APOYO.kofi=''; apoyoBoton();`);
  const r1 = await pg.evaluate(() => ({ vis: getComputedStyle(document.getElementById('apoyoBtn')).display !== 'none', txt: document.getElementById('apoyoBtn').textContent }));
  chk('con el usuario de Cafecito el botón aparece', r1.vis && /Apoyar el proyecto/.test(r1.txt));
  await pg.click('#apoyoBtn');
  const m1 = await pg.evaluate(() => {
    const ov = document.getElementById('baseOv'), as = [...ov.querySelectorAll('a[data-apoyo]')];
    const r = ov.getBoundingClientRect();
    return { vis: getComputedStyle(ov).display !== 'none' && document.elementFromPoint(r.width / 2, r.height / 2).closest('#baseOv') !== null,
      links: as.map(a => [a.dataset.apoyo, a.href, a.target, a.rel]), txt: ov.textContent };
  });
  chk('tocar el botón abre el modal encima de la pantalla de inicio', m1.vis);
  chk('un solo link, a cafecito.app/usuario, en otra pestaña y sin opener',
    m1.links.length === 1 && m1.links[0][1] === 'https://cafecito.app/directortecnico' && m1.links[0][2] === '_blank' && /noopener/.test(m1.links[0][3]) && /noreferrer/.test(m1.links[0][3]), JSON.stringify(m1.links[0]));
  chk('dice que no desbloquea nada', /no desbloquea nada/.test(m1.txt));

  await ev(`APOYO.kofi='dtjuego'; apoyoModal();`);
  const m2 = await pg.evaluate(() => [...document.querySelectorAll('#baseOv a[data-apoyo]')].map(a => a.href));
  chk('con los dos: Cafecito y Ko-fi', m2.length === 2 && m2[1] === 'https://ko-fi.com/dtjuego', m2.join(' · '));

  // celular
  await pg.setViewportSize({ width: 360, height: 740 });
  const mob = await pg.evaluate(() => { const m = document.getElementById('baseBody'); return { w: m.scrollWidth, cw: document.documentElement.clientWidth, chica: [...m.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10).length }; });
  chk('a 360 px el modal entra y no hay letra de menos de 10 px', mob.w <= mob.cw && mob.chica === 0, mob.w + ' de ' + mob.cw);
  await pg.evaluate(() => baseCerrar());

  // no toca el juego
  const juego = await pg.evaluate(() => {
    localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('Liga ARG'); setModo('pres'); startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const js = JSON.stringify(G); return { apoyo: /apoyo|cafecito|ko-fi/i.test(js), n: G.squad.length };
  });
  chk('la partida no guarda nada del apoyo', !juego.apoyo && juego.n > 0);
  chk('0 pedidos a la red (el link se abre recién al tocarlo)', red.length === 0, red.length + ' pedidos');
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
