#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE SE PAGÓ NO ES LO QUE VALE (Fase 103)
// ═══════════════════════════════════════════════════════════════════════════
// El parser del Worker (`parseKader`) tomaba el PRIMER "€" de la fila del
// plantel, y en la vista detallada de Transfermarkt el primero no es el valor
// de mercado: es el TRASPASO, que viene escondido en el `title` del escudo de
// "Llegó de" ("Manchester United: Ablöse €94.00m"). El valor de mercado está
// en la última celda. Resultado: todo jugador que llegó a su club por plata
// quedaba con lo que se pagó por él, igual en TODAS las temporadas que jugó
// ahí. Cristiano 94 de 2009 a 2017, Nedved 45 a los 36 años, Suárez 81,72.
// Medido sobre las 26 temporadas: de las 13.913 filas de €10M o más, 9.702
// (el 70%) son un traspaso.
//
// Esto no puede bajar de nuevo los datos (desde acá Transfermarkt da 403), así
// que los RECONSTRUYE:
//  1. Detecta el tramo: mismo jugador (nombre + año de nacimiento ±1), mismo
//     club, temporadas CONTIGUAS, 2+ y exactamente el mismo valor en todas. Un
//     valor de mercado de verdad cambia casi siempre de un año al otro.
//  2. Estima el valor de cada temporada con dos fuentes, pesadas por cuánto
//     se equivoca cada una (medido):
//      a) el traspaso, llevado a la plata y a la edad de esa temporada;
//      b) los valores REALES del mismo jugador en otras temporadas (otros
//         clubes, o players-db.js para 2026), proyectados con la misma curva.
//     Haaland 2025 sale de sus €220M de 2026 (un año de distancia), no de los
//     €60M que pagó el City en 2022.
//  3. Guarda el traspaso en r[19] y marca r[20]=1 ("r[7] es una estimación").
//     Volver a correrlo parte de r[19]: no se acumula.
//  4. Recalcula r[17]/r[18] (la tasación de otro año para los que TM no tasó,
//     Fase 74), porque muchas apuntaban a un traspaso.
//
// Una fila de una extracción NUEVA (con el Worker arreglado) trae el valor
// real en r[7] y el traspaso en r[19] SIN r[20]: ésas no se tocan, salvo que
// no traigan valor (r[7]≤0,1), en cuyo caso se estima desde r[19].
//
// Uso:
//   node tools/hist-valores.js             → informe, no escribe nada
//   node tools/hist-valores.js --verdad    → valida contra 2026 (sin usarlo)
//   node tools/hist-valores.js --escribir  → reescribe players-hist-*.js
//   --dir=carpeta                           → otra carpeta de históricos
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const ARGS = process.argv.slice(2);
const REPO = path.resolve(__dirname, '..');
const DIR = path.resolve((ARGS.find(a => a.startsWith('--dir=')) || '').slice(6) || REPO);
const ESCRIBIR = ARGS.includes('--escribir'), VERDAD = ARGS.includes('--verdad');

// La inflación es la del juego: una sola tabla.
const HTML = fs.readFileSync(path.join(REPO, 'director-tecnico.html'), 'utf8');
const mT = HTML.match(/const INFL_TABLA=\{([^}]*)\}/);
if (!mT) { console.error('No encontré INFL_TABLA en director-tecnico.html'); process.exit(1); }
const INFL = {}; mT[1].replace(/(\d{4})\s*:\s*([\d.]+)/g, (_, y, v) => { INFL[+y] = +v; });
const I = y => y >= 2026 ? 1 : INFL[y] || (y < 2000 ? Math.min(7, INFL[2000] * Math.pow(1.06, 2000 - y)) : 1);

// ── el modelo del traspaso ──
// Curva por edad en plata CONSTANTE (la inflación va aparte). Ajustada por
// descenso por coordenadas minimizando |log error| contra la verdad: los
// traspasos del archivo 2025 contra el valor real de 2026 de players-db.js
// (2.310 casos), y suavizada a mano para que sea monótona.
// ⚠️ El ajuste daba +13% por año de los 20 a los 23, y se dejó en +6%: la
// muestra son tramos que SIGUEN abiertos en 2025, o sea los pibes a los que
// les fue bien. En los históricos el tramo está entero, fracasos incluidos, y
// con +13% Martial (€60M a los 19) terminaba en €122M y 91 de media en 2022.
// ⚠️ Y LO QUE SE PAGA CARO VUELVE A LA MEDIA. Sin esto, los traspasos de
// €20M+ quedaban 46% arriba del valor real de 2026 (Maguire 87 → 8, Casemiro
// 70 → 6, Kalvin Phillips 49 → 2,5). `B` encoge el traspaso hacia €5M en
// escala log, de a poco: nada el año que llega, entero a los `RAMPA` años.
//   B 1,00 → sesgo por banda −0,49 / −0,12 / +0,19 / +0,38 · |err| 0,546
//   B 0,85 → sesgo por banda −0,28 / −0,03 / +0,09 / +0,12 · |err| 0,526
//   B 0,75 → sesgo por banda −0,16 / +0,01 /  0,00 / −0,05 · |err| 0,533
// (bandas de traspaso: <1M, 1-5M, 5-20M, 20M+).
const K0 = 0.97, B = 0.85, RAMPA = 2, REF = Math.log(5);
const CURVA = { 17: 1.06, 18: 1.06, 19: 1.06, 20: 1.06, 21: 1.06, 22: 1.06, 23: 1.06, 24: 1.04, 25: 1.03,
  26: 1.00, 27: 0.94, 28: 0.90, 29: 0.86, 30: 0.81, 31: 0.74, 32: 0.74, 33: 0.68 };
const curva = a => a < 17 ? 1.06 : a > 33 ? 0.68 : CURVA[a];
const RELLENO = 0.1;
// log del valor estimado EN PLATA DE HOY desde el traspaso
function lnDesdeTraspaso(traspaso, y0, a0, a) {
  const hoy = Math.log(traspaso * I(y0));
  const t = Math.max(0, a - a0);
  let v = hoy + (B - 1) * (hoy - REF) * Math.min(1, t / RAMPA) + Math.log(K0);
  for (let k = a0; k < a; k++) v += Math.log(curva(k));
  return v;
}
// log del valor en plata de hoy, proyectando un valor REAL de otra temporada
function lnProyectar(v, a1, y1, a2) {
  let x = Math.log(v * I(y1));
  if (a2 >= a1) for (let k = a1; k < a2; k++) x += Math.log(curva(k));
  else for (let k = a2; k < a1; k++) x -= Math.log(curva(k));
  return x;
}
// Cuánto se equivoca cada fuente (mediana de |log error|, medido sobre los
// tramos que varían, o sea valores de mercado de verdad). Proyectar un valor
// real d años con la curva:
//   d   +1   +2   +3   +4   +5   +6   +7   +8   (hacia adelante)
//  |e|  .30  .45  .56  .65  .70  .75  .80  .84
//   d   −1   −2   −3   −4   −5   −6   −7   −8   (hacia atrás)
//  |e|  .32  .51  .64  .72  .76  .77  .79  .80
// Y el traspaso, por años desde la llegada (contra 2026): .43 .51 .62 .71 ~.70
// ⚠️ Esa medición también da un SESGO (la proyección se pasa 10-70%), y se
// probó corregirlo: con la corrección entera el reconstruido quedaba −0,21
// abajo de 2026, con la mitad −0,16 y sin ninguna −0,13 con el menor error
// (0,45). La población de la que sale el sesgo (canteranos y libres) no es la
// de los fichajes, así que no se corrige.
//   con anclas  sesgo −0,13 · |err| 0,45
//   sólo traspaso    −0,09 · 0,54
//   traspaso crudo   +0,03 · 0,58  (y +1,10 / 1,26 a los 8 años de llegado)
const E_ADEL = [0.20, 0.30, 0.45, 0.56, 0.65, 0.70, 0.75, 0.80, 0.84];
const E_ATRAS = [0.20, 0.32, 0.51, 0.64, 0.72, 0.76, 0.77, 0.79, 0.80];
const eTraspaso = t => Math.min(0.70, 0.36 + 0.08 * t);
const UNA_TEMPORADA = 0.10;   // una fila suelta puede ser un traspaso: pesa menos

// ── carga ──
const H = {}, CAB = {};
const anios = fs.readdirSync(DIR).map(f => (f.match(/^players-hist-(\d{4})\.js$/) || [])[1]).filter(Boolean).map(Number).sort();
for (const y of anios) {
  const src = fs.readFileSync(path.join(DIR, `players-hist-${y}.js`), 'utf8');
  CAB[y] = src.split('\n').filter((l, i, a) => l.startsWith('//') && a.slice(0, i).every(x => x.startsWith('//')))
    .filter(l => !l.includes('tools/hist-valores.js'));
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
  H[y] = ctx.window.PLAYERS_DB_HIST[y];
}
const c26 = { window: {} }; vm.createContext(c26);
vm.runInContext(fs.readFileSync(path.join(REPO, 'players-db.js'), 'utf8'), c26);
const DB26 = c26.window.PLAYERS_DB;
// El valor "de origen" de una fila: si ya se reparó, el traspaso que guardó.
const orig = r => ((r[20] === 1 || r[20] === 2) && r[19] > 0) ? r[19] : r[7];
const nueva = r => r[19] > 0 && r[20] !== 1 && r[20] !== 2;     // extracción con el Worker arreglado

// ── el mismo jugador a lo largo de los años ──
const porNom = {};
for (const y of anios) H[y].forEach(r => (porNom[r[1]] = porNom[r[1]] || []).push({ y, r, b: y - r[3] }));
const i26 = {}; DB26.forEach(r => (i26[r[1]] = i26[r[1]] || []).push(r));
const jugadores = [];
for (const n in porNom) {
  const L = porNom[n].sort((a, b) => a.b - b.b); const grupos = [];
  for (const e of L) { const g = grupos.find(g => Math.abs(g.b - e.b) <= 1); if (g) g.f.push(e); else grupos.push({ b: e.b, f: [e] }); }
  for (const g of grupos) {
    const hoy = (i26[n] || []).filter(q => Math.abs((2026 - q[3]) - g.b) <= 1 && q[7] > RELLENO);
    jugadores.push({ n, f: g.f.sort((a, b) => a.y - b.y), hoy: hoy.length === 1 ? hoy[0] : null });
  }
}

// ── clasificación de cada fila ──
// fee: tramo constante · fut: traspaso del futuro · real · suelta (1 temporada) · nada (relleno)
// ⚠️ EL TRASPASO PUEDE SER DEL FUTURO. TM pone en "Llegó de" el ÚLTIMO pase
// del jugador a ese club, también en las temporadas de antes: Pogba en el
// United 2010 figura con los €105M de 2016, y Lukaku en el Chelsea 2011 con
// los €113M de 2021. r[9] es esa fecha de llegada, así que una fila con
// r[9] > año+1 cuyo valor es el mismo que el de una temporada posterior a
// esa llegada no tiene valor de mercado: tiene un traspaso que todavía no
// pasó. Queda sin tasar (r[20]=2) y la tasación de otro año la completa.
// ⚠️ Y el tramo tiene que ser CONTIGUO: si no, el Pogba de 2010-2011 y el
// de 2016-2021 eran "el mismo tramo constante" y el pibe de 17 se estimaba
// desde lo que se pagó por el de 23.
for (const J of jugadores) {
  // por CLUB, no por club+liga: el que asciende o desciende cambia de etiqueta
  // (Huracán entre la Liga ARG y la Primera Nacional) y sigue siendo el mismo
  // tramo con el mismo traspaso. El jugador ya viene identificado por nombre
  // y año de nacimiento, así que un homónimo de club de otro país no se cruza.
  const pc = {}; J.f.forEach(e => (pc[e.r[5]] = pc[e.r[5]] || []).push(e));
  for (const c in pc) {
    const f = pc[c];
    for (const e of f) {
      const r9 = e.r[9], v = orig(e.r);
      e.fut = !!(r9 && r9 > e.y + 1 && v > RELLENO && !nueva(e.r) && f.some(q => q.y >= r9 - 1 && orig(q.r) === v));
    }
    const runs = [];
    for (const e of f) { const u = runs[runs.length - 1]; if (u && e.y - u[u.length - 1].y <= 2) u.push(e); else runs.push([e]); }
    for (const run of runs) {
      // las filas sin tasar (relleno) no cuentan: si las tasadas son 2+ y todas
      // iguales, es el traspaso igual (Ábila en Huracán: 0,1 · 0,1 · 6 · 6)
      const vals = run.map(e => orig(e.r)), tas = vals.filter(v => v > RELLENO);
      const constante = tas.length >= 2 && !run.some(e => nueva(e.r)) && tas.every(v => v === tas[0]);
      const primero = run.find(e => !e.fut) || run[0];
      // ⚠️ El tramo que ya viene abierto en la primera temporada del archivo y
      // sin fecha de llegada NO empezó ese año: Aldair figura desde 2000 con
      // los €9M que pagó la Roma en 1990, y suponer que llegó en 2000 lo dejaba
      // en €8,7M a los 35 años. Se supone una llegada hasta 4 años antes, no
      // más joven que a los 26 (ahí la curva ya casi no se mueve).
      const r9p = primero.r[9], sinFecha = !(r9p && r9p >= primero.y - 15 && r9p <= primero.y + 1);
      const abierto = sinFecha && primero.y === anios[0] ? Math.min(4, Math.max(0, primero.r[3] - 26)) : 0;
      for (const e of run) {
        if (e.fut) { e.k = 'fut'; continue; }
        let fee = 0;
        if (constante && orig(e.r) > RELLENO) fee = tas[0];
        else if (nueva(e.r) && e.r[7] <= RELLENO) fee = e.r[19];
        if (fee > 0) {
          const r9 = e.r[9];
          const y0 = (r9 && r9 >= primero.y - 15 && r9 <= e.y + 1) ? Math.min(r9, primero.y) : primero.y - abierto;
          e.k = 'fee'; e.fee = fee; e.y0 = y0; e.a0 = primero.r[3] - (primero.y - y0);
        } else if (orig(e.r) > RELLENO) e.k = run.length >= 2 ? 'real' : 'suelta';
        else e.k = 'nada';
      }
    }
  }
}

// ── estimación ──
function estimar(J, e, con2026) {
  const ws = [], ls = [];
  const t = Math.max(0, e.r[3] - e.a0);
  const et = eTraspaso(t); ws.push(1 / (et * et)); ls.push(lnDesdeTraspaso(e.fee, e.y0, e.a0, e.r[3]));
  // los valores reales más cercanos de cada lado (y el del mismo año en otro club)
  const anclas = J.f.filter(q => q !== e && (q.k === 'real' || q.k === 'suelta')).map(q => ({ y: q.y, a: q.r[3], v: orig(q.r), suelta: q.k === 'suelta' }));
  if (con2026 && J.hoy) anclas.push({ y: 2026, a: J.hoy[3], v: J.hoy[7], suelta: false });
  const antes = anclas.filter(q => q.y <= e.y).sort((p, q) => q.y - p.y)[0];
  const despues = anclas.filter(q => q.y >= e.y && q !== antes).sort((p, q) => p.y - q.y)[0];
  for (const q of [antes, despues]) {
    if (!q) continue;
    const d = e.y - q.y, k = Math.min(8, Math.abs(d));
    // d>0: el ancla es de antes y se proyecta hacia adelante
    const err = (d >= 0 ? E_ADEL[k] : E_ATRAS[k]) + (q.suelta ? UNA_TEMPORADA : 0);
    ws.push(1 / (err * err)); ls.push(lnProyectar(q.v, q.a, q.y, e.r[3]));
  }
  let sw = 0, sl = 0; ws.forEach((w, i) => { sw += w; sl += w * ls[i]; });
  return sl / sw;                                               // log, plata de hoy
}

// ── validación: 2025 contra el valor real de 2026 SIN usar 2026 ──
if (VERDAD) {
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const casos = [];
  for (const J of jugadores) {
    if (!J.hoy) continue;
    for (const e of J.f) {
      if (e.y !== 2025 || e.k !== 'fee') continue;
      const q = J.hoy;
      // el estimado de 2025 llevado a la edad de 2026
      const lnE = estimar(J, e, false) + Math.log(curva(e.r[3])) * (q[3] - e.r[3]);
      const lnT = lnDesdeTraspaso(e.fee, e.y0, e.a0, q[3]);
      casos.push({ fee: e.fee, t: q[3] - e.a0, eM: lnE - Math.log(q[7]), eT: lnT - Math.log(q[7]), eC: Math.log(e.fee * I(e.y0)) - Math.log(q[7]) });
    }
  }
  const linea = (g, nom) => console.log(`${nom}: n ${g.length} · con anclas sesgo ${med(g.map(c => c.eM)).toFixed(2)} |err| ${med(g.map(c => Math.abs(c.eM))).toFixed(2)} · sólo traspaso ${med(g.map(c => c.eT)).toFixed(2)}/${med(g.map(c => Math.abs(c.eT))).toFixed(2)} · traspaso crudo ${med(g.map(c => c.eC)).toFixed(2)}/${med(g.map(c => Math.abs(c.eC))).toFixed(2)}`);
  linea(casos, 'verdad 2026, todos');
  for (const [lo, hi] of [[0.1, 1], [1, 5], [5, 20], [20, 1e9]]) linea(casos.filter(c => c.fee >= lo && c.fee < hi), `  traspaso €${lo}-${hi === 1e9 ? '∞' : hi}M`);
  for (const t of [1, 2, 3, 4, 6, 8]) { const g = casos.filter(c => c.t === t || (t === 8 && c.t >= 8)); if (g.length > 10) linea(g, `  ${t} años desde la llegada`); }
}

// ── aplicar ──
const pad = r => { while (r.length < 21) r.push(r.length === 11 || r.length === 16 ? '' : 0); };
let reparadas = 0, futuras = 0, con26 = 0; const porAnio = {}; const antes = {};
for (const y of anios) antes[y] = H[y].map(r => r[7]);
for (const J of jugadores) for (const e of J.f) {
  if (e.k === 'fee') {
    const ln = estimar(J, e, true);
    if (J.hoy && e.y >= 2018) con26++;
    pad(e.r); e.r[19] = e.fee; e.r[20] = 1;
    e.r[7] = Math.max(0.11, Math.round(Math.exp(ln) / I(e.y) * 100) / 100);
    reparadas++; porAnio[e.y] = (porAnio[e.y] || 0) + 1;
  } else if (e.k === 'fut') {
    pad(e.r); e.r[19] = orig(e.r); e.r[20] = 2; e.r[7] = RELLENO; futuras++;
  } else if (e.r[20] === 1 || e.r[20] === 2) {                       // ya no aplica: vuelve a su valor
    e.r[7] = e.r[19]; e.r[19] = 0; e.r[20] = 0;
  }
}

// ── r[17]/r[18]: la tasación de otro año, ahora sobre valores reparados ──
// Misma regla que `histRefValores` del extractor: mismo nombre, edad
// coherente con el salto, hasta 3 años atrás y 4 adelante.
const idx = {};
for (const y of anios) H[y].forEach(r => { if (r[7] > RELLENO) (idx[r[1]] = idx[r[1]] || []).push([y, r[3], r[7]]); });
let conRef = 0, sinValor = 0;
for (const y of anios) for (const r of H[y]) {
  if (r.length > 17) { r[17] = 0; r[18] = 0; }
  if (r[7] > RELLENO) continue;
  sinValor++;
  const c = idx[r[1]]; if (!c) continue;
  let best = null, bk = 99;
  for (const [y2, a2, v] of c) {
    const d = y2 - y;
    if (d < -3 || d > 4) continue;
    if (Math.abs((a2 - r[3]) - d) > 1) continue;
    const k = Math.abs(d) * 2 + (d < 0 ? 1 : 0);
    if (k < bk || (k === bk && v > best[2])) { bk = k; best = [y2, a2, v]; }
  }
  if (!best) continue;
  while (r.length < 19) r.push(r.length === 11 || r.length === 16 ? '' : 0);
  r[17] = best[2]; r[18] = best[0]; conRef++;
}
// filas sin nada al final: se recortan, como las escribe el extractor
for (const y of anios) for (const r of H[y]) {
  if (r.length > 19 && !(r[19] > 0) && !r[20]) r.length = 19;
  if (r.length === 19 && !(r[17] > 0) && !(r[18] > 0)) r.length = 17;
}

// ── informe ──
console.log(`${anios.length} temporadas · ${jugadores.length} jugadores · ${reparadas} filas reconstruidas desde el traspaso (${con26} de 2018+ con su valor de 2026 como ancla) · ${futuras} con un traspaso del futuro (quedan sin tasar)`);
console.log(`tasaciones de otro año: ${conRef} de ${sinValor} fichas sin tasar`);
for (const y of anios) {
  const top = H[y].map((r, i) => [r, antes[y][i]]).sort((a, b) => b[0][7] - a[0][7]).slice(0, 6);
  const mx10 = H[y].filter(r => r[7] >= 10).length, ant10 = antes[y].filter(v => v >= 10).length;
  console.log(`${y}: ${porAnio[y] || 0} reparadas · ≥10M ${ant10}→${mx10} · ` + top.map(([r, a]) => `${r[1].split(' ').pop()} ${a}→${r[7]}`).join(', '));
}

if (ESCRIBIR) {
  for (const y of anios) {
    const n = H[y].filter(r => r[20] === 1).length, nf = H[y].filter(r => r[20] === 2).length;
    const js = CAB[y].join('\n') + '\n'
      + `// valores de mercado reconstruidos desde el traspaso en ${n} filas y ${nf} sin tasar por traspaso futuro (tools/hist-valores.js, Fase 103)\n`
      + `(window.PLAYERS_DB_HIST=window.PLAYERS_DB_HIST||{})[${y}]=[\n`
      + H[y].map(r => JSON.stringify(r)).join(',\n') + '\n];\n';
    fs.writeFileSync(path.join(DIR, `players-hist-${y}.js`), js);
  }
  console.log('✍️  escritos', anios.length, 'archivos');
}
