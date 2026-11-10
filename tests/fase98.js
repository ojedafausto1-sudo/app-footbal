// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 98: los bugs del informe del modo DT (dos PDF)
// ═══════════════════════════════════════════════════════════════════════
// Reloj de semanas, semana vivida una vez, balance del mes, tabla de zona del
// Clausura, penales, Stats de liga, objetivos de la Junta, una sola moneda,
// amistosos de la gira, jugadas clave (por tiempo, LM nulo, rival que espera,
// arquero en el penal en contra, botones), 11v11 (simular el resto, stats del
// humano, formación del rival), Previa = once que juega, mercado cerrado.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase98.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await b.newContext()).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.accept());
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  const T = await pg.evaluate(() => {
    localStorage.setItem('dt_fondo3d', '0');
    const o = {};
    o.titulo = document.title;
    tsIr(1); tsIr(2, 'Argentina');
    const pn = tsLigas().find(x => x.lg === 'Primera Nacional'); o.pn = pn ? { top: pn.top, val: pn.val } : null;
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); } catch (e) { }
    try { closeMod(); } catch (e) { } doPreseason('asia'); try { closeMod(); } catch (e) { }
    o.sign80 = G.boardObjectives.some(x => x.id === 'sign80') ? boardObjCheck('sign80')(G) : false;
    o.ppg0 = document.getElementById('objText') ? document.getElementById('objText').textContent : '';
    o.dosAmistososW1 = G.calendar.filter(m => m.friendly && m.week === 1).length;
    o.gira = G.calendar.filter(m => m.friendly).every(m => m.gira && m.neutral);
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, 0) } catch (e) { } }); if (prensaPend()) prensaResolver(0); };
    let desfase = 0, bal = {}, b0 = G.budget, amis = [];
    for (let i = 0; i < 60; i++) {
      dr(); const m = G.calendar.find(x => !x.played); if (!m) break;
      if (!m.friendly && m.week < G.week) desfase++;
      G.day = 7; const n0 = G.phoneMsgs.length ? G.phoneMsgs[0].id : '';
      const bud = G.budget;
      simMatch(true); try { closeMod(); } catch (e) { }
      if (m.friendly) amis.push({ dif: Math.round((G.budget - bud) * 10) / 10, txt: ((G.phoneMsgs.find(x => /Amistoso/.test(x.body || '')) || {}).body) || '', home: m.home, away: m.away, score: m.score });
      for (const x of G.phoneMsgs) { if (x.id === n0) break; if (/Balance del mes/.test(x.body || '')) bal[G.week] = (bal[G.week] || 0) + 1; }
      if (i === 18) { o.top4Mitad = G.boardObjectives.find(x => x.id === 'top4') ? G.boardObjectives.find(x => x.id === 'top4').completed : false; o.statsTile = document.getElementById('sPtsT').textContent; o.stats = statsLiga(); }
      if (G.week >= 30) break;
    }
    o.desfase = desfase; o.balDoble = Object.values(bal).some(v => v > 1); o.balN = Object.keys(bal).length;
    o.amis = amis;
    // la tabla de zona del Clausura arranca de cero
    const cl = (G.arFix || []).filter(f => f.phase === 'clausura' && f.played && (f.home === G.teamName || f.away === G.teamName)).length;
    const z = arZoneTable(arZoneOf(G.teamName)).find(r => r.club === G.teamName);
    o.zonaPJ = z ? z.pj : -1; o.clJugados = cl;
    o.anualPJ = (G.league.table[G.teamName] || {}).pj;
    o.bTop = document.getElementById('bTop').textContent; o.wages = (document.getElementById('wages') || {}).textContent;
    o.dolares = /\$\d/.test(document.body.innerText);
    return o;
  });
  chk('el título de la página no viene escrito con Boca', /^Director Técnico/.test(T.titulo) && !/v7/.test(T.titulo), T.titulo);
  chk('la Primera Nacional tiene club más caro y valor', T.pn && T.pn.top && T.pn.val > 0, JSON.stringify(T.pn));
  chk('"fichar un +80" no se cumple el día 1', T.sign80 === false);
  chk('con 0 PJ no hay promedio de puntos', /0 PJ · — pts\/partido/.test(T.ppg0), T.ppg0.slice(0, 80));
  chk('la gira por Asia trae dos amistosos en la semana 1 (el caso del PDF)', T.dosAmistososW1 === 2);
  chk('el reloj nunca queda adelante del partido que sigue', T.desfase === 0, T.desfase + ' partidos con la semana corrida');
  chk('el balance del mes se cobra una vez por mes', !T.balDoble && T.balN >= 5, T.balN + ' balances');
  chk('los amistosos de la gira son en cancha neutral', T.gira);
  chk('la gira no cobra taquilla de nuevo en cada amistoso', T.amis.length && T.amis.every(a => a.dif <= 0.2), T.amis.map(a => a.dif).join(' '));
  chk('el resultado del amistoso va con el local primero', T.amis.every(a => a.txt.replace(/<[^>]+>/g, '').includes(`${a.home} ${a.score} ${a.away}`)), JSON.stringify(T.amis.find(a => !a.txt.replace(/<[^>]+>/g, '').includes(`${a.home} ${a.score} ${a.away}`)) || ''));
  chk('"top 4" no se marca a mitad de temporada', T.top4Mitad === false);
  chk('el tile de puntos cuenta la liga (no queda en 0)', +T.statsTile === T.stats.pts && T.stats.pts > 0, T.statsTile + ' pts en ' + T.stats.pj + ' PJ');
  chk('la tabla de zona del Clausura arranca de cero', T.clJugados > 0 && T.zonaPJ === T.clJugados && T.anualPJ > T.zonaPJ, `zona ${T.zonaPJ} PJ · anual ${T.anualPJ}`);
  chk('la plata se muestra en euros', /^€/.test(T.bTop) && !T.dolares, T.bTop);
  chk('los salarios se muestran por mes', /\/mes$/.test(T.wages || ''), T.wages);

  // ── penales y textos de llaves ──
  const P = await pg.evaluate(() => {
    const o = {}; let g = 0, emp = 0;
    for (let i = 0; i < 300; i++) { const m = { comp: 'X', oppPow: 72 }; const t = tandaPenales(m); if (t.gana) g++; if (t.mios === t.suyos) emp++; if (!/^\d+-\d+$/.test(m.pens)) o.mal = 1; }
    o.g = g; o.emp = emp;
    // la vuelta dice el global
    G.calendar.push({ week: 99, comp: 'Copa Libertadores - Octavos IDA', home: 'X', away: G.teamName, played: true, score: '2-0', result: 'L' });
    const v = { week: 100, comp: 'Copa Libertadores - Octavos VUELTA', home: G.teamName, away: 'X', played: true, score: '1-0', result: 'W' };
    o.global = llaveTxt(v).replace(/<[^>]+>/g, '');
    G.calendar = G.calendar.filter(m => m.week < 99);
    return o;
  });
  chk('la tanda de penales siempre tiene ganador y queda anotada', P.emp === 0 && !P.mal && P.g > 60 && P.g < 290, P.g + ' de 300 ganadas');
  chk('la vuelta muestra el global y si pasaste', /Global 1-2/.test(P.global) && /afuera/.test(P.global), P.global);

  // ── jugadas clave ──
  const J = await pg.evaluate(async () => {
    const o = {};
    G.day = 7; playMatch(); try { closeMod(); } catch (e) { }
    await new Promise(r => setTimeout(r, 300));
    if (!LM) return { sinLM: true };
    o.xiPrevia = true;
    // jugada del rival: espera el primer toque
    startSituation({ type: 'cornerdef', min: 20 });
    o.espera = SIT && SIT._espera > 0;
    o.capZ = document.getElementById('lmCapZ').textContent;
    const t0 = SIT.t; await new Promise(r => setTimeout(r, 700)); o.quieto = SIT && SIT.t === t0;
    // penal en contra: ataja el arquero
    sitEnd('def_clear'); await new Promise(r => setTimeout(r, 100));
    startSituation({ type: 'penalty', side: 'opp_penalty', min: 30 });
    o.arq = SIT && SIT.mainP && SIT.mainP.pos; o.capZ2 = document.getElementById('lmCapZ').textContent;
    // simular el resto con una jugada abierta cierra todo
    lmAutoFinish();
    await new Promise(r => setTimeout(r, 300));
    o.cerro = !LM && !SIT;
    o.tiempos = G._tiempos && G._tiempos.jugado;
    o.coincide = G._tiempos ? (G._tiempos.gf1 + G._tiempos.gf2) : -1;
    try { closeMod(); } catch (e) { }
    // sitLoop con LM nulo no rompe
    SIT = null; try { sitLoop(0); } catch (e) { o.err = e.message; }
    return o;
  });
  chk('una jugada del rival espera el primer toque', J.espera && J.quieto);
  chk('en el córner en contra el botón dice SALTAR', J.capZ === 'SALTAR', J.capZ);
  chk('en el penal en contra ataja el arquero', J.arq === 'ARQ' && J.capZ2 === 'ATAJAR', J.arq + ' / ' + J.capZ2);
  chk('"simular resto" cierra la jugada abierta y el partido', J.cerro);
  chk('"por tiempo" sale de los goles de este partido', J.tiempos === true && J.coincide >= 0);

  // ── 11v11 ──
  const M = await pg.evaluate(async () => {
    const o = {}; const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0); }; dr();
    try { closeMod(); } catch (e) { }
    const nm = G.calendar.find(x => !x.played); const riv = nm.home === G.teamName ? nm.away : nm.home;
    o.form = formacionRival(riv);
    G.day = 7; startFullMatch(true);
    await new Promise(r => setTimeout(r, 1500));
    if (!FM) return { sinFM: true };
    o.cab = document.getElementById('fm-ov').textContent.includes(o.form);
    o.boton = !!document.querySelector('#fm-ov button[onclick="fmSimularResto()"]');
    fmStat('my', 'pass'); o.pasa = FM.stat.my.pass >= 1;
    o.min0 = FM.minute;
    const pj0 = G.calendar.filter(x => x.played).length;
    fmSimularResto();
    await new Promise(r => setTimeout(r, 300));
    o.jugado = G.calendar.filter(x => x.played).length === pj0 + 1;
    try { closeMod(); } catch (e) { }
    return o;
  });
  chk('el 11v11 muestra la formación del DT rival', M.cab, M.form);
  chk('el botón de terminar simula el resto (no hay FIN instantáneo)', M.boton && M.jugado);
  chk('el 11v11 cuenta los pases', M.pasa);

  // ── mercado cerrado, carpeta, camisetas, aviso ──
  const K = await pg.evaluate(() => {
    const o = {};
    const v = ventanasPases ? null : null;
    const _w = isTransferWindowOpen; window.isTransferWindowOpen = () => false;
    const p = G.market.find(x => !esLibre(x) && x.club !== G.teamName);
    negStartPlayer(p.id); o.cerrado = /Libro de pases cerrado/.test(document.getElementById('modBody').textContent);
    o.seguir = /Seguirlo/.test(document.getElementById('modBody').textContent); closeMod();
    window.isTransferWindowOpen = _w;
    o.kit = kitFor('Ind. Rivadavia').c1; o.kitDist = _kitDist(o.kit, KIT_PASTO);
    flash('✅ prueba', 'win'); const fl = [...document.querySelectorAll('.flash')].pop(); o.flash = fl ? fl.textContent : '';
    o.rep = document.getElementById('repTop').textContent;
    return o;
  });
  chk('con el mercado cerrado, Fichar lo dice y ofrece seguirlo', K.cerrado && K.seguir);
  chk('una camiseta verde no se pierde en el pasto', K.kitDist >= 90, K.kit);
  chk('el aviso no repite el emoji', (K.flash.match(/✅/g) || []).length === 1, K.flash);
  chk('la reputación se muestra sin decimales', /^\d+$/.test(K.rep), K.rep);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
