// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 84: modo DT completo, retiros reales, 15 eventos + el
// armado a mano, la economía de los grandes, la Supercopa y la roja que
// cambia el partido
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase84.js
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
  const ARRANCA = (club, modo, liga) => `(()=>{localStorage.clear();localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    ${liga ? `setLigaSel('${liga}');` : ''}
    setModo('${modo || 'pres'}'); startGame(${liga ? `Object.keys(TEAMS).find(k=>TEAMS[k].name==='${club}')` : `'${club}'`}); try{autoFill();preseasonSaltear();closeMod();}catch(e){} })()`;

  console.log('\n═══ MODO DT: LA PANTALLA DICE DE QUIÉN ES CADA COSA ═══');
  const d = await pg.evaluate((A) => {
    eval(A); const o = {};
    updateUI();
    o.clase = document.body.classList.contains('modo-dt');
    o.banner = !!document.querySelector('#tab-pat > .modo-banner') && !!document.querySelector('#tab-stad > .modo-banner');
    // la charla presidente → DT no se abre siendo DT
    closeMod(); let abrio = false;
    try { openDtTalk(); abrio = document.getElementById('modOv') && document.getElementById('modOv').classList.contains('open') && /pedido|Pedile/i.test(document.getElementById('modOv').innerText); } catch (e) { }
    o.charla = /openDtTalk/.test(JSON.stringify(MODO_SOLO_PRES));
    closeMod();
    // carrera: te echan y te llegan ofertas de tu nivel para abajo
    const mio = nivelClub(G.teamName);
    G.careerOffers = [];
    o.nOf = dtCarreraOfertas(true);
    o.ofs = (G.careerOffers || []).map(x => x.club + ' ' + x.rep);
    o.abajo = (G.careerOffers || []).every(x => x.rep <= mio);
    o.html = /Aceptar/.test(dtCarreraHTML());
    const dt0 = { name: G.dt.name, rat: G.dt.rat };
    const off = G.careerOffers[0];
    if (off) { acceptCareerOffer(off.club); }
    o.nuevo = G.teamName; o.esOferta = off && G.teamName === off.club;
    o.mismoDT = G.dt.name === dt0.name; o.sigueDT = G.modo === 'dt' && dtIsMine();
    return o;
  }, ARRANCA('boca', 'dt'));
  chk('siendo DT, el cuerpo de la página lleva modo-dt (los botones del presidente van apagados)', d.clase);
  chk('Patrocinadores y Estadio avisan que eso lo maneja el presidente', d.banner);
  chk('la charla "presidente → DT" está en la tabla de lo que sólo hace el presidente', d.charla);
  chk('si te echan, te llegan ofertas de clubes de tu nivel o de abajo', d.nOf >= 1 && d.abajo && d.html, d.ofs.join(' · '));
  chk('aceptar te lleva al club nuevo con TU técnico y seguís siendo DT', d.esOferta && d.mismoDT && d.sigueDT, d.nuevo);

  console.log('\n═══ LOS VETERANOS SE RETIRAN ═══');
  const r = await pg.evaluate((A) => {
    eval(A); const o = {};
    const tira = (age, rat, n) => { let k = 0; for (let i = 0; i < n; i++) if (retiroAzar({ age, rat, apps: 5, name: 'x' + i })) k++; return k / n; };
    o.p33 = tira(33, 70, 2000); o.p36 = tira(36, 70, 4000); o.p36c = tira(36, 86, 4000); o.p39 = tira(39, 66, 4000);
    // una temporada con veteranos forzados en el plantel y en el mercado
    G.squad.slice(0, 4).forEach((p, i) => { p.age = 37 + (i % 2); p.rat = 66; });
    const mk = G.market.filter(p => p.club !== 'Libre').slice(0, 300); mk.forEach(p => { p.age = 38; p.rat = 75; });
    const ids = new Set(mk.map(p => p.id));
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0) } catch (e) { } }); if (prensaPend()) prensaResolver(0); };
    let g = 0; while (G.calendar.some(m => !m.played) && g++ < 400) { dr(); G.day = 7; simMatch(true); closeMod(); }
    const r0 = (G.retirados || []).length, pool0 = (G.dtPool || []).length;
    try { nextSeason(); } catch (e) { o.err = e.message; }
    o.ret = (G.retirados || []).length - r0;
    o.mkt = G.market.filter(p => ids.has(p.id)).length;
    o.pool = (G.dtPool || []).length - pool0;
    o.news = (G.news || []).some(n => /se retir|colg/i.test(n.msg || ''));
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('a los 33 nadie se retira por el dado', r.p33 === 0);
  chk('a los 36 se retira cerca de 1 de 3; la figura bastante menos', r.p36 > 0.22 && r.p36 < 0.42 && r.p36c < r.p36 * 0.6, (r.p36 * 100).toFixed(0) + '% · figura ' + (r.p36c * 100).toFixed(0) + '%');
  chk('a los 39 casi todos cuelgan los botines', r.p39 > 0.7, (r.p39 * 100).toFixed(0) + '%');
  chk('al cerrar la temporada se retiran veteranos del plantel', r.ret >= 2, r.ret + ' retirados' + (r.err ? ' · ERR ' + r.err : ''));
  chk('el mercado también envejece: se van veteranos de otros clubes', r.mkt < 270, (300 - r.mkt) + ' de 300 se retiraron');
  chk('algunos retirados del mercado entran al pool de técnicos y sale la noticia', r.pool > 0 && r.news, '+' + r.pool + ' DTs');

  console.log('\n═══ 15 EVENTOS, Y EL ARMADO A MANO ═══');
  const e1 = await pg.evaluate(() => ({ n: Object.keys(EVENTOS).length, keys: Object.keys(EVENTOS) }));
  chk('hay por lo menos 10 eventos (son ' + e1.n + ')', e1.n >= 10, e1.keys.join(', '));
  const evs = {};
  for (const k of ['elclasico', 'premier', 'liberta', 'd2000']) {
    evs[k] = await pg.evaluate((T) => new Promise(res => { eventoArmar(T, (ok, l) => res({ ok, l: l || [], kb: Math.round((localStorage.getItem(EVENTO_KEY) || '').length / 1024) })); }), k);
  }
  chk('El Clásico eterno: sólo Real Madrid y Barcelona', evs.elclasico.ok && evs.elclasico.l.every(x => /^(Real Madrid|Barcelona) \d{4}$/.test(x)), evs.elclasico.l.length + ' equipos');
  chk('Premier de leyendas: uno por club, sin el mismo club dos veces con otro nombre', evs.premier.ok && new Set(evs.premier.l.map(x => x.replace(/ \d{4}$/, '').replace(/ Fc$/, ''))).size === evs.premier.l.length, evs.premier.l.slice(0, 6).join(', '));
  chk('Libertadores de leyendas mezcla países', evs.liberta.ok && evs.liberta.l.some(x => /^(Flamengo|Palmeiras|Corinthians|São Paulo|Santos|Botafogo|Internacional|Grêmio|Fluminense)/.test(x)) && evs.liberta.l.some(x => /^(Boca|River)/.test(x)));
  chk('La década del 2000: todos los años entre 2000 y 2009', evs.d2000.ok && evs.d2000.l.every(x => { const y = +x.slice(-4); return y >= 2000 && y <= 2009; }));
  chk('cada evento entra holgado en localStorage', Object.values(evs).every(x => x.kb < 400), Object.values(evs).map(x => x.kb + 'KB').join(' · '));

  const W = (f) => pg.waitForFunction(f, null, { timeout: 90000 });
  await pg.evaluate(() => { localStorage.removeItem(EVENTO_KEY); _EVENTO_DB = null; tsIr(1); evManAbrir(); });
  const m0 = await pg.evaluate(() => /arm[aá] tu propia liga/i.test(document.getElementById('tsWizard').innerText));
  await pg.evaluate(() => evManAnio(2018)); await W(() => _evMan.y === 2018);
  await pg.evaluate(() => { evManLiga('Liga ARG'); ['River Plate', 'Boca Juniors', 'Racing Club'].forEach(c => evManAgregar(c)); });
  const m1 = await pg.evaluate(() => { evManFiltro('river'); return document.getElementById('evManClubs').innerText; });
  await pg.evaluate(() => evManAnio(2014)); await W(() => _evMan.y === 2014);
  await pg.evaluate(() => { evManLiga('Liga ARG'); ['San Lorenzo', 'Boca Juniors'].forEach(c => evManAgregar(c)); });
  await pg.evaluate(() => evManAnio(2026)); await W(() => _evMan.y === 2026);
  await pg.evaluate(() => { evManLiga('España'); ['Real Madrid', 'Barcelona', 'Atlético'].forEach(c => evManAgregar(c)); evManLiga('Premier'); ['Man City', 'Liverpool'].forEach(c => evManAgregar(c)); evManAgregar('Liverpool'); });
  const m2 = await pg.evaluate(() => _evMan.sel.length);
  await pg.evaluate(() => { _evMan.nombre = 'Copa del Presi'; evManArmar(); });
  await W(() => typeof eventoActivo === 'function' && eventoActivo());
  const man = await pg.evaluate(() => {
    const o = { nombre: eventoNombre(), lig: ligasJugables(), cl: clubesDeCategoria('Leyendas').length, tam: LIGA_TAM['Leyendas'] };
    document.getElementById('teamSelect').style.display = 'none';
    startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === 'River Plate 2018')); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    o.club = G.teamName; o.db = G.dbSeason; o.sq = G.squad.length; o.stad = G.stadium.name;
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0) } catch (e) { } }); if (prensaPend()) prensaResolver(0); };
    let g = 0; while (G.calendar.some(m => !m.played) && g++ < 400) { dr(); G.day = 7; simMatch(true); closeMod(); }
    o.pj = leagueSorted()[0].pj;
    saveGame(); return o;
  });
  chk('el armado a mano se abre en el inicio', m0);
  chk('el buscador filtra los clubes del año', /RIVER/i.test(m1) && !/BOCA/i.test(m1));
  chk('no deja meter dos veces el mismo club del mismo año', m2 === 10, m2 + ' elegidos');
  chk('arma la liga con el nombre que le pusiste y los años mezclados', man.nombre === 'Copa del Presi' && man.cl === 10 && man.tam === 10 && man.lig.includes('Leyendas'));
  chk('River 2018 juega en su cancha con plantel de 2018 y la temporada se completa', man.club === 'River Plate 2018' && man.db === 'LEY' && man.sq >= 25 && /Monumental/.test(man.stad) && man.pj === 18, man.stad + ' · ' + man.pj + ' fechas');
  const pg2 = await ctx.newPage(); pg2.on('pageerror', e => errs.push('P2 ' + e.message));
  await pg2.goto(F, { waitUntil: 'load' }); await pg2.waitForTimeout(500);
  const rel = await pg2.evaluate(() => { const ok = loadGame(); return { ok, club: G.teamName, ev: eventoActivo(), tam: LIGA_TAM['Leyendas'], nom: LIGA_NOMBRE['Leyendas'] }; });
  await pg2.close();
  chk('recargando, la partida del evento a mano vuelve con su liga', rel.ok && rel.club === 'River Plate 2018' && rel.ev && rel.tam === 10 && rel.nom === 'Copa del Presi');

  console.log('\n═══ LA ECONOMÍA DE LOS GRANDES ═══');
  const ec = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.m70 = granClubPrimaMult(70); o.m78 = granClubPrimaMult(78); o.m85 = granClubPrimaMult(85); o.m92 = granClubPrimaMult(92);
    // contrato de un save viejo con el bono de 3,5 semanas guardado
    o.wb = spnWinBonus({ income: 0.2, winBonus: 0.7 });
    // una renovación ya no se infla sobre el contrato vigente
    const cat = SPONSORS.find(s => s.cat !== 'Naming Estadio' && sponsorEnRegion(s, ligaMia()));
    G.rep = 92; G.sponsors = [{ id: cat.id, cat: cat.cat, name: cat.name, income: sponIncome(cat) * 8, reqRep: cat.reqRep, weeks: 52, weeksLeft: 3, weeksTotal: 52, winBonus: 0, obj: { bonus: 0 } }];
    G.sponsorOffers = [];
    weeklySponsorsVida();
    const of = G.sponsorOffers.find(x => x.renov);
    o.renov = of ? of.weekly : null; o.techo = Math.round(sponIncome(cat) * SPN_RENOV_TOPE * 1.1 * 1000) / 1000;
    // la ofertaza del dilema
    const D = DILEMAS.find(x => x.id === 'ofertaza'); const p = G.squad[0]; p.val = 206;
    const _f = window._dilFigura; window._dilFigura = () => p;
    try { const t = D.arma(); o.oferta = +(t.ops[0].d.match(/[\d.,]+/)[0].replace(',', '.')); o.txt = t.ops[0].d; } catch (e) { o.ofErr = e.message; }
    window._dilFigura = _f;
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('debajo de la reputación de Boca no hay prima de club grande (el balance calibrado no se mueve)', ec.m70 === 0 && ec.m78 === 0);
  chk('arriba, la prima sobre la masa salarial crece con la reputación', ec.m85 > 1 && ec.m92 > ec.m85 && ec.m92 <= 3.01, ec.m85.toFixed(2) + '× · ' + ec.m92.toFixed(2) + '×');
  chk('el bono por victoria de un contrato viejo (3,5 semanas) se cobra como media semana', Math.abs(ec.wb - 0.1) < 1e-6, String(ec.wb));
  chk('renovar un sponsor sale del catálogo: no se infla sobre el contrato vigente', ec.renov !== null && ec.renov <= ec.techo + 1e-6, ec.renov + ' ≤ ' + ec.techo);
  chk('la "oferta irrechazable" ya no paga el doble del récord mundial', ec.oferta > 0 && ec.oferta <= 260, ec.txt || ec.ofErr);

  // Real Madrid, una temporada entera firmando todo lo que llega
  const rm = await pg.evaluate((A) => {
    eval(A);
    const b0 = G.budget;
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, d.ops && d.ops.length > 1 && /ofertaza/.test(d.did || '') ? 1 : 0); (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0) } catch (e) { } }); if (prensaPend()) prensaResolver(0); };
    let g = 0; while (G.calendar.some(m => !m.played) && g++ < 400) { dr(); G.day = 7; simMatch(true); closeMod(); (G.sponsorOffers || []).slice().forEach(o => { try { spnFirmar(o.oid) } catch (e) { } }); }
    const f = G.fin[G.season] || {};
    return { b0, b1: G.budget, ventas: f.ventas || 0, sueldos: f.sueldos || 0, spons: f.sponsors || 0 };
  }, ARRANCA('Real Madrid', 'pres', 'España'));
  const netoRM = rm.b1 - rm.b0 - rm.ventas;
  chk('el Real Madrid ya no gana cientos de millones por temporada', netoRM < 90, 'neto sin ventas ' + Math.round(netoRM) + 'M · sueldos ' + Math.round(rm.sueldos) + 'M · sponsors ' + Math.round(rm.spons) + 'M');

  console.log('\n═══ LA SUPERCOPA ═══');
  const sc = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.nom = supercopaNombre('Liga ARG') + ' · ' + supercopaNombre('España') + ' · ' + supercopaNombre('Premier');
    o.no = armarSupercopa();                                       // sin títulos el año pasado, no hay
    G.trophies = [{ name: copaNacPref(), season: G.season - 1 }];
    o.si = armarSupercopa();
    const m = G.calendar.find(x => x.comp && x.comp.startsWith('Supercopa Argentina'));
    o.m = m && (m.comp + ' vs ' + (m.home === G.teamName ? m.away : m.home));
    o.otra = armarSupercopa();                                      // no se duplica
    if (!m) { o.dbg = { T: supercopaTitulos(G.season - 1), lg: ligaMia(), nom: supercopaNombre(), ev: eventoActivo(), c: G.calendar.filter(x => /Super/.test(x.comp)).map(x => x.comp), team: G.teamName, tro: G.trophies }; return o; }
    // se gana: va a la vitrina y paga
    premiosTitulos();                                               // se ancla (como en el juego, que lo llama después de cada partido)
    const t0 = G.trophies.length, b0 = G.budget;
    m.played = true; m.score = m.home === G.teamName ? '2-0' : '0-2'; m.result = 'W';
    resolveCopaCorta(m); premiosTitulos();
    o.trof = G.trophies.length - t0; o.premio = Math.round((G.budget - b0) * 10) / 10;
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('cada liga tiene su supercopa con el nombre real', sc.nom === 'Supercopa Argentina · Supercopa de España · Community Shield', sc.nom);
  chk('sin títulos el año pasado no se juega; con la copa sí, contra un grande de tu liga', !sc.no && sc.si && /Final/.test(sc.m || ''), sc.m);
  chk('no se arma dos veces', !sc.otra);
  chk('ganarla va a la vitrina y cobra premio', sc.trof === 1 && sc.premio >= 1, '+' + sc.premio + 'M');

  console.log('\n═══ LA ROJA CAMBIA EL PARTIDO ═══');
  const rj = await pg.evaluate((A) => {
    eval(A); const o = {};
    const a = rojaMult({ mia: null, rival: null }, 0, 45); o.neutro = a.my === 1 && a.op === 1;
    const b2 = rojaMult({ mia: 10, rival: null }, 45, 90); o.b = [b2.my, b2.op];
    const c = rojaMult({ mia: 80, rival: null }, 0, 45); o.c = c.my === 1 && c.op === 1;
    const half = rojaMult({ mia: 67.5, rival: null }, 45, 90); o.half = [half.my, half.op];
    let n = 0, nr = 0; const m = G.calendar.find(x => !x.played);
    for (let i = 0; i < 4000; i++) { const R = simRojas(m); if (R.mia) n++; if (R.rival) nr++; }
    o.pM = n / 4000; o.pR = nr / 4000;
    // la tarjeta de verdad es la del sorteo: un expulsado en el once, ni uno más
    let rojos = 0, ok2 = 0;
    for (let i = 0; i < 6; i++) {
      const mm = G.calendar.find(x => !x.played); if (!mm) break;
      G._rojaSim = { mia: 30, rival: null };
      G.squad.forEach(p => { p.susp = 0; });
      const xi = Object.values(G.slots || {}).filter(Boolean);
      applyMatchResult(mm, 1, 1);
      const r = G.squad.filter(p => p._redMatch).length; rojos += r; if (r === 1) ok2++;
      G.squad.forEach(p => { p.susp = 0; });
    }
    o.ok2 = ok2;
    // sin sorteo previo (jugadas clave / 11v11) sigue el dado de siempre
    G._rojaSim = null; o.sinSorteo = true;
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('sin expulsados no cambia nada', rj.neutro && rj.c);
  chk('con uno menos desde el 10, el 2º tiempo se genera 30% menos y se recibe 35% más', Math.abs(rj.b[0] - 0.70) < 1e-9 && Math.abs(rj.b[1] - 1.35) < 1e-9, rj.b.map(x => x.toFixed(2)).join(' / '));
  chk('a mitad del tiempo, la mitad del efecto', Math.abs(rj.half[0] - 0.85) < 1e-9 && Math.abs(rj.half[1] - 1.175) < 1e-9);
  chk('la frecuencia es la de siempre (~1 roja cada 8 partidos)', rj.pM > 0.08 && rj.pM < 0.22 && rj.pR > 0.08 && rj.pR < 0.18, 'mía ' + (rj.pM * 100).toFixed(1) + '% · rival ' + (rj.pR * 100).toFixed(1) + '%');
  chk('la roja del sorteo es la que se anota: exactamente un expulsado', rj.ok2 === 6, rj.ok2 + ' de 6');

  // simular de verdad: el resumen lo cuenta y G._rojaSim no queda colgado
  const sm = await pg.evaluate((A) => {
    eval(A); const o = {};
    let g = 0; while (G.calendar.find(x => !x.played).friendly && g++ < 20) { G.day = 7; simMatch(true); closeMod(); }
    const _s = window.simRojas; window.simRojas = () => ({ mia: 20, rival: 60 });
    G.day = 7; simMatch(false);
    window.simRojas = _s;
    const t = document.getElementById('modOv') ? document.getElementById('modOv').innerText : '';
    o.resumen = /diez a los 20/.test(t) && /diez a los 60/.test(t);
    o.colgado = G._rojaSim; o.T = G._tiempos && [G._tiempos.rojaMia, G._tiempos.rojaRival];
    closeMod();
    o.fn = (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return 0; let r = 0; for (const k in x) { if (typeof x[k] === 'function') r++; else if (x[k] && typeof x[k] === 'object') r += scan(x[k], d + 1); } return r; })(G, 0);
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('el resumen del partido cuenta las dos expulsiones con su minuto', sm.resumen && sm.T && sm.T[0] === 20 && sm.T[1] === 60);
  chk('el sorteo no queda colgado para el partido siguiente', !sm.colgado);
  chk('0 funciones en G', sm.fn === 0, String(sm.fn));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
