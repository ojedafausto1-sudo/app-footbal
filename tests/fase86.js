// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FASE 86: los filtros del Mercado salen del mercado de ESTA partida
// ═══════════════════════════════════════════════════════════════════════
// Liga, equipo y nación se rearman al abrir el Mercado por primera vez en cada
// partida y cada vez que el mercado cambia; las naciones van todas, y el valor
// de cada liga es la etiqueta exacta de la base.
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/fase86.js
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

  const arrancar = (club, liga) => pg.evaluate(([club, liga]) => {
    localStorage.setItem('dt_fondo3d', '0');
    document.getElementById('teamSelect').style.display = 'none';
    setLigaSel(liga); setModo('pres');
    startGame(Object.keys(TEAMS).find(k => TEAMS[k].name === club)); try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) { }
  }, [club, liga]);
  // opciones del <select> contra lo que hay de verdad en G.market
  const medir = () => pg.evaluate(() => {
    const vals = id => [...document.getElementById(id).options].map(o => o.value).filter(Boolean);
    const dist = k => new Set(G.market.map(p => p[k]).filter(Boolean));
    const lg = vals('mkLg'), nat = vals('mkNat'), team = vals('mkTeam');
    const dLg = dist('lg'), dNat = dist('nat'), dClub = dist('club');
    return {
      lg: lg.length, dLg: dLg.size, nat: nat.length, dNat: dNat.size, team: team.length, dClub: dClub.size,
      fantLg: lg.filter(x => !dLg.has(x)), fantTeam: team.filter(x => !dClub.has(x)).length,
      faltaLg: [...dLg].filter(x => !lg.includes(x)), faltaNat: [...dNat].filter(x => !nat.includes(x)).length,
      lgVals: lg, lgTxt: [...document.getElementById('mkLg').options].map(o => o.textContent),
    };
  });

  // ─── 1. la primera vez que se abre el Mercado ───
  console.log('\n═══ Man City (Premier), primera partida ═══');
  await arrancar('Man City', 'Premier');
  let m = await pg.evaluate(() => document.getElementById('mkLg').options.length);
  chk('antes de abrir el Mercado los filtros siguen vacíos (no se paga el armado)', m <= 1, m + ' opciones');
  // la pestaña puede estar LIMPIA y aun así tiene que armar los filtros
  await pg.evaluate(() => { _tabSucia.mkt = false; gTab('mkt'); });
  m = await medir();
  chk('al abrir el Mercado (aunque la pestaña esté limpia) se arman las ligas', m.lg === m.dLg && m.lg > 10, m.lg + ' de ' + m.dLg);
  chk('…todas las naciones del mercado, no las 40 de antes', m.nat === m.dNat && m.nat >= 60, m.nat + ' de ' + m.dNat);
  chk('…y todos los equipos', m.team === m.dClub, m.team + ' de ' + m.dClub);
  chk('ninguna liga ni equipo fantasma', m.fantLg.length === 0 && m.fantTeam === 0);

  // ─── 2. mktLeagues devuelve la etiqueta exacta ───
  const L = await pg.evaluate(() => {
    const l = mktLeagues().map(x => x.lg);
    const lower = l.map(x => x.toLowerCase());
    // filtrar por 'Premier' devuelve exactamente a los de la Premier
    const s = document.getElementById('mkLg'); s.value = 'Premier'; fillTeamFilter(); renderMkt();
    const enPrem = G.market.filter(p => p.lg === 'Premier').length;
    const clubesPrem = new Set(G.market.filter(p => p.lg === 'Premier').map(p => p.club)).size;
    const teamOpts = document.getElementById('mkTeam').options.length - 1;
    const opt = [...s.options].find(o => o.value === 'Premier');
    return {
      premier: l.includes('Premier'), sinCaso: new Set(lower).size === l.length,
      todasExactas: l.every(x => G.market.some(p => p.lg === x)),
      sel: s.value, enPrem, clubesPrem, teamOpts, txt: opt && opt.textContent,
      espana: l.includes('España'), libre: [...s.options].some(o => o.value === 'Libre' && /Libres/.test(o.textContent)) || !l.includes('Libre'),
    };
  });
  chk("mktLeagues() devuelve 'Premier' tal cual está en la base", L.premier && L.todasExactas);
  chk('no hay dos ligas que difieran sólo en mayúsculas', L.sinCaso);
  chk("y 'España' con tilde", L.espana);
  chk('el valor es la etiqueta y el texto el nombre de la competencia', L.sel === 'Premier' && /Premier League/.test(L.txt || ''), L.txt);
  chk("elegir 'Premier' deja en Equipos sólo los clubes de la Premier", L.teamOpts === L.clubesPrem && L.clubesPrem > 0, L.teamOpts + ' clubes, ' + L.enPrem + ' jugadores');
  chk('los libres se leen como "Libres", no como una liga', L.libre);

  // ─── 3. la elección sobrevive a un rearmado ───
  const keep = await pg.evaluate(() => { const n = document.getElementById('mkNat'); n.value = 'BRA'; refreshMktFilters(); return [document.getElementById('mkLg').value, n.value]; });
  chk('rearmar los filtros no te borra lo que tenías elegido', keep[0] === 'Premier' && keep[1] === 'BRA', keep.join(' · '));
  await pg.evaluate(() => { document.getElementById('mkLg').value = ''; document.getElementById('mkNat').value = ''; fillTeamFilter(); });

  // ─── 4. el mercado cambia en la misma partida ───
  const cambio = await pg.evaluate(() => {
    const sig0 = _mkFiltSig;
    // un libre nuevo de un club que no existía
    G.market.push({ id: 'x86', name: 'Pibe Fase86', pos: 'MC', age: 22, rat: 70, pot: 75, val: 1, nat: 'ISL', club: 'Club Fase86', lg: 'Premier' });
    renderMktSafe();
    const t = [...document.getElementById('mkTeam').options].some(o => o.value === 'Club Fase86');
    const n = [...document.getElementById('mkNat').options].some(o => o.value === 'ISL');
    // pasa la semana sin que cambie el largo: también rearma
    G.market.pop(); G.market[0].club = 'Club Movido86'; G.week++;
    renderMktSafe();
    const t2 = [...document.getElementById('mkTeam').options].some(o => o.value === 'Club Movido86');
    return { sig0, sig1: _mkFiltSig, t, n, t2 };
  });
  chk('un jugador nuevo en el mercado aparece en Equipos y Nación', cambio.t && cambio.n);
  chk('un pase de la semana se refleja aunque el mercado tenga el mismo largo', cambio.t2);
  const costo = await pg.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 5; i++) refreshMktFilters(); return (performance.now() - t0) / 5; });
  chk('rearmar los tres filtros es barato', costo < 120, costo.toFixed(1) + ' ms');
  const sinRearmar = await pg.evaluate(() => mktFiltrosAsegurar());
  chk('si el mercado no cambió, no se rearma', sinRearmar === false);

  // ─── 5. otra partida en la misma sesión ───
  console.log('\n═══ Boca (segunda partida en la misma sesión) ═══');
  await arrancar('Boca Juniors', 'Liga ARG');
  await pg.evaluate(() => gTab('mkt'));
  m = await medir();
  chk('la segunda partida rearma los filtros: 0 equipos fantasma', m.fantTeam === 0 && m.team === m.dClub, m.team + ' de ' + m.dClub);
  chk('no aparece "Club Movido86" de la partida anterior', !(await pg.evaluate(() => [...document.getElementById('mkTeam').options].some(o => o.value === 'Club Movido86'))));
  const tok = await pg.evaluate(() => { const a = G._mkTok; const js = JSON.stringify(G); saveGame(); G = null; loadGame(); return { a, b: G._mkTok, enSave: /_mkTok/.test(js), cambia: mktFiltrosAsegurar() }; });
  chk('la marca de la partida no viaja al save', !tok.enSave);
  chk('cargar la partida es otra partida: rearma', tok.cambia === true || tok.a !== tok.b, tok.a + ' → ' + tok.b);
  const fns = await pg.evaluate(() => { let n = 0; const v = (o, d) => { if (d > 6 || !o || typeof o !== 'object') return; for (const k in o) { if (typeof o[k] === 'function') n++; else v(o[k], d + 1); } }; v(G, 0); return n; });
  chk('0 funciones en G', fns === 0);

  // ─── 6. un año histórico (si el archivo está en la carpeta) ───
  const hay = await pg.evaluate(() => new Promise(res => { try { cargarTemporada(2015, ok => res(ok)); } catch (e) { res(false); } }));
  if (hay) {
    console.log('\n═══ Real Madrid 2015, después de una partida de 2026 ═══');
    await pg.evaluate(() => aplicarTemporada(2015));
    await arrancar('Real Madrid', 'España');
    await pg.evaluate(() => gTab('mkt'));
    m = await medir();
    chk('las ligas son las del año, sin las de 2026 que no estaban', m.fantLg.length === 0 && m.faltaLg.length === 0, m.lg + ' ligas' + (m.fantLg.length ? ' · fantasmas: ' + m.fantLg.join(',') : ''));
    chk('equipos y naciones del año, completos', m.fantTeam === 0 && m.team === m.dClub && m.faltaNat === 0, m.team + ' equipos · ' + m.nat + ' naciones');
    await pg.evaluate(() => aplicarTemporada(2026));
  } else console.log('  (sin players-hist-2015.js en la carpeta: se saltea el año histórico)');

  chk('0 errores de página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  process.exit(fail ? 1 : 0);
})();
