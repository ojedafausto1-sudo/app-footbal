// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 101: el vestuario se recupera, el DT se acuerda de lo
// que pidió y nadie paga el doble por un jugador de 33 años
// ═══════════════════════════════════════════════════════════════════════
// El presidente, con el Man Utd 2014 a mitad de temporada: 33 de 33
// "entrenando de mala gana", dos que se plantan, van Gaal recomendando a
// Gibbs y quejándose al ficharlo ("no lo pedí"), y Barcelona ofreciendo €52M
// por Carrick con 33 años.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase101.js
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
  const ARRANCA = (club) => `(()=>{localStorage.clear();localStorage.setItem('dt_fondo3d','0');
    document.getElementById('teamSelect').style.display='none';
    startGame('${club}'); try{autoFill();preseasonSaltear();closeMod();}catch(e){} })()`;

  console.log('\n═══ EL ÁNIMO DE FONDO ═══');
  const f = await pg.evaluate((A) => {
    eval(A); const o = {};
    const p = G.squad[5]; p.wantsOut = false; p.colgado = false;
    const f0 = window.formaEquipo;
    window.formaEquipo = () => null; p.dtRel = 60; o.neutro = moralFondo(p);
    window.formaEquipo = () => 2.5; p.dtRel = 85; o.arriba = moralFondo(p);
    window.formaEquipo = () => 0.3; p.dtRel = 30; o.abajo = moralFondo(p);
    window.formaEquipo = () => 3.0; p.dtRel = 85; p.wantsOut = true; o.quiereIrse = moralFondo(p); p.wantsOut = false;
    window.formaEquipo = f0;
    // la forma sale de los últimos 6 oficiales
    const cal = G.calendar.filter(m => !m.friendly).slice(0, 6);
    const bak = cal.map(m => ({ played: m.played, result: m.result }));
    cal.forEach((m, i) => { m.played = true; m.result = i < 4 ? 'W' : 'D'; });
    o.forma = formaEquipo();
    cal.forEach((m, i) => Object.assign(m, bak[i]));
    return o;
  }, ARRANCA('boca'));
  chk('sin partidos y con relación neutra, el fondo es 66', f.neutro === 66, String(f.neutro));
  chk('ganando y bien con el DT, el fondo sube (≈80)', f.arriba >= 78, f.arriba.toFixed(1));
  chk('perdiendo y peleado con el DT, el fondo baja (≈51)', f.abajo <= 52, f.abajo.toFixed(1));
  chk('el que pidió irse no vuelve arriba hasta que se resuelva', f.quiereIrse <= 30, String(f.quiereIrse));
  chk('la forma son los puntos por partido de los últimos oficiales', Math.abs(f.forma - 14 / 6) < 1e-9, String(f.forma));

  console.log('\n═══ MEDIA TEMPORADA DE GOLPES (el caso del presidente) ═══');
  // La misma secuencia de golpes "a todo el plantel" para la cuenta vieja y la
  // nueva. La vieja está copiada acá tal cual era (+0,4 con buena relación,
  // −0,9 con mala, y la salida del pozo abajo de 35).
  const g = await pg.evaluate((A) => {
    eval(A); const o = {};
    const golpes = { 4: -6, 6: -15, 8: -6, 9: -5, 10: -5, 11: -16, 12: -6, 14: -15, 16: -6 };
    const corre = (ppg) => {
      const f0 = window.formaEquipo; window.formaEquipo = () => ppg;
      const m0 = Math.random; Math.random = () => 0.99;      // nadie pide salir por sorteo
      G.squad.forEach((p, i) => { p.morale = 77; p.dtRel = 40 + (i % 33) * 1.4; p.wantsOut = false; p.colgado = false; p.injured = 0; });
      const viejo = G.squad.map(p => ({ m: 77, rel: p.dtRel }));
      for (let w = 1; w <= 18; w++) {
        if (golpes[w]) { G.squad.forEach(p => { p.morale = Math.max(3, p.morale + golpes[w]); }); viejo.forEach(v => { v.m = Math.max(3, v.m + golpes[w]); }); }
        // la relación con el DT no se toca acá: medimos la moral
        const rels = G.squad.map(p => p.dtRel);
        weeklyPlayerDt();
        G.squad.forEach((p, i) => { p.dtRel = rels[i]; });
        viejo.forEach(v => { let dm = (v.rel >= 62 ? 0.4 : v.rel <= 30 ? -0.9 : 0); if (v.m < 35) dm += (35 - v.m) * 0.10; v.m = Math.max(3, Math.min(99, v.m + dm)); });
      }
      Math.random = m0; window.formaEquipo = f0;
      const n = G.squad.length, mo = G.squad.map(p => p.morale);
      return { n, nuevo: mo.filter(x => x < 35).length, viejo: viejo.filter(v => v.m < 35).length,
        mNuevo: +(mo.reduce((a, x) => a + x, 0) / n).toFixed(1), mViejo: +(viejo.reduce((a, v) => a + v.m, 0) / n).toFixed(1) };
    };
    o.mal = corre(0.8); o.medio = corre(1.4); o.bien = corre(2.2);
    // y si los golpes paran, el plantel se levanta solo
    const f0 = window.formaEquipo; window.formaEquipo = () => 1.8;
    const m0 = Math.random; Math.random = () => 0.99;
    G.squad.forEach(p => { p.morale = 20; p.dtRel = 60; });
    for (let w = 0; w < 10; w++) weeklyPlayerDt();
    o.recupera = +(G.squad.reduce((a, p) => a + p.morale, 0) / G.squad.length).toFixed(1);
    // y el que está arriba no se queda clavado en 99
    G.squad.forEach(p => { p.morale = 99; p.dtRel = 60; });
    for (let w = 0; w < 20; w++) weeklyPlayerDt();
    o.baja = +(G.squad.reduce((a, p) => a + p.morale, 0) / G.squad.length).toFixed(1);
    Math.random = m0; window.formaEquipo = f0;
    return o;
  }, ARRANCA('boca'));
  chk('antes: los golpes se acumulaban y daba igual ganar o perder (todos bajo 35)',
    g.mal.viejo === g.mal.n && g.bien.viejo === g.bien.n && g.mal.mViejo === g.bien.mViejo, `${g.mal.viejo}/${g.mal.n} y ${g.bien.viejo}/${g.bien.n}, media ${g.mal.mViejo}`);
  chk('ahora, ganando, casi nadie queda bajo 35', g.bien.nuevo <= 3, g.bien.nuevo + ' de ' + g.bien.n + ', media ' + g.bien.mNuevo);
  chk('a mitad de tabla, la mitad o menos', g.medio.nuevo <= g.medio.n / 2 + 1, g.medio.nuevo + ' de ' + g.medio.n + ', media ' + g.medio.mNuevo);
  chk('ganar levanta al vestuario: la media sube con la forma', g.bien.mNuevo > g.medio.mNuevo && g.medio.mNuevo > g.mal.mNuevo, [g.mal.mNuevo, g.medio.mNuevo, g.bien.mNuevo].join(' < '));
  chk('un plantel hundido (20) se levanta solo en 10 semanas tranquilas', g.recupera >= 50, String(g.recupera));
  chk('el que está en 99 baja hacia su fondo (no se queda clavado)', g.baja < 80 && g.baja > 66, String(g.baja));

  console.log('\n═══ EL AVISO DEL VESTUARIO DICE POR QUÉ ═══');
  const v = await pg.evaluate((A) => {
    eval(A); const o = {};
    G.budget = Math.max(G.budget, 10);
    G.squad.forEach(p => { p.morale = 80; p.injured = 0; p.wantsOut = false; });
    const caidos = G.squad.filter(p => p.pos !== 'ARQ').slice(0, 4);
    caidos.forEach((p, i) => { p.morale = 10 + i * 5; });
    o.caidos = caidos.slice(0, 3).map(p => p.name);
    o.arqueros = G.squad.filter(p => p.pos === 'ARQ').map(p => p.name);
    moralGolpe('la goleada 0-4 con River', -5);
    moralGolpe('lo que usted declaró en la conferencia', -10);
    o.golpes = golpesRecientes(8).length;
    let msg = null;
    for (let i = 0; i < 400 && !msg; i++) { G._vidaUlt = null; vidaDeClub(); const m = (G.phoneMsgs || []).find(x => /mala gana/.test(x.body || '')); if (m) msg = m.body; }
    o.msg = msg || '';
    const fn = (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return 0; let r = 0; for (const k in x) { if (typeof x[k] === 'function') r++; else if (x[k] && typeof x[k] === 'object') r += scan(x[k], d + 1); } return r; })(G, 0);
    o.fn = fn;
    return o;
  }, ARRANCA('boca'));
  chk('salió el aviso', v.msg.length > 0);
  chk('nombra a los más caídos, no a los arqueros por el orden', v.caidos.every(n => v.msg.includes(n)) && !v.arqueros.some(n => v.msg.includes(n)), v.caidos.join(', '));
  chk('dice lo que más pesó', /Lo que más pesó/.test(v.msg) && /goleada 0-4/.test(v.msg) && /conferencia/.test(v.msg));
  chk('los golpes quedan anotados en G como datos planos (0 funciones)', v.golpes === 2 && v.fn === 0);

  console.log('\n═══ EL DT SE ACUERDA DE LO QUE PIDIÓ ═══');
  const d = await pg.evaluate((A) => {
    eval(A); const o = {};
    G.budget = 400;
    const msgs = () => (G.phoneMsgs || []).filter(m => m.from === G.dt.name).map(m => m.body);
    // 1) el que nombró en el chat
    const r = pedidoDelDT();
    o.hayPedido = !!(r && r.c && r.c.length);
    if (!o.hayPedido) return o;
    dtReplyCtx('refuerzo');
    o.anotado = (G._dtRecom || []).length;
    const p = r.c[0].p;
    G.market = G.market.filter(x => x.id !== p.id);
    G.squad.push(p); const n0 = msgs().length;
    dtReaccionFichaje(p, { motivo: 'fichaje' });
    o.recom = msgs().slice(0, msgs().length - n0)[0] || '';
    G.squad.splice(G.squad.indexOf(p), 1);
    // 2) un jugador de otro puesto que no nombró y no mejora nada: se queja igual que antes
    const tapa = (x) => { G.squad.push(x); const t = dtTapaNecesidad(x); G.squad.splice(G.squad.indexOf(x), 1); return t; };
    const otro = G.market.filter(x => x.rat >= 62 && x.pos !== r.n.pos && x.pos2 !== r.n.pos && !dtLoRecomendo(x)
        && _presMejora(x) < -3 && !(G.dt.wantedPos || []).includes(x.pos)).slice(0, 60).find(x => !tapa(x));
    G.squad.push(otro); const n1 = msgs().length;
    dtReaccionFichaje(otro, { motivo: 'fichaje' });
    o.otro = msgs().slice(0, msgs().length - n1)[0] || '';
    G.squad.splice(G.squad.indexOf(otro), 1);
    return o;
  }, ARRANCA('boca'));
  chk('hay un pedido del DT para probar', d.hayPedido);
  chk('la charla anota a quiénes recomendó', d.anotado >= 1, String(d.anotado));
  chk('fichar al que recomendó: lo agradece (antes: "no lo pedí")', /era uno de los que le pedí/.test(d.recom) && !/no lo pedí/.test(d.recom), d.recom.replace(/<[^>]+>/g, '').slice(0, 90));
  chk('a uno que no pidió ni le sirve, se lo sigue tomando como imposición', /no lo pedí/.test(d.otro), d.otro.replace(/<[^>]+>/g, '').slice(0, 70));

  console.log('\n═══ NADIE PAGA EL DOBLE POR UN JUGADOR DE 33 ═══');
  const c = await pg.evaluate((A) => {
    eval(A); const o = {};
    const vet = Object.assign(JSON.parse(JSON.stringify(G.squad[0])), { id: 'vet101', name: 'Veterano 101', age: 33, rat: 91, val: 27.2, listed: null });
    const jov = Object.assign(JSON.parse(JSON.stringify(G.squad[0])), { id: 'jov101', name: 'Joven 101', age: 26, rat: 91, val: 27.2, listed: null });
    const m0 = Math.random; let k = 0; Math.random = () => ((k++ * 0.6180339887) % 1);
    const prom = (p) => { let s = 0; for (let i = 0; i < 300; i++) { const of = buildBuyOffer(p, false); s += of.amount / (of.swapIn ? 0.55 : of.sellOn ? 0.88 : of.plan ? (of.plan === 2 ? 1.06 : 1.12) : 1); } return s / 300 / p.val; };
    o.vet = prom(vet); o.jov = prom(jov);
    Math.random = m0;
    o.factor = [26, 29, 30, 31, 32, 33, 35].map(a => ofertaEdadFactor({ age: a }));
    // ¿a quién van a buscar? al que vale más, no al veterano de más media
    const lista = [Object.assign({}, vet, { val: 27 }), Object.assign({}, jov, { id: 'dm', name: 'Di María', age: 27, rat: 91, val: 75 })];
    o.figura = figurasCodiciadas(lista)[0].name;
    // las ofertas no solicitadas ya no salen también todos los días
    G.offers = []; G.week = 2;
    const n0 = G.offers.length; Math.random = () => 0.01;
    for (let i = 0; i < 20; i++) weeklyOffers(true);
    o.diario = G.offers.filter(x => !x.listed).length - n0;
    G.offers = []; weeklyOffers(); o.semanal = G.offers.filter(x => !x.listed).length;
    Math.random = m0;
    return o;
  }, ARRANCA('boca'));
  chk('al veterano de 33 le ofrecen ~1,1× su valor (antes ~1,9×)', c.vet < 1.35 && c.vet > 0.9, c.vet.toFixed(2) + '×');
  chk('al de 26 con la misma media y valor, la prima de siempre', c.jov > 1.7, c.jov.toFixed(2) + '×');
  chk('la prima baja con la edad, sin saltos para arriba', c.factor.every((x, i) => i === 0 || x <= c.factor[i - 1]), c.factor.join(' · '));
  chk('el club grande va por el que más vale (Di María), no por el veterano de más media', c.figura === 'Di María', c.figura);
  chk('la llamada diaria no genera ofertas no solicitadas', c.diario === 0, String(c.diario));
  chk('la semanal sí', c.semanal >= 1, String(c.semanal));

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
