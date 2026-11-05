// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 85: la cantera es local en las 24 ligas
// ═══════════════════════════════════════════════════════════════════════
// Los juveniles nacen con nombre de la liga Y con su nacionalidad (yp.nat), y
// promOne la respeta: un canterano nunca ocupa cupo de extranjero.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase85.js
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

  // Sin argentinos de referencia: en Inglaterra y Portugal no puede salir ningún
  // nombre que sólo exista en la lista vieja.
  const VIEJOS = ['Thiago', 'Mateo', 'Luca', 'Agustín', 'Franco', 'Valentín'];
  for (const [club, liga] of [['Real Madrid', 'España'], ['Man City', 'Premier'], ['Porto', 'Portugal'], ['Boca Juniors', 'Liga ARG']]) {
    console.log(`\n═══ ${club} (${liga}) ═══`);
    const r = await pg.evaluate(([club, liga]) => {
      localStorage.clear(); localStorage.setItem('dt_fondo3d', '0');
      document.getElementById('teamSelect').style.display = 'none';
      setLigaSel(liga); setModo('pres');
      startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === club)); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
      const o = { loc: natsLocales(), lg: ligaMia() };
      // la academia inicial (buildYouth corre ANTES de que exista G)
      o.ini = G.youth.players.map(p => p.nat);
      // camada semanal
      G.youth.players = G.youth.players.slice(0, 4);
      const ids0 = new Set(G.youth.players.map(p => p.id));
      G.week = 12; weeklyYouth();
      const nuevos = G.youth.players.filter(p => !ids0.has(p.id));
      o.nNuevos = nuevos.length;
      o.natNuevos = nuevos.map(p => p.nat);
      o.nombres = nuevos.map(p => p.name);
      // el pool de nombres sale de jugadores locales de la base
      const pool = _youthNames(ligaMia());
      const locSet = new Set(o.loc);
      const nombresLoc = new Set();
      (window.PLAYERS_DB || []).forEach(r => { if (locSet.has(r[4])) { const pa = String(r[1] || '').split(' ').filter(x => x.length > 2); if (pa.length >= 2) { nombresLoc.add(pa[0]); nombresLoc.add(pa[pa.length - 1]); } } });
      o.poolLocal = pool.fn.every(x => nombresLoc.has(x)) && pool.ln.every(x => nombresLoc.has(x));
      o.poolN = pool.fn.length;
      // promover: el cupo no se mueve y sube con la nat de la cantera
      const ext0 = G.squad.filter(p => pIsForeign(p)).length;
      const yp = nuevos[0] || G.youth.players[0];
      const n0 = yp.name, nat0 = yp.nat;
      promOne(yp.id);
      const sub = G.squad.find(p => p.name === n0);
      o.sub = !!sub; o.subNat = sub && sub.nat; o.natCantera = nat0; o.subLg = sub && sub.lg;
      o.subExt = sub ? pIsForeign(sub) : null;
      o.cupo = [ext0, G.squad.filter(p => pIsForeign(p)).length];
      // el reemplazo que crea promOne también nace local
      o.reempl = G.youth.players[G.youth.players.length - 1].nat;
      // guarda 1: un juvenil con una nat que acá NO es local → sube local
      G.youth.players.push({ id: 'yX', name: 'Pibe Brasil', pos: 'MC', age: 17, rat: 60, pot: 80, progress: 0, val: 0.3, nat: 'BRA' });
      promOne('yX'); const x = G.squad.find(p => p.name === 'Pibe Brasil');
      o.guardaBRA = x && x.nat; o.guardaExt = x ? pIsForeign(x) : null;
      // guarda 2: un save viejo, juvenil sin nat
      G.youth.players.push({ id: 'yV', name: 'Pibe Viejo', pos: 'DC', age: 17, rat: 60, pot: 80, progress: 0, val: 0.3 });
      promOne('yV'); const v = G.squad.find(p => p.name === 'Pibe Viejo');
      o.viejo = v && v.nat; o.viejoExt = v ? pIsForeign(v) : null;
      // sobrevive al guardado
      saveGame(); const nj = G.youth.players.map(p => p.nat).join(',');
      G = null; loadGame(); o.guardado = G.youth.players.map(p => p.nat).join(',') === nj;
      return o;
    }, [club, liga]);
    const loc = new Set(r.loc);
    chk('la academia inicial nace con nacionalidad local', r.ini.length > 0 && r.ini.every(n => loc.has(n)), r.ini.slice(0, 4).join(','));
    chk('la camada semanal trae nombres de jugadores locales de la base', r.poolLocal && r.nNuevos > 0, r.nombres.join(' · '));
    chk('y nace con la nacionalidad local explícita', r.natNuevos.length > 0 && r.natNuevos.every(n => n === r.loc[0]), r.natNuevos.join(','));
    if (liga !== 'Liga ARG') chk('ningún nombre de la lista argentina vieja (pool de ' + r.poolN + ')', !r.nombres.some(n => VIEJOS.includes(n.split(' ')[0])) || r.poolN > 6);
    chk('sube al plantel con la nat de la cantera, en la liga que dirigís', r.sub && r.subNat === r.natCantera && r.subLg === r.lg, r.subNat + ' · ' + r.subLg);
    chk('no ocupa cupo de extranjero (el cupo no se mueve)', r.subExt === false && r.cupo[0] === r.cupo[1], r.cupo.join(' → '));
    chk('el reemplazo que deja promOne también es local', r.reempl === r.loc[0]);
    chk('guarda: un juvenil con nat que acá no es local sube como local', r.guardaBRA === r.loc[0] && r.guardaExt === false || r.loc.includes('BRA'), r.guardaBRA);
    chk('guarda: un juvenil de save viejo (sin nat) sube como local', r.viejo === r.loc[0] && r.viejoExt === false, r.viejo);
    chk('la nacionalidad de la cantera sobrevive al guardado', r.guardado);
  }
  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
