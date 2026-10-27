// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 80: tope salarial con la caja, simulación partido a
// partido, fechas reales y ventanas, el formato de cada época de la Liga
// ARG (con promedios), la puja en el mercado, oportunidades, ventas del
// Director Deportivo y la campaña de socios
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase80.js
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
  // Juega la temporada entera contestando todo lo que frena
  const TEMPORADA = `(()=>{let g=0;const dr=()=>{let d;while((d=dilemaBloqueante()))dilemaResolver(d.id,0);
    (G.dilemas||[]).filter(x=>x.resuelto===null).forEach(x=>{try{dilemaResolver(x.id,0)}catch(e){}});
    if(prensaPend())prensaResolver(0);};
    while(G.calendar.some(m=>!m.played)&&g++<400){dr();G.day=7;simMatch(true);closeMod();} })()`;

  console.log('\n═══ EL TOPE SALARIAL MIRA LA CAJA ═══');
  const tope = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.base = topeDetalle();
    G.budget = 28; o.con28 = topeDetalle();
    G.budget = 200; o.con200 = topeDetalle();
    o.bloquea200 = topeBloquea(600);
    G.budget = 28; o.bloquea28 = topeBloquea(600);
    G.budget = -10; o.rojo = topeDetalle();
    G.budget = 60; G.boardConf = 95; G.autoridad = 90;
    const r0 = Math.random; Math.random = () => 0.01; pedirAmpliacion(); Math.random = r0;
    o.amp = topeDetalle().amp; o.ampBase = Math.round(o.base.base * 0.15);
    pedirAmpliacion(); o.ampDos = G.wageAmp.k;
    gTab('pres'); try { rPresTab(); } catch (e) {}
    o.ui = !!document.getElementById('topeBox');
    return o;
  }, ARRANCA('boca'));
  chk('con 200M la caja suma tope (antes: el mismo con 28M que con 200M)', tope.con200.tope > tope.con28.tope + 1500, tope.con28.tope + 'k → ' + tope.con200.tope + 'k');
  chk('un sueldo de 600k entra con 200M y no entra con 28M', tope.bloquea200 === false && tope.bloquea28 === true);
  chk('con la caja en rojo vale sólo lo aprobado', tope.rojo.caja === 0 && tope.rojo.tope === tope.rojo.base);
  chk('la ampliación de la CD suma 15% y es una por temporada', tope.amp === tope.ampBase && tope.ampDos === tope.amp, tope.amp + 'k');
  chk('la tarjeta del tope se dibuja en Presidente', tope.ui);

  console.log('\n═══ SIMULACIÓN: PARTIDO A PARTIDO O TODO JUNTO ═══');
  const sim = await pg.evaluate((A) => {
    eval(A); const o = {};
    G.day = 7; openContinuousSim();
    o.elegir = /Partido a partido/i.test(document.getElementById('modOv').innerText) && /Todo junto/i.test(document.getElementById('modOv').innerText);
    csModo('paso');
    const pj0 = G.calendar.filter(m => m.played).length;
    runContinuousSim(3);
    o.carta1 = /Partido 1 de 3/i.test(document.getElementById('modOv').innerText);
    o.pj1 = G.calendar.filter(m => m.played).length - pj0;
    o.fecha = /\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/.test(document.getElementById('modOv').innerText);
    let g = 0; while (_CS && g++ < 10) { while (dilemaBloqueante()) dilemaResolver(dilemaBloqueante().id, 0); if (prensaPend()) prensaResolver(0); csPaso(); }
    o.pj3 = G.calendar.filter(m => m.played).length - pj0;
    o.resumen = /simulado/i.test(document.getElementById('modOv').innerText);
    closeMod();
    csModo('todo'); const pjA = G.calendar.filter(m => m.played).length;
    G.day = 7; runContinuousSim(4);
    o.todo = G.calendar.filter(m => m.played).length - pjA;
    o.todoResumen = /simulado/i.test(document.getElementById('modOv').innerText);
    o.modoGuardado = localStorage.getItem('dt_csmodo');
    closeMod();
    return o;
  }, ARRANCA('boca'));
  chk('la simulación continua te deja elegir el modo', sim.elegir);
  chk('partido a partido: juega UNO y muestra la carta con su fecha', sim.carta1 && sim.pj1 === 1 && sim.fecha);
  chk('siguiendo la seguidilla se juegan los 3 y sale el resumen', sim.pj3 >= 3 && sim.resumen, sim.pj3 + ' partidos');
  chk('todo junto juega los 4 de una y da el resumen', sim.todo >= 4 && sim.todoResumen, sim.todo + ' partidos');
  chk('el modo elegido se recuerda en el navegador (no en G)', sim.modoGuardado === 'todo');

  console.log('\n═══ FECHAS DE VERDAD Y VENTANAS ═══');
  const fe = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.dia1 = fechaTxt(1, 1); o.wTop = document.getElementById('wTop').textContent;
    o.ventanas = ventanasPases().map(v => [v.ini, v.fin]);
    const C = G.arPhases.clausura.start;
    o.invEnHueco = o.ventanas[1][0] >= G.arPhases.apertura.last && o.ventanas[1][0] <= C;
    G.week = o.ventanas[1][0]; o.abierto = isTransferWindowOpen(); o.estado = getWindowStatus();
    G.week = o.ventanas[1][1] + 1; o.cerrado = !isTransferWindowOpen();
    G.week = 1;
    gTab('cal'); try { rCal(); } catch (e) {}
    o.agenda = (document.getElementById('agendaBox') || {}).innerText || '';
    return o;
  }, ARRANCA('boca'));
  chk('Boca 2026 arranca el lunes 5 de enero', fe.dia1 === 'lun 5 ene 2026', fe.dia1);
  chk('la cabecera muestra la fecha, no "S1"', /ene/.test(fe.wTop), fe.wTop);
  chk('la ventana de mitad de año cae en el hueco entre Apertura y Clausura', fe.invEnHueco, JSON.stringify(fe.ventanas));
  chk('abre y cierra cuando dice, y lo dice con fecha', fe.abierto && fe.cerrado && /cierra el/.test(fe.estado), fe.estado);
  chk('la agenda trae el mercado, las finales y la última fecha', /Abre el mercado/.test(fe.agenda) && /Cierra el mercado/.test(fe.agenda) && /Final/.test(fe.agenda) && /Última fecha/.test(fe.agenda));
  const esp = await pg.evaluate(() => {
    localStorage.clear(); document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('España'); const id = Object.keys(TEAMS).find(k => TEAMS[k].name === 'Real Madrid');
    startGame(id); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {}
    const v = ventanasPases()[1];
    return { ini: fechaTxt(1, 1), inv: fechaTxt(v.ini, 1), invFin: fechaTxt(v.fin, 7) };
  });
  chk('LaLiga arranca en julio y el mercado de invierno es en enero', /jul/.test(esp.ini) && /(dic|ene)/.test(esp.inv) && /(ene|feb)/.test(esp.invFin), esp.ini + ' · ' + esp.inv + ' → ' + esp.invFin);

  console.log('\n═══ CADA ÉPOCA CON SU TORNEO ═══');
  const era = async (y) => pg.evaluate(async ([y, A, T]) => {
    await new Promise(r => cargarTemporada(y, r)); aplicarTemporada(y);
    eval(A); const o = { fmt: formatoARG() };
    o.phases = G.arPhases ? Object.keys(G.arPhases).map(k => (G.arPhases[k].tipo || 'po') + ':' + (G.arPhases[k].label || '')) : null;
    o.liga = G.calendar.filter(m => m.comp === 'Liga Profesional').length;
    o.idaVuelta = G.calendar.filter(m => m.comp === 'Liga Profesional').length >= (G.ligaClubs || []).length * 2 - 2;
    o.copaArg = G.calendar.some(m => /Copa Argentina/.test(m.comp));
    o.julio = /jul/.test(fechaTxt(1, 1));
    eval(T);
    o.pend = (G.arFix || []).filter(f => !f.played).length;
    o.cerr = G.arPhases ? Object.values(G.arPhases).every(p => p.cerrada) : null;
    o.camp = G.arCampeones ? Object.keys(G.arCampeones).filter(k => k !== 'season').length : 0;
    o.prom = descPromedios() ? promediosTabla(leagueSorted()).length : 0;
    gTab('cal'); try { rCal(); } catch (e) {}
    o.uiProm = /Promedios/i.test((document.getElementById('calView') || {}).innerText || '');
    o.trofeos = (G.trophies || []).map(x => x.name);
    return o;
  }, [y, ARRANCA('boca'), TEMPORADA]);
  const e05 = await era(2005);
  chk('2005: Apertura y Clausura cortos, una rueda cada uno, campeón por puntos', e05.fmt === 'cortos' && JSON.stringify(e05.phases) === '["tabla:Apertura","tabla:Clausura"]', JSON.stringify(e05.phases));
  chk('2005: no hay Copa Argentina (volvió en 2011) y arranca en julio', !e05.copaArg && e05.julio);
  chk('2005: la temporada se juega entera y salen los dos campeones', e05.pend === 0 && e05.cerr && e05.camp === 2, 'campeones ' + e05.camp);
  chk('2005: se baja por promedios y la tabla de promedios se ve', e05.prom > 10 && e05.uiProm);
  const e17 = await era(2017);
  chk('2017: torneo largo de una rueda, sin fases', e17.fmt === 'largo' && e17.phases === null && !e17.idaVuelta && e17.liga >= 25, e17.liga + ' fechas');
  chk('2017: la temporada se juega entera, con promedios', e17.pend === 0 && e17.prom > 10);
  const e22 = await era(2022);
  chk('2022: Copa de la Liga (playoffs) + Liga Profesional (tabla)', e22.fmt === 'ligacopa' && JSON.stringify(e22.phases) === '["po:Copa de la Liga","tabla:Liga Profesional"]', JSON.stringify(e22.phases));
  chk('2022: las dos fases cierran y la Liga tiene campeón', e22.pend === 0 && e22.cerr && e22.camp >= 1);
  const hoy = await pg.evaluate((A) => { aplicarTemporada(2026); eval(A); return { fmt: formatoARG(), zonas: !!G.arZones }; }, ARRANCA('boca'));
  chk('2026 sigue con las zonas de hoy', hoy.fmt === 'zonas' && hoy.zonas);

  console.log('\n═══ LA PUJA ═══');
  const pu = await pg.evaluate((A) => {
    eval(A); const o = {};
    G.budget = 300;
    const p = G.market.find(x => x.rat >= 76 && x.rat <= 80 && !esLibre(x) && x.club !== G.teamName);
    G.negs = G.negs || [];
    const n = { pid: p.id, name: p.name, club: p.club, stage: 'esperando_club', wage: 50, years: 3, bid: askingPrice(p), rounds: 0, wait: 3,
      rivals: ['Rival FC'], rivalBids: [{ club: 'Rival FC', bid: askingPrice(p) * 1.2 }], topRival: askingPrice(p) * 1.2, rivalTope: askingPrice(p) * 1.8, deadline: 5 };
    G.negs.push(n);
    openNegsPanel(); o.boton = /Pujar/i.test(document.getElementById('modOv').innerText);
    const r0 = Math.random; Math.random = () => 0.01; negPujar(p.id); Math.random = r0;
    o.subio = n.topRival > askingPrice(p) * 1.2; o.miPuja = n.miPuja;
    const r1 = Math.random; Math.random = () => 0.99; negPujar(p.id); Math.random = r1;
    o.sebajo = !(n.rivals || []).length;
    // al vencer el plazo con mi oferta arriba, no lo pierdo
    n.rivals = ['Otro']; n.rivalBids = [{ club: 'Otro', bid: 1 }]; n.topRival = 1; n.miPuja = 5; n.deadline = 1; n.wait = 0; n.stage = 'jugador_ok';
    const r2 = Math.random; Math.random = () => 0.99; weeklyNegotiations(); Math.random = r2; o.sigue = !!G.market.find(x => x.id === p.id) && !(negFind(p.id).rivals || []).length;
    closeMod(); return o;
  }, ARRANCA('boca'));
  chk('el panel de negociaciones tiene el botón de pujar', pu.boton);
  chk('el rival contesta: sube o se baja', pu.subio && pu.sebajo);
  chk('con tu oferta más alta al vencer el plazo, el rival se va y el jugador sigue', pu.sigue);

  console.log('\n═══ OPORTUNIDADES, VENTAS DEL DD Y CAMPAÑA DE SOCIOS ═══');
  const op = await pg.evaluate((A) => {
    eval(A); const o = {};
    const id0 = (G.phoneMsgs[0] || {}).id;
    o.lista = oportunidades().map(x => x.tag);
    gTab('mkt'); try { renderMkt(); } catch (e) {}
    o.ui = !!document.getElementById('opBox');
    o.sinMensajes = (G.phoneMsgs[0] || {}).id === id0;
    o.niebla = oportunidades().filter(x => /Ganga|Joya/.test(x.tag)).every(x => isKnown(x.p));
    // ventas del Director Deportivo
    const v = G.squad.filter(p => pgr(p.pos) !== 'ARQ').sort((a, b) => a.rat - b.rat)[0];
    v.wantsOut = true;
    juntaVentas(dirDeportivo());
    const a = aprobaciones().find(x => x.k === 'venta');
    o.carpeta = !!a && a.pid === v.id;
    if (a) aprobFirmar(a.aid);
    o.enVenta = v.listed === 'sale';
    // campaña
    const s0 = G.socios || sociosBase(), b0 = G.budget;
    campanaSocios(); o.socios = (G.socios || 0) - s0; o.costo = Math.round((b0 - G.budget) * 10) / 10;
    campanaSocios(); o.unaVez = (G.socios || 0) - s0 === o.socios;
    const fn = (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return 0; let r = 0; for (const k in x) { if (typeof x[k] === 'function') r++; else if (x[k] && typeof x[k] === 'object') r += scan(x[k], d + 1); } return r; })(G, 0);
    o.fn = fn;
    // save viejo: sin los campos nuevos
    saveGame(); const raw = JSON.parse(localStorage.getItem('dtg_v7'));
    ['wageAmp', 'campana', 'promHist', 'arSnap', 'arCampeones'].forEach(k => delete raw[k]);
    localStorage.setItem('dtg_v7', JSON.stringify(raw)); G = null; loadGame();
    o.viejo = !!G && topeSalarial() > 0 && agendaTemporada().length > 3;
    try { G.day = 7; simMatch(true); closeMod(); o.juega = true; } catch (e) { o.juega = e.message; }
    return o;
  }, ARRANCA('boca'));
  chk('el Mercado muestra oportunidades de la semana', op.ui && op.lista.length >= 2, op.lista.join(' | '));
  chk('armar las oportunidades no manda mensajes al celular', op.sinMensajes);
  chk('la ganga y la joya respetan la niebla de guerra', op.niebla);
  chk('el Director Deportivo propone una venta en la Carpeta y al firmar queda en venta', op.carpeta && op.enVenta);
  chk('la campaña de socios suma socios, cuesta plata y es una por temporada', op.socios > 0 && op.costo > 0 && op.unaVez, '+' + op.socios + ' por ' + op.costo + 'M');
  chk('0 funciones en G', op.fn === 0);
  chk('un save sin los campos nuevos carga y sigue jugando', op.viejo && op.juega === true, String(op.juega));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
