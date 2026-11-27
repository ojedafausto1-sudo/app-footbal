// ═══════════════════════════════════════════════════════════════════════
// AUDITORÍA (Fase 102): juega carreras enteras como un usuario —día por día,
// fichando, vendiendo, firmando la Carpeta, construyendo, contestando dilemas y
// conferencias— y anota todo lo raro en cada fecha:
//   · invariantes del plantel (NaN, moral/física fuera de rango, ids o nombres
//     repetidos, contratos vencidos, jugadores en el plantel Y en el mercado)
//   · el once que juega (lesionados, suspendidos o menos de 11)
//   · la tabla (PJ = G+E+P, puntos de más)
//   · cada pestaña (texto "NaN"/"undefined", pestaña vacía)
//   · la CAJA: quién mueve G.budget y si lo anotó en Finanzas (línea CAJA)
//   · textos argentinos en ligas de afuera (línea ARG)
//   · guardar y cargar al cerrar cada temporada, y 0 funciones en G
//
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tools/auditoria.js ESCENARIO TEMPORADAS SEMILLA
//   escenarios: boca madrid lanusdt sanmartin fundar boca2005 flamengo
//               nacional river2018 city
// Tarda ~3-6 min por temporada. FILE=otra.html para auditar otra versión.
const path = require('path');
const { chromium } = require('playwright');
const ESC = process.argv[2] || 'boca', TEMPS = +(process.argv[3] || 2), SEED = +(process.argv[4] || 1);
const FILE = process.env.FILE || path.resolve(__dirname, '..', 'director-tecnico.html');
const SC = {
  boca: { club: 'Boca Juniors', lg: 'Liga ARG' },
  madrid: { club: 'Real Madrid', lg: 'España' },
  lanusdt: { club: 'Lanús', lg: 'Liga ARG', modo: 'dt' },
  sanmartin: { club: 'San Martín (SJ)', lg: 'Liga ARG', diff: 2 },
  fundar: { lg: 'Premier', fundar: true },
  boca2005: { club: 'Boca Juniors', lg: 'Liga ARG', y: 2005 },
  flamengo: { club: 'Flamengo', lg: 'Brasil' },
  nacional: { club: 'Almirante Brown', lg: 'Primera Nacional' },
  river2018: { club: 'River Plate', lg: 'Liga ARG', y: 2018 },
  city: { club: 'Man City', lg: 'Premier' },
};
const sc = SC[ESC];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [], cons = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  pg.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 200)); });
  await pg.addInitScript(() => { try { localStorage.setItem('dt_fondo3d', '0'); localStorage.setItem('dt_fm3d', '0'); localStorage.setItem('dt_sit3d', '0'); } catch (e) { } });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(500);
  if (sc.y) await pg.evaluate(y => new Promise(res => cargarTemporada(y, res)), sc.y);
  const ini = await pg.evaluate(([sc, SEED]) => {
    let s = (SEED * 2654435761) >>> 0; window._R = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    localStorage.removeItem('dtg_v7');
    if (sc.y) aplicarTemporada(sc.y);
    try { setModo(sc.modo || 'pres'); } catch (e) { }

    // ── instrumento de la caja: quién mueve G.budget y cuánto anota ──
    window._bud={}; window._anot=0;
    window._instrBudget=()=>{
      let v=G.budget; const g=G;
      Object.defineProperty(g,'budget',{configurable:true,enumerable:true,get(){return v;},set(n){
        const d=n-v; v=n; if(!d)return;
        const st=(new Error().stack||'').split('\n').slice(2,5).map(l=>(l.match(/at (\S+)/)||[])[1]||'?').filter(x=>!/^(Object|eval|<anonymous>)/.test(x));
        const k=st[0]||'?'; window._bud[k]=(window._bud[k]||0)+d; }});
      const fa=window._fa0||(window._fa0=window.finAnota); window.finAnota=function(r,m,d){ try{ const inn=(FIN_RUBROS[r]||{}).in; const sg=(inn?1:-1)*Math.abs(m||0); window._anot+=sg;
          const st=(new Error().stack||'').split('\n').slice(2,5).map(l=>(l.match(/at (\S+)/)||[])[1]||'?').filter(x=>!/^(Object|eval|<anonymous>)/.test(x)); const k=st[0]||'?'; window._anK=window._anK||{}; window._anK[k]=(window._anK[k]||0)+sg; }catch(e){} return fa.apply(this,arguments); };
    };
    window._xiMalo = [];
    const _ms = window.matchStrengths; window.matchStrengths = function (m) {
      try {
        const xi = Object.values(G.slots || {}).filter(Boolean).map(id => G.squad.find(p => p.id === id)).filter(Boolean);
        const inj = xi.filter(p => p.injured), sus = xi.filter(p => p.susp > 0);
        if (inj.length) window._xiMalo.push(['lesionadoJugando', inj.map(p => p.name + '(' + p.injured + (p._infil ? ',infiltrado' : '') + ')').join(',') + ' ' + (m && m.comp)]);
        if (sus.length) window._xiMalo.push(['suspendidoJugando', sus.map(p => p.name + '(' + p.susp + ')').join(',') + ' ' + (m && m.comp)]);
        if (xi.length < 11) window._xiMalo.push(['jugoConMenosDe11', xi.length + ' ' + (m && m.comp)]);
      } catch (e) { }
      return _ms.apply(this, arguments);
    };
    setLigaSel(sc.lg);
    if (sc.fundar) {
      window._fundarPrompt = 1;
      try { _tsLg = sc.lg; fundarModal(); document.getElementById('fundNom').value = 'Auditoria FC'; const sg = document.getElementById('fundAbbr'); if (sg) sg.value = 'AUD'; fundarCrear(); } catch (e) { return { err: 'fundar ' + e.message }; }
    } else {
      const id = Object.keys(TEAMS).find(k => TEAMS[k].name === sc.club && (!TEAMS[k].liga || TEAMS[k].liga === sc.lg || sc.lg === 'Primera Nacional'));
      if (!id) return { err: 'no club ' + sc.club };
      startGame(id);
    }
    try { autoFill(); } catch (e) { }
    if (sc.diff !== undefined) G.diff = sc.diff;
    try { window._instrBudget(); window._b0=G.budget; } catch (e) { }
    try { closeMod(); preseasonSaltear(); closeMod(); } catch (e) { }
    return { team: G.teamName, liga: ligaMia(), season: G.season, n: G.squad.length, budget: G.budget, modo: G.modo, armado: !!(G.armado && !G.armado.cerrado) };
  }, [sc, SEED]);
  console.log('INICIO', JSON.stringify(ini));
  if (ini.err) { await b.close(); return; }

  const anom = {}; // tipo -> {n, ej}
  const nota = (t, ej) => { if (!anom[t]) anom[t] = { n: 0, ej: [] }; anom[t].n++; if (anom[t].ej.length < 4) anom[t].ej.push(ej); };
  const resumen = [];
  for (let temp = 0; temp < TEMPS; temp++) {
    let guard = 0, stuck = 0, lastKey = '';
    while (guard++ < 140) {
      const r = await pg.evaluate(() => {
        const R = window._R, o = { a: [] }, A = (t, e) => o.a.push([t, e]);
        const op = n => ~~(R() * n);
        const drain = () => {
          let d, g = 0;
          while ((d = dilemaBloqueante()) && g++ < 12) { try { dilemaResolver(d.id, op((d.ops || d.opts || [0, 1]).length || 2)); } catch (e) { A('dilemaResolverErr', e.message); break; } }
          (G.dilemas || []).filter(x => x.resuelto === null).forEach(x => { try { dilemaResolver(x.id, op(2)); } catch (e) { } });
          try { if (prensaPend()) prensaResolver(op(3)); } catch (e) { A('prensaErr', e.message); }
          try { closeMod(); } catch (e) { }
        };
        // ── gestión como un usuario ──
        drain();
        try {
          if (G.armado && !G.armado.cerrado) {
            // fichar en el armado
            const cand = G.market.filter(p => !esLibre(p) || true).filter(p => p.rat >= 58 && p.rat <= 72 && askingPrice(p) < G.budget * 0.08).slice(0, 4);
            cand.forEach(p => { try { firmaProgramar(p, { price: +askingPrice(p).toFixed(1), wage: _negWageExpect(p), years: 3, motivo: 'aud' }); } catch (e) { A('firmaErr', e.message); } });
            for (let d = 0; d < 7; d++) advanceDay(true);
            if (G.armado.dia >= 63) armadoCerrar();
            o.key = 'armado:' + G.armado.dia; o.w = G.week; o.pj = 0; o.season = G.season; o.st = {}; return o;
          }
        } catch (e) { A('armadoErr', e.message); }
        try { (G.offers || []).slice().forEach(() => { if (!G.offers.length) return; R() < 0.3 ? accOff(0) : rejOff(0); try { closeMod(); } catch (e) { } }); } catch (e) { A('offerErr', e.message); }
        try { closeMod(); } catch (e) { }
        try { const so = (G.sponsorOffers || [])[0]; if (so) spnFirmar(so.oid); } catch (e) { A('spnErr', e.message); }
        try { (G.boardApprovals || []).slice().forEach(a => { try { R() < 0.7 ? aprobFirmar(a.aid) : aprobRechazar(a.aid); } catch (e) { A('aprobErr', e.message); } }); } catch (e) { }
        try { if (reunionPendiente()) reunionResolver(['prudente', 'acordado', 'ambiciosa'][op(3)], ['mixto', 'fijo', 'variable'][op(3)]); } catch (e) { A('reunionErr', e.message); }
        try { (G.youthIntake || []).forEach(y => { if (R() < 0.5) intakeFirmar(y.id); }); try { closeMod(); } catch (e) { } } catch (e) { A('intakeErr', e.message); }
        try {
          if (isTransferWindowOpen() && R() < 0.12 && G.squad.length < 34 && G.modo !== 'dt') {
            const linea = ['DEF', 'MED', 'DEL'][op(3)];
            const p = G.market.filter(x => pgr(x.pos) === linea && isKnown(x) && !esClasico(G.teamName, x.club) && askingPrice(x) < G.budget * 0.3 && x.rat >= (G.squad.reduce((a, q) => a + q.rat, 0) / G.squad.length)).sort((a, b) => b.rat - a.rat)[0];
            if (p && !topeBloquea(_negWageExpect(p))) firmaProgramar(p, { price: +askingPrice(p).toFixed(1), wage: _negWageExpect(p), years: 3, motivo: 'aud' });
            try { closeMod(); } catch (e) { }
          }
        } catch (e) { A('compraErr', e.message); }
        try {
          if (R() < 0.08 && G.modo !== 'dt') { const xi = Object.values(G.slots || {}); const p = G.squad.filter(q => !xi.includes(q.id) && !q.listed).sort((a, b) => a.rat - b.rat)[0]; if (p) { p.listed = 'sale'; p.askPrice = p.val; } }
        } catch (e) { }
        try {
          if (G.modo !== 'dt' && G.budget > 30 && R() < 0.1) {
            const up = (G.stadium.upgrades || []).filter(u => !u.built && !(G.activeConstructions || []).some(c => c.id === u.id) && u.cost < G.budget * 0.4)[0];
            if (up) { confirmBuildStad(up.id); try { closeMod(); } catch (e) { } }
          }
        } catch (e) { A('obraErr', e.message); }
        try { if (G.youth && G.youth.players && G.squad.length < 28 && R() < 0.15) { const y = G.youth.players.slice().sort((a, b) => b.rat - a.rat)[0]; if (y) promOne(y.id); } } catch (e) { A('promErr', e.message); }
        drain();
        // ── avanzar como el usuario: día por día hasta el partido y jugarlo ──
        const w0 = G.week, pj0 = (G.calendar || []).filter(m => m.played).length, s0 = G.season;
        try { for (let d = 0; d < 8 && !esDiaDePartido(); d++) { drain(); advanceDay(true); } } catch (e) { A('advanceErr', e.message); }
        drain();
        const pend = (G.calendar || []).filter(m => !m.played);
        if (!pend.length) { o.finTemp = true; }
        else {
          try { G.day = 7; simMatch(true); } catch (e) { A('simErr', e.message + ' ' + (e.stack || '').split('\n')[1]); }
          try { closeMod(); } catch (e) { }
        }
        drain();
        const pj = (G.calendar || []).filter(m => m.played).length;
        o.key = G.season + ':' + G.week + ':' + pj;
        o.w = G.week; o.pj = pj; o.season = G.season;
        // ── invariantes ──
        const fin = v => typeof v === 'number' && isFinite(v);
        if (!fin(G.budget)) A('budgetNaN', G.budget);
        const ids = new Set(), noms = {};
        (G.squad || []).forEach(p => {
          if (ids.has(p.id)) A('idDuplicado', p.name); ids.add(p.id);
          noms[p.name] = (noms[p.name] || 0) + 1;
          ['rat', 'age', 'val', 'wage', 'morale', 'fit', 'pot'].forEach(k => { if (p[k] !== undefined && !fin(p[k])) A('campoNaN:' + k, p.name + '=' + p[k]); });
          if (p.morale < 0 || p.morale > 100) A('moralFuera', p.name + ' ' + p.morale);
          if (p.fit < 0 || p.fit > 100.01) A('fitFuera', p.name + ' ' + p.fit);
          if (p.rat < 25 || p.rat > 99) A('ratFuera', p.name + ' ' + p.rat);
          if ((p.age || 0) < 14 || p.age > 46) A('edadRara', p.name + ' ' + p.age);
          if (p.contract && p.contract < G.season) A('contratoVencidoEnPlantel', p.name + ' ' + p.contract + '<' + G.season);
          if (!(p.wage > 0)) A('sueldoCero', p.name + ' ' + p.wage);
          if (!p.pos) A('sinPuesto', p.name);
          if (p.val < 0) A('valorNegativo', p.name + ' ' + p.val);
        });
        Object.keys(noms).forEach(n => { if (noms[n] > 1) A('nombreDuplicado', n); });
        const mk = new Set((G.market || []).map(p => p.id));
        (G.squad || []).forEach(p => { if (mk.has(p.id)) A('enPlantelYMercado', p.name); });
        Object.entries(G.slots || {}).forEach(([k, id]) => { if (id && !ids.has(id)) A('slotFantasma', k + ' ' + id); });
        const xi = Object.values(G.slots || {}).filter(Boolean);
        if (xi.length < 11 && G.modo !== 'dt' && !(G.armado && !G.armado.cerrado)) A('onceIncompleto', xi.length + ' en S' + G.week);
        (window._xiMalo || []).forEach(x => A(x[0], x[1])); window._xiMalo = [];
        if (G.squad.length < 16) A('plantelCorto', G.squad.length);
        if (G.squad.length > PLANTEL_MAX) A('plantelPasado', G.squad.length);
        // tabla de la liga
        try {
          const T = G.league && G.league.table;
          if (T) Object.entries(T).forEach(([c, t]) => {
            const pj = (t.g || 0) + (t.e || 0) + (t.p || 0);
            if (t.pj !== pj) A('tablaPJ', c + ' pj=' + t.pj + ' g+e+p=' + pj);
            if (t.pts > 3 * t.g + t.e) A('tablaPtsDeMas', c + ' ' + t.pts + ' vs ' + (3 * t.g + t.e));
            if (t.gf < 0 || t.gc < 0) A('tablaGolesNeg', c);
          });
        } catch (e) { A('tablaErr', e.message); }
        if (!fin(G.morale)) A('moraleClubNaN', G.morale);
        ['boardConf', 'fanMood', 'rep', 'chem'].forEach(k => { if (G[k] !== undefined && (!fin(G[k]) || G[k] < 0 || G[k] > 100.01)) A('medidorFuera:' + k, G[k]); });
        if (!fin(G.socios)) A('sociosNaN', G.socios);
        o.st = { b: Math.round(G.budget * 10) / 10, n: G.squad.length, mo: Math.round(G.squad.reduce((a, p) => a + (p.morale === undefined ? 60 : p.morale), 0) / G.squad.length), wo: G.squad.filter(p => p.wantsOut).length, rep: G.rep, cd: G.boardConf, hi: G.fanMood, soc: G.socios, wages: Math.round((G.squad.reduce((a, p) => a + (p.wage || 0), 0))), inj: G.squad.filter(p => p.injured).length };
        return o;
      });
      r.a.forEach(([t, e]) => nota(t, 'T' + temp + ' S' + r.w + ': ' + e));
      if (r.key === lastKey) { stuck++; if (stuck >= 3) { nota('relojTrabado', 'T' + temp + ' S' + r.w + ' pj ' + r.pj); break; } } else stuck = 0;
      lastKey = r.key;
      if (r.w % 4 === 0 || r.finTemp) {
        // barrido de pantallas
        const s = await pg.evaluate(() => {
          const out = [];
          const tabs = [...document.querySelectorAll('#game .main > .tc')].map(t => t.id.replace('tab-', ''));
          tabs.forEach(t => {
            try { gTab(t); } catch (e) { out.push(['gTabErr', t + ': ' + e.message]); return; }
            const el = document.getElementById('tab-' + t); const tx = el ? el.innerText : '';
            const m = tx.match(/[^\n]{0,40}(NaN|undefined|Infinity|\[object Object\]|\bnull\b)[^\n]{0,30}/);
            if (m) out.push(['textoRoto:' + t, m[0]]);
            if (t !== 'hub' && tx.replace(/\s/g, '').length < 40) out.push(['pestañaVacía', t]);
          });
          gTab('ov');
          return out;
        });
        s.forEach(([t, e]) => nota(t, 'T' + temp + ' S' + r.w + ': ' + e));
        resumen.push({ t: temp, w: r.w, ...r.st });
      }
      if (r.finTemp) break;
    }
    // ── cierre de temporada ──
    const fin = await pg.evaluate(() => {
      const o = { a: [] };
      const tb = G.league && G.league.table;
      o.pos = (() => { try { const T = G.league.table; return Object.keys(T).sort((a, b) => (T[b].pts - T[a].pts) || ((T[b].gf - T[b].gc) - (T[a].gf - T[a].gc))).indexOf(G.teamName) + 1; } catch (e) { return null; } })();
      o.pj = (G.calendar || []).filter(m => m.played).length; o.tot = (G.calendar || []).length;
      o.comps = {}; (G.calendar || []).forEach(m => { const c = (m.comp || '').replace(/ - .*| (R\d+|Octavos|Cuartos|Semi.*|Final|Fecha.*)$/, ''); o.comps[c] = (o.comps[c] || 0) + (m.played ? 1 : 0); });
      o.trofeos = (G.trophies || []).length;
      o.s0 = G.season;
      try {
        if (ligaMia() !== 'Liga ARG' && ligaMia() !== 'Primera Nacional') {
          const RX = /\bAFA\b|Argentin|Libertadores|Sudamericana|Copa Argentina|Bombonera|Apertura|Clausura|Superclásico|Primera Nacional|Liga Profesional|\bpesos\b|Monumental/;
          const txts = [];
          (G.phoneMsgs || []).forEach(m => txts.push('cel:' + String(m.txt || m.text || m.msg || '').replace(/<[^>]+>/g, '')));
          (G.news || []).forEach(n => txts.push('news:' + String(n.title || n.txt || n.text || '').replace(/<[^>]+>/g, '')));
          [...document.querySelectorAll('#game .main > .tc')].forEach(t => { try { gTab(t.id.replace('tab-', '')); txts.push('tab ' + t.id + ':' + t.innerText); } catch (e) { } });
          gTab('ov');
          o.arg = txts.map(x => { const m = x.match(RX); return m ? x.slice(0, 12) + '…' + x.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, ' ') : null; }).filter(Boolean).slice(0, 15);
        }
      } catch (e) { o.arg = 'err ' + e.message; }
      try { o.finT = finTemporada(G.season); o.ventas=(G.movs||[]).filter(m=>m.season===G.season&&m.t==='sale'&&m.monto>0).map(m=>m.name+' '+m.rat+':'+m.monto).slice(0,12); } catch (e) { o.finT = e.message; }
      try { const tot=Object.values(window._bud).reduce((a,b)=>a+b,0); o.bud={delta:+tot.toFixed(1),anotado:+window._anot.toFixed(1),por:(()=>{const A=window._anK||{}; const ks=new Set([...Object.keys(window._bud),...Object.keys(A)]); return [...ks].map(k=>[k,(window._bud[k]||0)-(A[k]||0),window._bud[k]||0]).filter(x=>Math.abs(x[1])>0.5).sort((a,b)=>a[1]-b[1]).map(([k,g,d])=>k+' falta:'+g.toFixed(1)+' (mov '+d.toFixed(1)+')');})()}; window._bud={}; window._anot=0; window._anK={}; } catch (e) { o.bud=e.message; }
      try { nextSeason(); } catch (e) { o.a.push(['nextSeasonErr', e.message + ' ' + (e.stack || '').split('\n')[1]]); }
      o.asamblea = false;
      if (G.season === o.s0 && !G._fired) { try { if (aprobacion() >= ASAMBLEA_SIGUE) { o.asamblea = 'sigue'; descensoQuedarse(); } else { o.asamblea = 'renuncia'; } } catch (e) { o.a.push(['asambleaErr', e.message]); } }
      let d, g = 0; while ((d = dilemaBloqueante()) && g++ < 10) { try { dilemaResolver(d.id, 0); } catch (e) { break; } }
      try { if (prensaPend()) prensaResolver(0); } catch (e) { }
      try { closeMod(); preseasonSaltear(); closeMod(); } catch (e) { }
      // la asamblea / destitución
      o.fired = !!G._fired; o.fin = (typeof juegoTerminado === 'function') ? juegoTerminado() : null;
      o.liga = ligaMia(); o.s1 = G.season; o.cal = (G.calendar || []).length; o.n = G.squad.length; o.b = G.budget;
      o.hist = (G.history || []).slice(-1)[0];
      // guardado
      try { saveGame(); const raw = localStorage.getItem('dtg_v7'); o.saveKB = Math.round((raw || '').length / 1024); const s = G.season; G = null; loadGame(); o.reload = G && G.season === s; try{ window._fa0&&(window.finAnota=window._fa0); }catch(e){} } catch (e) { o.a.push(['saveLoadErr', e.message]); }
      try { window._instrBudget(); } catch (e) { }
      const fn = (function scan(x, d) { if (d > 7 || !x || typeof x !== 'object') return 0; let r = 0; for (const k in x) { if (typeof x[k] === 'function') r++; else if (x[k] && typeof x[k] === 'object') r += scan(x[k], d + 1); } return r; })(G, 0);
      if (fn) o.a.push(['funcionesEnG', fn]);
      return o;
    });
    fin.a.forEach(([t, e]) => nota(t, 'fin T' + temp + ': ' + e));
    console.log('TEMPORADA', temp, JSON.stringify({ asamblea: fin.asamblea, liga: fin.liga, pos: fin.pos, pj: fin.pj + '/' + fin.tot, comps: fin.comps, trofeos: fin.trofeos, s: fin.s0 + '→' + fin.s1, calNuevo: fin.cal, n: fin.n, b: fin.b, fired: fin.fired, fin: fin.fin, saveKB: fin.saveKB, reload: fin.reload, hist: fin.hist && { pos: fin.hist.pos, budget: fin.hist.budget, titulos: fin.hist.titulos } }));
    console.log('FIN', JSON.stringify(fin.finT), JSON.stringify(fin.ventas));
    console.log('CAJA', JSON.stringify(fin.bud));
    if (fin.arg) console.log('ARG', JSON.stringify(fin.arg));
    if (fin.fired || fin.fin) break;
  }
  resumen.forEach(x => console.log('R', JSON.stringify(x)));
  console.log('ANOMALIAS');
  Object.entries(anom).sort((a, b) => b[1].n - a[1].n).forEach(([t, v]) => console.log(' ', t, v.n, '|', v.ej.join(' || ').slice(0, 400)));
  const ue = {}; errs.forEach(e => ue[e] = (ue[e] || 0) + 1); const uc = {}; cons.forEach(e => uc[e] = (uc[e] || 0) + 1);
  console.log('PAGEERRORS', JSON.stringify(ue).slice(0, 1500));
  console.log('CONSOLE', JSON.stringify(uc).slice(0, 1500));
  await b.close();
})();
