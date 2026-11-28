// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 104: el modo JUGAR, el arquero, las jugadas clave y la
// fluidez
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase104.js
//
// Qué blinda (la auditoría "¿está listo para publicar?"):
//  1. En el modo JUGAR los dos DTs dirigen (antes perfil neutro de 0,5).
//  2. Tu remate se marca como remate, apunta al arco y entra (antes 0 de 120).
//  3. El arquero adelantado se estira hasta donde la pelota le pasa a ÉL, y el
//     arquero vencido no despeja con los pies. La IA apunta lejos del arquero.
//  4. La pelota que te robaron no se vuelve a pegar al pie en el cuadro siguiente.
//  5. Piloto automático: sin tocar nada, tu equipo juega solo.
//  6. El penal y el tiro libre a favor patean solos si no tocás; tocar el arco patea.
//  7. Guardado: el fin de partido no guarda en el acto, la seguidilla guarda una vez,
//     y al esconder la página se guarda lo pendiente.
//  8. Mercado paginado, la lista de DTs sin vidrio por fila, sin reacomodo forzado.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); localStorage.setItem('dt_sit3d', '0'); } catch (e) { } });
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  console.log('\n═══ MODO JUGAR (11v11 con humano) ═══');
  const J = await pg.evaluate(() => {
    const rng = s => { let a = s >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    Math.random = rng(7);
    document.getElementById('teamSelect').style.display = 'none';
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    G.calendar.forEach(x => { if (x.friendly) x.played = true; });
    const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7;
    const raf0 = window.requestAnimationFrame;
    window.requestAnimationFrame = cb => { if (!window._arm) { window._arm = 1; cb(performance.now()); window._arm = 0; } return 0; };
    startFullMatch(false); window.requestAnimationFrame = raf0;
    fmCloseHelp();
    const f = FM, o = {};
    o.perfiles = !!f.myProf && !!f.oppProf && !!f.oppDT && !!f.myProfEff && !!f.oppProfEff;
    o.oppDT = f.oppDT && f.oppDT.name;
    const fw = f.rightGL - f.leftGL, mPx = fw / 105, mid = f.VH / 2;
    const gk = f.opp.find(q => q.isGK);
    const st = f.my.find(q => !q.isGK && /DC|DEL|EI|ED|MCO/.test(q.role)) || f.my[9];
    const prep = (metros, y0, joy, carga) => {
      f.phase = 'play'; f.restart = null; f._ventaja = null; f._offPend = null; f.myAttRight = true; f._auto = false; f._idleT = 0;
      f.ctrl = f.my.indexOf(st);
      f.my.forEach(q => { if (q !== st) { q.x = f.VW * 0.3; q.vx = q.vy = 0; } });
      f.opp.forEach(q => { if (q !== gk) { q.x = f.VW * 0.2; q.vx = q.vy = 0; } });
      gk.x = f.rightGL - 20; gk.y = mid; gk.vx = gk.vy = 0;
      st.x = f.rightGL - metros * mPx - 22; st.y = mid + (y0 || 0); st.vx = st.vy = 0;
      Object.assign(f.ball, { x: st.x + 20, y: st.y, vx: 0, vy: 0, air: 0, isShot: null, _quiteDe: null }); f._gkHold = null; f._gkPass = null;
      f.keys = { up: 0, dn: 0, lf: 0, rt: 0, z: 0, x: 0, c: 0, tab: 0, sprint: 0 }; f.joyVec = joy ? { x: joy[0], y: joy[1], mag: 1 } : null;
      f.chargeA = carga; f.zWas = 1;
    };
    // un remate: se marca, sale al arco, el joystick elige el palo
    prep(16, 0, null, 0.4); fmCtrl(1);
    o.marca = f.ball.isShot === 'my' && st._solto === f.ticks;
    const cruce = y => y + f.ball.vy * ((f.rightGL - f.ball.x) / f.ball.vx);
    o.alArco = Math.abs(cruce(f.ball.y) - mid) < (f.GM || 86) * 1.05;
    o.vel = Math.hypot(f.ball.vx, f.ball.vy);
    prep(16, 0, [0.8, -0.6], 0.4); fmCtrl(1); o.paloArriba = cruce(f.ball.y) < mid;
    prep(16, 0, [0.8, 0.6], 0.4); fmCtrl(1); o.paloAbajo = cruce(f.ball.y) > mid;
    // 60 remates desde 11 m, solo contra el arquero
    let gol = 0;
    for (let i = 0; i < 60; i++) {
      Math.random = rng(500 + i); prep(11, 0, null, 0.5);
      for (let t = 0; t < 200; t++) { f.keys.z = 0; if (t) f.joyVec = null; fmTick(1); if (f.phase === 'goal_my') { gol++; break; } if (f.phase !== 'play' || f._gkHold) break; }
      f.myG = 0; f.oppG = 0; f.phase = 'play'; f.restart = null;
    }
    o.gol11 = gol;
    // el arquero adelantado: la pelota le pasa a 40 px pero cruzaría la línea a 70
    const geo = cg => {
      FM104.cruceGK = cg; f._gkPass = null; f._gkHold = null;
      gk.x = f.rightGL - 150; gk.y = mid; gk.attrs = Object.assign({}, gk.attrs, { REF: 75 });
      Object.assign(f.ball, { x: gk.x - 30, y: mid + 34, vx: 10, vy: 2, air: 0, isShot: 'my' }); f._lastTouch = 'my';
      Math.random = rng(3); const r = fmBodyBall(gk, f.ball, 'opp');
      return r === true || !!(f._gkPass && f._gkPass.gk === gk);
    };
    o.intervieneConCruceGK = geo(1); o.intervieneSinCruceGK = geo(0); FM104.cruceGK = 1;
    // el arquero vencido no la despeja con los pies
    const pies = on => {
      FM104.pies = on; f._gkHold = null; f.phase = 'play';
      gk.x = f.rightGL - 40; gk.y = mid; gk.vx = gk.vy = 0; gk._sacoT = -999;
      Object.assign(f.ball, { x: gk.x + 10, y: mid + 30, vx: 6, vy: 0, air: 0, isShot: null, _beat: f.ticks });
      f._gkPass = { gk, until: f.ticks + 45 };
      fmAI(gk, 'opp', f.opp.indexOf(gk), 1);
      return f.ball.vx > 5;          // sigue camino al arco
    };
    o.vencidoNoDespeja = pies(1); o.vencidoDespejabaAntes = !pies(0); FM104.pies = 1;
    // la IA apunta al lado que dejó libre el arquero
    const gkA = { y: mid + 40 }, gkB = { y: mid - 40 };
    Math.random = rng(9); const aA = fmAim(f, st, 80, gkA, mid, 0.8, 300);
    Math.random = rng(9); const aB = fmAim(f, st, 80, gkB, mid, 0.8, 300);
    o.aimLejos = aA < 0 && aB > 0;
    o.aimCallSites = (fmAI.toString().match(/fmAim\(f,p,shotAttr,_gk\d?,FM104\.aimMid\?mid:0/g) || []).length;
    // la pelota robada no se vuelve a pegar al pie
    prep(30, 0, [1, 0], 0); f.chargeA = 0; f.zWas = 0;
    Object.assign(f.ball, { x: st.x + 22, y: st.y, vx: -3.2, vy: 0, _quiteDe: st, _quiteT: f.ticks });
    fmCtrl(1); o.robadaSigueSuelta = f.ball.vx < -3;
    Object.assign(f.ball, { x: st.x + 22, y: st.y, vx: -3.2, vy: 0, _quiteDe: null }); fmCtrl(1); o.sinRoboLaPega = f.ball.vx > -3;
    // piloto automático
    prep(40, 0, null, 0); f.chargeA = 0; f.zWas = 0; f.ball.x = f.VW / 2; f.ball.y = mid; st.x = f.VW / 2 - 300;
    for (let t = 0; t < 80; t++) { f.keys = { up: 0, dn: 0, lf: 0, rt: 0, z: 0, x: 0, c: 0, tab: 0, sprint: 0 }; f.joyVec = null; fmTick(1); }
    o.autoOn = !!f._auto; o.autoCartel = getComputedStyle(document.getElementById('fm-auto')).display !== 'none';
    f.keys.rt = 1; fmTick(1); o.autoOffAlTocar = !f._auto;
    try { fmClean(); } catch (e) { } FM = null; document.getElementById('fm-ov')?.remove();
    return o;
  });
  chk('los dos DTs dirigen en el modo jugar', J.perfiles, J.oppDT);
  chk('tu remate se marca como remate (el arquero no lo toma por pelota suelta)', J.marca);
  chk('sin joystick sale al arco', J.alArco, 'vel ' + J.vel.toFixed(1));
  chk('el toque corto pega como la IA (8,5+)', J.vel >= 8.3, J.vel.toFixed(2));
  chk('el joystick elige el palo', J.paloArriba && J.paloAbajo);
  chk('desde 11 m, solo contra el arquero, entra (antes 0 de 120)', J.gol11 >= 9 && J.gol11 <= 36, J.gol11 + '/60');
  chk('el arquero adelantado se estira hasta donde le pasa la pelota a él', J.intervieneConCruceGK && !J.intervieneSinCruceGK);
  chk('el arquero vencido no la despeja con los pies', J.vencidoNoDespeja && J.vencidoDespejabaAntes);
  chk('la IA apunta lejos del arquero (y los 3 remates usan el centro real)', J.aimLejos && J.aimCallSites === 3, J.aimCallSites);
  chk('la pelota robada no se vuelve a pegar al pie', J.robadaSigueSuelta && J.sinRoboLaPega);
  chk('sin tocar nada entra el piloto automático y se ve el cartel', J.autoOn && J.autoCartel);
  chk('tocar algo devuelve el control', J.autoOffAlTocar);

  console.log('\n═══ JUGADAS CLAVE: el penal y el tiro libre no esperan para siempre ═══');
  await pg.evaluate(() => {
    let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0); try { closeMod(); } catch (e) { }
    const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7;
    window._t104 = [];
    const oE = window.sitEnd; window.sitEnd = function (o) { window._t104.push({ t: SIT && SIT.type, o, dt: SIT && Math.round(SIT.t) }); return oE.apply(this, arguments); };
    playMatch();
    LM.events = [{ min: 1, type: 'penalty', side: 'my' }, { min: 2, type: 'freekick', side: 'my' }];
  });
  const t0 = Date.now(); let fin = false;
  while (Date.now() - t0 < 70000) { await pg.waitForTimeout(400); const s = await pg.evaluate(() => !LM && !SIT); if (s) { fin = true; break; } }
  const K = await pg.evaluate(() => ({ sl: window._t104 }));
  chk('el partido de jugadas clave termina sin tocar nada', fin, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  chk('el penal patea solo', K.sl.some(x => x.t === 'penalty' && x.dt >= 530), JSON.stringify(K.sl));
  chk('el tiro libre patea solo', K.sl.some(x => x.t === 'freekick' && x.dt >= 530));
  const P = await pg.evaluate(() => {
    try { closeMod(); } catch (e) { }
    let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0); try { closeMod(); } catch (e) { }
    const nx = G.calendar.find(x => !x.played); G.week = nx.week; G.day = 7;
    playMatch(); LM.events = []; clearInterval(LM.timer);
    startSituation({ min: 1, type: 'penalty', side: 'my' });
    const s = SIT; const c = s.proj(0, 1, 0.43);
    s.onTap(c.x, c.y, false);
    const r = { kicked: s.kicked, apunta: Math.abs(s.aimAx) < 0.3 };
    try { lmAutoFinish(); } catch (e) { } try { closeMod(); } catch (e) { }
    return r;
  });
  chk('tocar el arco en el penal patea ahí', P.kicked && P.apunta);

  console.log('\n═══ GUARDADO Y FLUIDEZ ═══');
  const S = await pg.evaluate(async () => {
    const o = {};
    let n = 0; const oS = window.saveGame; window.saveGame = function () { n++; return oS.apply(this, arguments); };
    const dr = () => { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (prensaPend()) prensaResolver(0); try { closeMod(); } catch (e) { } };
    dr(); let m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7;
    saveFlush(); n = 0;
    simMatch(true); try { closeMod(); } catch (e) { }
    o.enElActo = n;
    await new Promise(r => setTimeout(r, 700));
    o.alRato = n;
    // seguidilla: un solo guardado
    dr(); n = 0; _csModo = 'todo';
    runContinuousSim(8); try { closeMod(); } catch (e) { }
    o.seguidillaSync = n;
    await new Promise(r => setTimeout(r, 1200));
    o.seguidilla = n;
    // al esconder la página se guarda lo pendiente
    dr(); m = G.calendar.find(x => !x.played); G.week = m.week; G.day = 7; simMatch(true); try { closeMod(); } catch (e) { }
    n = 0;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    o.alEsconder = n;
    delete document.visibilityState;
    window.saveGame = oS;
    // mercado paginado
    gTab('mkt'); try { renderMkt(); } catch (e) { }
    o.filas = document.querySelectorAll('#mkList .mkrow').length;
    o.boton = !!document.querySelector('#mkList button[onclick="mkVerMas()"]');
    mkVerMas(); o.filas2 = document.querySelectorAll('#mkList .mkrow').length;
    const q = document.getElementById('mkMinR'); q.value = '60'; renderMkt(); o.filas3 = document.querySelectorAll('#mkList .mkrow').length; q.value = ''; renderMkt();
    // lista de técnicos sin vidrio por fila
    irTab('ct');
    const dl = document.getElementById('dtList');
    o.dtFilas = dl ? dl.querySelectorAll(':scope > .mpanel').length : -1;
    o.dtCards = dl ? dl.querySelectorAll('.card').length : -1;
    o.fuisync = /requestAnimationFrame\(\(\)=>\{ try\{ const pn=_act\.parentNode/.test(fUISync.toString());
    o.irTab = irTab.toString().indexOf('scrollTop') < irTab.toString().indexOf('gTab(');
    const fns = []; (function scan(x, d) { if (!x || d > 6) return; for (const k in x) { if (typeof x[k] === 'function') fns.push(k); else if (typeof x[k] === 'object') scan(x[k], d + 1); } })(G, 0);
    o.fns = fns.length;
    return o;
  });
  chk('el fin de partido no guarda en el acto', S.enElActo === 0, S.enElActo);
  chk('…pero guarda enseguida', S.alRato === 1, S.alRato);
  chk('la seguidilla de 8 partidos guarda UNA vez', S.seguidillaSync === 0 && S.seguidilla === 1, S.seguidillaSync + ' / ' + S.seguidilla);
  chk('al esconder la página se guarda lo pendiente', S.alEsconder === 1, S.alEsconder);
  chk('el Mercado dibuja de a 50 con "mostrar más"', S.filas === 50 && S.boton && S.filas2 === 100, S.filas + ' → ' + S.filas2);
  chk('cambiar un filtro vuelve a la primera página', S.filas3 <= 50, S.filas3);
  chk('la lista de técnicos va sin vidrio por fila', S.dtFilas > 0 && S.dtCards === 0, S.dtFilas + ' filas · ' + S.dtCards + ' .card');
  chk('la barra no fuerza un reacomodo a mitad del cambio de pestaña', S.fuisync && S.irTab);
  chk('0 funciones en G', S.fns === 0, S.fns);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
