// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 93: el córner con zonas y marcas, y el penal por punto de contacto
// ═══════════════════════════════════════════════════════════════════════
// Córner: el que patea no cabecea, cada uno va a su zona, se cambia de
// jugador, las marcas siguen a su hombre, el arquero sale y la habilidad
// (cabezazo) cambia el resultado. Penal: el punto de la pelota decide adónde
// va y el TIR cuánto se te va el botín.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase93.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };
const N = 160;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await b.newContext()).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  const R = await pg.evaluate((N) => {
    const E = s => (0, eval)(s);
    localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_sit3d', '0');
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); autoFill(); try { preseasonSaltear(); } catch (e) { } closeMod();
    G.day = 7; playMatch(); clearInterval(LM.timer);
    LM.S.oppRat = 70;              // el mismo rival para todas las tandas
    let cur = null; const fin0 = window.sitEnd;
    window.sitEnd = o => { cur = o; const s = E('SIT'); if (s) { s.ended = true; cancelAnimationFrame(s.raf); } E('SIT=null'); };
    const dM = (a, c) => Math.hypot((a.wx - c.wx) * 6.1, (a.wz - c.wz) * 22);
    const ir = (s, L) => { const c = s.mates[s.ctrl]; const dx = (L.wx - c.wx) * 6.1, dz = (L.wz - c.wz) * 22; s.keys.right = dx > 0.3; s.keys.left = dx < -0.3; s.keys.up = dz > 0.3; s.keys.down = dz < -0.3; };
    const bots = {
      bien: s => { if (s.phase === 'aim') { if (s.aimT < 25) s.keys.shoot = true; return; } if (s.phase !== 'cross') return; ir(s, { wx: s.cross.x1, wz: s.cross.z1 }); if (s.ventana() && s.dBall < 0.9) s.keys.shoot = true; },
      atacar: s => { if (s.phase === 'aim') { if (s.aimT < 25) s.keys.shoot = true; return; } if (s.phase !== 'cross') return; ir(s, s.ball);
        if (s.ventana() && s.dBall < 0.9) { s.keys.shoot = true; s.keys.left = s.gk.wx > 0; s.keys.right = s.gk.wx <= 0; } },
      nada: s => { if (s.phase === 'aim' && s.aimT < 25) s.keys.shoot = true; },
    };
    const o = {};
    const correr = (bot, n, pre) => {
      const c = {}; let deTaker = 0, zonas = [], marcaMax = 0;
      for (let i = 0; i < n; i++) {
        cur = null; startSituation({ type: 'corner', side: 'my' }); const s = E('SIT'); cancelAnimationFrame(s.raf);
        if (pre) pre(s);
        const taker = s.taker.id; let g = 0, vistoZ = false;
        while (cur === null && g++ < 1500) { const S = E('SIT'); if (!S) break; S.keys.shoot = false; S.keys.pass = false; bot(S); S.t += 1; S.update(1);
          if (S && S.phase === 'cross' && !vistoZ && S.crossT / S.crossDur > 0.9) { vistoZ = true;
            const ia = S.mates.filter((m, j) => j !== S.atacaIA); let dmin = 99;
            for (let a = 0; a < ia.length; a++) for (let b2 = a + 1; b2 < ia.length; b2++) dmin = Math.min(dmin, dM(ia[a], ia[b2]));
            if (ia.length > 1) zonas.push(dmin);
            S.marks.forEach((mk, j) => { if (j !== S.ctrl) marcaMax = Math.max(marcaMax, dM(mk, mk.de)); }); }
          if (S && S.scorer && S.scorer.id === taker) deTaker++; }
        c[cur || 'colgada'] = (c[cur || 'colgada'] || 0) + 1;
      }
      for (const k in c) c[k] = c[k] / n;
      return { c, deTaker, zonaMin: zonas.length ? Math.min(...zonas) : 99, marcaMax };
    };
    o.bien = correr(bots.bien, N); o.atacar = correr(bots.atacar, N); o.nada = correr(bots.nada, N);
    // habilidad: los mismos que suben, con cabezazo de crack o de enano
    o.crack = correr(bots.bien, N, s => s.mates.forEach(m => m.cab = 92));
    o.enano = correr(bots.bien, N, s => s.mates.forEach(m => m.cab = 45));

    // controles: cambiar de jugador, moverse en los dos ejes
    startSituation({ type: 'corner', side: 'my' }); let s = E('SIT'); cancelAnimationFrame(s.raf);
    for (let i = 0; i < 20; i++) { s.keys.shoot = true; s.update(1); } s.keys.shoot = false; s.update(1);
    o.fase = s.phase; o.suben = s.mates.length; o.marcas = s.marks.length;
    const c0 = s.ctrl; s.keys.pass = true; s.update(1); s.keys.pass = false; s.update(1); o.cambia = s.ctrl !== c0;
    const m = s.mates[s.ctrl], z0 = m.wz, x0 = m.wx; s.keys.up = true; for (let i = 0; i < 10; i++) s.update(1); s.keys.up = false;
    s.keys.right = true; for (let i = 0; i < 10; i++) s.update(1); s.keys.right = false;
    o.mueveZ = m.wz > z0 + 0.01; o.mueveX = m.wx > x0 + 0.05;
    // un rápido le saca ventaja a su marca corriendo
    const mk = s.marks[s.ctrl]; m.vel = 95; mk.def = 50; mk.vel = 50; s.keys.left = true; for (let i = 0; i < 25; i++) s.update(1); s.keys.left = false;
    o.seLibra = dM(m, mk) > 1.0;
    E('SIT').ended = true; E('SIT=null');
    // el arquero sale si el centro va al área chica
    startSituation({ type: 'corner', side: 'my' }); s = E('SIT'); cancelAnimationFrame(s.raf);
    s.aimWx = 0; s.aimWz = 0.86; s.ckQ = 99; for (let i = 0; i < 10; i++) { s.keys.shoot = true; s.aimT += 1; s.phase === 'aim' && (s.aimWx = 0, s.aimWz = 0.86); s.update(1); }
    s.keys.shoot = false; s.update(1); for (let i = 0; i < 70 && E('SIT'); i++) { s.keys.shoot = false; s.update(1); }
    o.arqueroSale = !!s.gk.sale && s.gk.wz < 0.95;
    if (E('SIT')) { E('SIT').ended = true; E('SIT=null'); }
    // tocar un compañero lo elige
    startSituation({ type: 'corner', side: 'my' }); s = E('SIT'); cancelAnimationFrame(s.raf);
    for (let i = 0; i < 20; i++) { s.keys.shoot = true; s.update(1); } s.keys.shoot = false; s.update(1);
    const otro = (s.ctrl + 1) % s.mates.length, q = s.proj(s.mates[otro].wx, s.mates[otro].wz, 0);
    s.onTap(q.x, q.y, false); o.tocaElige = s.ctrl === otro;
    const g = s.aPasto(q.x, q.y); o.aPasto = dM(g, s.mates[otro]);
    E('SIT').ended = true; E('SIT=null');

    // ── PENAL ──
    const run = (fn, tir, n) => { const c = {}; for (let i = 0; i < n; i++) { cur = null; startSituation({ type: 'penalty', side: 'my' }); const S = E('SIT'); cancelAnimationFrame(S.raf);
      if (tir != null) { S.mainP.attrs = Object.assign({}, S.mainP.attrs, { TIR: tir }); S.finQ = tir; } fn(S); let k = 0; while (cur === null && k++ < 300) { const T = E('SIT'); if (!T) break; T.update(1); }
      c[cur] = (c[cur] || 0) + 1; } for (const k in c) c[k] /= n; return c; };
    const ctc = (nx, ny, pw) => S => S._fireContacto(nx, ny, pw);
    const bl = penContactoBlanco;
    o.pLadoIzq = bl(-0.6, 0, 1).ax > 0.5; o.pLadoDer = bl(0.6, 0, 1).ax < -0.5;
    o.pAbajoAlta = bl(0, 0.6, 1).ay > bl(0, -0.4, 1).ay + 0.6;
    o.pErr = [95, 80, 65].map(t => penError({ attrs: { TIR: t }, morale: 70 }, 1.0));
    o.pFuerza = penError({ attrs: { TIR: 80 } }, 1.3) > penError({ attrs: { TIR: 80 } }, 1.0);
    o.esq90 = run(ctc(-0.68, 0.10, 0.95), 90, 300); o.esq65 = run(ctc(-0.68, 0.10, 0.95), 65, 300);
    o.centro = run(ctc(0, 0, 1.0), 80, 300); o.borde = run(ctc(-0.97, 0.2, 0.95), 80, 200);
    // tocar la pelota grande y soltar patea al lado contrario
    startSituation({ type: 'penalty', side: 'my' }); s = E('SIT'); cancelAnimationFrame(s.raf);
    s._held = true; s.onTap(s.bola.x - s.bola.r * 0.6, s.bola.y, false); for (let i = 0; i < 15; i++) s.update(1);
    o.cargando = s.charging && !s.kicked; s._held = false; s.update(1);
    o.tocaPatea = s.kicked && s.contacto && s.aimAx > 0;
    if (E('SIT')) { E('SIT').ended = true; E('SIT=null'); }
    window.sitEnd = fin0;
    return o;
  }, N);

  const pc = x => Math.round((x || 0) * 100) + '%';
  console.log('  córner bien', JSON.stringify(R.bien.c), '· atacar', JSON.stringify(R.atacar.c), '· nada', JSON.stringify(R.nada.c));
  chk('el córner sale: 2-4 suben, cada uno con su marca', R.fase === 'cross' && R.suben >= 2 && R.suben <= 4 && R.marcas === R.suben, R.suben + ' suben');
  chk('el que patea el córner nunca es el que cabecea', R.bien.deTaker + R.atacar.deTaker + R.nada.deTaker === 0);
  chk('no van todos al mismo lugar (≥2 m entre el tuyo y los que esperan en su zona)', R.bien.zonaMin >= 2.0, R.bien.zonaMin.toFixed(1) + ' m');
  chk('las marcas siguen a su hombre (≤2,5 m)', R.nada.marcaMax <= 2.5, R.nada.marcaMax.toFixed(1) + ' m');
  chk('X cambia de jugador', R.cambia);
  chk('se maneja en los dos ejes (hacia el arco y de costado)', R.mueveZ && R.mueveX);
  chk('el rápido se le escapa a una marca lenta', R.seLibra);
  chk('el arquero sale a cortar un centro al área chica', R.arqueroSale);
  chk('tocar a un compañero lo elige', R.tocaElige);
  chk('tocar la cancha cae en el lugar tocado (≤0,6 m)', R.aPasto <= 0.6, R.aPasto.toFixed(2) + ' m');
  chk('bien jugado es gol entre 20% y 50%', R.bien.c.goal > 0.20 && R.bien.c.goal < 0.50, pc(R.bien.c.goal));
  chk('ir a buscarla rinde más que esperarla', R.atacar.c.goal > R.bien.c.goal, pc(R.atacar.c.goal) + ' contra ' + pc(R.bien.c.goal));
  chk('ir a buscarla no es gol seguro (≤70%)', R.atacar.c.goal <= 0.70, pc(R.atacar.c.goal));
  chk('sin hacer nada casi siempre la sacan (gol ≤20%)', (R.nada.c.goal || 0) <= 0.20, pc(R.nada.c.goal));
  chk('…pero a veces la cabecea un compañero', (R.nada.c.goal || 0) + (R.nada.c.save || 0) + (R.nada.c.miss || 0) > 0);
  chk('la defensa gana pelotas de verdad (despeje o arquero ≥25% bien jugado)', (R.bien.c.cleared || 0) + (R.bien.c.gk_claim || 0) >= 0.25);
  chk('el cabezazo del que sube cambia el resultado (92 contra 45)', R.crack.c.goal > (R.enano.c.goal || 0) + 0.12, pc(R.crack.c.goal) + ' contra ' + pc(R.enano.c.goal));

  console.log('  penal TIR 90', JSON.stringify(R.esq90), '· TIR 65', JSON.stringify(R.esq65), '· al medio', JSON.stringify(R.centro));
  chk('penal: pegarle del lado izquierdo la manda a la derecha y al revés', R.pLadoIzq && R.pLadoDer);
  chk('penal: pegarle abajo la levanta', R.pAbajoAlta);
  chk('penal: el botín se te va más con menos TIR', R.pErr[0] < R.pErr[1] && R.pErr[1] < R.pErr[2], R.pErr.map(x => x.toFixed(3)).join(' < '));
  chk('penal: pegarle con toda se te va más', R.pFuerza);
  chk('penal: al ángulo con TIR 90 es gol 50-88%', R.esq90.goal > 0.50 && R.esq90.goal < 0.88, pc(R.esq90.goal));
  chk('penal: con TIR 65 se va afuera más que con 90', (R.esq65.miss || 0) > (R.esq90.miss || 0) + 0.05, pc(R.esq65.miss) + ' contra ' + pc(R.esq90.miss));
  chk('penal: al medio se lo atajan más que al ángulo', (R.centro.save || 0) > (R.esq90.save || 0), pc(R.centro.save) + ' contra ' + pc(R.esq90.save));
  chk('penal: pegarle al borde de la pelota es errarla', (R.borde.miss || 0) > 0.8, pc(R.borde.miss));
  chk('penal: tocar la pelota grande carga la fuerza…', R.cargando);
  chk('…y soltar patea al lado contrario del que tocaste', R.tocaPatea);

  // ── en 3D ──
  const d3 = await pg.evaluate(async () => {
    const E = s => (0, eval)(s);
    localStorage.setItem('dt_sit3d', '1');
    const o = {};
    for (const t of ['corner', 'penalty']) {
      startSituation({ type: t, side: 'my' });
      for (let i = 0; i < 80 && !(E('SIT') && E('SIT')._3d); i++) await new Promise(r => setTimeout(r, 100));
      const s = E('SIT'); if (!s || !s._3d) { o[t] = 'sin 3D'; continue; }
      cancelAnimationFrame(s.raf);
      if (t === 'corner') { for (let i = 0; i < 20; i++) { s.keys.shoot = true; s.update(1); } s.keys.shoot = false; s.update(1); }
      let n = 0; const R0 = Math.random; Math.random = function () { n++; return R0(); };
      sit3DFrame(s, 1); s.draw(document.getElementById('lmCanvas').getContext('2d'));
      Math.random = R0; o[t + 'Azar'] = n;
      const e = _s3Escena(s); o[t + 'Figs'] = e.figs.length;
      o[t + 'Esperadas'] = t === 'corner' ? s.mates.length + s.marks.length + s.defs.length + 2 : 2;
      o[t + 'Ids'] = new Set(e.figs.map(f => f.id)).size === e.figs.length;
      if (t === 'corner') { const q = s.proj(s.mates[0].wx, s.mates[0].wz, 0), g = s.aPasto(q.x, q.y); o.p3d = Math.hypot((g.wx - s.mates[0].wx) * 6.1, (g.wz - s.mates[0].wz) * 22); }
      s.ended = true; E('SIT=null');
    }
    localStorage.setItem('dt_sit3d', '0');
    return o;
  });
  chk('córner en 3D: todos los jugadores, sin repetidos', d3.cornerFigs === d3.cornerEsperadas && d3.cornerIds, JSON.stringify(d3));
  chk('penal en 3D: arquero y pateador', d3.penaltyFigs === 2 && d3.penaltyIds);
  chk('en 3D tocar la cancha también cae bien (≤0,6 m)', d3.p3d <= 0.6, d3.p3d && d3.p3d.toFixed(2));
  chk('dibujar el 3D no gasta azar de la jugada', d3.cornerAzar === 0 && d3.penaltyAzar === 0, d3.cornerAzar + ' / ' + d3.penaltyAzar);

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
