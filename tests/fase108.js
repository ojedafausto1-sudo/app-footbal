// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 108: jugarlo en otro juego
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase108.js
//
// Qué blinda:
//  1. La función de Netlify que dibuja camisetas y escudos (PNG 512×512, sin
//     dependencias): los colores son los pedidos, el escudo es transparente
//     afuera, y una dirección mal escrita da 400 (no una imagen cualquiera).
//  2. La planilla: los dos onces con dorsal, puesto, altura, pie y media; los
//     dorsales del rival no se repiten; las direcciones de la camiseta y el
//     escudo tienen el formato que entiende la función; se copia como texto.
//  3. El resultado a mano entra por el mismo camino que el partido jugado acá:
//     marcador, goleadores NUESTROS (y el gol en contra, que no suma a nadie),
//     tarjetas, la tanda de penales en una eliminatoria, el amistoso y el reloj.
const path = require('path');
const zlib = require('zlib');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
const KIT = require(path.resolve(__dirname, '..', 'netlify', 'functions', 'kit.js'));
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

// decodifica el PNG que arma kit.js (RGBA, filtro 0 en todas las filas)
function leerPNG(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  let o = 8, idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8); if (t === 'IDAT') idat.push(buf.slice(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = (x, y) => { const i = y * (w * 4 + 1) + 1 + x * 4; return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]; };
  return { w, h, sig: buf.slice(0, 8).toString('hex'), px };
}

(async () => {
  console.log('\n═══ CAMISETAS Y ESCUDOS POR URL ═══');
  const L = leerPNG(KIT.dibujar('/kit/003a7d-ffd200-liso.png'));
  chk('es un PNG de 512×512', L.sig === '89504e470d0a1a0a' && L.w === 512 && L.h === 512);
  chk('la lisa es del color pedido', L.px(10, 10).join() === '0,58,125,255' && L.px(500, 500).join() === '0,58,125,255');
  // el molde de DLS: frente al medio (x 160-352, y 180-376), espalda arriba dada vuelta
  const Fr = leerPNG(KIT.dibujar('/kit/003a7d-ffd200-franja.png'));
  chk('la franja cruza el pecho y la espalda, y las mangas quedan lisas', Fr.px(256, 260).join() === '255,210,0,255' && Fr.px(256, 90).join() === '255,210,0,255' && Fr.px(60, 260).join() === '0,58,125,255' && Fr.px(256, 200).join() === '0,58,125,255');
  const Ry = leerPNG(KIT.dibujar('/kit/ffffff-e30613-rayas.png'));
  chk('las rayas van en el torso, no en las mangas ni el pantalón', Ry.px(170, 300).join() === '255,255,255,255' && Ry.px(194, 300).join() === '227,6,19,255' && Ry.px(30, 300).join() === '255,255,255,255' && Ry.px(256, 450).join() === '255,255,255,255');
  const Aq = leerPNG(KIT.dibujar('/kit/1fa34a-1fa34a-arquero.png'));
  chk('la del arquero es lisa', Aq.px(256, 260).join() === '31,163,74,255' && Aq.px(10, 10).join() === '31,163,74,255');
  const Es = leerPNG(KIT.dibujar('/kit/003a7d-ffd200-escudo-BJ.png'));
  chk('el escudo es transparente afuera y lleno adentro', Es.px(5, 5)[3] === 0 && Es.px(130, 440)[3] === 0 && Es.px(150, 80)[3] === 255);
  chk('el escudo lleva los dos colores', Es.px(120, 420).join() === '0,58,125,255' && Es.px(392, 420)[3] === 0 ? true : Es.px(300, 420).join() === '255,210,0,255');
  const r400 = await KIT.handler({ path: '/kit/nada.png' }), r200 = await KIT.handler({ path: '/kit/003a7d-ffd200-liso.png' });
  chk('una dirección mal escrita da 400', r400.statusCode === 400);
  chk('la buena da la imagen, cacheable', r200.statusCode === 200 && r200.isBase64Encoded && r200.headers['Content-Type'] === 'image/png' && /immutable/.test(r200.headers['Cache-Control']));
  chk('el sitio sirve /kit/* con la función', /from = "\/kit\/\*"[\s\S]*functions\/kit/.test(require('fs').readFileSync(path.resolve(__dirname, '..', 'netlify.toml'), 'utf8')));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const red = []; pg.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) red.push(u); });
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ LA PLANILLA ═══');
  const P = await pg.evaluate(() => {
    const o = {};
    document.getElementById('teamSelect').style.display = 'none';
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const limpiar = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0); closeMod(); };
    window._limpiar = limpiar; limpiar();
    // no es el día del partido: avisa y no abre nada
    G.day = 2; let fl = ''; const _f = window.flash; window.flash = t => { fl = t; };
    ojPlanilla(); window.flash = _f;
    o.noDia = /día del partido/.test(fl) && !document.getElementById('modOv').textContent.includes('Jugarlo en otro juego');
    // el día del partido (salteo los amistosos de la pretemporada)
    G.calendar.forEach(x => { if (x.friendly) x.played = true; });
    const m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7; updateUI(); limpiar();
    o.boton = !!document.getElementById('btnOtroJuego');
    ojPlanilla();
    const mod = document.getElementById('modOv');
    const tablas = [...mod.querySelectorAll('.oj-t')];
    o.tablas = tablas.length; o.filas = tablas.map(t => t.querySelectorAll('tbody tr').length);
    o.alturas = tablas[0] ? [...tablas[0].querySelectorAll('tbody tr')].every(tr => /\d{3} cm|—/.test(tr.children[3].textContent)) : false;
    o.pies = tablas[0] ? [...tablas[0].querySelectorAll('tbody tr')].every(tr => /derecho|izquierdo|ambidiestro|—/.test(tr.children[4].textContent)) : false;
    const nums = tablas[1] ? [...tablas[1].querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent) : [];
    o.numsRival = new Set(nums).size === nums.length && nums.every(n => +n > 0);
    o.urls = [...mod.querySelectorAll('.oj-url code')].map(c => c.textContent);
    o.urlOk = o.urls.length === 5 && o.urls.slice(0, 4).every(u => /^https:\/\/[^/]+\/kit\/[0-9a-f]{6}-[0-9a-f]{6}-(liso|franja|rayas|arquero)\.png$/.test(u)) && /\/kit\/[0-9a-f]{6}-[0-9a-f]{6}-escudo-[A-Z0-9]{1,3}\.png$/.test(o.urls[4]);
    const mio = ojOnceMio(); o.txt = window._ojTxt || '';
    o.txtOk = mio.every(f => o.txt.includes(f.name)) && /Camiseta: https/.test(o.txt);
    o.sitio = ojSitio();
    o.mio = mio.length; o.rival = (ojOnceRival(m).xi || []).length;
    closeMod();
    return o;
  });
  chk('fuera del día del partido avisa y no abre', P.noDia);
  chk('el botón está con las otras formas de jugar', P.boton);
  chk('dos onces completos', P.tablas === 2 && P.filas[0] === 11 && P.filas[1] === 11, P.filas.join(' + '));
  chk('con altura y pie de cada uno', P.alturas && P.pies);
  chk('los dorsales del rival no se repiten', P.numsRival);
  chk('las direcciones de camiseta y escudo tienen el formato de la función', P.urlOk, P.urls[0]);
  chk('desde un archivo local apunta al sitio publicado', /^https:\/\/stately-elf/.test(P.sitio), P.sitio);
  chk('la planilla se copia como texto con los once y la camiseta', P.txtOk);

  console.log('\n═══ EL RESULTADO A MANO ═══');
  const R = await pg.evaluate(() => {
    const o = {};
    const m = G.calendar.find(x => !x.played);
    const tn = G.teamName, local = m.home === tn;
    const w0 = G.wins, wk0 = G.week;
    ojResultado();
    const xi = _oj.xi;
    // falta un goleador: avisa y no carga
    _oj.gf = 2; _oj.ga = 1; ojResRender();
    let fl = ''; const _f = window.flash; window.flash = t => { fl = t; };
    ojAplicar(); window.flash = _f;
    o.valida = /Falta quién/.test(fl) && !m.played;
    // 3-1: dos de los nuestros y uno en contra; una amarilla y una roja
    const a = xi.find(f => f.posR !== 'ARQ'), c = xi.filter(f => f.posR !== 'ARQ')[1];
    const pa = G.squad.find(p => p.id === a.id), pc = G.squad.find(p => p.id === c.id);
    const ga0 = pa.goals || 0, gc0 = pc.goals || 0;
    const ama = xi[2], roja = xi[3];
    const pAma = G.squad.find(p => p.id === ama.id), pRoja = G.squad.find(p => p.id === roja.id);
    const y0 = pAma.yellows || 0, s0 = pRoja.susp || 0;
    _oj.gf = 3; _oj.ga = 1; _oj.gol = [a.id, c.id, 'og']; _oj.min = ['12', '', '77']; _oj.sus = ['40'];
    _oj.tarj = { [ama.id]: 'y', [roja.id]: 'r' };
    ojAplicar();
    o.jugado = m.played && m.result === 'W' && m.score === (local ? '3-1' : '1-3') && m.via === 'otro';
    o.ganados = G.wins === w0 + 1;
    o.goles = (pa.goals || 0) === ga0 + 1 && (pc.goals || 0) === gc0 + 1;
    o.tabla = !!(G.league && G.league.scorers && G.league.scorers[a.name]) && !(G.league.scorers['En contra']);
    o.amarilla = (pAma.yellows || 0) === y0 + 1 || pAma.susp > 0;
    o.roja = (pRoja.susp || 0) > s0;
    o.tiempos = G._tiempos && G._tiempos.gf1 === 1 && G._tiempos.ga1 === 1;
    o.resumen = document.getElementById('modOv').textContent.length > 100;
    o.reloj = G.week >= wk0;
    o.limpio = _oj === null && !G._penManual;
    closeMod(); window._limpiar();
    // un amistoso
    const am = { week: G.week, comp: 'Amistoso', home: tn, away: 'Club Amigo', played: false, result: null, score: null, friendly: true };
    G.calendar.forEach(x => { if (!x.played && x.week <= G.week) x.played = true; });
    G.calendar.push(am); G.calendar.sort((x, y) => x.week - y.week); G.day = 7;
    const wAm = G.wins;
    ojResultado(); _oj.gf = 2; _oj.ga = 0; _oj.gol = [a.id, a.id]; ojAplicar();
    o.amistoso = am.played && G.wins === wAm;
    closeMod(); window._limpiar();
    // una eliminatoria empatada, que se define con la tanda que cargaste
    const ko = G.calendar.find(x => !x.played && /Copa Argentina|Octavos|R32|R16/.test(x.comp));
    if (ko) {
      G.calendar.forEach(x => { if (!x.played && x !== ko && x.week <= ko.week) x.played = true; });
      G.week = ko.week; G.day = 7; window._limpiar();
      ojResultado(); _oj.gf = 1; _oj.ga = 1; _oj.gol = [a.id]; _oj.pm = '4'; _oj.ps = '2'; ojAplicar();
      o.ko = ko.comp; o.pens = ko.pens; o.penGana = ko.penGana;
      closeMod();
    }
    return o;
  });
  chk('si falta un goleador avisa y no carga nada', R.valida);
  chk('el partido queda jugado con el marcador cargado', R.jugado);
  chk('suma la victoria', R.ganados);
  chk('los goles son de los jugadores que elegiste', R.goles);
  chk('van a la tabla de goleadores, y el gol en contra no', R.tabla);
  chk('la amarilla y la roja cuentan (la roja suspende)', R.amarilla && R.roja);
  chk('el desglose por tiempo sale de los minutos cargados', R.tiempos);
  chk('sale el resumen del partido', R.resumen);
  chk('no queda nada colgado', R.limpio && R.reloj);
  chk('un amistoso se carga sin sumar a la temporada', R.amistoso);
  chk('una eliminatoria empatada se define con la tanda que cargaste', R.ko ? R.pens === '4-2' && R.penGana === true : true, R.ko ? `${R.ko} · ${R.pens}` : 'sin eliminatoria a mano');

  chk('0 pedidos a la red (las direcciones son sólo texto)', red.length === 0, red.slice(0, 2).join(' '));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
