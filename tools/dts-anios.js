// Genera dts-anios.js: para cada técnico de la base (dts-db.js + los curados
// de director-tecnico.html), el AÑO DE NACIMIENTO y el ÚLTIMO AÑO EN QUE
// FIGURA COMO JUGADOR en las temporadas históricas de la carpeta.
//
//   node tools/dts-anios.js            → escribe dts-anios.js
//
// Con eso el juego sabe que en 2000 Guardiola jugaba en el Barcelona y no se
// lo puede contratar de técnico (Fase 100). Correlo de nuevo cuando cambien
// las temporadas históricas o la base de DTs.
//
// Homónimos: un nombre puede ser de dos personas (el DT y un pibe que juega
// hoy). Se agrupan las apariciones por año de nacimiento (año − edad) y:
//   · si el DT tiene edad o nacionalidad curada, gana el grupo que coincide;
//   · un grupo que haría al DT menor de 30 en 2026 es un homónimo y se tira;
//   · si quedan dos grupos posibles, NO se anota nada (mejor sin dato que
//     con el dato de otro).
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const DIR=path.resolve(__dirname,'..');
const HOY=2026;

function cargar(file,glob){
  const ctx={window:{}}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR,file),'utf8'),ctx);
  return ctx.window[glob];
}
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();

// ── los técnicos ──
const dts=new Map();   // norm → {name, age, nat}
(cargar('dts-db.js','DTS_DB')||[]).forEach(r=>{
  const k=norm(r[0]); if(!k)return;
  const d=dts.get(k)||{name:r[0]};
  if(r[1]&&!d.age)d.age=r[1]; if(r[2]&&!d.nat)d.nat=r[2];
  dts.set(k,d);
});
const html=fs.readFileSync(path.join(DIR,'director-tecnico.html'),'utf8');
const ini=html.indexOf('const DTS = ['), fin=html.indexOf('\n];',ini);
html.slice(ini,fin).replace(/\{name:'([^']+)',\s*nat:'([^']*)',\s*age:(\d+)/g,(_,n,nat,age)=>{
  const k=norm(n), d=dts.get(k)||{name:n};
  d.age=+age; if(nat)d.nat=nat; dts.set(k,d);
});

// ── las apariciones como jugador ──
const ap=new Map();     // norm → [{y,b,nat}]
const anios=fs.readdirSync(DIR).map(f=>(f.match(/^players-hist-(\d{4})\.js$/)||[])[1]).filter(Boolean).map(Number).sort();
for(const y of anios){
  const ctx={window:{PLAYERS_DB_HIST:{}}}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR,'players-hist-'+y+'.js'),'utf8'),ctx);
  const H=ctx.window.PLAYERS_DB_HIST||{}, rows=H[y]||H[String(y)]||Object.values(H)[0]||[];
  for(const r of rows){
    const k=norm(r[1]); if(!dts.has(k)||!r[3])continue;
    (ap.get(k)||ap.set(k,[]).get(k)).push({y,b:y-r[3],nat:r[4]});
  }
}

// ── se resuelve cada uno ──
const out={}; let conDato=0, ambiguos=0, homonimos=0;
for(const [k,d] of dts){
  const A=ap.get(k); if(!A||!A.length)continue;
  // grupos por año de nacimiento (±1: la edad de TM es al momento de bajar el dato)
  const grupos=[];
  A.sort((a,b)=>a.b-b.b).forEach(a=>{
    // ±2: TM da la edad al día en que se bajó el dato, y en la misma
    // temporada el mismo jugador sale con 31 en un club y 33 en otro.
    const g=grupos.find(g=>Math.abs(g.b-a.b)<=2&&(!g.nat||!a.nat||g.nat===a.nat));
    if(g){ g.l.push(a); } else grupos.push({b:a.b,nat:a.nat,l:[a]});
  });
  let cand=grupos.filter(g=>HOY-g.b>=30);
  if(cand.length<grupos.length) homonimos++;
  // La nacionalidad manda; la edad curada a mano está corrida uno a tres años
  // en varios (Battaglia figura con 43 y nació en 1980), así que va con
  // margen y desempata por cercanía.
  if(d.nat) cand=cand.filter(g=>g.l.some(a=>a.nat===d.nat));
  if(d.age){ const b0=HOY-d.age;
    cand=cand.filter(g=>Math.abs(b0-g.b)<=4)
             .sort((x,y)=>Math.abs(b0-x.b)-Math.abs(b0-y.b)||y.l.length-x.l.length).slice(0,1); }
  if(cand.length!==1){ if(cand.length>1)ambiguos++; continue; }
  const g=cand[0], bs=g.l.map(a=>a.b).sort((a,b)=>a-b);
  out[d.name]=[bs[bs.length>>1], Math.max(...g.l.map(a=>a.y))];
  conDato++;
}

const txt='// Técnicos: [año de nacimiento, último año como jugador en las temporadas históricas]\n'
 +'// Generado por tools/dts-anios.js — NO editar a mano.\n'
 +`// ${conDato} técnicos con dato · ${ambiguos} homónimos sin resolver · temporadas ${anios[0]}-${anios[anios.length-1]}\n`
 +'window.DTS_ANIOS='+JSON.stringify(out).replace(/\],"/g,'],\n"')+';\n';
fs.writeFileSync(path.join(DIR,'dts-anios.js'),txt);
console.log(`técnicos: ${dts.size} · con dato: ${conDato} · ambiguos: ${ambiguos} · con homónimo joven: ${homonimos} · temporadas: ${anios.length}`);
['Pep Guardiola','Diego Simeone','Marcelo Gallardo','Xabi Alonso','Mikel Arteta','Jürgen Klopp','Carlo Ancelotti','Guillermo Barros Schelotto','Fernando Gago','Sebastián Battaglia']
  .forEach(n=>console.log(n.padEnd(28),JSON.stringify(out[n]||null)));
