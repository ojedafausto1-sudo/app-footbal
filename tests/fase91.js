// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 91: mano a mano, contraataque y córner en contra
// ═══════════════════════════════════════════════════════════════════════
// Las tres jugadas clave nuevas se sortean dentro del partido, se juegan con
// teclado/joystick o tocando la cancha (también en 3D), terminan siempre en un
// resultado que el partido entiende, y jugarlas bien CAMBIA el resultado.
// Las jugadas se manejan con un "robot" paso a paso (SIT.update(1)), sin reloj.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase91.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };
const N = 120;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await b.newContext()).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  // ── el reparto del partido ──
  const rep = await pg.evaluate(() => {
    localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_sit3d', '0');
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); autoFill(); try { preseasonSaltear(); } catch (e) { } closeMod();
    const c = {};
    for (let i = 0; i < 60; i++) { G.day = 7; playMatch(); clearInterval(LM.timer); LM.events.forEach(e => c[e.type] = (c[e.type] || 0) + 1); LM.done = true; LM = null; document.getElementById('lmOv').style.display = 'none'; }
    return c;
  });
  const tot = Object.values(rep).reduce((a, x) => a + x, 0);
  chk('el partido sortea mano a mano, contraataque y córner en contra', rep.mano > 0 && rep.contra > 0 && rep.cornerdef > 0, JSON.stringify(rep));
  chk('y siguen las cinco de antes', rep.penalty > 0 && rep.corner > 0 && rep.freekick > 0 && rep.attack > 0 && rep.defense > 0);
  chk('las nuevas son una parte, no todo (20-40% de las ocasiones)', (rep.mano + rep.contra + rep.cornerdef) / tot > 0.2 && (rep.mano + rep.contra + rep.cornerdef) / tot < 0.4, Math.round(100 * (rep.mano + rep.contra + rep.cornerdef) / tot) + '%');

  // ── robots ──
  const R = await pg.evaluate((N) => {
    const E = s => (0, eval)(s);
    G.day = 7; playMatch(); clearInterval(LM.timer);
    let cur = null; const fin0 = window.sitEnd;
    window.sitEnd = o => { cur = o; const s = E('SIT'); if (s) { s.ended = true; cancelAnimationFrame(s.raf); window.removeEventListener('keydown', s.kd); window.removeEventListener('keyup', s.ku); } E('SIT=null'); };
    const bots = {
      mano: s => { s.keys.up = true; if (s.mode === 'dribble' && s.player.y < s.H * 0.42) s.keys.shoot = true; },
      manoQuieto: s => { },
      manoAmague: s => { s.keys.up = true; const d = Math.hypot(s.gk.x - s.player.x, s.gk.y - s.player.y);
        if (s.gk.caido <= 0 && d < 46 && !s._am) { s.keys.pass = true; s._am = 1; } else s.keys.pass = false;
        if (s._amagueOk && s.player.y < s.H * 0.35) s.keys.shoot = true; else if (!s._amagueOk && s.player.y < s.glY + 60) s.keys.shoot = true; },
      contra: s => { s.keys.up = true; if (s.mode !== 'dribble') return; const c = s.mates[s.ctrl]; const dmin = Math.min(...s.defs.map(d => Math.hypot(d.x - c.x, d.y - c.y)));
        s.keys.pass = (dmin < 45 && (s.pases || 0) < 2); if (c.y < s.H * 0.36) s.keys.shoot = true; },
      contraSolo: s => { s.keys.up = true; if (s.mode === 'dribble' && s.mates[s.ctrl].y < s.H * 0.36) s.keys.shoot = true; },
      cornerdef: s => { if (s.mode !== 'vuelo') return; s.tapTo = { x: s.cae.x, y: s.cae.y }; if (s.t >= s.T - 8) s.keys.shoot = true; },
      cornerdefNada: s => { },
    };
    const out = {}, validos = { mano: ['goal', 'save', 'miss', 'gk_save', 'lost', 'back'], contra: ['goal', 'save', 'miss', 'lost', 'out', 'back'], cornerdef: ['def_clear', 'gk_save', 'def_goal', 'opp_miss'] };
    let raros = [];
    for (const [k, bot] of Object.entries(bots)) {
      const tipo = k.replace(/Amague|Solo|Nada|Quieto/, ''); const cnt = {};
      for (let i = 0; i < N; i++) {
        cur = null; startSituation({ type: tipo, side: 'my' }); const s = E('SIT'); if (!s) { cnt.nosit = (cnt.nosit || 0) + 1; continue; }
        cancelAnimationFrame(s.raf); let g = 0;
        while (cur === null && g++ < 1500) { const S = E('SIT'); if (!S) break; S.keys.shoot = false; bot(S); S.t += 1; S.update(1); }
        const o = cur || 'colgada'; cnt[o] = (cnt[o] || 0) + 1; if (!validos[tipo].includes(o)) raros.push(tipo + ':' + o);
      }
      out[k] = cnt;
    }
    window.sitEnd = fin0;
    return { out, raros: [...new Set(raros)] };
  }, N);
  const p = (k, o) => ((R.out[k][o] || 0) / N);
  const pc = x => Math.round(x * 100) + '%';
  chk('las tres terminan siempre en un resultado que el partido entiende', R.raros.length === 0, R.raros.join(', ') || 'ok');
  chk('mano a mano: pateando bien es gol entre 30% y 70%', p('mano', 'goal') > 0.30 && p('mano', 'goal') < 0.70, pc(p('mano', 'goal')));
  chk('mano a mano: quedarse quieto no hace goles (te alcanzan o se acaba)', p('manoQuieto', 'goal') === 0, JSON.stringify(R.out.manoQuieto));
  chk('mano a mano: el amague sirve (gol en 35-80%)', p('manoAmague', 'goal') > 0.35 && p('manoAmague', 'goal') < 0.80, pc(p('manoAmague', 'goal')));
  chk('contraataque: tocar rinde más que irse solo', p('contra', 'goal') > p('contraSolo', 'goal'), pc(p('contra', 'goal')) + ' contra ' + pc(p('contraSolo', 'goal')));
  chk('contraataque: solo te la sacan más seguido', (p('contraSolo', 'lost')) > (p('contra', 'lost')) + 0.1, pc(p('contraSolo', 'lost')) + ' contra ' + pc(p('contra', 'lost')));
  chk('córner en contra: bien jugado te hacen pocos goles (≤25%)', p('cornerdef', 'def_goal') <= 0.25, pc(p('cornerdef', 'def_goal')));
  chk('córner en contra: sin hacer nada te hacen muchos más', p('cornerdefNada', 'def_goal') > p('cornerdef', 'def_goal') + 0.10 && p('cornerdefNada', 'def_goal') > p('cornerdef', 'def_goal') * 1.5, pc(p('cornerdefNada', 'def_goal')) + ' contra ' + pc(p('cornerdef', 'def_goal')));

  // ── tocar la cancha ──
  const tap = await pg.evaluate(() => {
    const E = s => (0, eval)(s); const o = {};
    startSituation({ type: 'contra', side: 'my' }); let s = E('SIT'); cancelAnimationFrame(s.raf);
    const m = s.mates[2]; s.onTap(m.x, m.y); o.pase = s.mode === 'pase' && s.pase.a === 2;
    E('SIT').ended = true; E('SIT=null');
    startSituation({ type: 'mano', side: 'my' }); s = E('SIT'); cancelAnimationFrame(s.raf);
    s.onTap(s.W / 2 + s.gh * 0.6, s.glY + 4); s.t += 1; s.update(1); o.tiro = s.mode === 'shot';
    E('SIT').ended = true; E('SIT=null');
    startSituation({ type: 'cornerdef', side: 'my' }); s = E('SIT'); cancelAnimationFrame(s.raf);
    s.onTap(s.player.x + 80, s.player.y); const x0 = s.player.x; for (let i = 0; i < 40; i++) { s.t += 1; s.update(1); } o.mueve = s.player.x > x0 + 20;
    E('SIT').ended = true; E('SIT=null');
    return o;
  });
  chk('tocar un compañero le pasa la pelota', tap.pase);
  chk('tocar el arco patea', tap.tiro);
  chk('tocar el pasto lleva al jugador ahí', tap.mueve);

  // ── en 3D ──
  const d3 = await pg.evaluate(async () => {
    const E = s => (0, eval)(s);
    localStorage.setItem('dt_sit3d', '1');
    let llamadas = 0; const R0 = Math.random;
    const o = {};
    for (const t of ['mano', 'contra', 'cornerdef']) {
      startSituation({ type: t, side: 'my' });
      for (let i = 0; i < 60 && !(E('SIT') && E('SIT')._3d); i++) await new Promise(r => setTimeout(r, 100));
      const s = E('SIT'); if (!s || !s._3d) { o[t] = 'sin 3D'; continue; }
      Math.random = function () { llamadas++; return R0(); };
      sit3DFrame(s, 1);
      Math.random = R0;
      // ida y vuelta pantalla ↔ pasto
      const q = s._g2s(s.W * 0.4, s.H * 0.6, 0), g = s._s2g(q.x, q.y);
      o[t] = g ? Math.round(Math.hypot(g.x - s.W * 0.4, g.y - s.H * 0.6)) : 'null';
      o[t + 'Figs'] = _s3Escena(s).figs.length;
      s.ended = true; cancelAnimationFrame(s.raf); E('SIT=null');
    }
    o.azar = llamadas;
    localStorage.setItem('dt_sit3d', '0');
    return o;
  });
  chk('las tres se dibujan en 3D con sus jugadores', d3.manoFigs === 3 && d3.contraFigs === 6 && d3.cornerdefFigs === 5, JSON.stringify(d3));
  chk('en 3D, tocar la pantalla cae en el lugar correcto de la cancha (≤2 px)', d3.mano <= 2 && d3.contra <= 2 && d3.cornerdef <= 2);
  chk('dibujar en 3D no gasta azar del partido', d3.azar === 0, d3.azar + ' llamadas');

  // ── un partido entero de jugadas clave, simulando el resto ──
  const pm = await pg.evaluate(async () => {
    const E = s => (0, eval)(s);
    G.day = 7; const n0 = G.calendar.filter(m => m.played).length;
    if (E('LM')) { clearInterval(LM.timer); E('LM=null'); }
    playMatch(); clearInterval(LM.timer); LM.events = [{ min: 10, type: 'mano', side: 'my' }, { min: 20, type: 'contra', side: 'my' }, { min: 30, type: 'cornerdef', side: 'my' }];
    lmAutoFinish(); await new Promise(r => setTimeout(r, 300)); closeMod();
    return G.calendar.filter(m => m.played).length - n0;
  });
  chk('"simular resto" resuelve las nuevas y cierra el partido', pm === 1);

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
