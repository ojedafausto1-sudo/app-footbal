// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 107: presidente y DT a la vez, estrategias que cambian
// el partido, entrenamiento con techo y la interfaz "noche de partido"
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase107.js
//
// Qué blinda:
//  1. El rol "Presidente y DT": se elige en el inicio, sos el técnico (DT
//     propio) sin perder nada del presidente, el técnico de antes vuelve al
//     mercado, y nadie te pide refuerzos ni se pelea con vos: te habla el
//     ayudante de campo, con datos. Contratar un DT de verdad te devuelve al rol
//     de presidente solo (es derivado, no un campo).
//  2. Ponerte de DT cuando hay un técnico con contrato cobra su cláusula.
//  3. Las estrategias: siete juegos de perillas + mentalidad, cada una con su
//     familiaridad, que se aprende jugándola y entrenándola.
//  4. La simulación: el plan va fuera del tope de tacMod (antes el tope se lo
//     comía) y la mentalidad es un ida y vuelta de goles, no un bono.
//  5. El entrenamiento: la sesión tiene techo, cansa y la clase particular ya
//     no sube la media (antes €2M llevaban un 70 a 80).
//  6. La interfaz: botón Continuar, tablero de Central con datos, la letra
//     nueva local, sin vidrio en las filas.
//  7. Guardado: el rol y la familiaridad sobreviven; un save viejo carga.
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
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ EL ROL: PRESIDENTE Y DT ═══');
  const R = await pg.evaluate(() => {
    const o = {};
    o.roles = [...document.querySelectorAll('.modo-btn')].map(b => b.dataset.m).join(',');
    setModo('ambos');
    o.guarda = localStorage.getItem('dt_modo');
    o.marcado = !!document.querySelector('.modo-btn[data-m="ambos"].diff-sel');
    document.getElementById('teamSelect').style.display = 'none';
    // el técnico de Boca que había antes de sentarte vos
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    o.rol = rolJuego(); o.modo = G.modo; o.dt = G.dt.name; o.soyYo = !!G.dt.soyYo; o.mio = dtIsMine();
    o.bloq = tacBloqueada(); o.dtRat = G.dt.rat;
    o.top = document.getElementById('dtTop').textContent;
    // el de antes volvió al mercado como libre
    o.libres = (G.dtPool || []).filter(d => !d.club).length;
    // nada de lo del presidente rebota (en modo DT se envuelve)
    o.modoDT = modoDT();
    let abrio = false; const _s = window.showMod; window.showMod = function () { abrio = true; return _s.apply(this, arguments); };
    try { openContract(G.squad[3].id); } catch (e) { }
    window.showMod = _s; o.renovar = abrio; closeMod();
    // nadie te pide nada ni se pelea con vos
    G.dtRequests = []; for (let i = 0; i < 5; i++) genDtRequest(); o.pedidos = G.dtRequests.length;
    const r0 = G.dtRel; setDtRel(-40); o.rel = G.dtRel === r0;
    let fl = ''; const _f = window.flash; window.flash = (t) => { fl = t; }; openDtTalk(); window.flash = _f; o.charla = fl;
    // el celular: el ayudante
    openPhone(); phTab('dt');
    o.tab = document.querySelector('.ph-tab[onclick*="\'dt\'"]').textContent;
    o.botones = document.querySelectorAll('#phScreen .ph-qrbtn').length;
    o.informes = Object.keys(AYU_PREG).map(k => ayudanteInforme(k));
    closePhone();
    const _r = Math.random; Math.random = () => 0; const n0 = (G.phoneMsgs || []).length; const id0 = G.phoneMsgs[0] && G.phoneMsgs[0].id;
    weeklyDtVoice(); Math.random = _r;
    o.voz = G.phoneMsgs[0] && G.phoneMsgs[0].id !== id0 ? G.phoneMsgs[0].from : '';
    return o;
  });
  chk('hay tres roles en el inicio', R.roles === 'pres,dt,ambos', R.roles);
  chk('elegir el rol queda marcado y recordado', R.marcado && R.guarda === 'ambos');
  chk('arrancás de presidente y DT a la vez', R.rol === 'ambos' && R.modo === 'pres' && R.soyYo && R.mio, `${R.rol} · DT ${R.dt}`);
  chk('la táctica es tuya', !R.bloq);
  chk('arrancás como técnico de 68', R.dtRat === 68);
  chk('la cabecera dice el rol', R.top === 'Presidente y DT', R.top);
  chk('el técnico que estaba vuelve al mercado', R.libres > 0, R.libres + ' libres');
  chk('lo del presidente no rebota (renovar abre la negociación)', !R.modoDT && R.renovar);
  chk('el DT no te pide refuerzos a vos mismo', R.pedidos === 0);
  chk('la relación con el DT no se mueve (sos vos)', R.rel);
  chk('la charla con el DT te dice que el técnico sos vos', /técnico sos vos/.test(R.charla));
  chk('en el celular te habla el ayudante, con 5 preguntas', /Ayudante/.test(R.tab) && R.botones === 5, R.tab);
  chk('los informes del ayudante tienen datos y no se rompen', R.informes.every(t => t && t.length > 25 && !/undefined|NaN|true sem/.test(t)), R.informes.map(t => t.replace(/<[^>]+>/g, '').slice(0, 40)).join(' | '));
  chk('la voz semanal es del ayudante', R.voz === 'Ayudante de campo', R.voz);

  const R2 = await pg.evaluate(() => {
    const o = {};
    // contratar un DT de verdad te devuelve al rol de presidente solo
    const yo = G.dt;
    G.dt = { name: 'Un Técnico', rat: 75, trait: 'Equilibrado', style: '4-4-2', salary: 40, contract: { clause: 'media' } };
    o.rol = rolJuego(); o.bloq = tacBloqueada();
    // ponerte de DT con un técnico con contrato cobra su cláusula
    o.cl = _cdtClausula();
    const b0 = G.budget;
    openCustomDTModal(); o.aviso = /cláusula/.test(document.getElementById('modOv').textContent);
    confirmCustomDT();
    o.cobro = Math.round((b0 - G.budget) * 10) / 10;
    o.rol2 = rolJuego(); o.rat = G.dt.rat; o.enPool = (G.dtPool || []).some(d => d.name === 'Un Técnico' && !d.club);
    G.dt = yo; G.dtRequests = [];
    return o;
  });
  chk('contratar un DT de verdad te deja de presidente solo', R2.rol === 'pres' && R2.bloq);
  chk('ponerte de DT avisa y cobra la cláusula del que estaba', R2.aviso && R2.cl > 0 && R2.cobro === R2.cl, `€${R2.cobro}M`);
  chk('y el técnico vuelve al mercado; vos arrancás de 68', R2.rol2 === 'ambos' && R2.enPool && R2.rat === 68);

  console.log('\n═══ ESTRATEGIAS ═══');
  const E = await pg.evaluate(() => {
    const o = {};
    gTab('tac');
    o.tarjetas = document.querySelectorAll('#styleOpts .estr').length;
    o.n = ESTRATEGIAS.length;
    o.ini = estrategiaActual();
    estrategiaAplicar('contra');
    o.act = estrategiaActual(); o.ment = mentActual();
    o.perillas = Object.keys(ESTRATEGIAS.find(e => e.k === 'contra').v).every(k => G[k] === ESTRATEGIAS.find(e => e.k === 'contra').v[k]);
    o.enUso = !!document.querySelector('#styleOpts .estr.on');
    o.fam0 = tacFam();
    tacFamSemana(); o.fam1 = tacFam();
    o.otraBaja = tacFamDe('propia');
    // tocar una perilla te deja en "tu idea"
    setTac('width', 'Amplio'); o.propia = estrategiaActual();
    estrategiaAplicar('contra'); o.vuelve = estrategiaActual() === 'contra' && tacFam() === o.fam1;
    // la familiaridad escala el plan en la simulación
    const m = G.calendar.find(x => !x.played && !x.friendly);
    G.tacFamPor.contra = 100; const S1 = matchStrengths(m);
    G.tacFamPor.contra = 40; const S0 = matchStrengths(m);
    o.esc = S1.planMod ? +(S0.planMod / S1.planMod).toFixed(3) : null;
    o.tope = S1.tacMod <= 0.045 + 1e-9 && Math.abs(S1.planMod) <= 0.075 + 1e-9;
    // con un DT de la IA no se toca
    const yo = G.dt; G.dt = { name: 'X', rat: 70, trait: 'Equilibrado', style: '4-4-2' };
    const g0 = G.linea; estrategiaAplicar('presion'); o.bloqIA = G.linea === g0; o.famIA = tacFam();
    G.dt = yo;
    // la lectura: cuánto le calza cada una
    const L = estrategiasLectura(); o.lect = L.L.length; o.rival = !!L.rival;
    o.nums = L.L.every(r => isFinite(r.goles) && r.ataque >= 4 && r.ataque <= 96);
    o.ataques = L.L.map(r => r.k + ':' + r.ataque).join(' ');
    o.presVsCerrojo = L.L.find(r => r.k === 'presion').ataque > L.L.find(r => r.k === 'cerrojo').ataque;
    return o;
  });
  chk('siete estrategias, todas dibujadas', E.n === 7 && E.tarjetas >= 7, E.tarjetas + ' tarjetas');
  chk('al arrancar jugás "tu idea" (la del técnico que estaba)', E.ini === 'propia');
  chk('aplicar una estrategia pone las ocho perillas y la mentalidad', E.act === 'contra' && E.perillas && E.ment === 'Defensivo' && E.enUso);
  chk('una estrategia nueva arranca poco aprendida y se afianza jugándola', E.fam0 === 40 && E.fam1 === 45, `${E.fam0} → ${E.fam1}`);
  chk('la que no usás se olvida de a poco', E.otraBaja < 80, 'tu idea quedó en ' + E.otraBaja);
  chk('tocar una perilla te deja en tu idea, y volver no pierde lo aprendido', E.propia === 'propia' && E.vuelve);
  chk('la familiaridad escala el plan: a 40% rinde el 64% (0,4+0,6·0,4)', E.esc === 0.64, 'cociente ' + E.esc);
  chk('el plan tiene su tope y tacMod el suyo', E.tope);
  chk('con un DT de la IA la estrategia la elige él (y el plantel la conoce: 85%)', E.bloqIA && E.famIA === 85);
  chk('la lectura de las estrategias da números', E.lect === 7 && E.rival && E.nums, E.ataques);
  chk('presión alta es más ofensiva que cerrar el arco', E.presVsCerrojo);

  console.log('\n═══ LA SIMULACIÓN: PLAN Y MENTALIDAD ═══');
  const S = await pg.evaluate(() => {
    const o = {};
    const base = { myRatEq: 72, modF: 1, tacMod: TAC_CENTRO, diffMod: 0, oppRat: 72, homeBonus: 0.032 };
    const n = xgDeS(base), of = xgDeS({ ...base, ment: 'Ofensivo' }), de = xgDeS({ ...base, ment: 'Defensivo' }), eq = xgDeS({ ...base, ment: 'Equilibrado' });
    o.eq = n.my === eq.my && n.op === eq.op;
    o.of = of.my > n.my && of.op > n.op; o.de = de.my < n.my && de.op < n.op;
    // ¿a quién le conviene? el favorito ataca, el que corre de atrás se cierra
    const pts = (S) => { const x = xgDeS(S); return puntosEsperados(x.my, x.op); };
    const fav = { ...base, myRatEq: 80, oppRat: 70 }, und = { ...base, myRatEq: 64, oppRat: 76 };
    o.favOf = pts({ ...fav, ment: 'Ofensivo' }) > pts(fav);
    o.undDe = pts({ ...und, ment: 'Defensivo' }) > pts(und);
    o.undOf = pts({ ...und, ment: 'Ofensivo' }) < pts(und);
    o.difs = [pts(fav), pts({ ...fav, ment: 'Ofensivo' }), pts(und), pts({ ...und, ment: 'Defensivo' })].map(x => x.toFixed(3)).join(' / ');
    // el plan entra fuera del tope: ±1,8 puntos de fuerza
    const p0 = xgDeS({ ...base, planMod: 0 }).my, p1 = xgDeS({ ...base, planMod: 0.075 }).my;
    o.plan = +(p1 - p0).toFixed(3);
    // el plan le calza al plantel: presionar con piernas suma, sin piernas resta
    const xi = Object.values(G.slots).filter(Boolean).map(id => G.squad.find(p => p.id === id));
    const prof = { press: .9, line: .88, direct: .5, counter: .5, width: .5, cyn: .5, disc: .5 };
    const guard = xi.map(p => ({ ...p.attrs }));
    xi.forEach(p => { ensureAttrs(p); p.attrs.VEL = 88; p.attrs.FIS = 88; p.attrs.DEF = 80; });
    const rap = planFit(prof, xi, 0).tFit;
    xi.forEach(p => { p.attrs.VEL = 55; p.attrs.FIS = 55; p.attrs.DEF = 60; });
    const len = planFit(prof, xi, 0).tFit;
    xi.forEach((p, i) => { p.attrs = guard[i]; });
    o.rap = +rap.toFixed(3); o.len = +len.toFixed(3);
    // la contra rinde contra el que es mejor que vos
    const pc = { press: .22, line: .18, direct: .88, counter: .88, width: .18, cyn: .5, disc: .5 };
    o.contraVsMejor = planFit(pc, xi, -0.08).tFit > planFit(pc, xi, 0.08).tFit;
    // un save viejo (sin ment ni planMod) da lo de siempre
    o.viejo = JSON.stringify(xgDeS(base)) === JSON.stringify(xgDeS({ ...base, ment: undefined, planMod: undefined }));
    return o;
  });
  chk('equilibrada = lo de siempre', S.eq);
  chk('ofensiva: más goles para los dos lados', S.of);
  chk('defensiva: menos para los dos', S.de);
  chk('al favorito le conviene atacar', S.favOf, S.difs);
  chk('al que corre de atrás le conviene cerrarse, y atacar le cuesta', S.undDe && S.undOf);
  chk('el plan al tope suma fuera del tope de tacMod (~+0,18 goles)', S.plan > 0.15 && S.plan < 0.22, '+' + S.plan);
  chk('presión alta: con piernas suma, sin piernas resta', S.rap > 0 && S.len < 0, `${S.rap} / ${S.len}`);
  chk('la contra rinde más contra un rival mejor', S.contraVsMejor);
  chk('una medición vieja guardada da lo mismo', S.viejo);

  console.log('\n═══ ENTRENAMIENTO ═══');
  const T = await pg.evaluate(() => {
    const o = {};
    gTab('trn');
    o.ses = document.querySelectorAll('#trainOpts .ses').length;
    o.ind = document.querySelectorAll('#indTrain .ind-f').length === G.squad.length;
    // la sesión sube +1 hasta el techo, y no más
    const p = G.squad.find(x => x.pos !== 'ARQ' && x.age > 21 && !x.injured); ensureAttrs(p);
    const techo = techoAttr(p);
    p.attrs.VEL = techo - 1; const f0 = p.fit = 100;
    G.trainedWeek = 0; doTrain('fis');
    o.sube = p.attrs.VEL === techo; o.cansa = p.fit === f0 - 3;
    G.trainedWeek = 0; doTrain('fis'); o.techo = p.attrs.VEL === techo;
    o.unaPorSemana = (() => { const v = p.attrs.VEL; doTrain('fis'); return p.attrs.VEL === v; })();
    // recuperación
    G.trainedWeek = 0; G.squad.forEach(x => x.fit = 70); doTrain('rec'); o.rec = G.squad.filter(x => !x.injured).every(x => x.fit === 78);
    // sesión táctica: +12 a la estrategia en uso
    G.trainedWeek = 0; const fa = tacFam(); doTrain('tact'); o.tact = Math.round(tacFam() - fa);
    // la clase particular ya no sube la media, una cada 4 semanas, con techo
    const q = G.squad.find(x => x.pos !== 'ARQ' && x.age > 21 && x.rat < (x.pot || 99) && !x.injured); ensureAttrs(q);
    const rat0 = q.rat, b0 = G.budget, a0 = { ...q.attrs };
    for (let i = 0; i < 20; i++) { q._claseW = 0; const k = Object.keys(q.attrs)[i % 6]; trAttr(q.id, k); }
    o.media = q.rat === rat0;
    // el que ya venía por encima de su techo (su especialidad) no sube más
    o.techoClase = Object.keys(q.attrs).every(k => q.attrs[k] <= Math.max(a0[k], techoAttr(q)));
    q._claseW = 0; const k = Object.keys(q.attrs).find(k => q.attrs[k] < techoAttr(q) - 2);
    if (k) { trAttr(q.id, k); const v = q.attrs[k]; trAttr(q.id, k); o.cada4 = q.attrs[k] === v; } else o.cada4 = true;
    // el foco individual avanza de a poco
    const r = G.squad.find(x => x.pos !== 'ARQ' && x.age >= 30 && !x.injured) || G.squad[6]; ensureAttrs(r);
    r.attrs.PAS = Math.min(r.attrs.PAS, techoAttr(r) - 6); const pa = r.attrs.PAS;
    setFoco(r.id, 'PAS'); closeMod();
    for (let i = 0; i < 20; i++) focoSemana(r, 1);
    o.foco = r.attrs.PAS - pa;
    return o;
  });
  chk('nueve sesiones y el foco individual para todo el plantel', T.ses === 9 && T.ind);
  chk('la sesión sube hasta el techo del jugador y no más', T.sube && T.techo);
  chk('las sesiones pesadas cansan', T.cansa);
  chk('una sesión por semana', T.unaPorSemana);
  chk('la de recuperación devuelve 8 de físico', T.rec);
  chk('la sesión táctica afianza la estrategia (+12)', T.tact === 12, '+' + T.tact);
  chk('la clase particular ya no sube la media (antes 2 clases = +1)', T.media);
  chk('y no pasa el techo, una cada 4 semanas', T.techoClase && T.cada4);
  chk('el foco individual de un veterano: ~1 punto cada 10 semanas', T.foco === 2, '+' + T.foco + ' en 20 semanas');

  console.log('\n═══ LA INTERFAZ ═══');
  const U = await pg.evaluate(async () => {
    const o = {};
    closeMod(); gTab('ov');
    const b = document.getElementById('fCont');
    o.boton = !!b && b.offsetWidth > 0;
    o.lbl = document.getElementById('fContTxt').textContent;
    G.calendar.forEach(x => { if (x.friendly) x.played = true; });
    let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0);
    const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 1; updateUI();
    o.lbl1 = document.getElementById('fContTxt').textContent;
    continuar(); closeMod();
    o.dia = esDiaDePartido();
    while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0); closeMod(); updateUI();
    o.lbl2 = document.getElementById('fContTxt').textContent;
    o.pulsa = b.classList.contains('partido');
    continuar(); o.previa = document.getElementById('modOv').classList.contains('on') || getComputedStyle(document.getElementById('modOv')).display !== 'none';
    o.previaTxt = document.getElementById('modOv').textContent.slice(0, 200);
    closeMod();
    // el tablero de Central
    gTab('ov'); const P = [...document.querySelectorAll('#ovTiles .ht.dash')];
    o.paneles = P.map(x => x.querySelector('.ht-t').textContent).join(',');
    o.sucio = P.some(x => /undefined|NaN|<b>|&lt;/.test(x.innerHTML.replace(/<[^>]*>/g, ' ')) || /undefined|NaN/.test(x.textContent));
    // la letra nueva, local
    await document.fonts.ready;
    o.fuente = document.fonts.check('700 20px ArchivoVF');
    o.stitle = getComputedStyle(document.querySelector('#tab-ov .stitle')).fontFamily;
    // sin vidrio en las filas (estrategias, sesiones, foco)
    gTab('tac'); const e = document.querySelector('.estr'); gTab('trn'); const s = document.querySelector('.ses'), f = document.querySelector('.ind-f');
    o.blur = [e, s, f].some(x => x && getComputedStyle(x).backdropFilter !== 'none');
    o.fondo = getComputedStyle(document.body).backgroundColor;
    return o;
  });
  chk('el botón Continuar está en la barra de mando', U.boton, U.lbl);
  chk('dice qué va a hacer: hasta el partido', U.lbl1 === 'hasta el partido', U.lbl1);
  chk('lleva al día del partido', U.dia);
  chk('el día del partido dice "ir al partido" y se marca', U.lbl2 === 'ir al partido' && U.pulsa, U.lbl2);
  chk('y abre la previa', U.previa && /\S/.test(U.previaTxt));
  chk('Central: cuatro paneles con datos', U.paneles.split(',').length === 4 && /Bandeja/.test(U.paneles) && /Mercado/.test(U.paneles), U.paneles);
  chk('los paneles no muestran basura', !U.sucio);
  chk('la letra nueva está cargada (local)', U.fuente && /ArchivoVF/.test(U.stitle), U.stitle);
  chk('sin vidrio en las filas', !U.blur);
  chk('el fondo es el de noche de partido', U.fondo === 'rgb(10, 17, 32)', U.fondo);

  console.log('\n═══ GUARDADO ═══');
  const G2 = await pg.evaluate(() => {
    const o = {};
    estrategiaAplicar('presion'); G.tacFamPor.presion = 77;
    let fn = 0; (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return; for (const k in x) { const v = x[k]; if (typeof v === 'function') fn++; else if (v && typeof v === 'object') scan(v, d + 1); } })(G, 0);
    o.fn = fn;
    saveGame(); G = null; loadGame();
    o.rol = rolJuego(); o.estr = estrategiaActual(); o.fam = tacFam();
    // un save viejo, sin familiaridad ni nada de esta fase
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    delete raw.tacFamPor; delete raw.tacFam; if (raw._S) { delete raw._S.planMod; delete raw._S.ment; }
    (raw.squad || []).forEach(p => { delete p._foco; delete p._focoAcc; delete p._claseW; });
    localStorage.setItem(SAVE_KEY, JSON.stringify(raw)); G = null; loadGame();
    o.viejo = !!G && isFinite(tacFam());
    try { const m = G.calendar.find(x => !x.played && !x.friendly); const S = matchStrengths(m); o.sim = isFinite(xgDeS(S).my); simMatch(true); closeMod(); o.jugo = true; } catch (e) { o.err = e.message; }
    return o;
  });
  chk('0 funciones en G', G2.fn === 0);
  chk('el rol, la estrategia y su familiaridad sobreviven al guardado', G2.rol === 'ambos' && G2.estr === 'presion' && G2.fam === 77, `${G2.rol} · ${G2.estr} · ${G2.fam}`);
  chk('un save viejo carga y juega', G2.viejo && G2.sim && G2.jugo, G2.err || '');

  chk('0 pedidos a la red', red.length === 0, red.slice(0, 2).join(' '));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
