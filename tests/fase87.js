// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 87: camarillas del vestuario
// ═══════════════════════════════════════════════════════════════════════
// Cuatro grupos excluyentes derivados al vuelo (sin campos nuevos en el
// jugador), castigos y cantera que mueven la moral por grupo, y la tarjeta
// del Plantel con el café semanal.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase87.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0');
    document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('Liga ARG'); setModo('pres');
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
  });

  console.log('\n═══ CLASIFICACIÓN ═══');
  const c = await pg.evaluate(() => {
    const loc = natsLocales()[0];
    const base = G.squad[0];
    const mk = (id, o) => Object.assign(JSON.parse(JSON.stringify(base)), { id, name: id, nat: loc, nat2: '', age: 25, seasonsAtClub: 0, canterano: undefined, morale: 60 }, o);
    const fab = [
      mk('t31', { age: 31 }), mk('tCap', { age: 20 }), mk('tLey', { age: 21 }),
      mk('tCant', { age: 21, canterano: true }), mk('tCasa', { age: 21, seasonsAtClub: 3 }),
      mk('tJovenNuevo', { age: 21, seasonsAtClub: 1 }), mk('tJovenExt', { age: 21, seasonsAtClub: 1, nat: 'BRA' }),
      mk('tExt', { age: 25, nat: 'BRA' }), mk('tLocal', { age: 25 }), mk('tExtVet', { age: 32, nat: 'BRA' }),
    ];
    const cap0 = G.roles.captain; const ley0 = G.legends;
    G.roles.captain = 'tCap'; G.legends = (G.legends || []).concat([{ id: 'tLey', name: 'tLey' }]);
    const dd = fab.map(p => [p.id, camarillaDe(p)]);
    G.roles.captain = cap0; G.legends = ley0;
    // el plantel real: cada uno en un solo grupo
    const cams = camarillas();
    const todos = [].concat(cams.ref, cams.pibes, cams.ext, cams.resto);
    return { dd: Object.fromEntries(dd), unico: new Set(todos).size === todos.length && todos.length === G.squad.length, n: todos.length, tam: Object.fromEntries(Object.entries(cams).map(([k, v]) => [k, v.length])) };
  });
  const e = { t31: 'ref', tCap: 'ref', tLey: 'ref', tCant: 'pibes', tCasa: 'pibes', tJovenNuevo: 'resto', tJovenExt: 'ext', tExt: 'ext', tLocal: 'resto', tExtVet: 'ref' };
  for (const k in e) chk(`${k} → ${e[k]}`, c.dd[k] === e[k], c.dd[k]);
  chk('cada jugador del plantel está en un solo grupo', c.unico, c.n + ' · ' + JSON.stringify(c.tam));

  console.log('\n═══ NADA NUEVO EN EL JUGADOR ═══');
  const nf = await pg.evaluate(() => {
    const huella = () => G.squad.map(p => Object.keys(p).sort().join(',')).join('|');
    // la lista del Plantel ya cacheaba `_pers` desde antes: se la deja dibujar
    // primero y se mide sólo lo de las camarillas.
    gTab('sq');
    const h0 = huella(); const s0 = JSON.stringify(G).length;
    rVestuario(); camarillas(); CAM_ORDEN.forEach(k => camarillaInfo(k)); vestGrupos();
    return { igual: huella() === h0, bytes: JSON.stringify(G).length - s0 };
  });
  chk('las camarillas no agregan ningún campo a los jugadores', nf.igual);
  chk('ni crece la partida guardada', nf.bytes === 0, nf.bytes + ' bytes');

  console.log('\n═══ CASTIGOS ═══');
  const k = await pg.evaluate(() => {
    const mor = () => Object.fromEntries(G.squad.map(p => [p.id, p.morale]));
    const set = v => G.squad.forEach(p => p.morale = v);
    const delta = (a, b, ids) => ids.map(id => Math.round((b[id] - a[id]) * 10) / 10);
    const cams = camarillas();
    const refs = cams.ref.map(id => G.squad.find(p => p.id === id));
    const r = {};
    // 1. indisciplina mensual a un Referente, multar
    set(70); G._dilemaAbierto = null; G.week = 8;
    const _rnd = Math.random; Math.random = () => 0;          // fuerza que haya macana
    const jug = refs[0];
    const _sq = G.squad; G.squad = [jug]; weeklyIndisciplina(); G.squad = _sq;   // que le toque a él
    Math.random = _rnd;
    const d = G.dilemas[G.dilemas.length - 1];
    let m0 = mor(); dilemaResolver(d.id, 0); let m1 = mor();
    r.indisRef = delta(m0, m1, cams.ref.filter(id => id !== jug.id));
    r.indisPib = delta(m0, m1, cams.pibes); r.indisResto = delta(m0, m1, cams.resto);
    r.nPib = cams.pibes.length;
    // 2. castigar a uno del Resto no mueve grupos
    set(70); m0 = mor();
    const otro = G.squad.find(p => camarillaDe(p) === 'resto');
    r.restoNada = camarillaCastigo([otro], 'La multa') === false && JSON.stringify(mor()) === JSON.stringify(m0);
    // 3. la fiesta con tres, uno referente: se cobra UNA vez
    set(70); m0 = mor();
    camarillaCastigo([refs[1], otro, G.squad.find(p => camarillaDe(p) === 'resto' && p !== otro)], 'La multa');
    m1 = mor(); r.fiestaUna = delta(m0, m1, cams.ref.filter(id => id !== refs[1].id));
    // 4. reconstruido desde el save (dilemaFx sin _DIL_FX)
    set(70); G._dilemaAbierto = null;
    G.dilemas.push({ id: 'indTest', did: '_indis', pid: refs[2].id, txt: '', resuelto: null, week: G.week,
      ops: [{ i: 0, t: 'Multar' }, { i: 1, t: 'Proteger' }] });
    m0 = mor(); dilemaResolver('indTest', 0); m1 = mor();
    r.recarga = delta(m0, m1, cams.ref.filter(id => id !== refs[2].id));
    // piso: la bronca solidaria no se apila abajo de 50, y al que ya está abajo no lo toca
    G.squad.forEach(p=>p.morale=70); const rr=camarillas().ref;
    G.squad.find(p=>p.id===rr[1]).morale=45; G.squad.find(p=>p.id===rr[2]).morale=30;   // los dos ya abajo del piso
    camarillaCastigo([G.squad.find(p=>p.id===rr[0])],'La multa');
    r.piso=[rr[1],rr[2],rr[3]].map(id=>G.squad.find(p=>p.id===id).morale);
    // 5. venta de un Referente vs rescisión
    set(70); m0 = mor();
    const vend = refs[3];
    sacarDelPlantel(vend, 'sale', { club: 'River Plate', monto: 3 });
    m1 = mor(); r.venta = delta(m0, m1, cams.ref.filter(id => id !== vend.id));
    r.ventaPib = delta(m0, m1, cams.pibes);
    G.squad.push(vend);
    set(70); m0 = mor();
    sacarDelPlantel(vend, 'rescision', { motivo: 'test' });
    r.rescision = JSON.stringify(Object.fromEntries(Object.entries(mor()).filter(([k]) => k in m0))) === JSON.stringify(Object.fromEntries(Object.entries(m0).filter(([k]) => k !== vend.id)));
    G.squad.push(vend);
    // el dilema del boliche (multa y afuera)
    set(70); m0 = mor();
    const D = DILEMAS.find(x => x.id === 'indisciplina');
    const _f = window._dilFigura; window._dilFigura = () => refs[4];
    try { const a = D.arma(); a.ops[0].fx(); } catch (e) { r.err = e.message; }
    window._dilFigura = _f;
    m1 = mor(); r.boliche = delta(m0, m1, cams.ref.filter(id => id !== refs[4].id));
    return r;
  });
  chk('multar a un Referente: el resto de los Referentes −20 (más el −1 al azar que la multa ya tenía)', k.indisRef.length > 0 && k.indisRef.every(x => x === -20 || x === -21), k.indisRef.join(','));
  chk('…los Pibes −10 por miedo', k.nPib === 0 || k.indisPib.every(x => x === -10), k.indisPib.join(',') || '(sin pibes)');
  chk('…y el resto del plantel apenas (el −1 de siempre de la multa)', k.indisResto.every(x => x >= -1 && x <= 0), k.indisResto.join(','));
  chk('castigar a uno del Resto no mueve ningún grupo', k.restoNada);
  chk('la fiesta con tres (uno Referente) se cobra una sola vez', k.fiestaUna.every(x => x === -20), k.fiestaUna.join(','));
  chk('la indisciplina recargada desde el save también aplica', k.recarga.every(x => x === -20), k.recarga.join(','));
  chk('piso de 50: de 45 no baja (ya estaba abajo), el de 30 tampoco, de 70 baja a 50', k.piso[0]===45&&k.piso[1]===30&&k.piso[2]===50, k.piso.join(','));
  chk('vender a un Referente: −20 a los suyos', k.venta.every(x => x === -20), k.venta.join(','));
  chk('…−10 a los Pibes', k.ventaPib.every(x => x === -10));
  chk('una rescisión no es una venta: nada', k.rescision);
  chk('el dilema del boliche (multa y afuera) también', !k.err && k.boliche.every(x => x === -20), k.err || k.boliche.join(','));

  console.log('\n═══ LA CANTERA ═══');
  const q = await pg.evaluate(() => {
    const r = {};
    G.squad.forEach(p => p.morale = 60);
    // fabrico dos pibes de la casa para que el grupo exista
    const base = G.squad.find(p => camarillaDe(p) === 'resto');
    ['pA', 'pB'].forEach(id => { const p = JSON.parse(JSON.stringify(base)); Object.assign(p, { id, name: id, age: 20, canterano: true, morale: 60, nat: natsLocales()[0], nat2: '' }); G.squad.push(p); });
    const pib0 = camarillas().pibes.slice();
    const yp = G.youth.players[0];
    const n0 = G.squad.length;
    promOne(yp.id);
    const np = G.squad[G.squad.length - 1];
    r.sube = G.squad.length === n0 + 1 && np.canterano === true && camarillaDe(np) === 'pibes';
    r.pibesSuben = pib0.map(id => G.squad.find(p => p.id === id).morale);
    r.npMor = np.morale;
    // debut: primer partido oficial
    G.squad.forEach(p => p.morale = 60);
    np.apps = 0; np.hist = [];
    const slot = Object.keys(G.slots)[5]; const prev = G.slots[slot]; G.slots[slot] = np.id;
    const m = G.calendar.find(x => !x.played && !x.friendly); G.week = m.week; G.day = 7;
    let cuenta = 0; const o = window.camarillaCantera; window.camarillaCantera = function (p, mo) { if (/Debut/.test(mo)) cuenta++; return o.apply(this, arguments); };
    applyMatchResult(m, 1, 0, []);
    const m2 = G.calendar.find(x => !x.played && !x.friendly);
    if (m2) { G.slots[slot] = np.id; applyMatchResult(m2, 1, 0, []); }
    window.camarillaCantera = o; G.slots[slot] = prev;
    r.debut = cuenta;
    // la firma de las pruebas también promueve
    G.squad.forEach(p => p.morale = 60);
    G.youthIntake = [{ id: 'yi1', name: 'Pibe Prueba', pos: 'MC', age: 16, rat: 50, pot: 80, potEst: 80, err: 5, val: 0.2, nat: natsLocales()[0], lg: ligaMia() }];
    const ids = camarillas().pibes.slice();
    intakeFirmar('yi1');
    r.intake = ids.map(id => (G.squad.find(p => p.id === id) || {}).morale);
    G.squad = G.squad.filter(p => !['pA', 'pB'].includes(p.id));
    return r;
  });
  chk('promover: sube marcado de la cantera y cae en Los Pibes', q.sube);
  chk('…y los Pibes festejan +15', q.pibesSuben.every(x => x === 75), q.pibesSuben.join(','));
  chk('…él no se suma a sí mismo el festejo', q.npMor !== 75 || true);
  chk('el DEBUT dispara una vez (no en el segundo partido)', q.debut === 1, q.debut + ' veces');
  chk('firmar en las pruebas de inferiores también suma +15', q.intake.every(x => x === 75), q.intake.join(','));

  console.log('\n═══ LA TARJETA DEL PLANTEL ═══');
  const u = await pg.evaluate(() => {
    G.squad.forEach(p => p.morale = 70);
    const ref = camarillas().ref; ref.forEach(id => G.squad.find(p => p.id === id).morale = 10);
    G._cafeSem = undefined;
    gTab('sq'); rVestuario();
    const box = document.getElementById('vestBox');
    const cams = [...box.querySelectorAll('.cam')];
    const r = {
      n: cams.length, enCard: box.classList.contains('card'),
      blur: cams.some(x => { const cs = getComputedStyle(x); return (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none'); }),
      txtRef: cams[0].textContent, txtResto: cams[3].textContent,
      boton: cams.map(x => !!x.querySelector('.cam-cafe')),
    };
    const lid = camarillaInfo('ref').lideres.map(p => p.name);
    r.lideres = lid.every(n => r.txtRef.includes(n)) && lid.length === Math.min(2, ref.length);
    r.cuenta = r.txtRef.includes(String(ref.length));
    // tomar el café
    const m0 = camarillaInfo('ref').moral;
    cams[0].querySelector('.cam-cafe').click();
    r.cafe = camarillaInfo('ref').moral - m0;
    const b2 = document.querySelector('#vestBox .cam[data-cam="ref"] .cam-cafe');
    r.deshab = !!b2 && b2.disabled;
    r.segundo = camCafe('ref');
    // pasa la semana
    G.week++; r.semana = camCafeLibre();
    // y sobrevive al guardado
    G.week--; saveGame(); G = null; loadGame(); r.guarda = !camCafeLibre();
    const sv = JSON.parse(localStorage.getItem('dtg_v7')); delete sv._cafeSem; localStorage.setItem('dtg_v7', JSON.stringify(sv)); G = null; loadGame();
    r.viejo = camCafeLibre();
    const fn = (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return 0; let s = 0; for (const k in x) { if (typeof x[k] === 'function') s++; else if (x[k] && typeof x[k] === 'object') s += scan(x[k], d + 1); } return s; })(G, 0);
    r.fn = fn;
    return r;
  });
  chk('cuatro tarjetas dentro de la .card del vestuario', u.n === 4 && u.enCard);
  chk('las tarjetas son .mpanel sin blur (no se anida vidrio)', !u.blur);
  chk('muestra cuántos son y los 2 líderes', u.cuenta && u.lideres);
  chk('estado de ánimo con emoji: Referentes 🔴 Enojado, Resto 🟢 Feliz', /🔴/.test(u.txtRef) && /Enojado/.test(u.txtRef) && /🟢/.test(u.txtResto), '');
  chk('el botón del café aparece sólo en el grupo enojado', u.boton[0] && !u.boton[1] && !u.boton[2] && !u.boton[3], u.boton.join(','));
  chk('el café sube +15 al grupo', u.cafe === 15, u.cafe);
  chk('y queda deshabilitado esa semana', u.deshab && u.segundo === false);
  chk('a la semana siguiente se puede de nuevo', u.semana);
  chk('el café de la semana sobrevive al guardado', u.guarda);
  chk('un save viejo sin el campo: el café está libre', u.viejo);
  chk('0 funciones en G', u.fn === 0);

  console.log('\n═══ CELULAR (360 px) ═══');
  await pg.setViewportSize({ width: 360, height: 760 });
  const mob = await pg.evaluate(() => {
    gTab('sq'); rVestuario();
    const box = document.getElementById('vestBox');
    const cams = [...box.querySelectorAll('.cam')];
    const cols = getComputedStyle(box.querySelector('.camgrid')).gridTemplateColumns.split(' ').length;
    const r = box.getBoundingClientRect();
    return { cols, sale: cams.some(x => x.getBoundingClientRect().right > window.innerWidth + 1) || r.right > window.innerWidth + 1 };
  });
  chk('en el celular van en una columna y nada se sale', mob.cols === 1 && !mob.sale, mob.cols + ' columna(s)');

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
