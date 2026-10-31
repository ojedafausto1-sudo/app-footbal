#!/usr/bin/env node
/**
 * GENERADOR DE PAQUETE DE DATOS PARA SOCCER MANAGER 27
 * ====================================================
 * Convierte players-db.js al JSON que pide SM27:
 *   { PlayerData:[], ClubData:[], LeagueData:[], CupData:[], StadiumData:[] }
 *
 * ⚠️ LEER ESTO ANTES DE USARLO
 * Los "ID" del paquete son los IDs INTERNOS de Soccer Manager: el juego los usa
 * para saber a QUÉ jugador suyo le está cambiando el nombre o la foto. Nuestra
 * base no tiene esos IDs (usa 'p64', etc.), así que este script emite IDs
 * secuenciales propios. Con eso el archivo es válido y carga, pero SM27 va a
 * aplicar cada entrada al jugador que tenga ese número, no al que vos querés.
 *
 * Para que sirva de verdad hay que mapear nuestros nombres contra los IDs
 * reales de SM27 (se sacan de un paquete existente de la comunidad, en el
 * Discord que menciona el juego). Cuando tengas ese mapa, pasalo con --map.
 *
 * USO
 *   node sm27-pack.js                        → paquete completo
 *   node sm27-pack.js --liga "Liga ARG"      → sólo una liga
 *   node sm27-pack.js --map ids.json         → aplica IDs reales de SM27
 *   node sm27-pack.js --out mi-pack.json     → nombre de salida
 *
 * FORMATO DE ids.json (opcional)
 *   { "players": {"Álvaro Montero": 12345}, "clubs": {"Boca Juniors": 678} }
 */
const fs = require('fs');
const path = require('path');

// ── argumentos ──
const arg = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const soloLiga = arg('--liga', null);
const mapFile  = arg('--map', null);
const outFile  = arg('--out', soloLiga ? `sm27-${soloLiga.replace(/\s+/g, '-').toLowerCase()}.json` : 'sm27-pack.json');

// ── base ──
global.window = {};
require(path.join(__dirname, 'players-db.js'));
let filas = global.window.PLAYERS_DB || [];
if (soloLiga) filas = filas.filter(r => r[6] === soloLiga);
if (!filas.length) { console.error('❌ No hay jugadores' + (soloLiga ? ` en "${soloLiga}"` : '')); process.exit(1); }

// ── mapa de IDs reales, si lo hay ──
let mapa = { players: {}, clubs: {}, leagues: {}, stadiums: {} };
if (mapFile) {
  try { mapa = Object.assign(mapa, JSON.parse(fs.readFileSync(mapFile, 'utf8'))); }
  catch (e) { console.error('❌ No pude leer el mapa de IDs:', e.message); process.exit(1); }
}

// Separa "Álvaro Montero" en nombre y apellido. Los compuestos ("De Paul")
// se mantienen enteros del lado del apellido, que es como los escribe SM.
const PARTICULAS = ['de', 'del', 'da', 'dos', 'van', 'von', 'la', 'le', 'di', 'do', "d'"];
function partirNombre(full) {
  const p = String(full || '').trim().split(/\s+/);
  if (p.length === 1) return { fore: '', sur: p[0] };
  let corte = p.length - 1;
  while (corte > 1 && PARTICULAS.includes(p[corte - 1].toLowerCase())) corte--;
  return { fore: p.slice(0, corte).join(' '), sur: p.slice(corte).join(' ') };
}
// Sigla de 3 letras para el club, evitando repetidas
const siglasUsadas = new Set();
function sigla(nombre) {
  const limpio = String(nombre).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '').trim();
  const pal = limpio.split(/\s+/).filter(Boolean);
  let base = (pal.length >= 3 ? pal.slice(0, 3).map(w => w[0]).join('')
            : pal.length === 2 ? (pal[0].slice(0, 2) + pal[1][0])
            : limpio.slice(0, 3)).toUpperCase();
  if (base.length < 3) base = (base + limpio.toUpperCase()).slice(0, 3);
  let s = base, n = 1;
  while (siglasUsadas.has(s)) { s = base.slice(0, 2) + String(n++); }
  siglasUsadas.add(s);
  return s;
}

// ── armado ──
const clubes = [...new Set(filas.map(r => r[5]).filter(Boolean))].sort();
const ligas  = [...new Set(filas.map(r => r[6]).filter(Boolean))].sort();

const PlayerData = filas.map((r, i) => {
  const { fore, sur } = partirNombre(r[1]);
  return {
    ID: mapa.players[r[1]] || (i + 1),
    Forename: fore,
    Surname: sur,
    ImageURL: ''
  };
});
const ClubData = clubes.map((c, i) => ({
  ID: mapa.clubs[c] || (i + 1),
  Name: c,
  ShortName: sigla(c),
  ImageURL: ''
}));
const LeagueData = ligas.map((l, i) => ({
  ID: mapa.leagues[l] || (i + 1),
  Name: l,
  ImageURL: ''
}));
// SM separa copas de ligas. Estas son las que el juego ya simula.
const CupData = [
  { ID: 1, Name: 'Copa Argentina',        ImageURL: '' },
  { ID: 2, Name: 'Copa Libertadores',     ImageURL: '' },
  { ID: 3, Name: 'Copa Sudamericana',     ImageURL: '' },
].map((c, i) => ({ ...c, ID: mapa.cups && mapa.cups[c.Name] || c.ID }));
// Un estadio por club: la base no trae canchas, así que se nombran a partir del club
const StadiumData = clubes.map((c, i) => ({
  ID: mapa.stadiums[c] || (i + 1),
  Name: 'Estadio ' + c
}));

const pack = { PlayerData, ClubData, LeagueData, CupData, StadiumData };
fs.writeFileSync(outFile, JSON.stringify(pack, null, 2));

const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log(`✅ ${outFile}  (${kb} KB)`);
console.log(`   ${PlayerData.length} jugadores · ${ClubData.length} clubes · ${LeagueData.length} ligas · ${StadiumData.length} estadios`);
if (!mapFile) {
  console.log('\n⚠️  IDs SECUENCIALES, no los de SM27.');
  console.log('   El archivo carga, pero cada entrada se va a aplicar al jugador');
  console.log('   que SM tenga con ese número, no al que vos querés.');
  console.log('   Para que sirva: conseguí los IDs reales y volvé a correrlo con --map ids.json');
}
