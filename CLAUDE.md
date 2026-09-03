# DIRECTOR TÉCNICO — contexto del proyecto

Juego de manager de fútbol en un solo archivo. **El usuario es el PRESIDENTE del
club**, no el DT. Es un proyecto personal ("para boludear con amigos"), no
comercial. El usuario habla español rioplatense; respondele en ese registro.

## Archivos

| Archivo | Qué es |
|---|---|
| `director-tecnico.html` | **El juego entero** (~14.000 líneas, HTML+CSS+JS inline) |
| `players-db.js` | Base de jugadores generada por el extractor |
| `dts-db.js` | Base de DTs, **curada a mano** (no pisarla sin fusionar) |
| `extractor.html` | Herramienta para bajar datos de SportDB/Transfermarkt |
| `netlify/functions/sportdb.js` | Proxy (soporta transfermarkt, flashscore, tmapi, tmcoach) |
| `cloudflare-worker/sportdb-cache.js` | Mismo proxy + caché KV. El usuario lo tiene desplegado |

## Formato de `players-db.js`

Las columnas nuevas van **siempre al final** para no romper bases viejas:

```
[num, nombre, pos, edad, nac, club, liga, valorM, pie,
 contratoHasta, alturaCm, pos2, clausulaM, goles, asistencias, partidos, nac2]
```

## Reglas de diseño que el usuario pidió explícitamente

- **Sos el presidente**: los cambios en el partido y el once los decide el DT.
  La ÚNICA excepción es un **DT personalizado** (`G.dt.customProf`), donde el
  usuario controla todo. `dtIsMine()` distingue los dos casos.
- Los **DTs reales** juegan como en la vida real: hay una tabla `REAL` en
  `dtProfile()` con perfiles por nombre (Guardiola, Simeone, Gallardo...).
- **Liga Argentina con formato real**: 30 clubes, 2 zonas de 15, Apertura +
  Clausura, los 8 primeros de cada zona a playoffs (octavos → final), descensos
  por **tabla anual**. Todo en `arBuildZones` / `arBuildTournament` / `arSimPair`.
- **El sorteo de zonas parte los clásicos**: `AR_CLASICOS` (10 parejas) se
  reparte una a cada zona ANTES que el resto, así la fecha interzonal
  (`zone:'INT'`, la última de cada torneo) es la fecha de los clásicos: 10 de
  los 15 partidos. La localía se da vuelta entre Apertura y Clausura. Tu club
  siempre queda etiquetado como Zona A (si le tocó la B se dan vuelta los
  nombres, no los clubes).
- **Extranjeros**: un nacionalizado NO ocupa cupo. `isForeign(nat, nat2)`. El
  cupo se cumple en el ONCE (`autoFill`, `clickSlot`, `doSub`), no en el plantel.
  **Extranjero es respecto de la liga que dirigís**, no siempre de Argentina:
  `LIGA_NAT` da las nacionalidades locales de cada una de las 24 ligas (las
  británicas juntas en la Premier, USA+CAN en la MLS) y `natsLocales()` las
  lee. El cupo también es por liga (`CUPO_LIGA` / `cupoExt()`): 5 en Argentina
  y Brasil, 10 en México, 8 en Arabia, 11 (= sin límite) en Europa. Con el
  `'ARG'` fijo de antes, dirigir al Porto daba 25 extranjeros de 27 y el juego
  te bloqueaba autoFill, los cambios, las compras y los libres. Nacionalizar
  suma la nacionalidad LOCAL (`natLocalPrincipal()`), no siempre ARG.
- **Todo el que entra o sale pasa por un embudo**: `sacarDelPlantel(p,tipo,det)`
  saca, anota el movimiento (`movAnota` → `G.movs`, pestaña Mercado →
  Movimientos) y **rellena el hueco** del once con `taparHueco`. Antes había
  diez lugares que sacaban gente y ninguno rellenaba: te quedabas con 10.
- **Ninguna firma es instantánea**: `firmaProgramar` encola y `firmasTick`
  (diario) cierra 2-5 días después. Ojo con `pagado:true` en los caminos que
  ya descontaron la plata, si no se cobra dos veces.
- **La cláusula de rescisión abre una charla**, no una venta: `G.clausulas` +
  `clausulaAbrir` / `clausulaResolver` (mejorar contrato, hablar del proyecto,
  dejarlo ir). A los dos intentos fallidos se va igual.
- **La pretemporada son fechas del calendario** (`PRE_SEMANAS=3`): la liga
  arranca en la semana 4 y los amistosos son partidos de verdad, de local y de
  visitante. Si tocás esto acordate de `otherLeagueTable`, que descuenta las
  mismas semanas.
- **El DT se adapta**: `weeklyDtPlan` revisa cada 6 fechas; con menos de 1,2
  pts/partido cambia primero el esquema y después el arquetipo (`ARQ_SIN_GOL` /
  `ARQ_LE_HACEN`). Tu DT propio no se toca.
- **La reputación se gana**: toda suba pasa por `repSuma(d)`, que la frena
  cuanto más alto estás (×0,38 arriba de 78, ×0,12 arriba de 92); las bajas NO
  se frenan. Antes cada victoria daba +1 plano y la rep llegaba a 100 en la
  primera temporada y no se movía más, lo que rompía el objetivo de la
  dirigencia, la plata de TV y las ofertas de otros clubes. Medido en 8
  temporadas: ahora hace 77 → 93 → 86 → 88.
- **Los socios son un stock, no un % del estadio**: `updateFans` los acerca de a
  8% por partido a un objetivo que sale de la REPUTACIÓN y puede ser 4-5 veces
  la capacidad (Boca ~220-250k). El arranque lo da `sociosBase()`, la misma
  cuenta, así que no hay salto. Si tocás esto, ojo con el divisor de `socInc`
  (42.000) en el balance mensual.
- **Un club grande cuesta caro**: los gastos operativos suman `_estructura`
  (reputación + masa societaria). Sin eso el club ganaba +18 a +30M netos TODAS
  las temporadas y el presupuesto iba de 29 a 167M en ocho años.
- **Quedar en zona de descenso es el fin del ciclo**: tu club no baja de
  categoría (no hay Primera Nacional), pero `checkFired` te pide la renuncia si
  terminás en los puestos que descienden. Antes sólo te echaban saliendo último.
- **En la Liga ARG la tabla anual NO da título**: los campeones son el Apertura
  y el Clausura, que ya van a `G.trophies`. `archiveSeason` guarda
  `champion:false` y `anual1:true` para no contar doble. Usá `titulosLiga()`
  para contar ligas ganadas, nunca `history.filter(h=>h.champion)`.
- **La planilla del partido simulado sale del partido**: posesión, remates, al
  arco, pases, córners y faltas se calculan en `applyMatchResult` desde `G._S`
  (lo que dejó `matchStrengths`) y el perfil del DT. Antes era todo
  `Math.random()` + el marcador. Medianas medidas: posesión 62% con un DT de
  posesión y 42% con uno de contragolpe, 683 vs 386 pases, 9 vs 14,5 faltas.
  Las amarillas son las de verdad (las que cuenta `cards()` para la quinta),
  no un número aparte.
- **Reconvertir a un jugador le cambia el puesto PRINCIPAL** (`weeklyReconv`):
  el viejo queda como `pos2`.
- **Las instrucciones del banco (`TAC_INSTR`) pisan el perfil** vía
  `tacProfOverride` dentro de `dtProfile`, y sólo con DT propio.
- **Copas internacionales**: Libertadores y Sudamericana comparten motor
  (`INT_COPAS`, `intProximaRonda`, `genIntKO`): grupos → octavos → cuartos →
  semis → final, **una ronda sorteada por vez**. Ganar la Libertadores habilita
  Recopa y Mundial de Clubes al año siguiente (`armarRecopa`,
  `armarMundialClubes`, `resolveCopaCorta`).
- **El grupo de copa es un grupo de verdad**: 4 clubes, 6 fechas, ida y vuelta.
  Tus 6 partidos van a `G.calendar`; los otros 6 (rival vs rival) viven en
  `G.intGrp.fix` y los juega `intGrpPlay(fecha)` desde `simMatch` apenas jugás
  el tuyo, así los cuatro van siempre con los mismos PJ. La tabla sale de
  `intGrpTabla()` (nunca de una fórmula) y **clasifican los dos primeros**.
  Armado en `intBuildGroup` / `intGroupFixture`; la fuerza de cada rival sale
  del bombo (`INT_POW`). `intSimGoals` usa un multiplicador más suave que
  `arSimPair` (1.9 vs 3.2): con el de la liga el grupo terminaba 21:1.
- **Cada club de afuera vale lo que vale** (`INT_RAT` / `intRatDe`). Antes
  `matchStrengths` le ponía 73 fijo a toda la Libertadores y era imposible
  ganarla: 12 temporadas sin llegar ni a una semi. Salir primero del grupo
  ahora te da un cruce más flojo en octavos.
- **Tácticas de los DTs**: 14 arquetipos (`ARQ`) asignados por
  `ARQ_DT` (a mano, ~100 nombres) → `ARQ_LIGA` (default por escuela) →
  hash. La tabla `REAL` de `dtProfile()` pisa al arquetipo. La formación sale
  del arquetipo (`ARQ[k].forms`).
- La **arenga** solo aparece en partidos importantes (`isBigMatch`).
- **Sin relato** jugada a jugada: simular va directo al resumen.
- **Se puede dirigir en cualquiera de las 24 ligas** de la base, no sólo la
  argentina: `_LIGA_ELEGIDA` (global, porque `buildCal`/`buildSquad` corren
  dentro del literal que crea `G`), `G.miLiga`, `ligaComp()`, `esLigaLocal()`,
  `clubesDeLiga()` y `buildCalOtra()` (todos contra todos, ida y vuelta).
  El formato de zonas + Apertura/Clausura y las copas sudamericanas son sólo
  para `Liga ARG`.
- ⚠️ **La IA no modela cansancio** (`arSimPair` mira sólo `clubPower`), así que
  la condición física castiga únicamente al jugador. Si tocás el descanso
  semanal (`_descanso`, hoy 13) movés la dificultad de todo el juego: con 20 el
  jugador ganaba 12 ligas de 12 y el 67% de las Libertadores.
- ⚠️ **En el 11v11, casi nada se arregla subiendo la probabilidad**: lo que ata
  centros, córners y gambetas es la GEOMETRÍA (cuántos ticks hay alguien con la
  pelota en esa situación), no el dado. Antes de tocar un número, medí cuántos
  ticks se da la condición. Hay tres intentos fallidos documentados en el código
  con sus números para no repetirlos.
- **Medí con MEDIANAS, no con promedios**: una tanda de 12 partidos con el mismo
  código da entre 1,6 y 4,7 goles de media. Un solo partido que se dispara mueve
  el promedio entero. `scratchpad/m11.js` ya saca medianas.
- **`autoFill` llena primero los puestos con menos candidatos**. En orden de
  dibujo, un plantel desbalanceado terminaba con un extremo de MCD (castigo 25)
  y el tope de `posMod` (−11%) hundía al equipo.

## Módulos de gestión (los que hacen que la carrera importe)

- **Mercado por prestigio real**: `clubRank()` calcula el nivel de los 551
  clubes de la base desde el valor de sus 15 mejores, en log (PSG 93, Porto
  84, River 75, mediana 63). `pickBuyer(rat)` elige comprador en la ventana
  R−6..R+3 con peso hacia los grandes, y `pickLoanClub(rat)` en R−14..R−3.
  Medido: un OVR 90 recibe ofertas de PSG/Barcelona/Real Madrid/City; un 64,
  de clubes de nivel 60-67. Antes era `opts[random]` sobre 22 nombres a mano
  (con 'Sevilla', que ni existe en la base). Ojo: tu plantel vive en
  `G.squad`, no en `G.market`, y `clubRank` lo inyecta a mano.
- **La obligación de compra se gana jugando**: `G.loaned[].obligApps` es el
  objetivo de partidos; el cedido los va sumando semana a semana según su
  nivel contra el del club que lo pidió, y la compra se ejecuta al vencer la
  cesión sólo si llegó. Antes se cobraba TODO al firmar: era una venta
  disfrazada. Simétrico para los préstamos entrantes (`p.loanObligApps` +
  `p.loanApps0`, que hay que restar porque `p.apps` es de toda la carrera).
- **Precio de entradas**: slider continuo 0.50-2.00 (`setTicket`).
  `ticketTolerancia()` dice hasta dónde banca la gente según los puntos por
  partido y la reputación; `weeklyTicket()` erosiona el humor cada semana que
  estés por encima. `sponsorMood()` ata los sponsors al humor y a la
  asistencia. Medido a 20 fechas: caro + perdiendo lleva el humor de 37 a 2 y
  los sponsors a ×0.69, y el borderó da **menos** plata (7.4M) que a precio
  normal (16.3M).
- **Elecciones cada 4 temporadas** (`ELECCION_CADA`, `proximaEleccion`,
  `correrEleccion` dentro de `nextSeason`, después de `checkFired`).
  `votoEstimado()` pesa el humor de la hinchada tres veces más que la
  confianza de la CD: **el que vota es el socio**. Medido: gestión normal 56%,
  desastre 16%, y ganar títulos con la hinchada furiosa 50% (perdés).
- **Dilemas** (`DILEMAS`, `weeklyDilema`, `dilemaResolver`): 6 escenarios con
  2-3 salidas que mueven confianza, humor, `dtRel`, vestuario y plata. Llegan
  al celular con botones. ⚠️ Las funciones `fx` viven en `_DIL_FX`, **fuera de
  `G`**, porque no se pueden serializar al guardar; si recargás con un dilema
  abierto se reconstruyen desde `DILEMAS` por su `did`.
- **La táctica llega al 2D**: `FM.mentality` salía SIEMPRE en 1 y sólo la
  movía el botón dentro del partido — todo el sistema de `push` por línea
  (`FM_MENTS` 0.55/1.0/1.5) estaba ahí apagado. Ahora sale de
  `G.tactic.mentality`, y si el DT no es tuyo, de su perfil. `sitMent()` hace
  lo mismo en las jugadas clave: acompañantes en el ataque (2.5 / 2.4 / 1.8),
  desde dónde salen, dónde espera el bloque defensivo y cuántos suben al
  córner (4 / 3 / 2). `cornerRunners(n)` ahora recibe el cupo: estaba fijo en
  3 y uno es el pateador, así que al área llegaban siempre 2 exactos.
  Además `baseShift` corre la línea base del bloque (defensa ±7%, medio ±6%,
  ataque ±3% del largo de la cancha): `push` sólo multiplicaba el término que
  depende de dónde está la pelota, y ese se anula con la pelota en el medio.

⚠️ **El efecto del bloque en el 11v11 NO se puede medir con pocos partidos.**
Medí la posición del bloque condicionada a la pelota, 3 partidos por táctica:
una corrida dio Defensivo 41,3% contra Equilibrado 45,5%, y la siguiente —con
el MISMO código en esa rama— dio 48,3%. La varianza entre partidos (±4 puntos)
es del tamaño del efecto buscado. El mecanismo sí está verificado y es
determinista (`scratchpad/shift.js`), pero **el efecto emergente sobre el
bloque quedó sin demostrar**. Hay un intento fallido documentado en el código
(empuje asimétrico 0.26/0.115, que borró el repliegue). Si vas a tocar esto:
10+ partidos por táctica, o no lo toques.
- **Fricción de la pelota** en las jugadas clave: era una constante (.990 /
  .998) y la pelota rodaba eterna. Ahora distingue aire, rodada fuerte, media
  y lenta, y se detiene de verdad por debajo de 0.035 — el mismo modelo que
  ya usaba el 11v11.

## Sistema de diseño — Tactical Dark Glassmorphism

Los tokens viven en `:root` y **el acento lo pisa `applyTheme()` al arrancar**,
así que un color de acento nuevo va en `UI_THEMES`, no en el `:root`.

| token | valor | qué es |
|---|---|---|
| `--dark` | `#0b0e14` | fondo maestro, **igual para todos los clubes** |
| `--card` / `--card-2` | `rgba(18,24,38,.75)` / `.85` | superficies de vidrio |
| `--blur` | `blur(14px) saturate(1.25)` | el vidrio |
| `--green` | `#10b981` | verde neón |
| `--gold` | `#f59e0b` | oro metálico (cambia por club) |
| `--gold-rgb` | `245,158,11` | el mismo, para los `rgba()` del CSS |
| `--sh-deep` / `--sh-lift` | — | sombra en reposo / en hover |

- **Tipografías**: `Plus Jakarta Sans` para cuerpo y tablas, `Chakra Petch`
  para todo dato numérico (`.rb .pv .sv .vc .ac .sv-n`, con `tabular-nums` para
  que las columnas no bailen), `Rajdhani` para títulos y navegación.
- ⚠️ **El canvas no resuelve variables CSS**: un `fillStyle='var(--gold)'` sale
  negro. Para la cancha, las jugadas clave y el 11v11 están `GOLD()` y
  `GOLDA(alpha)`, que leen el valor computado. Si agregás un dibujo con el
  color de acento, usá esas dos.
- **El fondo maestro NO cambia por club**, sólo el acento. Antes cada club
  traía su propio negro (River bordó, Independiente rojo oscuro) y la pantalla
  cambiaba de identidad entera.
- El aviso (`.flash`) va **abajo y al centro**: estaba en `top:14px` con
  `z-index:300` sobre un topbar de `z-index:100`, así que tapaba el nombre del
  club, el presupuesto y la semana justo cuando pasaba algo importante.
- Medido: el `backdrop-filter` cuesta entre −3,6 ms y +2,6 ms por pestaña
  (nada). Los 128 ms del Mercado son del HTML de la lista, no del vidrio.
- Contraste: todo el texto pasa AA salvo tres falsos positivos del medidor
  (texto oscuro sobre el botón dorado, que da 9,6:1). `--t3` se subió de
  `#6b7686` a `#7c8798` porque daba 4,20 contra el mínimo de 4,5.

## Sistemas principales (dónde tocar)

- **Simulación rápida**: `simMatch` + `matchStrengths` + `applyMatchResult`
- **Simulación 11v11 que se mira**: `FM` global, `fmAI` / `fmTick` / `fmMove`
- **Jugadas clave jugables**: `SIT` global. Penal, tiro libre y centro usan una
  proyección pseudo-3D (`proj(wx, wz, wy)`); ataque y defensa son cenitales.
- **Mercado con tiempos reales**: `G.negs`, `negStartPlayer` → `negOpenClub` →
  `weeklyNegotiations`. Hay precontratos, libres y competencia de otros clubes.
- **Relación con el DT**: `G.dtRel` (0-100), `setDtRel`, `dtAskList` (pedidos del
  presidente al DT, que puede retrucar).

⚠️ **Ojo con los nombres — `dtDemands` ≠ `dtAskList`**. Van en direcciones
opuestas y ya hubo una colisión por esto:

| | `dtDemands(d)` | `dtAskList()` |
|---|---|---|
| dirección | **DT → presidente** | **presidente → DT** |
| qué es | lo que el técnico exige al FIRMAR | los pedidos que vos le hacés |
| argumentos | recibe un DT (`d`) | ninguno (lee `G.dt`, `G.squad`) |
| devuelve | array de **strings** | array de **objetos** `{id,label,desc,resist,argue,apply}` |
| dónde se usa | `dtNegOpen` / `confirmDtHire` | la charla con el técnico (3 call sites) |
| dónde queda | `G.dt.contract.demands`, no se toca más | se aplica y el DT puede retrucar |

Si tocás la relación con el técnico es `dtAskList`; si tocás la firma del
contrato es `dtDemands`. La regresión (`scratchpad/reg.js`) verifica que sigan
separadas: aridad, tipo de retorno y que `dtAskList` devuelva objetos con
`apply`.

## Cómo probar (Playwright)

```js
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
await page.goto('file://' + path.resolve('director-tecnico.html'),
                { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { startGame('boca'); autoFill(); });
```

- Usar `startGame('boca')` (NO `initGame`) + `autoFill()`
- `G`, `FM`, `SIT` son globales (no `window.FM`)
- `fmInit` corre dentro de un `requestAnimationFrame`: esperá ~1s antes de leer `FM`
- Verificar sintaxis extrayendo los bloques `<script>` y corriendo `node --check`

**Siempre correr la regresión antes de commitear**: las 6 jugadas clave, una
temporada completa (450 fixtures) y el ciclo de fichaje.

## ⚠️ El extractor puede perder clubes en silencio

Un club cuyo `/clubs/{id}/players` falla se salteaba con un `✗ Sin datos`
perdido entre cientos de líneas y **desaparecía de la base sin que nadie se
enterara**. Así se perdieron 12 clubes entre dos extracciones —Santos, Porto,
Emelec, Coventry, Modena, Paris FC, Rostov, Puebla, Botafogo-SP, Atl. Rafaela,
Real Oruro y Volos— desperdigados por 11 ligas: el patrón de fallos pasajeros.

Ya está arreglado: `apiGet` reintenta ante **cualquier** error (antes sólo
429/503) y ante cortes de red, cada club tiene una segunda oportunidad con
pausa larga, y al final la corrida **lista por nombre** los que quedaron sin
plantel más un conteo de clubes por liga. Si ves una liga con menos clubes de
los que debería, volvé a correr esa liga.

Para comparar dos versiones de la base y ver qué se perdió:
```js
// clubes que estaban en la base vieja y ya no están en la nueva
const clubes=DB=>{const m={};DB.forEach(r=>m[r[6]+'|'+r[5]]=1);return m;};
Object.keys(clubes(viejo)).filter(k=>!clubes(nuevo)[k]);
```

## ⚠️ La segunda nacionalidad decide el cupo: no se inventa

`nat2FromProfile` sacaba el segundo país de un regex sobre texto libre
(`"from <País1> <País2>"`). Con un país de DOS palabras partía el único país
del jugador y guardaba la mitad como si fuera otra nacionalidad:

| descripción real | nat / nat2 guardados | casos |
|---|---|---|
| `from United States` | `USA` + `STA` | 167 |
| `from Saudi Arabia` | `ARB` + `ARA` | 293 |
| `from Costa Rica` | `CRC` + `RIC` | 6 |
| — (ni país era) | `* ` + `RET` | 487 |

Eran **1.069 nat2 basura**, ya borrados de la base. No daban cupo de más (un
código inventado nunca coincide con la nacionalidad local) pero tapaban la
segunda nacionalidad de verdad. Ya está arreglado: `nat2FromProfile` sólo
acepta la LISTA estructurada de nacionalidades del perfil (nunca el texto
libre), `mapNat(nat, true)` devuelve `''` en vez de inventar un código con
`slice(0,3)`, y se descarta el nat2 igual al nat1.

El mismo `slice(0,3)` había roto **nat1**: 327 turcos quedaron como `TÜR`
(el mapa sólo conocía `turkey`/`türkei`, no `Türkiye`) y 87 marfileños como
`COT`. Dirigiendo en Turquía, los 327 turcos contaban como extranjeros. Los
alias que faltaban están agregados y la base normalizada (475 nat1 + 141 nat2).

Quedan **3.608 segundas nacionalidades válidas**, de las cuales 2.375 liberan
cupo en alguna liga.

## El juego NO pide nada por red

`director-tecnico.html` no tiene un solo `fetch` ni `XMLHttpRequest`: la base
entra por `<script src="players-db.js">` y `<script src="dts-db.js">`, ambos
locales y con `onerror` que deja el array vacío. **Ojo: tienen que ser `.js`
con `window.PLAYERS_DB=[...]`, no `.json`** — un `fetch` de JSON no funciona
abriendo el archivo con `file://` (CORS), y el usuario juega así. El extractor
es una herramienta aparte que se corre a mano para regenerar la base; el juego
nunca lo llama. La regresión verifica que no se abra ninguna conexión.

## Estado del extractor (julio 2026)

| Fuente | Estado |
|---|---|
| SportDB `/clubs/{id}/players` | ✅ planteles, valores, altura, pie |
| SportDB `/players/{id}/profile` | ✅ **nacionalidad** (viene en `description`: "from Colombia") |
| `tmapi` (transfermarkt-api.fly.dev) | ❌ caída, 500 en todo |
| `tmcoach` (web de Transfermarkt) | ✅ DT desde `/mitarbeiter/verein/{id}` |

La nacionalidad cuesta **1 crédito por jugador**, por eso está detrás de un
checkbox aparte (`deepNats`). El Worker la cachea 30 días.

Los DTs salían **sólo** dentro del bucle que baja plantel por plantel, así que
actualizar los técnicos obligaba a rebajar todos los jugadores (y a pagar los
créditos). La búsqueda de clubes se extrajo a `clubsDeLiga(lg, li)` y ahora hay
un botón **"3b. Extraer SÓLO los DTs"** (`extractAll(true)` → `extractDTsOnly`)
que llega a la lista de clubes por standings —gratis, pocos pedidos— y hace UNA
consulta `tmcoach` por club. Medido con proxy simulado: 5 pedidos y 0 planteles
contra 12 pedidos del modo normal.

⚠️ El diagnóstico (`testExtras`) consultaba `tmapi` una vez **por club** aunque
ya supiera que está caída, y su `ERROR 500 en /clubs/189/players` no decía de
qué fuente venía — parecía que fallaban los planteles cuando lo que fallaba era
la API libre. Ahora la caída se late una sola vez (`tmapiDown`) y el error
nombra la fuente. La sonda `probeNats` también reconoce las rutas que **ya**
están cableadas (`YA_CONECTADAS`) en vez de pedir que se las pasen.

## Deploy

Rama `claude/stoic-euler-7hUcb` → commit → push → ff-merge a `main` → push.
Netlify publica `main` en stately-elf-897da3.netlify.app.

## Cómo trabaja bien este proyecto

- Confirmá los bugs **midiendo**, no leyendo: el usuario reporta síntomas reales
  y varias veces la causa no fue la obvia.
- Si algo no se puede verificar (red bloqueada, API caída), **decilo** en vez de
  afirmar que funciona.
- Los mensajes de commit van en inglés; las respuestas al usuario, en español.
