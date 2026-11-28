// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 78: ascenso/descenso, mercado de técnicos, lesiones con
// decisión, semana del clásico y galería de técnicos
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase78.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  const ARRANCA = (club) => `(()=>{localStorage.clear();localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    startGame('${club}'); try{autoFill();preseasonSaltear();closeMod();}catch(e){} })()`;

  console.log('\n═══ LA PRIMERA NACIONAL TIENE RIVALES DE VERDAD ═══');
  const nac = await pg.evaluate(() => {
    localStorage.clear(); document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('Primera Nacional');
    const c = clubesDeCategoria('Primera Nacional')[0];
    startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === c));
    const pows = G.ligaClubs.filter(x => x !== G.teamName).map(x => Math.round(clubPower(x)));
    return { liga: G.miLiga, distintos: new Set(pows).size, todos66: pows.every(p => p === 66),
             conocida: G.market.filter(p => G.ligaClubs.includes(p.club)).slice(0, 50).every(isKnown) };
  });
  chk('cada rival vale lo que vale su plantel (antes: 66 fijo para todos)', nac.liga === 'Primera Nacional' && !nac.todos66 && nac.distintos >= 5, nac.distintos + ' valores distintos');
  chk('la niebla de guerra no te tapa tu propia liga', nac.conocida);

  console.log('\n═══ DESCENDER Y QUEDARSE · ASCENDER ═══');
  const asc = await pg.evaluate((A) => {
    eval(A); const o = {};
    ensureLeague(); const T = G.league.table;
    Object.keys(T).forEach((c, i) => T[c].pts = 50 + i); T[G.teamName].pts = 1;
    const otros = Object.keys(T).filter(c => c !== G.teamName).sort((a, b) => T[a].pts - T[b].pts);
    o.bajaIA = otros[0];
    G.boardConf = 60; G.fanMood = 60;
    nextSeason();
    o.modal = (document.getElementById('modOv') || {}).innerText || '';
    o.boton = /me quedo/i.test(o.modal);
    o.histUna = G.history.length;
    nextSeason();                          // cerrar el modal y volver a tocar "iniciar" no archiva dos veces
    o.histSigue = G.history.length;
    descensoQuedarse();
    o.liga = G.miLiga; o.zonas = !!G.arZones; o.season = G.season;
    o.bocaPrim = clubesPrimera().includes('Boca Juniors');
    o.iaPrim = clubesPrimera().includes(o.bajaIA);
    o.objetivo = G.boardTarget && G.boardTarget.desc;
    o.comps = [...new Set(G.calendar.map(m => m.comp))];
    o.hist = G.history.length; o.desc = !!G.history[0].descenso;
    saveGame(); G = null; loadGame();
    o.carga = [G.miLiga, clubesPrimera().includes('Boca Juniors'), clubesPrimera().includes(o.bajaIA), clubesPrimera().length];
    ensureLeague(); const T2 = G.league.table;
    Object.keys(T2).forEach((c, i) => T2[c].pts = 10 + i); T2[G.teamName].pts = 999;
    nextSeason();
    o.liga2 = G.miLiga; o.zonas2 = !!G.arZones; o.boca2 = clubesPrimera().includes('Boca Juniors');
    o.prim2 = clubesPrimera().length; o.asc = !!G.history[1].ascenso;
    o.libDesdeNac = G.calendar.some(m => /Libertadores/.test(m.comp));
    return o;
  }, ARRANCA('boca'));
  chk('salir último abre la asamblea con la opción de quedarse', asc.boton, asc.modal.slice(0, 60).replace(/\n/g, ' '));
  chk('retomar la temporada no la archiva dos veces', asc.histUna === 1 && asc.histSigue === 1);
  chk('quedarse: arranca en la Primera Nacional, sin zonas', asc.liga === 'Primera Nacional' && !asc.zonas && asc.comps.includes('Primera Nacional'), asc.comps.join(' · '));
  chk('Boca y el otro descendido salen de Primera', !asc.bocaPrim && !asc.iaPrim);
  chk('el objetivo pasa a ser ascender', /ascender/.test(asc.objetivo || ''), asc.objetivo);
  chk('el historial marca el descenso', asc.desc);
  chk('guardar y cargar conserva la categoría y la Primera (antes AR_CLUBS no se guardaba)', asc.carga[0] === 'Primera Nacional' && !asc.carga[1] && !asc.carga[2] && asc.carga[3] === 30, JSON.stringify(asc.carga));
  chk('salir 1º de la Nacional te devuelve a Primera con zonas', asc.liga2 === 'Liga ARG' && asc.zonas2 && asc.boca2 && asc.prim2 === 30 && asc.asc);
  chk('ascender no te mete en la Libertadores', !asc.libDesdeNac);

  const sinApoyo = await pg.evaluate((A) => {
    eval(A); ensureLeague(); const T = G.league.table;
    Object.keys(T).forEach((c, i) => T[c].pts = 50 + i); T[G.teamName].pts = 1;
    G.boardConf = 10; G.fanMood = 10;
    nextSeason();
    const txt = (document.getElementById('modOv') || {}).innerText || '';
    descensoQuedarse();
    return { boton: /me quedo/i.test(txt), liga: G.miLiga, season: G.season };
  }, ARRANCA('boca'));
  chk('sin respaldo de la asamblea no hay opción de quedarse', !sinApoyo.boton && sinApoyo.liga === 'Liga ARG' && sinApoyo.season === 2026);

  console.log('\n═══ EL MERCADO DE TÉCNICOS ═══');
  const dtm = await pg.evaluate((A) => {
    eval(A); const o = {}; ensureDtPool(); ensureLeague();
    const T = G.league.table, cl = Object.keys(T).filter(c => c !== G.teamName);
    // el más fuerte de la liga (sin contar a Boca) va último
    const fuerte = cl.slice().sort((a, b) => clubPower(b) - clubPower(a))[0];
    cl.forEach((c, i) => { T[c].pj = 12; T[c].pts = 18 + i; }); T[G.teamName].pj = 12; T[G.teamName].pts = 30;
    T[fuerte].pts = 2;
    const cand = dtCandidatoDespido();
    o.cand = cand && cand.r.club === fuerte;
    const dt = cand && cand.d; o.dtLiga = dt && (dt.league === 'Liga ARG');
    _dtDespedirIA(dt, 'test', true);
    o.vac = dtVacantes().some(v => v.club === fuerte);
    const rnd = Math.random; Math.random = () => 0.01;
    G.week += 2; dtContratarVacantes(); Math.random = rnd;
    const nuevo = G.dtPool.filter(d => d.club === fuerte && (d.league === 'Liga ARG'));
    o.cubierta = !dtVacantes().some(v => v.club === fuerte) && nuevo.length === 1;
    // un club grande se queda sin DT y va por el tuyo
    G._dtOfertaSem = 0; G._dilemaAbierto = null;
    const big = G.dtPool.find(d => d.club && nivelClub(d.club) >= nivelClub(G.teamName) + 5);
    G.dt.rat = 80; G.dt._ult = [3, 3, 3]; G.dt._xpUlt = [1, 1, 1];
    Math.random = () => 0.01; const ofe = dtOfertaPorElMio(big.club); Math.random = rnd;
    const dil = dilemaBloqueante();
    o.oferta = ofe && dil && dil.did === '_dtofe';
    const fee = dil.fee, b0 = G.budget, nom = G.dt.name;
    saveGame(); G = null; loadGame(); _DIL_FX = {};        // se reconstruye desde el did
    dilemaResolver(dilemaBloqueante().id, 0);
    o.cobro = Math.abs(G.budget - (b0 + fee)) < 0.15;
    o.interino = /Interino/.test(G.dt.name);
    o.seFue = (G.dtPool.find(d => d.name === nom) || {}).club === big.club;
    dtHistTick();
    const H = G.dtHist; o.gal = H.length >= 2 && /se fue a/.test(H[H.length - 2].motivo || '') && H[H.length - 1].interino;
    return o;
  }, ARRANCA('boca'));
  chk('en tu liga echan al que va muy por debajo de su plantel', dtm.cand);
  chk('se busca al DT por club Y liga (hay Racing en Argentina y Uruguay)', dtm.dtLiga);
  chk('el club que echa queda con la vacante y la cubre con UN técnico', dtm.vac && dtm.cubierta);
  chk('un club más grande sin DT va por el tuyo y frena el club', dtm.oferta);
  chk('dejarlo ir cobra la cláusula, queda un interino y el DT se muda (con el dilema reconstruido tras cargar)', dtm.cobro && dtm.interino && dtm.seFue);
  chk('la galería cierra al que se fue y abre al interino', dtm.gal);

  console.log('\n═══ LESIONES CON DECISIÓN ═══');
  const les = await pg.evaluate((A) => {
    eval(A); const o = {}; const rnd = Math.random;
    const xi = Object.values(G.slots).filter(Boolean).map(id => G.squad.find(p => p.id === id)).filter(p => p && p.pos !== 'ARQ');
    const sup = G.squad.find(p => !Object.values(G.slots).includes(p.id));
    const lesiona = (p, w) => { p.injured = true; p.injuredWeeks = w; p.injTotal = w; p.injType = 'Desgarro muscular'; };
    lesiona(sup, 5); o.suplente = !lesionDecision(sup); sup.injured = false; sup.injuredWeeks = 0;
    const a = xi[0]; lesiona(a, 5); o.dil = lesionDecision(a) && dilemaBloqueante() && dilemaBloqueante().did === '_lesion';
    dilemaResolver(dilemaBloqueante().id, 0); o.opera = a.injuredWeeks === 7 && a.reinjuryRisk === 0;
    const c = xi[1]; lesiona(c, 4); lesionDecision(c); dilemaResolver(dilemaBloqueante().id, 2);
    o.infil = !c.injured && c._infil && c._infil.sem === 4;
    Math.random = () => 0.99; infiltradosPartido([c]); o.zafa = !c.injured;
    Math.random = () => 0.01; infiltradosPartido([c]); Math.random = rnd;
    o.rompe = c.injured && c.injuredWeeks >= 6 && !c._infil;
    const d = xi[2]; lesiona(d, 4); lesionDecision(d); dilemaResolver(dilemaBloqueante().id, 2);
    for (let i = 0; i < 4; i++) infiltradosSemana(); o.sana = !d._infil && !d.injured;
    const e = xi[3]; lesiona(e, 12); lesionDecision(e); dilemaResolver(dilemaBloqueante().id, 2);
    o.grave = e.injured && !e._infil;
    // el plan acelerado ya no se puede deshacer gratis
    const f = xi[4]; lesiona(f, 5); f.recPlan = null;
    setRecovery(f.id, 'accel'); setRecovery(f.id, 'normal'); o.trampa = f.injuredWeeks === 5 && !f.reinjuryRisk;
    return o;
  }, ARRANCA('boca'));
  chk('al suplente no se le pregunta (no frena el club)', les.suplente);
  chk('el titular lesionado 3+ semanas abre la decisión', les.dil);
  chk('operar: ×1,4 de tiempo y sin riesgo de recaída', les.opera);
  chk('infiltrar: juega ya, con la lesión de fondo contando', les.infil);
  chk('infiltrado: si zafa sigue, si se rompe vuelve ×1,6', les.zafa && les.rompe);
  chk('pasadas las semanas, la infiltración termina sola', les.sana);
  chk('una lesión grave no se infiltra', les.grave);
  chk('acelerado → normal ya no deja las semanas recortadas gratis', les.trampa);

  console.log('\n═══ LA SEMANA DEL CLÁSICO ═══');
  const cla = await pg.evaluate((A) => {
    eval(A); const o = {};
    let m = G.calendar.find(x => !x.played && !x.friendly && (x.home === 'River Plate' || x.away === 'River Plate') && /Liga/.test(x.comp));
    G.calendar.forEach(x => { if (x !== m && x.week <= m.week) x.played = true; });
    G.week = m.week; G.day = 1; m.home = G.teamName; m.away = 'River Plate';
    G._dilemaAbierto = null;
    o.abre = clasicoPrevia() && dilemaBloqueante() && dilemaBloqueante().did === '_clasico';
    o.unaVez = !clasicoPrevia();
    o.frena = dilemaFrena(); try { closeMod(); } catch (e) {}
    dilemaResolver(dilemaBloqueante().id, 1);
    o.taq = clasicoTaquilla(m);
    const f0 = G.fanMood = 50; G._clasico.apuesta = 1.6; G._clasico.inc = 0;
    clasicoResultado(m, 'W', 2, 0, 'Superclásico'); o.subeGrande = G.fanMood - f0;
    G.fanMood = 50; clasicoResultado(m, 'W', 2, 0, 'Superclásico'); o.subeNormal = G.fanMood - 50;   // sin previa: ×1
    o.mundo = !!derbyOf('Real Madrid', 'Barcelona') && !!derbyOf('Inter', 'AC Milan') && !derbyOf('Boca Juniors', 'Aldosivi');
    return o;
  }, ARRANCA('boca'));
  chk('la semana del clásico abre la previa y frena el club', cla.abre && cla.frena);
  chk('la previa sale una sola vez por partido', cla.unaVez);
  chk('entradas del partido del año: borderó ×1,6 de local', cla.taq === 1.6, 'x' + cla.taq);
  chk('calentar la previa agranda las consecuencias', cla.subeGrande > cla.subeNormal && cla.subeNormal > 0, cla.subeGrande + ' vs ' + cla.subeNormal);
  chk('los clásicos del mundo cuentan (Madrid–Barsa, Inter–Milan)', cla.mundo);

  console.log('\n═══ GALERÍA Y ESTADO ═══');
  const gal = await pg.evaluate((A) => {
    eval(A); dtHistTick();
    const n0 = G.dt.name;
    for (let i = 0; i < 3; i++) dtHistPartido('W');
    G.trophies = (G.trophies || []).concat([{ name: 'Copa Test', season: G.season }]);
    dtHistTick();
    confirmFireDT(0, true); dtHistTick();
    const H = G.dtHist;
    gTab('pres'); try { rPresTab(); } catch (e) {}
    const txt = (document.getElementById('presDtGal') || {}).innerText || '';
    const fn = (function scan(o, d) { if (d > 7 || !o || typeof o !== 'object') return 0; let r = 0; for (const k in o) { if (typeof o[k] === 'function') r++; else if (o[k] && typeof o[k] === 'object') r += scan(o[k], d + 1); } return r; })(G, 0);
    return { n0, primero: H[0], ult: H[H.length - 1], txt: txt.slice(0, 200), fn };
  }, ARRANCA('boca'));
  chk('la galería anota partidos y títulos del que está sentado', gal.primero.name === gal.n0 && gal.primero.pj === 3 && gal.primero.g === 3 && gal.primero.tit.includes('Copa Test'));
  chk('al echarlo queda el motivo y entra el interino', /despedido/.test(gal.primero.motivo || '') && gal.ult.interino);
  chk('la tarjeta se dibuja en la pestaña Presidente', gal.txt.includes(gal.n0), gal.txt.slice(0, 60).replace(/\n/g, ' '));
  chk('0 funciones en G', gal.fn === 0);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
