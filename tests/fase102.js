// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 102: la auditoría jugando carreras enteras
// ═══════════════════════════════════════════════════════════════════════
// Lo que apareció jugando más de veinte temporadas simuladas (Boca, Real
// Madrid, Man City, Flamengo, Lanús en modo DT, San Martín, Boca 2005, River
// 2018, la Primera Nacional y un club fundado) con chequeos en cada fecha.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase102.js
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
  // Arranca un club por nombre en su liga (modo presidente salvo que se pida)
  const ARRANCA = `window._arr=(club,liga,modo)=>{ localStorage.clear(); localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    setLigaSel(liga); setModo(modo||'pres');
    startGame(Object.keys(TEAMS).find(k=>TEAMS[k].name===club)); try{autoFill();preseasonSaltear();closeMod();}catch(e){} };`;
  await pg.evaluate(A => { (0, eval)(A); }, ARRANCA);

  console.log('\n═══ COPAS: TAMBIÉN SE PUEDE QUEDAR AFUERA ═══');
  const c = await pg.evaluate(() => {
    const o = {};
    o.ar = [1, 4, 5, 10, 11, 30].map(p => tierPorPuesto(p, 'Liga ARG'));
    o.es = [1, 4, 5, 6, 7, 20].map(p => tierPorPuesto(p, 'España'));
    o.mx = [1, 4, 5].map(p => tierPorPuesto(p, 'Liga MX'));
    _arr('Boca Juniors', 'Liga ARG'); o.boca = G.calendar.filter(m => /Libertadores/.test(m.comp)).length;
    _arr('San Martín (SJ)', 'Liga ARG');
    o.smSud = G.calendar.filter(m => /Sudamericana|Libertadores/.test(m.comp)).length;
    o.smTier = _tierCont(G.teamId, 'Liga ARG');
    // save de antes de la fase: sin tierCont y con qualifiedLib=false sigue en la chica
    G.tierCont = undefined; G.qualifiedLib = false; o.viejo = _tierCont(G.teamId, 'Liga ARG');
    G.tierCont = 0; o.cero = _tierCont(G.teamId, 'Liga ARG');
    // el cierre de temporada escribe tres salidas: Real Madrid 7º, 5º y campeón de copa
    _arr('Real Madrid', 'España');
    const T = G.league.table, cl = Object.keys(T);
    const ponerPuesto = n => { cl.forEach((k, i) => { T[k].pts = 100 - i; }); const yo = G.teamName; const k = cl[n - 1]; const a = T[yo].pts; T[yo].pts = T[k].pts; T[k].pts = a; };
    const hist0 = (G.history || []).length;
    ponerPuesto(7); archiveSeason(); o.esp7 = G.tierCont; o.esp7lib = G.qualifiedLib;
    ponerPuesto(5); archiveSeason(); o.esp5 = G.tierCont;
    ponerPuesto(12); G.trophies = (G.trophies || []).concat([{ name: copaNacPref(), season: G.season }]); archiveSeason(); o.espCopa = G.tierCont;
    ponerPuesto(3); archiveSeason(); o.esp3 = G.tierCont;
    G.history.length = hist0;
    return o;
  });
  chk('Liga ARG: 4 a la Libertadores, 6 a la Sudamericana, el resto nada', JSON.stringify(c.ar) === '[1,1,2,2,0,0]', JSON.stringify(c.ar));
  chk('LaLiga: 4 a la Champions, 2 a la Europa League', JSON.stringify(c.es) === '[1,1,2,2,0,0]', JSON.stringify(c.es));
  chk('Liga MX: sin segunda copa', JSON.stringify(c.mx) === '[1,1,0]', JSON.stringify(c.mx));
  chk('Boca arranca en la Libertadores', c.boca > 0, c.boca + ' partidos');
  chk('San Martín (SJ) arranca SIN copa internacional (antes jugaba la Sudamericana)', c.smSud === 0 && c.smTier === 0, 'tier ' + c.smTier + ', ' + c.smSud + ' partidos');
  chk('un save viejo con qualifiedLib=false sigue en la copa chica', c.viejo === 2);
  chk('tier 0 se respeta', c.cero === 0);
  chk('Real Madrid 7º: sin copa; 5º: Europa League; 3º: Champions', c.esp7 === 0 && c.esp7lib === false && c.esp5 === 2 && c.esp3 === 1, `${c.esp7} · ${c.esp5} · ${c.esp3}`);
  chk('ganar la Copa del Rey saliendo 12º da la Europa League', c.espCopa === 2, 'tier ' + c.espCopa);

  console.log('\n═══ RENOVACIONES CON LA MISMA CURVA QUE LOS FICHAJES ═══');
  const r = await pg.evaluate(() => {
    _arr('Boca Juniors', 'Liga ARG');
    const o = {};
    const base = G.squad.find(p => !esMercenario(p) && !esLeal(p));
    const mk = (rat, age, wage) => Object.assign({}, base, { rat, age, wage, _greed: 1.0, name: 'Test ' + rat + '-' + age, pos: 'MC', personality: 'Normal' });
    o.p50 = renovPretension(mk(50, 26, 1)); o.p70 = renovPretension(mk(70, 26, 1)); o.p90 = renovPretension(mk(90, 26, 1));
    o.viejo50 = Math.round(50 * 0.55); o.viejo90 = Math.round(90 * 0.55);
    o.piso = renovPretension(mk(60, 26, 60));           // cobra más de lo que vale: no se rebaja
    o.vet = renovPretension(mk(60, 37, 60));            // el veterano sí acepta menos
    const tot = k => G.squad.reduce((a, p) => a + k(p), 0);
    o.totNuevo = tot(p => renovPretension(p));
    o.totViejo = tot(p => Math.max(5, Math.round(p.rat * 0.55 * (esMercenario(p) ? PERS_MERC_WAGE : 1))));
    openContract(G.squad[3].id); o.modal = (document.getElementById('modBody') || document.body).innerText.includes('~' + renovPretension(G.squad[3]) + 'k'); closeMod();
    return o;
  });
  chk('la curva es convexa: 50 → ' + r.p50 + ', 70 → ' + r.p70 + ', 90 → ' + r.p90, r.p90 / r.p50 > 3 && r.p50 < r.viejo50 && r.p90 > r.viejo90, `antes ${r.viejo50} y ${r.viejo90}`);
  chk('no renueva por menos de lo que cobra', r.piso >= 60, r.piso + 'k');
  chk('el veterano pasado del pico acepta una rebaja', r.vet < 60 && r.vet >= 51, r.vet + 'k');
  chk('el total de Boca queda donde estaba (±8%)', Math.abs(r.totNuevo / r.totViejo - 1) < 0.08, `${r.totViejo}k → ${r.totNuevo}k`);
  {
    // Se lee el FUENTE: las funciones están envueltas por el modo DT y su
    // toString() devuelve el envoltorio.
    const src = require('fs').readFileSync(path.resolve(__dirname, '..', 'director-tecnico.html'), 'utf8');
    const usan = ['function openContract(', 'function juntaRenovFin(', 'function weeklyJunta(', 'function presRenovarUno('].filter(fn => {
      const i = src.indexOf(fn), j = src.indexOf('\nfunction ', i + 10); return i >= 0 && /renovPretension\(p\)/.test(src.slice(i, j));
    }).length;
    const lineal = (src.match(/\(p\.rat\|\|65\)\*0\.55\*\(esMercenario|p\.rat\*0\.55\*\(esMercenario/g) || []).length;
    chk('los cuatro lugares que renuevan usan renovPretension', usan === 4 && lineal === 0, usan + ' de 4, ' + lineal + ' con la cuenta vieja');
  }
  chk('la pantalla de renovación muestra esa pretensión', r.modal);

  console.log('\n═══ MODO DT: EL AYUDANTE TAPA LAS BAJAS ═══');
  const d = await pg.evaluate(() => {
    _arr('Lanús', 'Liga ARG', 'dt');
    const o = { mio: dtIsMine() };
    const xi = () => Object.values(G.slots).filter(Boolean).map(id => G.squad.find(p => p.id === id));
    const ids = xi().filter(p => p.pos !== 'ARQ').slice(0, 3);
    ids[0].injured = true; ids[0].injuredWeeks = 3; ids[1].susp = 1; G.slots[Object.keys(G.slots).find(k => G.slots[k] === ids[2].id)] = null;
    const msgs0 = (G.phoneMsgs || []).length ? G.phoneMsgs[0].id : null;
    dtPicksXI();
    const x = xi();
    o.n = x.length; o.malos = x.filter(p => p.injured || p.susp > 0).length;
    o.sacados = [ids[0], ids[1]].every(p => !x.includes(p));
    o.msg = (G.phoneMsgs || [])[0] && G.phoneMsgs[0].id !== msgs0 && /armé el once/.test(String(G.phoneMsgs[0].body || ''));
    const id1 = G.phoneMsgs[0].id; dtPicksXI(); o.unaVez = G.phoneMsgs[0].id === id1;
    // el resto del once no se toca
    const antes = Object.values(G.slots).join(); cubrirIndisponibles(); o.quieto = Object.values(G.slots).join() === antes;
    return o;
  });
  chk('el DT es tuyo', d.mio);
  chk('antes del partido el once queda con 11 y ningún lesionado o suspendido', d.n === 11 && d.malos === 0 && d.sacados, `${d.n} jugadores, ${d.malos} no disponibles`);
  chk('avisa al celular una sola vez por partido', d.msg && d.unaVez);
  chk('si no hay bajas no cambia a nadie', d.quieto);

  console.log('\n═══ SIN ARQUERO SANO, ATAJA UNO DE CAMPO ═══');
  const a = await pg.evaluate(() => {
    _arr('Boca Juniors', 'Liga ARG');
    G.squad.filter(p => p.pos === 'ARQ').forEach(p => { p.injured = true; p.injuredWeeks = 4; });
    autoFill();
    const xi = Object.values(G.slots).filter(Boolean).map(id => G.squad.find(p => p.id === id));
    const k = getForm().findIndex(s => s.pos === 'ARQ');
    const gk = G.squad.find(p => p.id === G.slots[k]);
    return { n: xi.length, gk: gk && gk.name, gkPos: gk && gk.pos, sano: gk && !gk.injured };
  });
  chk('el once sale con 11 y alguien en el arco', a.n === 11 && !!a.gk && a.sano, `${a.n} · al arco ${a.gk} (${a.gkPos})`);

  console.log('\n═══ PRÉSTAMOS QUE CRUZAN LA TEMPORADA ═══');
  const l = await pg.evaluate(() => {
    _arr('Real Madrid', 'España');
    const o = {};
    const m = G.market.find(p => p.lg === 'Italia' && p.rat >= 70);
    const n = { pid: m.id, kind: 'prestamo', bid: 0, bonus: 0, wage: 20, years: 1, stage: 'aceptada', deal: { cost: 1, semanas: 30 } };
    G.budget = 999; G.week = 30;
    negExecDeal(n, m);
    (G.firmas || []).forEach(f => f.dias = 0); try { firmasTick(); } catch (e) { }
    const p = G.squad.find(q => q.id === m.id);
    o.entro = !!p; o.lg = p && p.lg; o.until = p && p.loanUntil;
    if (p) { p.apps = 7; p.loanApps0 = 2; p.loanObligApps = 10; }
    G.week = 49; G.calendar.forEach(x => x.played = true);
    try { nextSeason(); } catch (e) { o.err = e.message; }
    try { let dd, g = 0; while ((dd = dilemaBloqueante()) && g++ < 10) dilemaResolver(dd.id, 0); closeMod(); } catch (e) { }
    const q = G.squad.find(x => x.id === m.id);
    o.sigue = !!q; o.until2 = q && q.loanUntil; o.jug = q ? (q.apps || 0) - (q.loanApps0 || 0) : null;
    if (q) { devolverPrestamo(q); const mk = G.market.find(x => x.id === m.id); o.vuelveLg = mk && mk.lg; o.vuelveClub = mk && mk.club; }
    return o;
  });
  chk('el que viene a préstamo juega en TU liga (era Liga ARG fijo)', l.entro && l.lg === 'España', l.lg);
  chk('una cesión de la semana 30 por 30 semanas sigue al cambiar de temporada', l.sigue && l.until2 === 11, `vuelve en la semana ${l.until2} (era ${l.until})`);
  chk('los partidos que jugó cuentan para la obligación aunque se borren al cambiar de año', l.jug === 5, l.jug + ' partidos');
  chk('al volver recupera su liga', l.vuelveLg === 'Italia', l.vuelveLg + ' · ' + l.vuelveClub);

  console.log('\n═══ LA CAJA CUADRA: LAS OBRAS SE ANOTAN ═══');
  const f = await pg.evaluate(() => {
    _arr('Real Madrid', 'España');
    const o = {}; G.budget = 900;
    const fo = () => ((G.fin || {})[G.season] || {}).obras || 0, fc = () => ((G.fin || {})[G.season] || {}).cuerpo || 0;
    const u = G.stadium.upgrades.find(x => !x.built && x.cost > 0);
    const b0 = G.budget, o0 = fo(); confirmBuildStad(u.id); closeMod();
    o.stad = { gasto: +(b0 - G.budget).toFixed(1), anot: +(fo() - o0).toFixed(1) };
    const y = G.youth.upgrades.find(x => !x.built && x.cost > 0);
    const b1 = G.budget, o1 = fo(); buildYouthUpg(y.id);
    o.juv = { gasto: +(b1 - G.budget).toFixed(1), anot: +(fo() - o1).toFixed(1) };
    const u2 = G.stadium.upgrades.find(x => !x.built && x.cost > 0 && !obras().some(q => q.id === x.id));
    G.boardApprovals = []; _aprobPush({ k: 'obra', tipo: 'stadium', id: u2.id, nombre: u2.name, cost: u2.cost, titulo: u2.name, detalle: '' });
    const b2 = G.budget, o2 = fo(); aprobFirmar(G.boardApprovals[0].aid);
    o.carpeta = { gasto: +(b2 - G.budget).toFixed(1), anot: +(fo() - o2).toFixed(1) };
    const st = STAFF_ROLES.find(r2 => r2.levels.some(lv => lv.lv === (G.staffLevels[r2.id] || 0) + 1 && lv.cost > 0));
    const b3 = G.budget, c3 = fc(); if (st) upgradeStaff(st.id);
    o.staff = { gasto: +(b3 - G.budget).toFixed(1), anot: +(fc() - c3).toFixed(1) };
    return o;
  });
  chk('una obra del estadio se anota en Finanzas', f.stad.gasto > 0 && f.stad.gasto === f.stad.anot, JSON.stringify(f.stad));
  chk('una obra de las inferiores también', f.juv.gasto > 0 && f.juv.gasto === f.juv.anot, JSON.stringify(f.juv));
  chk('y la que firmás en la Carpeta del Director Deportivo', f.carpeta.gasto > 0 && f.carpeta.gasto === f.carpeta.anot, JSON.stringify(f.carpeta));
  chk('mejorar el cuerpo técnico va al rubro del cuerpo técnico', f.staff.gasto > 0 && f.staff.gasto === f.staff.anot, JSON.stringify(f.staff));

  console.log('\n═══ CUPO EN LAS NEGOCIACIONES ═══');
  const q = await pg.evaluate(() => {
    _arr('Man City', 'Premier');
    const o = { cupo: cupoExt(), ext: foreignCount(G.squad) };
    const p = G.market.find(x => pIsForeign(x) && x.rat >= 70 && !esLibre(x));
    const n = { pid: p.id, kind: 'compra', bid: 1, bonus: 0, wage: 20, years: 3, stage: 'aceptada', deal: {} };
    const n0 = G.squad.length; G.budget = 999; negExecDeal(n, p);
    o.entro = G.squad.length > n0 || (G.firmas || []).length > 0;
    _arr('Flamengo', 'Brasil');
    o.cupoB = cupoExt(); o.extB = foreignCount(G.squad);
    const p2 = G.market.find(x => pIsForeign(x) && x.rat >= 70 && !esLibre(x));
    const n2 = { pid: p2.id, kind: 'compra', bid: 1, bonus: 0, wage: 20, years: 3, stage: 'aceptada', deal: {} };
    const m0 = G.squad.length; G.budget = 999; negExecDeal(n2, p2);
    o.entroB = G.squad.length > m0 || (G.firmas || []).length > 0;
    o.msgB = String(((G.phoneMsgs || [])[0] || {}).body || '');
    return o;
  });
  chk('el Man City (cupo 99, ' + q.ext + ' extranjeros) cierra una negociación por un extranjero', q.entro, 'antes: "cupo lleno (5/5)"');
  chk('Flamengo con el cupo lleno (' + q.extB + '/' + q.cupoB + ') no, y el mensaje dice el cupo real', !q.entroB && q.msgB.includes('/' + q.cupoB) && !q.msgB.includes('5/5'), q.msgB.replace(/<[^>]+>/g, '').slice(0, 90));

  console.log('\n═══ CADA LIGA CON SU FEDERACIÓN Y SUS MEDIOS ═══');
  const t = await pg.evaluate(() => {
    const o = {};
    _arr('Real Madrid', 'España');
    o.fed = federacion(); G.budget = -10; dispararEmbargo(); o.embargo = G.phoneMsgs.slice(0, 3).map(m => (m.from || '') + ': ' + (m.body || '')).join(' | ');
    gTab('social'); o.social = document.getElementById('tab-social').innerText;
    gTab('stats'); o.stats = document.getElementById('tab-stats').innerText;
    o.medios = mediosLiga().slice(0, 3);
    _arr('Boca Juniors', 'Liga ARG'); o.fedAR = federacion();
    gTab('social'); o.socialAR = document.getElementById('tab-social').innerText;
    gTab('ov');
    return o;
  });
  chk('en España el embargo lo hace LaLiga, no la AFA', t.fed === 'LaLiga' && !/AFA/.test(t.embargo) && /LaLiga/.test(t.embargo));
  chk('en la Argentina sigue siendo la AFA', t.fedAR === 'la AFA');
  chk('las redes del Madrid no citan medios argentinos', !/TyC|Olé|Transfermarkt ARG|#TorneoArgentino|ESPN Fútbol ARG/.test(t.social) && /#LaLiga/.test(t.social), t.medios.join(', '));
  chk('las de Boca sí', /TyC Sports|Olé/.test(t.socialAR));
  chk('Estadísticas: el recuadro de la liga dice LaLiga, no "🇦🇷 Liga Profesional"', !/Liga Profesional/.test(t.stats) && /LaLiga/.test(t.stats));

  console.log('\n═══ RESUMEN DE TEMPORADA ═══');
  const s = await pg.evaluate(() => {
    _arr('Boca Juniors', 'Liga ARG');
    const o = {};
    // primero de la tabla anual (que en el formato de 2026 NO da título)
    const T = G.league.table; Object.keys(T).forEach((k, i) => T[k].pts = 50 - i); T[G.teamName].pts = 99;
    G.boardConf = 50;
    showSeasonSummary(); o.txt = (document.getElementById('modBody') || document.body).innerText; closeMod();
    o.cd1 = G.boardConf;
    showSeasonSummary(); closeMod(); showSeasonSummary(); closeMod();
    o.cd3 = G.boardConf;
    o.daTit = tablaDaTituloARG();
    return o;
  });
  chk('abrir el resumen tres veces no suma confianza tres veces', s.cd1 === s.cd3, `${s.cd1} → ${s.cd3}`);
  chk('el 1º de la tabla anual argentina no es "campeón de la liga"', s.daTit || (!/CAMPEÓN DE LA LIGA/.test(s.txt) && /tabla anual/.test(s.txt)));
  chk('el recuadro de la liga no tiene la bandera argentina fija ni "Sud."', !/🥈 Sud\./.test(s.txt) && /Liga Profesional/.test(s.txt));

  console.log('\n═══ NOMBRES DE LA CANTERA SIN REPETIR ═══');
  const n = await pg.evaluate(() => {
    _arr('Boca Juniors', 'Liga ARG');
    const f0 = window._youthNames;
    // un pool chico: Fernando + 6 apellidos, uno de los cuales ya está en el plantel
    window._youthNames = () => ({ fn: ['Fernando'], ln: ['Alarcón', 'Zuluaga', 'Ibarra', 'Quiroga', 'Medina', 'Sosa'] });
    G.squad[0].name = 'Fernando Alarcón'; _youthName._c = null;
    const sal = []; for (let i = 0; i < 5; i++) sal.push(_youthName('Liga ARG'));
    window._youthNames = f0; _youthName._c = null;
    return { repetidos: sal.filter(x => x === 'Fernando Alarcón').length, dist: sal, distintos: new Set(sal).size };
  });
  chk('el pibe no sale con el nombre de uno que ya existe, ni dos pibes con el mismo', n.repetidos === 0 && n.distintos === 5, n.dist.join(', '));

  console.log('\n═══ TEXTO Y PLATA ═══');
  const fs = require('fs');
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'director-tecnico.html'), 'utf8');
  chk('no quedan signos $ sueltos en los montos', !/font-weight:700">\$<\/span>/.test(html));
  chk('sin errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log(`\n${ok} ✓  ${fail} ✗`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
