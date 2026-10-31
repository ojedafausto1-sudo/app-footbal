// PROTOTIPO, no enchufado al juego. Necesita three.min.js (r160) cargado como
// <script src="three.min.js"> LOCAL (nada de CDN: el juego anda con file://).
// Uso: estadio3D(div, {vista:"tv"|"aire"|"arco", noche, cap, color, techo, asist}).
// PROTOTIPO — estadio 3D generado desde los datos de la partida (G.stadium,
// color del club) + los 22 del 11v11 leídos de FM. Three.js r160 local
// (three.min.js), sin red: anda bajo file:// igual que el juego.
function estadio3D(cont, opt) {
  opt = opt || {};
  const W = cont.clientWidth, H = cont.clientHeight;
  const cap = opt.cap || (G.stadium && G.stadium.capacity) || 20000;
  const techo = opt.techo != null ? opt.techo
    : !!((G.stadium && G.stadium.upgrades) || []).find(u => u.id === 'roof' && u.built);
  const col = new THREE.Color(opt.color || (TEAMS[G.teamId] || {}).color || '#003087');
  const asist = opt.asist != null ? opt.asist : 0.8;

  const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setSize(W, H); R.setPixelRatio(1);
  R.shadowMap.enabled = true;
  cont.appendChild(R.domElement);
  const S = new THREE.Scene();
  S.background = new THREE.Color(opt.noche ? '#05070d' : '#8fb7e0');
  S.fog = new THREE.Fog(S.background, 260, 520);

  // ── luz ──
  S.add(new THREE.HemisphereLight(opt.noche ? 0x445577 : 0xddeeff, 0x223311, opt.noche ? 0.55 : 0.9));
  const sol = new THREE.DirectionalLight(0xffffff, opt.noche ? 0.35 : 1.4);
  sol.position.set(-90, 160, 70); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -140, right: 140, top: 110, bottom: -110, far: 400 });
  S.add(sol);

  // ── cancha: textura dibujada en canvas (franjas + cal) ──
  const L = 105, A = 68, M = 6;                    // largo, ancho, margen
  const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 680;
  const g = tc.getContext('2d'), sx = 1024 / (L + 2 * M), sy = 680 / (A + 2 * M);
  for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#2f8a3a' : '#3a9a44'; g.fillRect(i * 1024 / 18, 0, 1024 / 18 + 1, 680); }
  g.strokeStyle = '#f4f4f4'; g.lineWidth = 2.2;
  const X = x => (x + M) * sx, Y = y => (y + M) * sy;
  g.strokeRect(X(0), Y(0), L * sx, A * sy);
  g.beginPath(); g.moveTo(X(L / 2), Y(0)); g.lineTo(X(L / 2), Y(A)); g.stroke();
  g.beginPath(); g.ellipse(X(L / 2), Y(A / 2), 9.15 * sx, 9.15 * sy, 0, 0, 7); g.stroke();
  [[0, 1], [L, -1]].forEach(([x0, d]) => {
    g.strokeRect(Math.min(X(x0), X(x0 + d * 16.5)), Y(A / 2 - 20.16), 16.5 * sx, 40.32 * sy);
    g.strokeRect(Math.min(X(x0), X(x0 + d * 5.5)), Y(A / 2 - 9.16), 5.5 * sx, 18.32 * sy);
  });
  const tex = new THREE.CanvasTexture(tc); tex.anisotropy = 4;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * M, A + 2 * M),
    new THREE.MeshLambertMaterial({ map: tex }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; S.add(pitch);
  // arcos
  const blanco = new THREE.MeshLambertMaterial({ color: 0xffffff });
  [-L / 2, L / 2].forEach(x => {
    const arco = new THREE.Group();
    const palo = (w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), blanco); m.position.set(px, py, pz); m.castShadow = true; arco.add(m); };
    palo(.12, 2.44, .12, 0, 1.22, -3.66); palo(.12, 2.44, .12, 0, 1.22, 3.66); palo(.12, .12, 7.44, 0, 2.44, 0);
    const red = new THREE.Mesh(new THREE.BoxGeometry(2, 2.44, 7.32), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .25 }));
    red.position.set(Math.sign(x) * 1, 1.22, 0); arco.add(red);
    arco.position.x = x; S.add(arco);
  });

  // ── tribunas: la FORMA sale de la capacidad ──
  // < 15.000: dos tribunas laterales rectas (cancha de ascenso)
  // 15-40.000: cuatro tribunas, esquinas casi rectas
  // > 40.000: bowl redondeado con bandejas superpuestas
  const butacasFila = r => 2 * ((L + 2 * M + 2 * r) + (A + 2 * M + 2 * r)) / 0.5;
  let filas = 0, tot = 0;
  while (tot < cap && filas < 120) { tot += butacasFila(filas * 0.8) * (cap < 15000 ? 0.55 : 1); filas++; }
  const porBandeja = cap < 15000 ? filas : cap < 40000 ? Math.ceil(filas / 1) : 22;
  const bandejas = Math.ceil(filas / porBandeja);
  const radio = cap < 15000 ? 0 : cap < 40000 ? 4 : 26;
  const matA = new THREE.MeshLambertMaterial({ color: col });
  const matB = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const matHorm = new THREE.MeshLambertMaterial({ color: 0x6d7480 });
  const rrect = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - .1, h / 2 - .1);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  const filasMeta = [];          // para sembrar la gente después
  let z0 = 0.6, off0 = 0;
  for (let b = 0; b < bandejas; b++) {
    const n = Math.min(porBandeja, filas - b * porBandeja);
    for (let i = 0; i < n; i++) {
      const off = off0 + i * 0.8, h = z0 + i * 0.42;
      const w = L + 2 * M + 2 * off, d = A + 2 * M + 2 * off;
      if (cap < 15000) {           // sólo laterales
        [-1, 1].forEach(sgn => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, h, 0.8), (i % 6 < 3) ? matA : matB);
          m.position.set(0, h / 2, sgn * (A / 2 + M + off + 0.4)); m.castShadow = m.receiveShadow = true; S.add(m);
        });
        filasMeta.push({ off, h, lateral: true });
      } else {
        const sh = rrect(w + 1.6, d + 1.6, radio + off * 0.4);
        sh.holes.push(rrect(w, d, radio + off * 0.4 - 0.1));
        const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 10 });
        geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, (Math.floor(i / 3) + b) % 2 ? matB : matA);
        m.castShadow = m.receiveShadow = true; S.add(m);
        filasMeta.push({ off, h, w, d, r: radio + off * 0.4 });
      }
    }
    // la siguiente bandeja arranca más arriba y montada encima (voladizo)
    z0 += n * 0.42 + 4.5; off0 += n * 0.8 - 6;
    if (b < bandejas - 1) {
      const fr = rrect(L + 2 * M + 2 * (off0 + 7), A + 2 * M + 2 * (off0 + 7), radio + off0 * 0.4);
      fr.holes.push(rrect(L + 2 * M + 2 * (off0 + 0.5), A + 2 * M + 2 * (off0 + 0.5), radio + off0 * 0.4 - .1));
      const g2 = new THREE.ExtrudeGeometry(fr, { depth: 1.2, bevelEnabled: false, curveSegments: 10 });
      g2.rotateX(-Math.PI / 2); const mf = new THREE.Mesh(g2, matHorm); mf.position.y = z0 - 1.4; S.add(mf);
    }
  }
  const alto = z0, offMax = off0 + porBandeja * 0.8;

  // ── gente: muestreo proporcional a la asistencia ──
  const maxVis = 14000, vis = Math.min(maxVis, Math.round(cap * asist));
  const pg = new THREE.BoxGeometry(0.42, 0.75, 0.42);
  const pm = new THREE.MeshLambertMaterial();
  const gente = new THREE.InstancedMesh(pg, pm, vis);
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  const pal = [col, col, col, new THREE.Color(0xffffff), new THREE.Color(0x222222), new THREE.Color(0xd9b38c)];
  for (let k = 0; k < vis; k++) {
    const f = filasMeta[(Math.random() * filasMeta.length) | 0];
    let x, z;
    if (f.lateral) { x = (Math.random() - .5) * L * 0.88; z = (Math.random() < .5 ? -1 : 1) * (A / 2 + M + f.off + 0.4); }
    else {           // un punto sobre el perímetro del rectángulo redondeado
      const t = Math.random(), per = 2 * (f.w + f.d);
      let s = t * per;
      if (s < f.w) { x = -f.w / 2 + s; z = -f.d / 2; } else if ((s -= f.w) < f.d) { x = f.w / 2; z = -f.d / 2 + s; }
      else if ((s -= f.d) < f.w) { x = f.w / 2 - s; z = f.d / 2; } else { s -= f.w; x = -f.w / 2; z = f.d / 2 - s; }
      // empujar las esquinas hacia la curva
      const cx = Math.max(Math.abs(x) - (f.w / 2 - f.r), 0), cz = Math.max(Math.abs(z) - (f.d / 2 - f.r), 0);
      if (cx > 0 && cz > 0) { const a = Math.atan2(cz, cx); x = Math.sign(x) * (f.w / 2 - f.r + Math.cos(a) * f.r); z = Math.sign(z) * (f.d / 2 - f.r + Math.sin(a) * f.r); }
      const n = Math.hypot(x, z); x += x / n * 0.4; z += z / n * 0.4;
    }
    dummy.position.set(x, f.h + 0.37, z); dummy.updateMatrix();
    gente.setMatrixAt(k, dummy.matrix); gente.setColorAt(k, c.copy(pal[(Math.random() * pal.length) | 0]));
  }
  S.add(gente);

  // ── techo: si se construyó, o si el estadio es enorme ──
  if (techo || cap > 60000) {
    const t = rrect(L + 2 * M + 2 * (offMax + 4), A + 2 * M + 2 * (offMax + 4), radio + offMax * 0.4);
    t.holes.push(rrect(L + 2 * M + 2 * (offMax * 0.45), A + 2 * M + 2 * (offMax * 0.45), radio + offMax * 0.2));
    const gt = new THREE.ExtrudeGeometry(t, { depth: 0.6, bevelEnabled: false, curveSegments: 12 });
    gt.rotateX(-Math.PI / 2);
    const mt = new THREE.Mesh(gt, new THREE.MeshLambertMaterial({ color: 0xdfe6ee, transparent: true, opacity: .55 }));
    mt.position.y = alto + 6; mt.castShadow = true; S.add(mt);
  }
  if (opt.noche) [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
    const sp = new THREE.SpotLight(0xfff6e0, 2.2, 0, Math.PI / 4.2, 0.5, 0);
    sp.position.set(a * (L / 2 + 20), alto + 30, b * (A / 2 + 20)); sp.target.position.set(a * 8, 0, b * 6);
    S.add(sp); S.add(sp.target);
  });
  // ── torres de luz en las esquinas ──
  if (!(techo || cap > 60000)) [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(.5, .8, alto + 22, 6), matHorm);
    tw.position.set(a * (L / 2 + M + offMax * .7), (alto + 22) / 2, b * (A / 2 + M + offMax * .7)); S.add(tw);
    const pan = new THREE.Mesh(new THREE.BoxGeometry(6, 4, .6), new THREE.MeshBasicMaterial({ color: 0xffffee }));
    pan.position.set(tw.position.x, alto + 22, tw.position.z); pan.lookAt(0, 0, 0); S.add(pan);
  });

  // ── los 22 del 11v11 ──
  const jugs = [];
  // camiseta (c1) arriba y pantalón (c2) abajo: el mismo kit que dibuja el 2D
  // ⚠️ El canvas/WebGL no resuelve variables CSS (la misma trampa que GOLD()):
  // el kit de Boca trae c2:'var(--gold)'.
  const cssCol = v => { v = String(v || '#fff'); const m = v.match(/var\((--[\w-]+)\)/);
    return m ? (getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#f59e0b') : v; };
  const ficha = kit0 => { const kit = { c1: cssCol(kit0.c1), c2: cssCol(kit0.c2) }; const gr = new THREE.Group();
    const tor = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 4, 8), new THREE.MeshLambertMaterial({ color: kit.c1 })); tor.position.y = 0.4;
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 8), new THREE.MeshLambertMaterial({ color: kit.c2 })); pie.position.y = -0.45;
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a77a })); cab.position.y = 1.15;
    [tor, pie, cab].forEach(m => { m.castShadow = true; gr.add(m); }); S.add(gr); jugs.push(gr); return gr; };
  const pel = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  pel.castShadow = true; S.add(pel);
  function sync() {
    if (typeof FM === 'undefined' || !FM || !FM.my) return false;
    const toW = p => [((p.x - FM.leftGL) / (FM.rightGL - FM.leftGL) - .5) * L, (p.y / FM.VH - .5) * A];
    if (!jugs.length) { FM.my.forEach(() => ficha(FM.myKit || { c1: col, c2: '#fff' })); FM.opp.forEach(() => ficha(FM.oppKit || { c1: '#fff', c2: '#222' })); }
    FM.my.concat(FM.opp).forEach((p, i) => { const [x, z] = toW(p); jugs[i].position.set(x, 0.85, z); });
    const [bx, bz] = toW(FM.ball); pel.position.set(bx, 0.45 + (FM.ball.air || 0) * 0.08, bz);
    return true;
  }

  const cam = new THREE.PerspectiveCamera(opt.fov || 42, W / H, 0.5, 900);
  const vista = opt.vista || 'tv';
  const ponerCam = t => {
    if (vista === 'tv') { cam.position.set(0, 22, A / 2 + M + 16); cam.lookAt(0, 0, -4); }
    else if (vista === 'aire') { const a = t * .00012 + .7; cam.position.set(Math.cos(a) * (190 + offMax), 95 + alto, Math.sin(a) * (150 + offMax)); cam.lookAt(0, 4, 0); }
    else if (vista === 'arco') { cam.position.set(-L / 2 - 14, 9, 0); cam.lookAt(10, 0, 0); }
  };
  let raf = 0;
  const loop = t => { sync(); ponerCam(t || 0); R.render(S, cam); if (opt.animar) raf = requestAnimationFrame(loop); };
  loop(0);
  return { R, S, cam, render: () => { sync(); R.render(S, cam); }, info: { cap, filas, bandejas, techo, vis, jugadores: jugs.length, colores: [...new Set(jugs.map(g => g.children[0].material.color.getHexString()))] }, stop: () => cancelAnimationFrame(raf) };
}
