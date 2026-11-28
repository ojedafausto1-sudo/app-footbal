// ═══════════════════════════════════════════════════════════════════════
// FASE 108: CAMISETAS Y ESCUDOS POR URL (para cargarlos en otro juego)
// ═══════════════════════════════════════════════════════════════════════
// Dream League Soccer (y otros) dejan bajar la camiseta y el escudo desde una
// dirección de internet: es una opción OFICIAL del juego. Esta función dibuja
// el PNG con los colores que le pasan en la dirección. No guarda nada, no
// llama a nadie y no usa dependencias: el PNG se arma a mano con zlib, que
// viene con Node.
//
//   /kit/ffd200-003a7d-liso.png      → camiseta (512×512)
//   /kit/ffd200-003a7d-rayas.png     → rayas verticales
//   /kit/ffd200-003a7d-franja.png    → franja horizontal al medio
//   /kit/ffd200-003a7d-mitad.png     → mitad y mitad
//   /kit/ffd200-003a7d-escudo-BJ.png → escudo con hasta 3 letras
//
// El molde (dónde caen el frente, la espalda y las mangas) se midió sobre una
// camiseta de DLS que pasó el presidente: ver FRENTE y ESPALDA. "Liso" queda
// bien con cualquier molde; los dibujos, con el de DLS. El escudo no tiene
// molde: se ve como se dibuja.
const zlib = require('zlib');

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, c]);
}
// RGBA, 8 bits por canal
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hex = s => { s = String(s || '').replace(/^#/, ''); if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) return null; if (s.length === 3) s = s.split('').map(c => c + c).join(''); if (s.length !== 6) return null; const n = parseInt(s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const luz = c => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;

// Letras de 5×7 para el escudo (sin fuentes: se dibujan con cuadraditos)
const F5 = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10011','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','11011','10001'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  0: ['01110','10011','10101','10101','11001','10001','01110'], 1: ['00100','01100','00100','00100','00100','00100','01110'],
  2: ['01110','10001','00001','00010','00100','01000','11111'], 3: ['11110','00001','00001','01110','00001','00001','11110'],
  4: ['00010','00110','01010','10010','11111','00010','00010'], 5: ['11111','10000','11110','00001','00001','10001','01110'],
  6: ['00110','01000','10000','11110','10001','10001','01110'], 7: ['11111','00001','00010','00100','01000','01000','01000'],
  8: ['01110','10001','10001','01110','10001','10001','01110'], 9: ['01110','10001','10001','01111','00001','00010','01100'],
};

// El molde de 512×512 que usa Dream League Soccer, medido sobre una camiseta
// de DLS: el FRENTE va al medio (el pecho, con el escudo y el sponsor), la
// ESPALDA arriba al medio y dada vuelta (los hombros se tocan en y≈180), las
// mangas y los costados a los lados, y el pantalón abajo (y≥380). Los dibujos
// van en el frente y en la espalda; las mangas y el pantalón quedan lisos.
const FRENTE = { x0: 160, x1: 352, y0: 180, y1: 376 }, ESPALDA = { x0: 180, x1: 346, y0: 0, y1: 180 };
const en = (R, x, y) => x >= R.x0 && x < R.x1 && y >= R.y0 && y < R.y1;
function camiseta(c1, c2, tipo) {
  const W = 512, H = 512, px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = c1;
    const f = en(FRENTE, x, y), e = en(ESPALDA, x, y);
    if (tipo === 'franja') { if ((f && y >= 244 && y < 292) || (e && y >= 68 && y < 116)) c = c2; }
    else if (tipo === 'rayas') { if ((f && Math.floor((x - FRENTE.x0) / 24) % 2 === 1) || (e && Math.floor((ESPALDA.x1 - 1 - x) / 24) % 2 === 1)) c = c2; }
    else if (tipo === 'mitad') { if ((f && x >= 256) || (e && x < 263)) c = c2; }
    else if (tipo === 'arquero') c = c1;
    const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return png(W, H, px);
}

function escudo(c1, c2, letras) {
  const W = 512, H = 512, px = Buffer.alloc(W * H * 4);   // transparente
  const borde = luz(c1) > 200 && luz(c2) > 200 ? [30, 30, 30] : [250, 250, 250];
  // contorno de escudo: arriba recto, costados rectos hasta 55%, abajo en punta
  const dentro = (x, y, m) => {
    const L = 64 + m, R = 448 - m, T = 40 + m, B = 488 - m;
    if (y < T || y > B || x < L || x > R) return false;
    const yc = T + (B - T) * 0.55;
    if (y <= yc) return true;
    const t = (y - yc) / (B - yc), mid = 256, half = (R - L) / 2 * (1 - t * t);
    return Math.abs(x - mid) <= half;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!dentro(x, y, 0)) continue;
    const c = dentro(x, y, 14) ? (x < 256 ? c1 : c2) : borde;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  // las letras, centradas, en una banda del color que contraste
  const t = String(letras || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (t) {
    const s = t.length === 3 ? 14 : t.length === 2 ? 18 : 24, gw = 5 * s, gap = s, tw = t.length * gw + (t.length - 1) * gap;
    const x0 = Math.round(256 - tw / 2), y0 = Math.round(236 - 3.5 * s);
    const banda = [x0 - 2 * s, y0 - s, x0 + tw + 2 * s, y0 + 8 * s];
    const fondo = luz(c1) > 150 ? [20, 24, 32] : [250, 250, 250], tinta = luz(fondo) > 150 ? [20, 24, 32] : [250, 250, 250];
    for (let y = banda[1]; y < banda[3]; y++) for (let x = banda[0]; x < banda[2]; x++) {
      if (!dentro(x, y, 14)) continue; const i = (y * W + x) * 4; px[i] = fondo[0]; px[i + 1] = fondo[1]; px[i + 2] = fondo[2]; px[i + 3] = 255; }
    [...t].forEach((ch, k) => {
      const g = F5[ch]; if (!g) return;
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '1')
        for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
          const x = x0 + k * (gw + gap) + q * s + xx, y = y0 + r * s + yy, i = (y * W + x) * 4;
          px[i] = tinta[0]; px[i + 1] = tinta[1]; px[i + 2] = tinta[2]; px[i + 3] = 255;
        }
    });
  }
  return png(W, H, px);
}

// /kit/<c1>-<c2>-<tipo>[-<letras>].png
function dibujar(nombre) {
  const m = String(nombre || '').replace(/^.*\//, '').replace(/\.png$/i, '').split('-');
  const c1 = hex(m[0]), c2 = hex(m[1]) || [244, 244, 244], tipo = (m[2] || 'liso').toLowerCase();
  if (!c1) return null;
  if (tipo === 'escudo') return escudo(c1, c2, m[3]);
  if (!['liso', 'rayas', 'franja', 'mitad', 'arquero'].includes(tipo)) return null;
  return camiseta(c1, c2, tipo);
}

exports.dibujar = dibujar;
exports.handler = async function (event) {
  const path = (event && (event.path || event.rawUrl)) || '';
  const img = dibujar(path);
  if (!img) return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    body: 'Formato: /kit/<color1>-<color2>-<liso|rayas|franja|mitad>.png o /kit/<color1>-<color2>-escudo-<LETRAS>.png (colores en hexadecimal, sin #)' };
  return { statusCode: 200, isBase64Encoded: true, body: img.toString('base64'),
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } };
};
