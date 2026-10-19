// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 77: el montón de jugadores del 11v11
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase77.js
//
// El reporte (captura del Inter–Monza): diez jugadores del mismo equipo
// pegados en un punto, en pleno juego. La causa eran dos bugs juntos:
//  1. f.ticks volvía a cero cada minuto y todo lo que se mide con él son
//     duraciones: las marcas viejas de "voy a recibir" (_recvTick) revivían.
//  2. "Voy a buscarla" no miraba si había un pase más nuevo a otro compañero.
// Qué blinda:
//  1. El reloj es monótono y el minuto se cuenta aparte.
//  2. Con la pelota suelta, sólo va el destino del ÚLTIMO pase.
//  3. Dos partidos del Inter tick a tick: nunca 8+ de un equipo amontonados.
//  4. Los remates quedan en un rango sano (se recalibraron, ver FM77).
//  5. 0 errores.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  // arma un partido de Inter en modo espectador, sin reloj de pared
  const ARMAR = `(()=>{
    localStorage.clear();localStorage.setItem('dt_fondo3d','0');localStorage.setItem('dt_fm3d','0');
    document.getElementById('teamSelect').style.display='none';
    setLigaSel('Italia'); const _k=Object.keys(TEAMS).find(k=>TEAMS[k].name==='Inter'); startGame(_k);
    try{autoFill();preseasonSaltear();closeMod();}catch(e){}
    G.calendar.forEach(m=>{ if(m.friendly) m.played=true; });
    const m=G.calendar.find(x=>!x.played); G.week=m.week; G.day=7;
    const q=[]; const rAF=window.requestAnimationFrame; window.requestAnimationFrame=cb=>{q.push(cb);return 1;};
    startFullMatch(true);
    for(let i=0;i<5&&q.length;i++){ const c=q.shift(); try{c(performance.now());}catch(e){} }
    window.requestAnimationFrame=rAF;
  })()`;

  console.log('\n═══ EL RELOJ ═══');
  const rel = await pg.evaluate((ARMAR) => {
    eval(ARMAR);
    const t0 = FM.ticks, m0 = FM.minute; let baja = 0, prev = FM.ticks;
    for (let i = 0; i < 2000 && FM && FM.phase !== 'done'; i++) { fmTick(1); if (FM.ticks < prev) baja++; prev = FM.ticks; }
    const r = { t0, t1: FM.ticks, m0, m1: FM.minute, minT: FM._minT, tpm: FM.tpm, baja };
    try { fmClean(); } catch (e) {}
    return r;
  }, ARMAR);
  chk('el reloj nunca vuelve para atrás', rel.baja === 0 && rel.t1 > rel.tpm * 3, rel.t0 + ' → ' + Math.round(rel.t1));
  chk('el minuto sigue corriendo aparte', rel.m1 >= rel.m0 + 3 && rel.minT >= 0 && rel.minT < rel.tpm, 'minuto ' + rel.m0 + ' → ' + rel.m1);

  console.log('\n═══ SÓLO VA EL DESTINO DEL ÚLTIMO PASE ═══');
  const voy = await pg.evaluate((ARMAR) => {
    eval(ARMAR);
    const f = FM, mid = f.VH / 2;
    f.ticks = 5000;                          // en el arranque el reloj está en 0
    const campo = f.my.map((p, i) => ({ p, i })).filter(o => !o.p.isGK);
    const A = campo[1], B = campo[2], C = campo[3];
    const bx = (f.leftGL + f.rightGL) / 2, by = mid;
    const pon = () => {
      f.phase = 'play'; f.possSide = 'my'; f.poss = null; f._gkHold = null;
      Object.assign(f.ball, { x: bx, y: by, vx: 0, vy: 0, air: 0 });
    };
    // los tres a la misma distancia de la pelota, y alguien más cerca que todos
    // (así nadie va por "ser el más cercano")
    A.p.x = bx - 420; A.p.y = by - 300; B.p.x = bx - 420; B.p.y = by + 300; C.p.x = bx + 500; C.p.y = by;
    const cerca = campo[4].p; cerca.x = bx + 60; cerca.y = by + 10;
    A.p._recvTick = f.ticks - 30;            // pase viejo (sigue adentro de los 90)
    B.p._recvTick = f.ticks - 5;             // el último pase
    C.p._recvTick = 0;
    const dA0 = Math.hypot(A.p.x - bx, A.p.y - by), dB0 = Math.hypot(B.p.x - bx, B.p.y - by);
    // ¿quién entra por la rama de "voy a buscarla"? se mira el destino de fmMove
    const oM = window.fmMove; const va = new Set();
    window.fmMove = function (pl, dx, dy) {
      if (Math.hypot(pl.x + dx - bx, pl.y + dy - by) < 40) va.add(pl);
      return oM.apply(this, arguments);
    };
    for (let k = 0; k < 6; k++) { pon(); fmAI(A.p, 'my', A.i, 1); fmAI(B.p, 'my', B.i, 1); }
    window.fmMove = oM;
    const r = { a: va.has(A.p), b: va.has(B.p) };
    try { fmClean(); } catch (e) {}
    return r;
  }, ARMAR);
  chk('el destino del último pase va a buscarla', voy.b);
  chk('el del pase anterior NO va (antes iban los dos)', !voy.a);

  console.log('\n═══ DOS PARTIDOS DEL INTER, TICK A TICK ═══');
  const m = await pg.evaluate((ARMAR) => {
    const A = { ticks: 0, monton: 0, max: 0, min: 0, shots: 0, goles: 0, pases: 0 };
    const R = 170;
    for (let k = 0; k < 2; k++) {
      eval(ARMAR);
      for (let t = 0; t < 40000 && FM && FM.phase !== 'done'; t++) {
        fmTick(1); if (!FM) break;
        if (FM.phase !== 'play') continue;
        A.ticks++;
        for (const arr of [FM.my, FM.opp]) {
          const c = arr.filter(x => !x.isGK); let best = 0;
          c.forEach(a => { const n = c.filter(o => Math.hypot(o.x - a.x, o.y - a.y) < R).length; if (n > best) best = n; });
          A.max = Math.max(A.max, best); if (best >= 8) A.monton++;
        }
      }
      A.min += FM ? FM.minute : 0;
      if (FM && FM.stat) { A.shots += FM.stat.my.shots + FM.stat.opp.shots; A.pases += FM.stat.my.pass + FM.stat.opp.pass; A.goles += FM.myG + FM.oppG; }
      try { fmClean(); } catch (e) {}
    }
    return A;
  }, ARMAR);
  const p90 = x => (x / Math.max(1, m.min) * 90).toFixed(1);
  chk('los dos partidos llegan al final', m.min >= 170, m.min + ' min');
  chk('nunca 8+ de un equipo amontonados (antes: 1,4% del partido, hasta 10)', m.monton <= 10, m.monton + ' ticks · máximo ' + m.max + ' juntos');
  chk('remates en rango sano', p90(m.shots) >= 12 && p90(m.shots) <= 45, p90(m.shots) + ' por 90');
  chk('el partido se juega', p90(m.pases) > 250 && p90(m.goles) <= 7, p90(m.pases) + ' pases · ' + p90(m.goles) + ' goles por 90');
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
