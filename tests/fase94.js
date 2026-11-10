// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 94: charlas que salen del club
// ═══════════════════════════════════════════════════════════════════════
// En modo DT el celular habla con el PRESIDENTE (no con vos mismo), los
// jugadores te dicen "profe", el DT de la IA pide lo que el plantel necesita
// con motivo y nombres, hay botones según lo que pasa y se puede escribir.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase94.js
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');
let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await b.newContext()).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(400);

  // ── el texto libre se entiende ──
  const it = await pg.evaluate(() => ({
    a: chatIntencion('necesito un 9 urgente'), b: chatIntencion('¿hay plata para comprar?'), c: chatIntencion('¿Cómo va la rodilla?'),
    d: chatIntencion('quiero renovar el contrato'), e: chatIntencion('¿qué pasó el domingo?'), f: chatIntencion('se viene el clásico'),
    g: chatIntencion('asdfgh'),
  }));
  chk('el texto libre se entiende (refuerzo, plata, lesión, contrato, partido, clásico)', it.a === 'refuerzo' && it.b === 'plata' && it.c === 'lesion' && it.d === 'contrato' && it.e === 'ultimo' && it.f === 'clasico', JSON.stringify(it));
  chk('lo que no entiende va a "otro" y no rompe', it.g === 'otro');

  // ── MODO PRESIDENTE: el DT pide lo que hace falta ──
  const P = await pg.evaluate(() => {
    localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_modo', 'pres');
    document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    G.budget = 60;
    const o = {};
    // dejo al DFI sin recambio: saco a todos menos el titular
    const sl = getForm(); const lat = sl.find(s => s.pos === 'DFI') || sl.find(s => s.pos === 'DFD');
    const pos = lat.pos;
    const cand = G.squad.filter(p => p.pos === pos || p.pos2 === pos).sort((a, b) => b.rat - a.rat);
    cand.slice(1).forEach(p => { if (p.pos === pos) p.pos = 'MC'; if (p.pos2 === pos) p.pos2 = null; });
    o.pos = pos;
    const N = necesidadPlantel(); o.nec = N.map(n => n.pos + ':' + n.tipo);
    const n = N.find(x => x.pos === pos); o.hayNec = !!n;
    const c = candidatosPara(n, 3); o.cands = c.map(x => x.p.pos + '/' + (x.p.pos2 || '') + ' ' + x.p.rat + ' ' + askingPrice(x.p));
    o.candOk = c.length > 0 && c.every(x => (x.p.pos === pos || x.p.pos2 === pos) && askingPrice(x.p) <= G.budget * 0.6 && x.p.rat >= n.ref - 6 && !G.squad.some(q => q.id === x.p.id));
    o.porque = c.length && /[A-Z]{3} \d+/.test(c[0].porque);
    const r = dtReplyCtx('refuerzo'); o.reply = r; o.replyNombra = c.length ? r.includes(c[0].p.name) : false;
    // el pedido formal también va al puesto que hace falta
    G.dtRequests = []; genDtRequest(); o.req = G.dtRequests[0] ? G.dtRequests[0].pos + ' · ' + G.dtRequests[0].reason : null;
    // ¿por qué no juega?
    const banco = _mejorEnBanco(); o.porqueBanco = banco ? dtReplyCtx('porque', banco.id) : '';
    // botones según el momento: lesionado y contrato
    const j = G.squad.find(p => p.pos !== 'ARQ'); j.injured = 3; j.injWeeks = 3; j.contract = G.season;
    o.botones = chatBotonesJugador(j); o.lesion = playerReplyCtx(j, 'lesion');
    // el celular: pestaña de chat con el DT y la caja de texto
    openPhone(); o.tab = document.querySelector('.ph-tab[onclick*="\'dt\'"]').textContent;
    phTab('dt'); o.input = !!document.getElementById('phIn'); o.dtNombre = document.getElementById('phScreen').textContent.includes(G.dt.name);
    // escribir algo raro no mete HTML
    document.getElementById('phIn').value = '<img src=x onerror="window._xss=1">hola'; chatLibre();
    o.escapado = !document.querySelector('#phScreen img') && !window._xss;
    closePhone();
    return o;
  });
  chk('el DT detecta el puesto sin recambio', P.hayNec, P.pos + ' · ' + P.nec.join(' '));
  chk('pide nombres de ese puesto, que alcanzan y que mejoran (no del plantel)', P.candOk, P.cands.join(' | '));
  chk('dice por qué le gustan (los atributos de su idea)', P.porque);
  chk('la respuesta trae el motivo y los nombres', P.replyNombra && /recambio/.test(P.reply), P.reply.slice(0, 120));
  chk('el pedido formal del DT va al puesto que hace falta', P.req && P.req.startsWith(P.pos), P.req);
  chk('"¿por qué no juega?" tiene una respuesta concreta', P.porqueBanco.length > 25, P.porqueBanco.slice(0, 90));
  chk('al lesionado se le pregunta por la recuperación y contesta las semanas', /recuperaci/.test(P.botones) && /3 semanas/.test(P.lesion), P.lesion);
  chk('al que se le vence el contrato, botón para hablarlo', /contrato/.test(P.botones));
  chk('en modo presidente la pestaña es "Chat DT", con el DT y caja para escribir', /Chat DT/.test(P.tab) && P.dtNombre && P.input);
  chk('lo que escribís no mete HTML en la pantalla', P.escapado);
  await espera(1700);
  const resp = await pg.evaluate(() => { const t = G.chats.dt; return t[t.length - 1] && t[t.length - 1].from === 'them'; });
  chk('y el DT contesta lo escrito', resp);

  // ── MODO DT: el celular es del presidente ──
  const D = await pg.evaluate(() => {
    localStorage.setItem('dt_modo', 'dt'); try { setModo('dt'); } catch (e) { }
    startGame('river'); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
    const o = { modo: G.modo };
    o.vos = G.dt.name;
    G.phoneMsgs = [];
    for (let i = 0; i < 40; i++) weeklyDtVoice();
    o.deVos = G.phoneMsgs.filter(m => m.from === G.dt.name).length;
    o.dePres = G.phoneMsgs.filter(m => m.from === presIA().name).length;
    openPhone(); o.tab = document.querySelector('.ph-tab[onclick*="\'dt\'"]').textContent;
    phTab('dt'); const scr = document.getElementById('phScreen').textContent;
    o.pres = scr.includes(presIA().name); o.noVos = !/Director Técnico/.test(scr);
    const n0 = pedidosAbiertos().length;
    presMsg('refuerzo', 'Necesito un refuerzo'); o.pedidos = pedidosAbiertos().length - n0;
    presMsg('trabajo', '¿Cómo ve mi trabajo?');
    // los jugadores te dicen profe
    const p = G.squad[3]; G.chats.players[p.id] = [{ from: 'them', txt: 'Presidente, quería hablar con usted, presi.', w: 1 }];
    phTab('player'); _phPlayer = p.id; rPhone();
    o.profe = /Profe, quería hablar con usted, profe/.test(document.getElementById('phScreen').textContent);
    o.renuevaBtn = /contrato/.test(chatBotonesJugador(Object.assign(p, { contract: G.season })));
    const n1 = pedidosAbiertos().length; presMsgPlayerX(p.id, 'contrato', 'Hablemos de tu contrato'); o.pedRenov = pedidosAbiertos().length - n1;
    closePhone();
    return o;
  });
  chk('arranca en modo DT', D.modo === 'dt');
  chk('siendo DT no te llegan mensajes "del DT" (que sos vos)', D.deVos === 0, D.deVos + ' de ' + D.vos);
  chk('te escribe el presidente', D.dePres > 0, D.dePres + ' mensajes');
  chk('la pestaña del chat es la del Presidente', /Presidente/.test(D.tab) && D.pres && D.noVos, D.tab);
  chk('pedirle un refuerzo deja un pedido formal', D.pedidos === 1);
  chk('los jugadores te dicen "profe"', D.profe);
  chk('hablarle del contrato a un jugador le pide la renovación al presidente', D.renuevaBtn && D.pedRenov === 1);
  await espera(1700);
  const r2 = await pg.evaluate(() => { const t = G.chats.pres || []; return { n: t.filter(m => m.from === 'them').length, fns: (() => { let n = 0; (function sc(o, d) { if (!o || d > 6) return; for (const k in o) { if (typeof o[k] === 'function') n++; else if (typeof o[k] === 'object') sc(o[k], d + 1); } })(G, 0); return n; })() }; });
  chk('el presidente contesta', r2.n >= 2, r2.n + ' respuestas');
  chk('0 funciones en G', r2.fns === 0);
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
