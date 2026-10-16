// tests/extractor-sumar.js — IDs con candidatos (PR1A|PRAP|…) y fusión con los archivos que ya tenés,
// con Transfermarkt simulado (desde el entorno de desarrollo TM da 403).
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '..', 'extractor.html'));
  const r = await pg.evaluate(async () => {
    const pedidos = [];
    const VALIDOS = { BO1A: 'Bolivia', EL1S: 'Ecuador', PRAP: 'Paraguay' };   // VZ: ninguno anda
    window.histClubes = async (c, y) => { pedidos.push(c + '/' + y);
      if (!VALIDOS[c]) return [];
      return Array.from({ length: 12 }, (_, i) => ({ id: c + i, name: VALIDOS[c] + ' club ' + i })); };
    window.histPlantel = async (id, y) => ({ players: Array.from({ length: 18 }, (_, i) => ({ name: 'J' + id + '_' + i, pos: 'Centre-Back', nat: 'Bolivia', age: 25, value: 0.5 })) });
    window.rawGet = async () => ({ status: 200, body: '' });
    const descargas = []; window.histDescargar = (y, f, c, pl) => descargas.push({ y, n: f.length, ligas: Object.keys(pl).sort(), f });
    // archivos "que ya tenés": 2024 con Liga ARG + Uruguay (con un 'Nacional'), y un Bolivia viejo a reemplazar
    window._histBase = { 2024: [
      [1,'Viejo ARG','ARQ',30,'ARG','Boca Juniors','Liga ARG',5,'der',2026,180,'',0,0,0,0,''],
      [1,'Viejo URU','ARQ',30,'URU','Nacional','Uruguay',2,'der',2026,180,'',0,0,0,0,''],
      [1,'Bolivia vieja','ARQ',30,'BOL','Bolivar','Bolivia',1,'der',2026,180,'',0,0,0,0,''],
    ] };
    histMarcar(0);
    ['Paraguay','Ecuador','Bolivia','Venezuela'].forEach(lg => { const i = HIST_LIGAS.findIndex(L => L.lg === lg); document.getElementById('hl' + i).checked = true; });
    document.getElementById('histDesde').value = 2023; document.getElementById('histHasta').value = 2024;
    window.confirm = () => true; window.alert = () => {};
    await histProbarIDs();
    const campos = ['Paraguay','Ecuador','Bolivia','Venezuela'].map(lg => document.getElementById('hc1' + HIST_LIGAS.findIndex(L => L.lg === lg)).value);
    const ped1 = pedidos.length; pedidos.length = 0;
    // volver a poner las listas para probar que la corrida larga también resuelve
    ['Paraguay','Ecuador','Bolivia','Venezuela'].forEach(lg => { const i = HIST_LIGAS.findIndex(L => L.lg === lg); document.getElementById('hc1' + i).value = HIST_LIGAS[i].c1; });
    await extraerHistorico();
    const d24 = descargas.find(d => d.y === 2024), d23 = descargas.find(d => d.y === 2023);
    return { campos, ped1, ped2: pedidos.slice(), d24: { n: d24.n, ligas: d24.ligas,
        viejaBol: d24.f.some(x => x[1] === 'Bolivia vieja'), uru: d24.f.some(x => x[1] === 'Viejo URU'), arg: d24.f.some(x => x[1] === 'Viejo ARG') },
      d23: d23 && { n: d23.n, ligas: d23.ligas },
      idx: JSON.parse(localStorage.getItem('dt_hist_idx'))[2024],
      log: document.getElementById('status').innerText.split('\n').filter(l => /🔎|✗|➕|⚠️ No cargaste|anduvo|AFUERA/.test(l)).slice(0, 20) };
  });
  const ok = {
    candidatoElegido: r.campos.slice(0, 3).join() === 'PRAP,EL1S,BO1A',
    ningunoAnda_quedaLaLista: r.campos[3].includes('|'),
    ligaSinIDqueda_afuera: !r.ped2.some(p => /^VZ1L\/2023/.test(p)),
    fusionConserva_otrasLigas: r.d24.uru && r.d24.arg,
    fusionReemplaza_suLiga: !r.d24.viejaBol,
    indiceDelFusionado: r.idx.j === r.d24.n && r.idx.lg.Uruguay === 1,
    anioNuevo_sinBase: r.d23 && r.d23.ligas.join() === 'Bolivia,Ecuador,Paraguay',
    sinErrores: !errs.length,
  };
  Object.entries(ok).forEach(([k, v]) => console.log((v ? '  ✓ ' : '  ✗ ') + k));
  if (Object.values(ok).some(v => !v)) { console.log(JSON.stringify(r, null, 1), errs); process.exitCode = 1; }
  await b.close();
})();
