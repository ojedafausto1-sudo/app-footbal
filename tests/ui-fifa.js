// ═══════════════════════════════════════════════════════════════════════
// VERIFICACIÓN: interfaz estilo FIFA, 3D y las tres funciones nuevas (Fase 71)
// ═══════════════════════════════════════════════════════════════════════
//   export NODE_PATH=/opt/node22/lib/node_modules
//   node tests/ui-fifa.js
//
// Qué blinda, y por qué:
//  1. NINGUNA PESTAÑA QUEDÓ HUÉRFANA — la barra vieja tenía 14 botones y la
//     nueva tiene 5 secciones. Si una pestaña no tiene tarjeta, se pierde
//     (es el bug de las 9 pestañas en blanco de la Fase 49, por otro camino).
//  2. CADA PESTAÑA ENTRA CON CONTENIDO y la sección correcta se resalta.
//  3. INFORME — detecta un puesto sin recambio fabricado a propósito.
//  4. DORSALES — dos con el mismo número se detectan y se resuelven; un
//     número retirado no se puede volver a usar.
//  5. SEGUIMIENTO — sobrevive al guardado y el ojeador avisa cuando el
//     jugador cambia de club.
//  6. 0 FUNCIONES EN G (la regla de siempre).
//  7. 3D — three.js carga LOCAL, el visor abre y cierra, y el partido en 3D
//     tapa el 2D sin romper el 11v11 y lo devuelve al apagarlo.
//  8. EL JUEGO SIGUE ANDANDO — diez partidos simulados sin un error.
//
// ⚠️ NO lances Chromium con --use-angle=swiftshader para esto: con esa
// bandera la página entera se compone por software, las animaciones de CSS
// se congelan (la pestaña queda en opacidad 0) y parece que la interfaz está
// rota cuando no lo está. Medido: misma página, opacidad 0 con la bandera y
// 1 sin ella, también en la versión ANTERIOR del juego.
const path = require('path');
const { chromium } = require('playwright');
const F = 'file://' + path.resolve(__dirname, '..', 'director-tecnico.html');

let ok = 0, fail = 0;
const chk = (n, c, d) => { if (c) { ok++; console.log('  ✓ ' + n + (d ? ' — ' + d : '')); } else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(F, { waitUntil: 'load' }); await pg.waitForTimeout(450);
  await pg.evaluate(() => { localStorage.clear(); document.getElementById('teamSelect').style.display = 'none'; startGame('boca'); });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { try { autoFill(); preseasonSaltear(); closeMod(); } catch (e) {} updateUI(); });

  console.log('\n═══ NAVEGACIÓN ═══');
  const nav = await pg.evaluate(() => {
    const ids = [...document.querySelectorAll('#game .main > .tc')].map(t => t.id.replace(/^tab-/, '')).filter(x => x !== 'hub');
    const alcanzables = new Set(['ov']);
    Object.values(HUBS).forEach(H => { alcanzables.add(H.bigTab); H.tiles.forEach(t => t.tab && alcanzables.add(t.tab)); });
    const huerfanas = ids.filter(i => !alcanzables.has(i));
    const sinSec = ids.filter(i => !TAB_SEC[i]);
    const res = {};
    ids.forEach(i => {
      irTab(i);
      const t = document.getElementById('tab-' + i);
      const sec = document.querySelector('#fnav .fs.on');
      res[i] = { txt: (t.innerText || '').trim().length, sec: sec && sec.dataset.sec };
    });
    const hubs = {};
    ['plantel', 'mercado', 'oficina', 'temporada'].forEach(s => { irSec(s); hubs[s] = document.querySelectorAll('#hubGrid .ht').length; });
    irSec('central');
    return { ids, huerfanas, sinSec, res, hubs, ovTiles: document.querySelectorAll('#ovTiles .ht').length };
  });
  chk('las 15 pestañas tienen tarjeta', nav.ids.length === 15 && !nav.huerfanas.length, nav.huerfanas.join(',') || nav.ids.length + ' pestañas');
  chk('todas tienen sección', !nav.sinSec.length, nav.sinSec.join(','));
  const vacias = Object.entries(nav.res).filter(([, v]) => v.txt < 40).map(([k]) => k);
  chk('cada pestaña entra con contenido', !vacias.length, vacias.join(',') || 'ninguna vacía');
  const malSec = Object.entries(nav.res).filter(([k, v]) => v.sec !== (k === 'ov' ? 'central' : nav.res[k].sec) || !v.sec).map(([k]) => k);
  const secOk = await pg.evaluate(r => Object.entries(r).every(([k, v]) => v.sec === TAB_SEC[k]), nav.res);
  chk('se resalta la sección correcta', secOk && !malSec.length);
  chk('los 4 tableros tienen tarjetas', Object.values(nav.hubs).every(n => n >= 4), JSON.stringify(nav.hubs));
  chk('la portada tiene sus 4 tarjetas', nav.ovTiles === 4);

  console.log('\n═══ INFORME DEL PLANTEL ═══');
  const inf = await pg.evaluate(() => {
    // Se fabrica el caso: nadie más juega de DFI que el titular.
    const back = G.squad.map(p => [p.id, p.pos, p.pos2]);
    const sl = getForm(); const necesita = sl.some(s => s.pos === 'DFI');
    G.squad.filter(p => p.pos === 'DFI' || p.pos2 === 'DFI').forEach((p, i) => { if (i > 0) { p.pos = 'DFC'; p.pos2 = ''; } else p.pos2 = ''; });
    const I = informePlantel();
    const alerta = I.alertas.some(a => a.grave && /DFI/.test(a.txt));
    back.forEach(([id, pos, pos2]) => { const p = G.squad.find(x => x.id === id); p.pos = pos; p.pos2 = pos2; });
    abrirInforme(); const html = document.getElementById('modBody').innerHTML.length; closeMod();
    return { necesita, alerta, lineas: I.lineas.length, html };
  });
  chk('detecta un puesto sin recambio', !inf.necesita || inf.alerta, inf.necesita ? 'DFI' : 'la formación no usa DFI');
  chk('cuatro líneas y el modal se dibuja', inf.lineas === 4 && inf.html > 500);

  console.log('\n═══ DORSALES ═══');
  const dor = await pg.evaluate(() => {
    const [a, c] = G.squad; const na = a.num, nc = c.num;
    c.num = a.num;
    const dup = dorsalesConflictos().length >= 1;
    dorsalesAuto(); closeMod();
    const limpio = dorsalesConflictos().length === 0;
    G.numsRetirados = (G.numsRetirados || []).concat([{ num: 77, name: 'Prueba', season: G.season }]);
    const antes = a.num; dorsalCambiar(a.id, 77); closeMod();
    const bloqueado = a.num === antes;
    G.numsRetirados = G.numsRetirados.filter(r => r.name !== 'Prueba');
    // Retirar el número de una leyenda que ya se fue
    const libre = dorsalLibre(0);
    G.legends = (G.legends || []).concat([{ id: 'legPrueba', name: 'Leyenda Prueba', num: libre, activo: false }]);
    const fm0 = G.fanMood; dorsalRetirar('legPrueba'); closeMod();
    const ret = G.numsRetirados.some(r => r.name === 'Leyenda Prueba');
    const fmSube = G.fanMood > fm0; const fm1 = G.fanMood;
    dorsalRetirar('legPrueba'); closeMod();
    const unaVez = G.fanMood === fm1 && G.numsRetirados.filter(r => r.name === 'Leyenda Prueba').length === 1;
    G.legends = G.legends.filter(l => l.id !== 'legPrueba'); G.numsRetirados = G.numsRetirados.filter(r => r.name !== 'Leyenda Prueba');
    return { dup, limpio, bloqueado, ret, fmSube, unaVez };
  });
  chk('dos con el mismo número se detectan', dor.dup);
  chk('asignar automático los resuelve', dor.limpio);
  chk('un número retirado no se puede usar', dor.bloqueado);
  chk('retirar la de una leyenda: suma a la hinchada, una sola vez', dor.ret && dor.fmSube && dor.unaVez);

  console.log('\n═══ SEGUIMIENTO ═══');
  const seg = await pg.evaluate(() => {
    const p = G.market.find(x => x.club && x.club !== 'Libre' && contractMonths(x) > 12);
    seguirToggle(p.id);
    const sigue = sigo(p.id);
    saveGame(); const id = p.id; G = null; loadGame();
    const vuelve = sigo(id);
    const q = G.market.find(x => x.id === id);
    const m0 = (G.phoneMsgs[0] || {}).id;
    q.club = 'Club de Prueba';
    weeklySeguimiento();
    const aviso = (G.phoneMsgs[0] || {}).id !== m0 && /Club de Prueba/.test(G.phoneMsgs[0].body || G.phoneMsgs[0].text || JSON.stringify(G.phoneMsgs[0]));
    seguirToggle(id);
    const sale = !sigo(id);
    let fns = 0; const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 6) return; for (const k in o) { const v = o[k]; if (typeof v === 'function') fns++; else walk(v, d + 1); } };
    walk(G, 0);
    return { sigue, vuelve, aviso, sale, fns };
  });
  chk('seguir y dejar de seguir', seg.sigue && seg.sale);
  chk('sobrevive al guardado', seg.vuelve);
  chk('el ojeador avisa cuando cambia de club', seg.aviso);
  chk('0 funciones en G', seg.fns === 0, seg.fns + ' funciones');

  console.log('\n═══ 3D ═══');
  const t3 = await pg.evaluate(() => new Promise(r => e3dCargar(okk => r({ okk, v: window.THREE && THREE.REVISION }))));
  chk('three.js carga local', t3.okk && t3.v === '160', 'r' + t3.v);
  await pg.evaluate(() => abrirEstadio3D()); await pg.waitForTimeout(600);
  const v1 = await pg.evaluate(() => ({ ov: !!document.getElementById('e3dOv'), cv: !!document.querySelector('#e3dHost canvas') }));
  await pg.evaluate(() => e3dCerrar());
  const v2 = await pg.evaluate(() => !document.getElementById('e3dOv') && !window._E3V);
  chk('el visor del estadio abre y cierra', v1.ov && v1.cv && v2);
  await pg.evaluate(() => { G.trophies = [{ name: 'Copa Argentina' }]; abrirTrofeos3D(); }); await pg.waitForTimeout(500);
  const tro = await pg.evaluate(() => { const r = !!document.querySelector('#e3dHost canvas') && /1 t/.test(document.getElementById('e3dInfo').textContent); e3dCerrar(); G.trophies = []; return r; });
  chk('la sala de trofeos cuenta como la vitrina', tro);
  const fm = await pg.evaluate(() => new Promise(r => {
    G.day = 7; startFullMatch(true);
    setTimeout(() => {
      try { fmCloseHelp(); } catch (e) {}
      // Fase 72: el 3D arranca PRENDIDO solo (preferencia `dt_fm3d`, que el
      // localStorage.clear() del principio dejó en el default).
      setTimeout(() => {
        const on = !!document.querySelector('#fm3d canvas') && document.getElementById('fm-cv').style.visibility === 'hidden';
        // ⚠️ FM.ticks NO es monótono (se reinicia): se mide el minuto y la pelota.
        const m0 = FM.minute, x0 = FM.ball.x, y0 = FM.ball.y;
        setTimeout(() => {
          const corre = FM.minute > m0 || Math.hypot(FM.ball.x - x0, FM.ball.y - y0) > 1;
          fm3DToggle();
          const off = !document.getElementById('fm3d') && document.getElementById('fm-cv').style.visibility === '';
          try { fmQuit(); } catch (e) {}
          document.getElementById('fm-ov')?.remove(); closeMod();
          r({ on, corre, off });
        }, 4000);
      }, 900);
    }, 900);
  }));
  chk('el partido en 3D tapa el 2D', fm.on);
  chk('el 11v11 sigue corriendo debajo', fm.corre);
  chk('apagarlo devuelve el 2D', fm.off);

  console.log('\n═══ EL JUEGO SIGUE ANDANDO ═══');
  const sim = await pg.evaluate(() => {
    let jugados = 0;
    const drenar = () => {
      for (let k = 0; k < 5; k++) {
        const d = dilemaBloqueante(); if (d) { dilemaResolver(d.id, 0); continue; }
        if (prensaPend()) { prensaResolver(0); continue; }
        break;
      }
      closeMod();
    };
    for (let i = 0; i < 40 && jugados < 10; i++) {
      drenar();
      const m = G.calendar.find(x => !x.played); if (!m) break;
      G.day = 7; G.week = Math.max(G.week, m.week);
      simMatch(true); if (m.played) jugados++;
      closeMod(); updateUI();
    }
    irSec('plantel'); irSec('oficina');
    return jugados;
  });
  chk('diez partidos simulados', sim >= 10, sim + ' jugados');
  chk('0 errores de página', !errs.length, errs.slice(0, 3).join(' | '));

  console.log(`\n${fail ? '❌' : '✅'} ${ok} en verde · ${fail} en rojo`);
  await b.close();
  process.exitCode = fail ? 1 : 0;
})();
