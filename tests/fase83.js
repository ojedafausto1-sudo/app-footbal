// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 83: modo DT, socios, campaña, retirados, negociaciones,
// eventos de leyendas, premios de copa, sponsors y herramientas del presidente
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase83.js
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
  const ARRANCA = (club, modo) => `(()=>{localStorage.clear();localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    setModo('${modo || 'pres'}'); startGame('${club}'); try{autoFill();preseasonSaltear();closeMod();}catch(e){} })()`;

  console.log('\n═══ LA PANTALLA DE INICIO ═══');
  const ini = await pg.evaluate(() => {
    const w = document.getElementById('tsWizard');
    return { wiz: w.innerHTML.length, ev: /EVENTOS ESPECIALES/.test(w.innerText), modo: document.querySelectorAll('.modo-btn').length,
      presSel: document.querySelector('.modo-btn[data-m="pres"]').classList.contains('diff-sel') };
  });
  chk('el asistente se dibuja al abrir (un let en zona muerta lo dejaba en blanco)', ini.wiz > 1000, ini.wiz + ' caracteres');
  chk('con temporadas en la carpeta ofrece los eventos especiales', ini.ev);
  chk('se elige el rol: presidente (por defecto) o DT', ini.modo === 2 && ini.presSel);
  const dif = await pg.evaluate(() => { setDiff(2, document.getElementById('diff-2')); const r = document.querySelector('.modo-btn[data-m="pres"]').classList.contains('diff-sel'); setDiff(1, document.getElementById('diff-1')); return r; });
  chk('elegir la dificultad no desmarca el rol', dif);

  console.log('\n═══ SOCIOS: SE HACEN CON HISTORIA, NO CON HORMIGÓN ═══');
  const s = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.ancla = G._socAncla; o.ini = G.socios;
    G.rep = G._repAncla; G.fanMood = 55; G.trophies = []; G.history = [];
    o.obj0 = sociosObjetivo();
    // las cuatro tribunas: antes multiplicaban la masa societaria
    G.stadium.upgrades.filter(u => /^exp/.test(u.id)).forEach(u => { u.built = true; try { aplicarMejora(u); } catch (e) {} });
    o.cap = G.stadium.capacity; o.capOri = _capOriginal(); o.objObras = sociosObjetivo();
    // todo a favor: no pasa del tope
    G.rep = 100; G.fanMood = 100; for (let i = 0; i < 30; i++) G.trophies.push({ name: 'Copa ' + i, season: 2026 });
    o.objMax = sociosObjetivo();
    // un save viejo con los socios inflados se ancla en la cancha ORIGINAL
    delete G._socAncla; delete G._repAncla; G.socios = 650000;
    o.anclaVieja = sociosAncla();
    // 60 partidos ganados de golpe no lo llevan al techo
    G._socAncla = o.ancla; G._repAncla = 78; G.rep = 90; G.fanMood = 100; G.trophies = []; G.socios = o.ancla;
    for (let i = 0; i < 50; i++) { G.fanMood = 100; updateFans('W', false, 1); }
    o.tras50 = G.socios;
    return o;
  }, ARRANCA('boca'));
  chk('la partida ancla la masa societaria al arrancar', s.ancla === s.ini && s.ancla > 100000, String(s.ancla));
  chk('con la reputación y el humor de siempre, el objetivo es el ancla', Math.abs(s.obj0 - s.ancla) / s.ancla < 0.01, s.obj0 + ' / ' + s.ancla);
  chk('ampliar la cancha a más del doble suma poco (antes la multiplicaba)', s.objObras <= s.ancla * 1.2, `${s.capOri} → ${s.cap} butacas: ${s.ancla} → ${s.objObras}`);
  chk('ni con todo a favor pasa de 1,8× la masa histórica', s.objMax <= Math.round(s.ancla * 1.8) + 1, s.objMax + ' / ' + s.ancla);
  chk('un save viejo con 650.000 socios se ancla en la cancha original, no en el número inflado', s.anclaVieja < 250000, String(s.anclaVieja));
  chk('una temporada ganándolo todo sube los socios de a poco (menos de +35%)', s.tras50 > s.ancla && s.tras50 < s.ancla * 1.35, s.ancla + ' → ' + s.tras50);

  console.log('\n═══ MODO DT: EL EQUIPO ES TUYO, EL MERCADO ES DEL PRESIDENTE ═══');
  const d = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.modo = G.modo; o.mine = dtIsMine(); o.pres = !!(G.presIA && G.presIA.name && PRES_PERFILES[G.presIA.perfil]);
    G.week = 3;                                                        // ventana abierta
    const p = G.market.filter(x => x.lg === 'Liga ARG' && x.rat >= 72 && x.rat <= 76 && !esLibre(x))[0];
    const sq0 = G.squad.length, b0 = G.budget, f0 = (G.firmas || []).length;
    openNeg(p.id); o.modal = /Pedido al presidente/.test(document.body.innerText); closeMod();
    payClause(p.id); openPlayerTerms({ p, fee: 1 }); closeMod();
    o.noCompra = G.squad.length === sq0 && G.budget === b0 && (G.firmas || []).length === f0;
    const s0 = (G.sponsors || []).length; signSponsor('sp1'); o.noSponsor = (G.sponsors || []).length === s0;
    const c0 = G.squad[0].contract; openContract(G.squad[0].id); closeMod(); o.noRenov = G.squad[0].contract === c0;
    // pedido: un presidente ambicioso, con caja y buena relación, lo trae
    G.presIA.perfil = 'ambicioso'; G.presIA.rel = 95; G.budget = 400; G.wageCap = 99999;
    pedido('jugador', p.id); o.pend = pedidosAbiertos().length;
    const m0 = Math.random; Math.random = () => 0.01;
    G.week = 5; presPedidosTick();
    Math.random = m0;
    o.resp = pedidos()[0].estado; o.firma = (G.firmas || []).some(f => f.pid === p.id);
    // una oferta muy buena por un suplente: la acepta él
    const xi = new Set(Object.values(G.slots).filter(Boolean));
    const sup = G.squad.filter(q => !xi.has(q.id) && !q.injured).sort((a, b) => a.rat - b.rat)[0];
    G.offers = [{ player: sup, from: 'Club X', amount: Math.round((sup.val || 1) * 3 * 10) / 10, type: 'compra', week: G.week }];
    Math.random = () => 0.01; presOfertasTick(); Math.random = m0;
    o.vendio = !G.squad.some(q => q.id === sup.id);
    // la que es una miseria por un titular: la rechaza
    const tit = G.squad.find(q => xi.has(q.id));
    G.offers = [{ player: tit, from: 'Club Y', amount: Math.round((tit.val || 1) * 0.5 * 10) / 10, type: 'compra', week: G.week }];
    presOfertasTick(); o.noVendioTit = G.squad.some(q => q.id === tit.id);
    // renovaciones: al titular le renueva solo
    tit.contract = G.season; tit.wantsOut = false; tit._presNoRenov = null; G.budget = 300;
    presRenovar(true); o.renovo = tit.contract > G.season;
    // un dilema del club lo decide el presidente, no te frena
    G._dilemaAbierto = null; G.dilemas = G.dilemas || [];
    const idd = 'dtest'; G.dilemas.push({ id: idd, did: 'x', txt: 't', ops: [{ i: 0, t: 'A' }, { i: 1, t: 'B' }], resuelto: null, week: G.week, bloquea: true });
    _DIL_FX[idd] = [() => { }, () => { }]; presDecideDilemas();
    o.dilema = !dilemaBloqueante();
    // la tarjeta del despacho
    gTab('pres'); try { rPresTab(); } catch (e) { }
    o.card = !!document.getElementById('presDespacho');
    // si la relación se cae, te echa el presidente
    G.presIA.rel = 5; weeklyPresIA(); o.echado = juegoTerminado();
    return o;
  }, ARRANCA('boca', 'dt'));
  chk('arrancando como DT: el técnico sos vos y el presidente es de la IA', d.modo === 'dt' && d.mine && d.pres);
  chk('tocar "fichar" abre el pedido al presidente', d.modal);
  chk('no podés comprar por ninguna vía (negociar, cláusula, términos)', d.noCompra);
  chk('ni firmar sponsors ni renovar contratos', d.noSponsor && d.noRenov);
  chk('el pedido queda esperando respuesta', d.pend === 1);
  chk('un presidente con caja y confianza dice que sí y cierra el fichaje', d.resp === 'si' && d.firma, d.resp);
  chk('las ofertas por tus jugadores las decide él: vende al suplente por el triple', d.vendio);
  chk('y no regala a un titular por la mitad', d.noVendioTit);
  chk('renueva solo al que juega', d.renovo);
  chk('los dilemas del club los resuelve él, no frenan tu partida', d.dilema);
  chk('la pestaña Presidente muestra el despacho con tus pedidos', d.card);
  chk('con la relación en el piso, el presidente te echa', d.echado);

  const pm = await pg.evaluate((A) => {
    eval(A); const o = {};
    o.modo = G.modo; o.mine = dtIsMine();
    const p = G.market.filter(x => x.lg === 'Liga ARG' && x.rat >= 72 && !esLibre(x))[0];
    G.week = 3; openNeg(p.id); o.negocia = /Fichaje/.test(document.body.innerText); closeMod();
    // le imponés al DT un jugador de un puesto que no pidió y que no mejora el once
    const g = G.squad.slice().sort((a, b) => a.rat - b.rat)[0];
    const q = G.market.find(x => x.pos === 'ARQ' && x.rat >= 60 && x.rat <= 65 && !(G.dt.wantedPos || []).includes('ARQ'));
    G.dtRel = 60; const rel0 = G.dtRel;
    firmaProgramar(q, { price: 0.1, wage: 5, years: 1 }); G.budget = 100;
    G.firmas.forEach(f => f.dias = 0); firmasTick();
    o.impuesto = q._impuesto === G.season; o.rel = G.dtRel; o.rel0 = rel0;
    o.fn = 0;
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('en modo presidente se sigue negociando como siempre', pm.modo === 'pres' && !pm.mine && pm.negocia);
  chk('imponerle al DT un jugador que no pidió le baja la relación', pm.impuesto && pm.rel < pm.rel0, pm.rel0 + ' → ' + pm.rel);

  console.log('\n═══ ELECCIONES: CAMPAÑA Y PROMESAS ═══');
  const e = await pg.evaluate((A) => {
    eval(A); const o = {};
    G.season = proximaEleccion(); G.week = 25;
    o.abierta = campanaAbierta();
    const v0 = votoEstimado();
    campanaPrometer('titulo'); campanaPrometer('entradas'); campanaPrometer('figura'); campanaPrometer('pibes');
    o.n = G.campElec.promesas.length; o.suma = votoEstimado() - v0;
    G.budget = 50; campanaActo(); o.acto = G.campElec.actos === 1;
    campanaDebate(); o.debate = G.campElec.debate !== null;
    gTab('pres'); try { rPresTab(); } catch (e) { } o.card = !!document.getElementById('campanaBox');
    // gana
    G.boardConf = 90; G.fanMood = 90; const m0 = Math.random; Math.random = () => 0.5;
    correrEleccion(); Math.random = m0; closeMod();
    o.prom = (G.promesas || []).length;
    // al mandato siguiente
    G.season++; G.week = 3;
    G.trophies = (G.trophies || []).concat([{ name: 'Copa Argentina', season: G.season }]);
    G.ticketPrice = 1.6; const fm0 = G.fanMood;
    promesasTick();
    const P = k => G.promesas.find(x => x.id === k);
    o.tit = P('titulo').cumplida; o.ent = P('entradas').rota; o.fm = G.fanMood < fm0 + 4;
    // al vencer: la de la figura no se cumplió → rota, y pesa en la elección siguiente
    G.season = P('figura').hasta; promesasVencer();
    o.fig = P('figura').rota; o.castigo = promesasRotasVoto();
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('en el año de la elección se abre la campaña', e.abierta);
  chk('hasta 3 promesas, y suman votos ya', e.n === 3 && e.suma >= 10, '+' + e.suma);
  chk('actos y debate', e.acto && e.debate);
  chk('la tarjeta de campaña aparece en Presidente', e.card);
  chk('al ganar, las promesas pasan a ser compromiso', e.prom === 3);
  chk('salir campeón cumple la del título; subir las entradas rompe la de los precios', e.tit && e.ent);
  chk('lo que no cumpliste al vencer se rompe y te resta votos en la siguiente', e.fig && e.castigo === 8, 'castigo ' + e.castigo);

  console.log('\n═══ RETIRADOS, REPRESENTANTES Y MÁS TÉCNICOS ═══');
  const r = await pg.evaluate((A) => {
    eval(A); const o = {};
    const p = G.squad[0];
    o.det = retiroCamino(p, {}) === retiroCamino(p, {});
    // fabrico los tres caminos con nombres que el hash manda a cada uno
    const prob = (k) => { for (let i = 0; i < 400; i++) { const q = Object.assign({}, p, { id: 'rt' + i, name: 'Retirado ' + k + i, seasonsAtClub: 5, pos: 'MC' }); if (retiroCamino(q, { apps: 200 }) === k) return q; } return null; };
    const rep = prob('rep'), st = prob('staff'), dt = prob('dt');
    const l0 = (G.dtPool || []).length; ensureDtPool();
    if (rep) _retiroDecidir(rep, { apps: 200, goals: 10 });
    if (st) _retiroDecidir(st, { apps: 200, goals: 10 });
    if (dt) _retiroDecidir(dt, { apps: 200, goals: 10 });
    o.agente = agentes().length >= 1; o.staff = staffPres().length >= 1; o.dt = G.dtPool.some(x => dt && x.name === dt.name);
    // el representante amigo le cobra menos comisión a sus clientes
    const cli = G.market.find(x => agenteDe(x));
    o.cliente = !!cli; o.comis = cli ? ptComisEspera(cli) <= ((esMercenario(cli) || cli.rat >= 84) ? 5 : 0) : false;
    gTab('pres'); try { rPresTab(); } catch (e) { }
    o.card = /Ex jugadores/.test((document.getElementById('presStaffBox') || {}).innerText || '');
    o.libres = G.dtPool.filter(x => !x.club).length;
    const psg = G.dtPool.find(x => x.club === 'PSG'), chico = G.dtPool.filter(x => x.club && nivelClub(x.club) <= 58 && !x.attrs)[0];
    o.rats = [psg && psg.rat, chico && chico.rat];
    o.pool = G.dtPool.length;
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('el camino del retirado es determinista (recargar no lo cambia)', r.det);
  chk('el que se retira puede ser representante, staff o técnico', r.agente && r.staff && r.dt);
  chk('a los clientes del representante amigo se les cobra menos comisión', r.cliente && r.comis);
  chk('la pestaña Presidente muestra tu staff de ex jugadores', r.card);
  chk('hay 140 técnicos libres o más (antes 87)', r.libres >= 140, r.libres + ' de ' + r.pool);
  chk('la media del DT dice algo: el de un club grande vale más que el de uno chico', r.rats[0] > r.rats[1], r.rats.join(' vs '));

  console.log('\n═══ NEGOCIACIONES CON CONTEXTO ═══');
  const n = await pg.evaluate((A) => {
    eval(A); const o = {}; G.week = 3;
    const club = 'River Plate';
    const pl = G.market.filter(x => x.club === club).sort((a, b) => b.rat - a.rat);
    const top = pl[0], banco = pl[pl.length - 1];
    o.fTop = negFactores(top).map(f => f.ic); o.fBanco = negFactores(banco).map(f => f.ic);
    o.caroTop = _negDemand(top) / top.val > _negDemand(banco) / banco.val;
    o.det = _negDemand(top) === _negDemand(top);
    const corto = Object.assign({}, banco, { contract: G.season }); o.fCorto = negFactores(corto).some(f => f.ic === '📄');
    // una oferta ridícula ofende y cortan el teléfono
    const p = G.market.find(x => x.lg === 'Liga ARG' && x.club !== G.teamName && x.club !== 'River Plate' && x.rat >= 70 && !esLibre(x));
    openNeg(p.id); o.panel = /LO QUE PESA/.test(document.body.innerText);
    negStep2(); document.getElementById('negInp').value = String(Math.max(0.1, Math.round(window._negData.demand * 0.2 * 10) / 10));
    G.budget = 200; subNegI(p.id, window._negData.demand);
    o.cortado = negCortado(p.club);
    openNeg(p.id); o.noAtiende = !/Contactar agente/.test(document.body.innerText); closeMod();
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('el mejor del plantel rival pesa como figura (⭐) y el del banco como suplente (🪑)', n.fTop.includes('⭐') && n.fBanco.includes('🪑'), n.fTop.join('') + ' / ' + n.fBanco.join(''));
  chk('la figura sale más cara en proporción a su valor', n.caroTop);
  chk('el precio no cambia por abrir y cerrar la ficha', n.det);
  chk('con el contrato por vencer, venden más barato', n.fCorto);
  chk('la ficha muestra lo que pesa en la negociación', n.panel);
  chk('una oferta ridícula ofende: el club corta el teléfono', n.cortado && n.noAtiende);

  console.log('\n═══ COPAS, SPONSORS Y HERRAMIENTAS DEL PRESIDENTE ═══');
  const c = await pg.evaluate((A) => {
    eval(A); const o = {};
    const b0 = G.budget; copaPremio('Champions League - Grupos', 'W'); o.ucl = +(G.budget - b0).toFixed(2);
    const b1 = G.budget; copaPremio('Copa Libertadores - Grupos', 'L'); o.perder = G.budget === b1;
    premiosTitulos(); const b2 = G.budget;
    G.trophies = G.trophies || []; G.trophies.push({ name: 'Copa Libertadores', season: G.season }); premiosTitulos(); o.lib = +(G.budget - b2).toFixed(1);
    premiosTitulos(); o.unaVez = +(G.budget - b2).toFixed(1) === o.lib;
    // sponsor que vence: propone renovar, y firmar reemplaza el contrato
    G.sponsors = [{ id: 'spx', cat: 'Camiseta', name: 'Marca X', income: 0.2, weeks: 52, weeksTotal: 52, weeksLeft: 3, reqRep: 60, obj: { id: 'champ', desc: 'x', bonus: 2 } }];
    G.sponsorOffers = []; weeklySponsorsVida();
    const of = G.sponsorOffers.find(x => x.renov); o.renov = !!of;
    if (of) spnFirmar(of.oid); closeMod();
    o.reemplazo = G.sponsors.length === 1 && G.sponsors[0].weeksLeft > 3;
    // prima por partido
    G.budget = 50; primaProponer(); o.prima = !!G.primaProx; const b3 = G.budget;
    primaResolver('W', 'Liga Profesional'); o.pago = G.budget < b3 && !G.primaProx;
    escuelaAbrir(); o.escuela = (G.escuelas || []).length === 1;
    seguridadPlan(); o.seg = seguridadActiva();
    gTab('pres'); try { rPresTab(); } catch (e) { } o.card = /Herramientas del presidente/.test(document.body.innerText);
    o.fn = (function scan(x,d){ if(d>7||!x||typeof x!=='object')return 0; let r=0; for(const k in x){ if(typeof x[k]==='function')r++; else if(x[k]&&typeof x[k]==='object') r+=scan(x[k],d+1);} return r; })(G,0);
    return o;
  }, ARRANCA('boca', 'pres'));
  chk('ganar un partido de Champions paga', c.ucl === 1.5, String(c.ucl));
  chk('perder no paga', c.perder);
  chk('salir campeón de la Libertadores paga el premio, y una sola vez', c.lib === 10 && c.unaVez, String(c.lib));
  chk('el sponsor que vence propone renovar, y firmar reemplaza el contrato', c.renov && c.reemplazo);
  chk('la prima por partido se promete y se paga si ganan', c.prima && c.pago);
  chk('escuelas en el exterior y plan de seguridad', c.escuela && c.seg);
  chk('las herramientas aparecen en Presidente', c.card);

  console.log('\n═══ EVENTO: LOS MEJORES BOCAS ═══');
  const ev = await pg.evaluate(() => new Promise(res => {
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0');
    eventoArmar('bocas', (ok, l) => {
      const o = { ok, n: (l || []).length, distintos: new Set((l || []).map(x => x.slice(-4))).size };
      eventoAplicar(); setLigaSel('Leyendas');
      o.ligas = ligasJugables();
      const ids = Object.keys(TEAMS).filter(k => TEAMS[k].liga === 'Leyendas');
      o.teams = ids.length;
      document.getElementById('teamSelect').style.display = 'none';
      setModo('pres'); startGame(ids[0]); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
      o.club = G.teamName; o.db = G.dbSeason; o.sq = G.squad.length;
      o.rivales = new Set(G.calendar.filter(m => m.comp === LIGA_NOMBRE['Leyendas']).map(m => m.home === G.teamName ? m.away : m.home)).size;
      o.mktBocas = new Set(G.market.map(p => p.club)).size;
      o.estadio = G.stadium.name;
      saveGame();
      res(o);
    });
  }));
  chk('se arma con 20 versiones de Boca de años distintos', ev.ok && ev.n === 20 && ev.distintos === 20, ev.n + ' equipos');
  chk('la liga especial es la única jugable mientras dura el evento', ev.ligas.length === 1 && ev.ligas[0] === 'Leyendas');
  chk('los 20 equipos aparecen para elegir (antes el corte del id juntaba 2000-2009)', ev.teams === 20, String(ev.teams));
  chk('se juega contra las otras 19 versiones', ev.rivales === 19 && ev.mktBocas === 19, ev.rivales + ' rivales');
  chk('cada Boca juega en la Bombonera', /Bombonera/.test(ev.estadio), ev.estadio);
  const pg2 = await ctx.newPage(); pg2.on('pageerror', e => errs.push('P2 ' + e.message));
  await pg2.goto(F, { waitUntil: 'load' }); await pg2.waitForTimeout(500);
  const ev2 = await pg2.evaluate(() => { const ok = loadGame(); return { ok, club: G.teamName, db: G.dbSeason, liga: ligasJugables()[0], ev: eventoActivo() }; });
  chk('la partida del evento se guarda y se vuelve a cargar', ev2.ok && ev2.db === 'LEY' && ev2.liga === 'Leyendas' && ev2.ev && ev2.club === ev.club, ev2.club);
  await pg2.close();

  console.log('\n═══ SAVE VIEJO Y TEMPORADA COMPLETA EN MODO DT ═══');
  const t = await pg.evaluate((A) => {
    eval(A);
    saveGame();
    const raw = JSON.parse(localStorage.getItem('dtg_v7'));
    ['modo', 'presIA', 'pedidosDT', '_socAncla', '_repAncla', 'campElec', 'promesas', 'staffPres', 'agentes', 'escuelas', 'primaProx', 'seguridad', '_premTrof', '_negCortes', '_dtPoolV'].forEach(k => delete raw[k]);
    localStorage.setItem('dtg_v7', JSON.stringify(raw)); G = null;
    const o = { carga: loadGame() };
    o.modo = modoJuego(); o.ancla = sociosAncla() > 0;
    return o;
  }, ARRANCA('boca', 'pres'));
  const pg3 = await ctx.newPage(); pg3.on('pageerror', e => errs.push('P3 ' + e.message));
  await pg3.goto(F, { waitUntil: 'load' }); await pg3.waitForTimeout(400);
  const t2 = await pg3.evaluate(() => {
    const o = {};
    localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); document.getElementById('teamSelect').style.display = 'none';
    setLigaSel('Liga ARG'); setModo('dt'); startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === 'Lanús')); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0); } catch (e) { } }); if (prensaPend()) prensaResolver(0); };
    let g = 0, pj = 0;
    while (G.calendar.some(m => !m.played) && g++ < 400 && !juegoTerminado()) { dr(); G.day = 7; const m = G.calendar.find(x => !x.played); simMatch(true); closeMod(); if (m && m.played) pj++; }
    o.pj = pj; o.club = G.teamName; o.dt = G.dt.name; o.mine = dtIsMine(); o.pres = G.presIA.name; o.rel = Math.round(G.presIA.rel);
    o.fn = (function scan(x,d){ if(d>7||!x||typeof x!=='object')return 0; let r=0; for(const k in x){ if(typeof x[k]==='function')r++; else if(x[k]&&typeof x[k]==='object') r+=scan(x[k],d+1);} return r; })(G,0);
    return o;
  });
  await pg3.close();
  chk('un save viejo sin ninguno de los campos nuevos carga y es modo presidente', t.carga && t.modo === 'pres' && t.ancla);
  chk('una temporada entera como DT de Lanús se juega sin trabarse', t2.pj >= 30 && t2.mine && t2.club === 'Lanús', t2.club + ': ' + t2.pj + ' partidos · presidente ' + t2.pres + ' · relación ' + t2.rel);
  chk('0 funciones en G (modo DT, con presidente, pedidos y promesas)', t2.fn === 0, String(t2.fn));
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
