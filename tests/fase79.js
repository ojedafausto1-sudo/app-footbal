// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 79: jugar sin internet + la interfaz del celular
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase79.js
//
// SIN INTERNET: levanta un servidor local (el service worker no existe con
// file://), deja que el juego se guarde, CORTA LA RED y recarga.
// CELULAR: recorre las 15 pestañas, los 4 tableros y el partido a 360px, y
// verifica que en escritorio no haya cambiado nada.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/director-tecnico.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
// ⚠️ `context.setOffline(true)` NO corta la red del service worker (medido:
// con eso puesto, el SW bajaba del servidor una temporada que no estaba
// guardada). Para probar "sin internet" de verdad se APAGA el servidor.
const sockets = new Set(); srv.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
const apagar = () => new Promise(r => { srv.close(() => r()); sockets.forEach(s => s.destroy()); });

(async () => {
  console.log('\n═══ LOS ARCHIVOS ═══');
  const html = fs.readFileSync(path.join(ROOT, 'director-tecnico.html'), 'utf8');
  chk('el juego ya no pide tipografías a Google', !/fonts\.googleapis|fonts\.gstatic/.test(html));
  const css = fs.readFileSync(path.join(ROOT, 'fonts/fonts.css'), 'utf8');
  const woff = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  chk('las tipografías locales existen todas', woff.length >= 20 && woff.every(f => fs.existsSync(path.join(ROOT, 'fonts', f))), woff.length + ' archivos');
  chk('están las cuatro familias', ['Rajdhani', 'Chakra Petch', 'Archivo', 'Plus Jakarta Sans'].every(f => css.includes(`'${f}'`)));
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const png = f => { const b = fs.readFileSync(path.join(ROOT, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  chk('manifiesto instalable: standalone, arranque y los íconos con su tamaño',
    man.display === 'standalone' && man.start_url === 'director-tecnico.html' &&
    man.icons.every(i => { const [w, h] = png(i.src); return i.sizes === `${w}x${h}`; }) && man.icons.some(i => i.purpose === 'maskable'));
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  chk('el service worker no toca lo que no es suyo (POST, otros sitios, el proxy)',
    /method !== 'GET'/.test(sw) && /url\.origin !== self\.location\.origin/.test(sw) && /\.netlify\//.test(sw));
  chk('el núcleo guardado existe entero', [...sw.match(/CORE_FILES = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].every(m => fs.existsSync(path.join(ROOT, m[1]))));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\n═══ SIN INTERNET ═══');
  const U = `http://127.0.0.1:${srv.address().port}/director-tecnico.html`;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const afuera = []; pg.on('request', q => { if (!q.url().startsWith('http://127.0.0.1')) afuera.push(q.url()); });
  await pg.goto(U, { waitUntil: 'load' });
  await pg.waitForFunction(async () => { const ks = await caches.keys(); return ks.some(k => k.startsWith('dt-core-')); }, null, { timeout: 30000 });
  await pg.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  const cache = await pg.evaluate(async () => {
    const k = (await caches.keys()).find(x => x.startsWith('dt-core-')); const c = await caches.open(k);
    const tiene = async u => !!(await c.match(u));
    return { html: await tiene('director-tecnico.html'), db: await tiene('players-db.js'), three: await tiene('three.min.js'),
      fuente: await tiene('fonts/Rajdhani-700-latin.woff2'), n: (await c.keys()).length };
  });
  chk('el juego, la base, three.js y las tipografías quedan guardados', cache.html && cache.db && cache.three && cache.fuente, cache.n + ' archivos');
  // una temporada vieja se guarda al elegirla
  const t2010 = await pg.evaluate(() => new Promise(r => cargarTemporada(2010, ok => setTimeout(async () => r({ ok, cache: !!(await (await caches.open('dt-hist')).match('players-hist-2010.js')) }), 300))));
  chk('elegir una temporada con conexión la guarda para después', t2010.ok && t2010.cache);
  // el botón de bajar temporadas, con dos años para no copiar 51 MB en el test
  const baja = await pg.evaluate(async () => {
    const orig = window.temporadasDB; window.temporadasDB = () => [2010, 2012, 2026];
    await offlineBajarTemporadas(); window.temporadasDB = orig;
    return { hist: _OFF.hist, prog: _OFF.prog, c12: !!(await (await caches.open('dt-hist')).match('players-hist-2012.js')) };
  });
  chk('"Descargar temporadas" baja las que faltan y nada más', baja.c12 && baja.hist === 2 && /Listo: 1 temporada/.test(baja.prog), baja.prog);

  const puerto = srv.address().port;
  await apagar();
  await ctx.setOffline(true);
  await pg.reload({ waitUntil: 'load' });
  const off = await pg.evaluate(async () => {
    await document.fonts.ready;
    return { online: navigator.onLine, db: (window.PLAYERS_DB || []).length, dts: (window.DTS_DB || []).length,
      fuentes: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) };
  });
  chk('sin conexión el juego abre con la base entera', !off.online && off.db > 10000 && off.dts > 100, off.db + ' jugadores');
  chk('y con sus tipografías, no con Arial', off.fuentes.length >= 3, off.fuentes.join(', '));
  const juega = await pg.evaluate(() => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none';
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    for (let i = 0; i < 4; i++) { const m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7; simMatch(true); try { closeMod(); } catch (e) {} }
    saveGame(); return G.calendar.filter(m => m.played).length;
  });
  chk('sin conexión se arranca una partida y se juega', juega === 4, juega + ' partidos');
  const tres = await pg.evaluate(() => new Promise(r => { e3dCargar(() => r(!!window.THREE)); setTimeout(() => r(false), 8000); }));
  chk('el 3D también anda sin conexión', tres);
  const hist = await pg.evaluate(() => Promise.all([2010, 2011].map(y => new Promise(r => cargarTemporada(y, r)))));
  chk('sin conexión, la temporada guardada carga y la que no, avisa', hist[0] === true && hist[1] === false, JSON.stringify(hist));
  const tarjeta = await pg.evaluate(() => { abrirOffline(); const t = document.getElementById('offBox').innerText; closeMod(); return t; });
  chk('la tarjeta dice el estado real', /guardado en este dispositivo/.test(tarjeta) && /sin internet/.test(tarjeta) && /2 de/.test(tarjeta), tarjeta.split('\n').slice(0, 3).join(' · '));
  chk('0 pedidos fuera del sitio', afuera.length === 0, afuera.slice(0, 2).join(' '));
  chk('(el servidor estaba apagado de verdad)', await new Promise(r => http.get('http://127.0.0.1:' + puerto + '/director-tecnico.html', () => r(false)).on('error', () => r(true))));
  await ctx.close();

  console.log('\n═══ EL CELULAR (360 px) ═══');
  const F = 'file://' + path.join(ROOT, 'director-tecnico.html');
  const mc = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const mp = await mc.newPage(); mp.on('pageerror', e => errs.push(e.message));
  await mp.goto(F, { waitUntil: 'load' }); await mp.waitForTimeout(300);
  const fileTxt = await mp.evaluate(() => { abrirOffline(); const t = document.getElementById('offBox').innerText; closeMod(); return t; });
  chk('con file:// la tarjeta explica que ya es local', /file:\/\//.test(fileTxt));
  await mp.evaluate(() => { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0');
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {} });
  await mp.waitForTimeout(400);
  const sale = await mp.evaluate(async () => {
    const malas = [];
    const mide = (n) => { const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 1) malas.push(n + ':doc');
      document.querySelectorAll('.tc.on *, .fhead *, #fnav *').forEach(e => { const r = e.getBoundingClientRect();
        if (r.width && r.right > vw + 2 && getComputedStyle(e.parentElement).overflowX === 'visible') malas.push(n + ':' + (e.className || e.tagName)); }); };
    for (const t of ['ov', 'sq', 'dt', 'tac', 'mkt', 'trn', 'stad', 'juv', 'ct', 'pat', 'cal', 'stats', 'news', 'social', 'pres']) {
      gTab(t); await new Promise(r => setTimeout(r, 120)); mide(t); }
    for (const h of ['plantel', 'mercado', 'oficina', 'temporada']) { irSec(h); await new Promise(r => setTimeout(r, 120)); mide('hub-' + h); }
    return [...new Set(malas)];
  });
  chk('nada se sale de la pantalla en las 15 pestañas y los 4 tableros', sale.length === 0, sale.slice(0, 4).join(' ; '));
  const nav = await mp.evaluate(() => { irSec('central');
    const n = document.getElementById('fnav').getBoundingClientRect();
    const bs = [...document.querySelectorAll('#fnav .fs')].map(x => x.getBoundingClientRect());
    return { fija: getComputedStyle(document.getElementById('fnav')).position, abajo: Math.round(innerHeight - n.bottom),
      alto: Math.min(...bs.map(x => x.height)), adentro: bs.every(x => x.left >= 0 && x.right <= innerWidth), n: bs.length,
      cab: Math.round(document.querySelector('.fhead').getBoundingClientRect().height) };
  });
  chk('las cinco secciones van abajo, fijas, y entran todas', nav.fija === 'fixed' && nav.abajo === 0 && nav.n === 5 && nav.adentro);
  chk('botones de la barra cómodos para el dedo (44px+)', nav.alto >= 44, nav.alto + 'px');
  chk('la cabecera ocupa una línea', nav.cab <= 72, nav.cab + 'px (antes ~200)');
  const mkt = await mp.evaluate(async () => { gTab('mkt'); await new Promise(r => setTimeout(r, 200));
    const fr = document.querySelector('#mk-buy .frow'), cerrado = getComputedStyle(fr).display;
    mkFiltrosToggle(); const abierto = getComputedStyle(fr).display;
    document.getElementById('mkPos').value = 'DC'; renderMkt();
    const lbl = document.getElementById('mkFBtn').textContent;
    document.getElementById('mkPos').value = ''; mkFiltrosToggle(); renderMkt();
    const rows = [...document.querySelectorAll('#mkList .mkrow')].slice(0, 10).map(r => r.getBoundingClientRect());
    const vals = [...document.querySelectorAll('#mkList .mkrow .vc')].slice(0, 10).map(v => v.getBoundingClientRect());
    return { cerrado, abierto, lbl, anchoOk: rows.every(r => r.right <= innerWidth), valOk: vals.every(v => v.width > 0 && v.right <= innerWidth),
      btn: getComputedStyle(document.querySelector('#mkList .mkrow>:nth-child(7)')).display };
  });
  chk('los filtros del Mercado arrancan plegados y se abren', mkt.cerrado === 'none' && mkt.abierto === 'grid');
  chk('el botón avisa cuántos filtros hay puestos', /1 activo/.test(mkt.lbl), mkt.lbl);
  chk('cada fila del Mercado entra entera con su valor a la vista', mkt.anchoOk && mkt.valOk && mkt.btn === 'none');
  const letra = await mp.evaluate(async () => { let n = 0;
    for (const t of ['sq', 'mkt', 'ct', 'cal', 'juv']) { gTab(t); await new Promise(r => setTimeout(r, 150));
      document.querySelectorAll('.tc.on *').forEach(e => { if (!e.getBoundingClientRect().width) return;
        if (![...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 1)) return;
        if (parseFloat(getComputedStyle(e).fontSize) < 10) n++; }); }
    return n; });
  chk('no queda texto de menos de 10px en Plantel, Mercado, CT, Calendario y Juveniles', letra === 0, letra + ' (antes ~2.300)');
  const fm = await mp.evaluate(async () => { G.calendar.forEach(m => { if (m.friendly) m.played = true; });
    const m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7; startFullMatch(true);
    await new Promise(r => setTimeout(r, 1200)); try { fmCloseHelp(); } catch (e) {}
    const bs = [...document.querySelectorAll('#fm-ov .fm-btns button')].map(x => x.getBoundingClientRect());
    const msg = document.getElementById('fm-msg');
    const r = { alto: Math.min(...bs.map(x => x.height)), adentro: bs.every(x => x.right <= innerWidth), msg: getComputedStyle(msg).whiteSpace };
    try { fmClean(); } catch (e) {} try { document.getElementById('fm-ov').remove(); } catch (e) {} return r; });
  chk('el partido: botones de arriba de 36px+ y adentro de la pantalla', fm.alto >= 36 && fm.adentro, fm.alto + 'px');
  chk('el cartel del partido puede partirse en vez de cortarse', fm.msg === 'normal');
  await mc.close();

  console.log('\n═══ EN LA COMPU NO CAMBIA NADA ═══');
  const dc = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await dc.newPage(); dp.on('pageerror', e => errs.push(e.message));
  await dp.goto(F, { waitUntil: 'load' }); await dp.waitForTimeout(300);
  const esc = await dp.evaluate(async () => { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0');
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    gTab('mkt'); await new Promise(r => setTimeout(r, 200));
    return { nav: getComputedStyle(document.getElementById('fnav')).position, fbtn: getComputedStyle(document.getElementById('mkFBtn')).display,
      frow: getComputedStyle(document.querySelector('#mk-buy .frow')).display,
      cols: getComputedStyle(document.querySelector('#mkList .mkrow')).gridTemplateColumns.split(' ').length };
  });
  chk('barra arriba, filtros a la vista y fila de 7 columnas', esc.nav !== 'fixed' && esc.fbtn === 'none' && esc.frow !== 'none' && esc.cols === 7, JSON.stringify(esc));
  await dc.close();

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
