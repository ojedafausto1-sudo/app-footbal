// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 90: fundá tu club y armá el plantel negociando
// ═══════════════════════════════════════════════════════════════════════
// El club fundado ocupa la plaza del más flojo de la liga, arranca con 18
// pibes de la cantera de nivel muy bajo y un presupuesto que sale de la liga,
// y tiene 10 semanas sin partidos con el mercado abierto. Los fichajes pasan
// por el embudo de siempre (firmaProgramar → firmasTick).
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase90.js
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
  pg.on('dialog', d => d.accept());
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);
  await pg.evaluate(() => { localStorage.setItem('dt_fondo3d', '0'); });

  // ── el paso 3 del inicio ofrece fundar ──
  const w = await pg.evaluate(() => { tsIr(1); tsIr(2, 'Argentina'); tsIr(3, 'Liga ARG');
    const btn = document.querySelector('.ts-fundar'); const n = fundarNumeros('Liga ARG');
    return { btn: !!btn, txt: btn ? btn.textContent : '', n }; });
  chk('el paso 3 tiene la tarjeta "Fundá tu club"', w.btn && /Fundá tu club/.test(w.txt));
  chk('el presupuesto sale de la liga (90% del club mediano)', Math.abs(w.n.presu - w.n.med * 0.9) < 0.2 && w.n.presu > 5, w.n.presu + 'M de ' + w.n.med + 'M');
  chk('en la Liga ARG la plaza la cede San Martín (SJ)', w.n.cede === 'San Martín (SJ)', w.n.cede);

  // ── el modal y la validación ──
  const v = await pg.evaluate(() => { fundarModal();
    const r = { modal: !!document.getElementById('fundNom') };
    r.corto = fundarValidar('AB', '', 'Liga ARG').err || '';
    r.repe = fundarValidar('boca juniors', '', 'Liga ARG').err || '';
    r.html = fundarValidar('<b>Club "X"</b>', 'zz', 'Liga ARG');
    r.sigla = fundarValidar('Atlético del Puerto', '', 'Liga ARG').abbr;
    return r; });
  chk('el modal se abre con nombre, sigla y colores', v.modal);
  chk('un nombre de menos de 3 letras no pasa', /3 letras/.test(v.corto));
  chk('un nombre que ya existe no pasa', /Ya hay un club/.test(v.repe));
  chk('se limpian los signos de HTML del nombre', v.html.nombre && !/[<>"]/.test(v.html.nombre), v.html.nombre);
  chk('sin sigla se arma con las iniciales', v.sigla === 'AD', v.sigla);

  // ── fundar ──
  await pg.evaluate(() => { document.getElementById('fundNom').value = 'Atlético del Puerto'; document.getElementById('fundAbbr').value = 'ADP'; fundarCrear(); });
  await pg.waitForTimeout(800);
  const g = await pg.evaluate(() => {
    const zon = G.arZones ? [...G.arZones.A, ...G.arZones.B] : [];
    const cede = G.fundado.cede;
    return { name: G.teamName, budget: G.budget, sq: G.squad.length, maxRat: Math.max(...G.squad.map(p => p.rat)), minRat: Math.min(...G.squad.map(p => p.rat)),
      canter: G.squad.every(p => p.canterano), edad: G.squad.every(p => p.age >= 16 && p.age <= 19), arq: G.squad.filter(p => p.pos === 'ARQ').length,
      zonas: zon.length, enZona: zon.includes(G.teamName), cede, cedeEnZona: zon.includes(cede),
      libresCede: G.market.filter(p => p._exClub === cede && p.freeAgent).length, quedanEnCede: G.market.filter(p => p.club === cede).length,
      armado: JSON.stringify(G.armado), wageCap: G.wageCap, wages: G.squad.reduce((a, p) => a + (p.wage || 0), 0),
      ventana: isTransferWindowOpen(), estado: getWindowStatus(), modo: G.modo, cap: G.stadium.capacity, est: G.stadium.name,
      youthMax: Math.max(...G.youth.players.map(y => y.rat)), lvl: G.youth.level,
      cal: G.calendar.filter(m => m.home === G.teamName || m.away === G.teamName).length,
      intro: document.getElementById('teamSelect').style.display, box: !!document.querySelector('#armadoOv .arm-card'),
      nat: G.squad.every(p => p.nat === 'ARG'), copa: G.calendar.filter(m => esCopaInt(m.comp)).length, nac: G.calendar.filter(m => /Copa Argentina/.test(m.comp)).length };
  });
  chk('arranca la partida con el club fundado', g.name === 'Atlético del Puerto' && g.intro === 'none');
  chk('18 pibes de la cantera, 2 arqueros', g.sq === 18 && g.arq === 2 && g.canter);
  chk('nivel muy bajo: media 40-51', g.minRat >= 40 && g.maxRat <= 51, g.minRat + '-' + g.maxRat);
  chk('16 a 19 años y locales', g.edad && g.nat);
  chk('la academia también arranca verde (nivel 1, pibes de 48 o menos)', g.lvl === 1 && g.youthMax <= 48, 'máx ' + g.youthMax);
  chk('el presupuesto es el de la liga', Math.abs(g.budget - w.n.presu) < 0.05, g.budget + 'M');
  chk('juega las zonas: 30 clubes con el tuyo adentro', g.zonas === 30 && g.enZona);
  chk('el club que cedió la plaza no juega', g.cede === 'San Martín (SJ)' && !g.cedeEnZona);
  chk('sus jugadores quedaron libres', g.libresCede >= 15 && g.quedanEnCede === 0, g.libresCede + ' libres');
  chk('el tope salarial sale de la liga, no de los 18 pibes', g.wageCap > g.wages * 2 && g.wageCap > 300, g.wageCap + ' contra ' + g.wages);
  chk('el mercado está abierto y lo dice', g.ventana && /Armado del plantel/.test(g.estado));
  chk('se juega como presidente', g.modo === 'pres');
  chk('tiene un estadio propio', g.cap >= 5000 && /Atlético del Puerto/.test(g.est), g.est + ' ' + g.cap);
  chk('el primer año no juega copa continental (sí la Copa Argentina)', g.copa === 0 && g.nac >= 1, g.copa + ' continentales');
  chk('el calendario tiene sus partidos', g.cal >= 30, g.cal + ' partidos');
  chk('la tarjeta del armado está en la portada', g.box);
  chk('el armado arranca en el día 0 de 70', /"dia":0,"total":70,"cerrado":false/.test(g.armado));

  // ── no hay partidos durante el armado ──
  const gate = await pg.evaluate(() => {
    const w0 = G.week, d0 = G.calendar.filter(m => m.played).length;
    try { simMatch(true); } catch (e) { }
    try { playMatch(); } catch (e) { }
    try { closeMod(); } catch (e) { }
    advanceDay();
    return { week: G.week, played: G.calendar.filter(m => m.played).length - d0, dia: G.armado.dia, w0, gira: !!document.querySelector('#modOv.on, .ov.on') && /Pretemporada/.test(document.body.innerText) };
  });
  chk('simular y jugar no juegan nada', gate.played === 0 && gate.week === gate.w0);
  chk('"avanzar día" corre un día del armado', gate.dia === 1);

  // ── fichar en el armado: el embudo de siempre ──
  const f = await pg.evaluate(() => {
    const c = G.market.filter(p => p.club !== 'Libre' && p.lg === 'Liga ARG' && p.rat >= 62 && p.rat <= 66).slice(0, 3);
    const b0 = G.budget, n0 = G.squad.length;
    c.forEach(p => firmaProgramar(p, { price: 0.8, wage: p.wage, years: 2 }));
    for (let i = 0; i < 8; i++) advanceDay(true);
    return { n: G.squad.length - n0, gasto: Math.round((b0 - G.budget) * 10) / 10, dia: G.armado.dia, ids: c.map(p => p.id), dentro: c.filter(p => G.squad.some(q => q.id === p.id)).length };
  });
  chk('los fichajes se cierran solos a los pocos días del armado', f.n === 3 && f.dentro === 3, f.n + ' firmados en ' + f.dia + ' días');
  chk('y se cobran', f.gasto >= 2.3, f.gasto + 'M');

  // ── semana entera, guardar y cargar ──
  const sv = await pg.evaluate(() => { armadoSemana(); const d = G.armado.dia; saveGame(); const s = JSON.parse(localStorage.getItem('dtg_v7'));
    G = null; loadGame(); return { d, d2: G && G.armado && G.armado.dia, name: G && G.teamName, team: TEAMS[G.teamId] && TEAMS[G.teamId].name, fund: !!s.fundado,
      fun: Object.keys(G).filter(k => typeof G[k] === 'function').length, color: (CLUB_COLORS['atlético del puerto'] || [])[0] }; });
  chk('"pasar una semana" son 7 días', sv.d === 16, 'día ' + sv.d);
  chk('el armado sobrevive al guardado', sv.d2 === sv.d && sv.name === 'Atlético del Puerto' && sv.fund);
  chk('al cargar, el club vuelve a TEAMS con sus colores', sv.team === 'Atlético del Puerto' && !!sv.color);
  chk('0 funciones en G', sv.fun === 0);

  // ── cerrar el armado ──
  const cz = await pg.evaluate(() => {
    // dejo el plantel corto a propósito para ver que se completa
    G.squad = G.squad.filter(p => p.pos !== 'ARQ').slice(0, 12); G.slots = {}; G.bench = [...G.squad];
    armadoCerrar(false);
    return { activo: armadoActivo(), n: G.squad.length, arq: G.squad.filter(p => p.pos === 'ARQ').length, sum: G.armado.sumados,
      ventana: getWindowStatus(), once: Object.values(G.slots).filter(Boolean).length };
  });
  chk('cerrar con el plantel corto lo completa con la cantera', !cz.activo && cz.n === 18 && cz.arq === 2 && cz.sum === 6, cz.n + ' jugadores, ' + cz.sum + ' sumados');
  chk('queda armado el once', cz.once === 11);
  chk('después del armado el mercado es el de la pretemporada', /Mercado abierto/.test(cz.ventana), cz.ventana);
  await pg.waitForTimeout(700);
  const gira = await pg.evaluate(() => /Pretemporada/.test(document.getElementById('modOv') ? document.getElementById('modOv').innerText : ''));
  chk('al cerrar se ofrece la gira de pretemporada', gira);

  // ── ahora sí se juega ──
  const jg = await pg.evaluate(() => { try { preseasonSaltear(); } catch (e) { } closeMod();
    for (let i = 0; i < 6; i++) { try { const pend = G.calendar.filter(m => !m.played && m.week <= G.week); if (!pend.length) { advanceDay(true); continue; } simMatch(true); closeMod(); } catch (e) { } }
    return G.calendar.filter(m => m.played).length; });
  chk('cerrado el armado los partidos se juegan', jg >= 3, jg + ' jugados');

  // ── España: otra liga, otro presupuesto ──
  const es = await pg.evaluate(() => { tsIr(1); tsIr(2, 'España'); tsIr(3, 'España'); const n = fundarNumeros('España');
    _fundar.nombre = 'Deportivo Meseta'; fundarModal(); fundarCrear();
    return { n, b: G.budget, liga: G.miLiga, clubs: (G.ligaClubs || []).length, en: (G.ligaClubs || []).includes('Deportivo Meseta'), cede: G.fundado.cede,
      cedeJuega: (G.ligaClubs || []).includes(G.fundado.cede), arm: armadoActivo(), comp: G.calendar.filter(m => /LaLiga/.test(m.comp)).length }; });
  chk('en España el presupuesto es otro', es.b > w.n.presu * 3 && Math.abs(es.b - es.n.presu) < 0.05, es.b + 'M');
  chk('y juega LaLiga con 20 clubes, el tuyo adentro', es.liga === 'España' && es.clubs === 20 && es.en && es.comp === 38, es.comp + ' fechas');
  chk('el que cedió la plaza no está en la liga', es.cede && !es.cedeJuega, es.cede);

  // ── celular ──
  await pg.setViewportSize({ width: 360, height: 740 });
  const mob = await pg.evaluate(() => { gTab('ov'); const c = document.querySelector('#armadoOv .arm-card'); if (!c) return { ok: false };
    return { ok: true, w: c.scrollWidth, cw: c.clientWidth, chica: [...c.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10).length }; });
  chk('a 360 px la tarjeta entra y no hay letra de menos de 10 px', mob.ok && mob.w <= mob.cw + 1 && mob.chica === 0, JSON.stringify(mob));

  // ── diez semanas juntos: el que llegó temprano ya no es recién llegado ──
  const jt = await pg.evaluate(() => {
    const kid = G.squad[0]; for (let i = 0; i < 3; i++) armadoSemana();
    const p = G.market.find(q => q.lg === 'España' && q.club !== 'Libre' && q.rat >= 70);
    firmaProgramar(p, { price: 1, wage: p.wage, years: 2 }); armadoSemana();
    const llego = G.squad.find(q => q.id === p.id); armadoCerrar(false);
    return { kid: kid.seasonsAtClub, tarde: llego ? llego.seasonsAtClub || 0 : -1, juntos: G.armado.juntos, rastro: G.squad.some(q => q._armDia !== undefined) };
  });
  chk('los que entrenaron 3+ semanas juntos cuentan como del club', jt.kid >= 1 && jt.juntos >= 18, jt.juntos + ' jugadores');
  chk('el que llegó la última semana sigue siendo recién llegado', jt.tarde === 0, 'temporadas: ' + jt.tarde);
  chk('no queda la marca del día de llegada en el plantel', !jt.rastro);

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
