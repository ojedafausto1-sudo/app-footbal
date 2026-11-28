// ═══════════════════════════════════════════════════════════════════════
// ARNÉS DETERMINISTA DEL 11v11 (Fase 100)
// ═══════════════════════════════════════════════════════════════════════
// El de la Fase 67 (det.js) vivía en el scratchpad y se perdió con el
// contenedor. Este vive en el repo. Lo que lo hace determinista son las
// cuatro lecciones de la Fase 67:
//   1. `FM`, `G`, `FM67`… son globales LÉXICAS: se leen por nombre pelado y se
//      escriben con eval indirecto ((0,eval)('FM67.lon=0.5')).
//   2. Nunca `FM.watch=false`: el jugador f.ctrl queda sin IA. Se juega con
//      startFullMatch(true).
//   3. requestAnimationFrame síncrono mientras se arma el partido: toda la
//      corrida es un solo bloque y no se cuela ningún temporizador.
//   4. La semilla se ancla en cada partido (antes de startFullMatch y en la
//      entrada de fmInit), así el brazo A y el B juegan el MISMO partido.
//
// Uso:
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tools/arnes11.js [n=12] [semilla=1] [opciones]
//     --file=otro.html     correr otra versión del juego (para A/B de código)
//     --club=boca          club (id de TEAMS)
//     --set="FM67.lon=0.5;FM77.remArea=0.3"   perillas, con eval indirecto
//     --json=salida.json   guarda los partidos
//     --vs=base.json       compara partido a partido contra otra corrida
//     --det                corre dos veces y verifica que dé lo mismo
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const N = +pos[0] || 12, SEED = +pos[1] || 1;
const FILE = path.resolve(opt.file || path.join(__dirname, '..', 'director-tecnico.html'));
const CLUB = opt.club || 'boca';

async function correr(b) {
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); } catch (e) { } });
  await pg.goto('file://' + FILE, { waitUntil: 'load' });
  await pg.waitForTimeout(300);
  const res = await pg.evaluate(({ N, SEED, CLUB, SET }) => {
    const rng = s => { let a = s >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    Math.random = rng(SEED * 7919 + 13);
    document.getElementById('teamSelect').style.display = 'none';
    startGame(CLUB); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    if (SET) (0, eval)(SET);
    // ── ganchos (no consumen azar) ──
    let cur = null;
    const wrap = (n, fn) => { const o = window[n]; if (!o) return; window[n] = function () { try { fn.apply(this, arguments); } catch (e) { } return o.apply(this, arguments); }; };
    wrap('fmSetRestart', (type, team, x, y, msg) => { if (!cur) return; cur.rest[type] = (cur.rest[type] || 0) + 1; if (/FUERA DE JUEGO/.test(msg || '')) cur.offs++; });
    wrap('fmFoul', () => { if (cur) cur.foulCalls++; });
    wrap('fmMsg', t => { if (!cur) return; t = String(t || ''); if (/SIGA/.test(t)) cur.siga++; if (/VENTAJA/.test(t) && !/VUELVE/.test(t)) cur.ventaja++; });
    const oDR = window.fmDoRestart;
    window.fmDoRestart = function () { const f = FM, r = f && f.restart; if (cur && r && r.type === 'goalkick') cur.sacas.push({ t: f.ticks, team: r.team, largo: !!r._largo }); return oDR.apply(this, arguments); };
    const oST = window.fmStat;
    window.fmStat = function (team, key) {
      try {
        const f = FM;
        if (cur && f && key === 'shots') {
          const atR = (team === 'my') === f.myAttRight, gx = atR ? f.rightGL : f.leftGL;
          const fw = f.rightGL - f.leftGL, dm = Math.abs(gx - f.ball.x) / fw * 105, lat = Math.abs(f.ball.y - f.VH / 2) / f.VH * 68;
          if (dm < 16.5 && lat < 20.2) cur.remArea++; else if (dm < 22) cur.remBorde++; else cur.remLejos++;
        }
      } catch (e) { }
      return oST.apply(this, arguments);
    };
    const oInit = window.fmInit;
    let semillaPartido = 0;
    window.fmInit = function () { Math.random = rng(semillaPartido); return oInit.apply(this, arguments); };
    const raf0 = window.requestAnimationFrame;
    const out = [];
    for (let m = 0; m < N; m++) {
      try { let d; while ((d = dilemaBloqueante())) dilemaResolver(d.id, 0); if (typeof prensaPend === 'function' && prensaPend()) prensaResolver(0); } catch (e) { }
      G.calendar.forEach(x => { if (x.friendly || /Amistoso/.test(x.comp || '')) x.played = true; });
      const nx = G.calendar.find(x => !x.played); if (!nx) break;
      G.week = nx.week; G.day = 7;
      semillaPartido = (SEED * 100003 + m * 7717) >>> 0;
      Math.random = rng(semillaPartido + 1);
      cur = { rest: {}, offs: 0, foulCalls: 0, siga: 0, ventaja: 0, sacas: [], remArea: 0, remBorde: 0, remLejos: 0 };
      window.requestAnimationFrame = cb => { if (!window._arm) { window._arm = 1; cb(performance.now()); window._arm = 0; } return 0; };
      try { startFullMatch(true); } catch (e) { out.push({ err: String(e) }); continue; }
      window.requestAnimationFrame = raf0;
      const f = FM; if (!f) { out.push({ err: 'sin FM' }); continue; }
      let t = 0, par = 0, mues = 0, tercio = 0, mont8 = 0, clus = 0, h = 0;
      const pend = [];
      while (FM === f && f.phase !== 'done' && t < 45000) {
        fmTick(1); t++;
        if (f.phase !== 'play') par++;
        // saques de arco y del arquero: ¿quién tiene la pelota 150 ticks después?
        for (const s of cur.sacas) if (!s.done && f.ticks - s.t >= 150) {
          s.done = 1; const ps = f.possSide; s.ret = ps === s.team; s.perd = ps && ps !== s.team;
          const atR = (s.team === 'my') === f.myAttRight, own = atR ? f.leftGL : f.rightGL, fw = f.rightGL - f.leftGL;
          s.peligro = s.perd && Math.abs(f.ball.x - own) < fw * 0.33;
        }
        for (const g of (f._x100gk || [])) if (!g.done && f.ticks - g.t >= 150) { g.done = 1; const ps = f.possSide; g.ret = ps === g.team; g.perd = ps && ps !== g.team; }
        if (t % 25 === 0 && f.phase === 'play') {
          mues++; const bx = f.ball.x, W = f.VW; let c = 0;
          const campo = [...f.my, ...f.opp].filter(p => !p.isGK);
          campo.forEach(p => { if (Math.abs(p.x - bx) < W / 6) c++; });
          tercio += c;
          for (const eq of [f.my, f.opp]) {
            const cp = eq.filter(p => !p.isGK);
            let mx = 0; for (const a of cp) { let k = 0; for (const q of cp) if (Math.hypot(a.x - q.x, a.y - q.y) < 170) k++; if (k > mx) mx = k; }
            if (mx >= 8) { mont8++; break; }
          }
          let mx2 = 0; for (const a of campo) { let k = 0; for (const q of campo) if (Math.hypot(a.x - q.x, a.y - q.y) < 120) k++; if (k > mx2) mx2 = k; }
          clus += mx2;
        }
        if (t % 500 === 0) h = (Math.imul(h, 31) + Math.round(f.ball.x * 10) * 7 + Math.round(f.ball.y * 10)) | 0;
      }
      const s = f.stat, L = f.learn || {}, gk = (f._x100gk || []).filter(g => g.done), sc = cur.sacas.filter(x => x.done), X = f._x100 || {};
      out.push({
        rival: f.oppName, min: f.minute, g: f.myG + f.oppG, sh: s.my.shots + s.opp.shots, sot: s.my.sot + s.opp.sot,
        pass: s.my.pass + s.opp.pass, corner: s.my.corner + s.opp.corner, foul: s.my.foul + s.opp.foul, off: cur.offs,
        yel: (s.my.yel || 0) + (s.opp.yel || 0), red: (s.my.red || 0) + (s.opp.red || 0),
        fk: cur.rest.freekick || 0, thr: cur.rest.throw || 0, gkk: cur.rest.goalkick || 0, pen: cur.rest.penalty || 0,
        siga: cur.siga, ventaja: cur.ventaja, foulCalls: cur.foulCalls,
        remArea: cur.remArea, remBorde: cur.remBorde, remLejos: cur.remLejos,
        gamb: L.dribbles || 0, x: X,
        sacaN: sc.length, sacaRet: sc.filter(x => x.ret).length, sacaPeligro: sc.filter(x => x.peligro).length,
        gkN: gk.length, gkRet: gk.filter(x => x.ret).length,
        parado: Math.round(par / t * 100), tercio: +(tercio / Math.max(1, mues)).toFixed(2), mont8: +(mont8 / Math.max(1, mues) * 100).toFixed(1), clus: +(clus / Math.max(1, mues)).toFixed(2),
        hash: h
      });
      try { fmClean(); } catch (e) { }
      FM = null; nx.played = true; nx.score = '0-0';
    }
    window.requestAnimationFrame = raf0;
    return out;
  }, { N, SEED, CLUB, SET: opt.set || '' });
  await pg.close();
  return { res, errs };
}

const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function resumen(o) {
  const ok = o.filter(x => !x.err), n = ok.length || 1, S = k => ok.reduce((a, x) => a + (x[k] || 0), 0);
  const p = k => +(S(k) / n).toFixed(2);
  return {
    partidos: ok.length, goles: p('g'), remates: p('sh'), alArco: p('sot'), pases: p('pass'), corners: p('corner'),
    faltas: p('foul'), tirosLibres: p('fk'), offsides: p('off'), laterales: p('thr'), saquesArco: p('gkk'), penales: p('pen'),
    amarillas: p('yel'), rojas: p('red'), siga: p('siga'), ventaja: p('ventaja'),
    remArea: p('remArea'), remBorde: p('remBorde'), remLejos: p('remLejos'), gambetas: p('gamb'),
    sacaRet: S('sacaN') ? +(S('sacaRet') / S('sacaN') * 100).toFixed(0) : null,
    sacaPeligro: S('sacaN') ? +(S('sacaPeligro') / S('sacaN') * 100).toFixed(0) : null,
    gkRet: S('gkN') ? +(S('gkRet') / S('gkN') * 100).toFixed(0) : null, gkN: p('gkN'),
    parado: p('parado'), tercio: p('tercio'), mont8: p('mont8'), clus: p('clus'),
    medGoles: med(ok.map(x => x.g)), medPases: med(ok.map(x => x.pass))
  };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const A = await correr(b);
  if (A.errs.length) console.log('ERRORES DE PÁGINA:', A.errs.slice(0, 5).join(' | '));
  A.res.forEach((x, i) => console.log(i + 1, x.err ? x.err : JSON.stringify({ rival: x.rival, g: x.g, sh: x.sh, pass: x.pass, foul: x.foul, off: x.off, fk: x.fk, gamb: x.gamb, lejos: x.remLejos, saca: x.sacaRet + '/' + x.sacaN, terc: x.tercio, m8: x.mont8, hash: x.hash })));
  const R = resumen(A.res);
  console.log('\nAGREGADO POR PARTIDO:', JSON.stringify(R, null, 1));
  const XX = {}; A.res.forEach(x => Object.entries(x.x || {}).forEach(([k, v]) => XX[k] = (XX[k] || 0) + v));
  if (Object.keys(XX).length) console.log('contadores del motor (por partido):', JSON.stringify(Object.fromEntries(Object.entries(XX).map(([k, v]) => [k, +(v / A.res.length).toFixed(2)]))));
  if (opt.det) {
    const B = await correr(b);
    const igual = A.res.length === B.res.length && A.res.every((x, i) => x.hash === B.res[i].hash && x.pass === B.res[i].pass && x.g === B.res[i].g);
    console.log('\n¿ES DETERMINISTA?', igual ? 'SÍ — hash idéntico en los ' + A.res.length + ' partidos' : 'NO', igual ? '' : JSON.stringify(A.res.map((x, i) => [x.hash, B.res[i] && B.res[i].hash])));
  }
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ seed: SEED, n: N, file: FILE, set: opt.set || '', res: A.res, resumen: R }, null, 1));
  if (opt.vs) {
    const V = JSON.parse(fs.readFileSync(opt.vs, 'utf8'));
    const k = ['g', 'sh', 'pass', 'foul', 'fk', 'off', 'gamb', 'remLejos', 'tercio', 'mont8', 'parado'];
    console.log('\nPAREADO contra ' + opt.vs + ' (↑ sube / ↓ baja, partido a partido):');
    for (const key of k) {
      let up = 0, dn = 0, sa = 0, sb = 0, nn = 0;
      A.res.forEach((x, i) => { const y = V.res[i]; if (!y || x.err || y.err) return; nn++; sa += x[key]; sb += y[key]; if (x[key] > y[key]) up++; else if (x[key] < y[key]) dn++; });
      console.log('  ' + key.padEnd(9), (sb / nn).toFixed(2).padStart(7), '→', (sa / nn).toFixed(2).padStart(7), `(${up}↑ ${dn}↓)`);
    }
  }
  await b.close();
})();
