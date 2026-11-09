// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 97: lo que pide es lo que firma
// ═══════════════════════════════════════════════════════════════════════
// Antes, ofreciendo EXACTAMENTE la pretensión que mostraba la pantalla, el
// jugador aceptaba el 36% de las veces con un club fundado (60% con Boca) y el
// rechazo decía "pretendo cerca de 42k" a una oferta de 42k.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase97.js
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
  await pg.evaluate(() => { localStorage.setItem('dt_fondo3d', '0'); });

  // ── club fundado (el caso del presidente) ──
  await pg.evaluate(() => { tsIr(1); tsIr(2, 'Argentina'); tsIr(3, 'Liga ARG'); fundarModal();
    document.getElementById('fundNom').value = 'Palogol'; document.getElementById('fundAbbr').value = 'PAL'; fundarCrear(); });
  await pg.waitForTimeout(800);

  // juega una tanda de negociaciones de términos personales hasta la respuesta
  const tanda = (oferta) => pg.evaluate((oferta) => {
    try { closeMod(); } catch (e) { }
    const cand = G.market.filter(p => !esLibre(p) && p.rat >= 60 && p.rat <= 80 && p.club !== G.teamName).slice(0, 120);
    const res = { n: 0, si: 0, msgsMal: 0, ejemplo: '', pisoOk: true, rep: G.rep, f: negRepPide() };
    for (const p of cand) {
      const pret = negPretension(p), piso = negPiso(p, 3);
      if (!(piso <= pret && piso >= Math.floor(pret * 0.82))) res.pisoOk = false;
      const wage = oferta === 'pide' ? pret : oferta === 'piso' ? piso : piso - 1;
      G.negs = [{ pid: p.id, name: p.name, club: p.club, stage: 'esperando_jugador', wait: 0, wage, years: 3, free: false, pre: false, bid: 0, rounds: 0, rivals: [], deadline: 0, playerOk: false }];
      const m0 = (G.phoneMsgs[0] || {}).id;
      weeklyNegotiations(); res.n++;
      const n = G.negs.find(x => x.pid === p.id);
      if (n && n.playerOk) res.si++;
      const m = G.phoneMsgs[0];
      if (m && m.id !== m0 && /no me sirve/.test(m.body || m.txt || '')) {
        const t = m.body || m.txt || ''; res.ejemplo = t.replace(/<[^>]+>/g, '');
        const pide = +((t.match(/Con <b>(\d+)k<\/b> firmo/) || [])[1] || 0);
        if (!(pide > wage)) res.msgsMal++;
      }
    }
    G.negs = [];
    return res;
  }, oferta);

  const A = await tanda('pide');
  chk('club fundado: reputación baja', A.rep < 45, 'rep ' + A.rep);
  chk('un club chico paga más: la pretensión trae el recargo por reputación', A.f > 1.05 && A.f <= 1.15, '×' + A.f);
  chk('ofreciendo lo que pide, firman TODOS', A.n >= 100 && A.si === A.n, A.si + ' de ' + A.n);
  chk('el piso oculto está entre el 82% y el 100% de lo que pide', A.pisoOk);
  const P = await tanda('piso');
  chk('llegando justo al piso, firman', P.si === P.n, P.si + ' de ' + P.n);
  const D = await tanda('debajo');
  chk('un peso abajo del piso, nadie firma', D.si === 0, D.si + ' de ' + D.n);
  chk('el rechazo dice un número MAYOR que lo ofrecido', D.msgsMal === 0 && /Con \d+k firmo/.test(D.ejemplo), D.ejemplo.slice(0, 110));

  // ── la pantalla de términos dice el recargo y arranca en lo que pide ──
  const M = await pg.evaluate(() => {
    const p = G.market.find(p => !esLibre(p) && p.rat >= 65 && p.club !== G.teamName);
    negStartPlayer(p.id);
    const html = document.getElementById('modOv') ? document.getElementById('modOv').innerText : document.body.innerText;
    const r = { rec: /por la reputación/.test(html), firma: /Con lo que pide, firma/.test(html), val: nRead('negWg'), pret: negPretension(p) };
    closeMod(); return r;
  });
  chk('la pantalla explica el recargo por reputación', M.rec);
  chk('el sueldo arranca en la pretensión', M.val === M.pret, M.val + ' / ' + M.pret);

  // ── con Boca no hay recargo y también firma con lo que pide ──
  const B = await pg.evaluate(() => {
    startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const cand = G.market.filter(p => !esLibre(p) && p.rat >= 60 && p.club !== G.teamName).slice(0, 60);
    let si = 0;
    for (const p of cand) {
      G.negs = [{ pid: p.id, name: p.name, club: p.club, stage: 'esperando_jugador', wait: 0, wage: negPretension(p), years: 3, free: false, pre: false, bid: 0, rounds: 0, rivals: [], deadline: 0, playerOk: false }];
      weeklyNegotiations(); const n = G.negs.find(x => x.pid === p.id); if (n && n.playerOk) si++;
    }
    G.negs = [];
    return { f: negRepPide(), si, n: cand.length, det: negPiso(cand[0], 3) === negPiso(cand[0], 3) };
  });
  chk('con Boca la pretensión no lleva recargo', B.f === 1, '×' + B.f);
  chk('con Boca también firman todos con lo que piden', B.si === B.n, B.si + ' de ' + B.n);
  chk('el piso es estable (no se puede tantear reabriendo)', B.det);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
