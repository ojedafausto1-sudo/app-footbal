# DIRECTOR TÉCNICO — contexto del proyecto

Juego de manager de fútbol en un solo archivo. **El usuario es el PRESIDENTE del
club**, no el DT. Es un proyecto personal ("para boludear con amigos"), no
comercial. El usuario habla español rioplatense; respondele en ese registro.

## Archivos

| Archivo | Qué es |
|---|---|
| `director-tecnico.html` | **El juego entero** (~14.000 líneas, HTML+CSS+JS inline) |
| `players-db.js` | Base de jugadores generada por el extractor |
| `players-hist-AÑO.js` | Planteles de una temporada vieja. **Opcional**: el que esté en la carpeta aparece solo en el selector (Fase 39) |
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
  El **cartel** de la pestaña Plantel tenía el `/5` escrito a mano: el Real
  Madrid mostraba "15/5" en rojo con un cupo real de 11 y Chivas "0/5" con 10.
  Ahora sale de `cupoExt()`, dice "sin cupo" donde no hay límite, muestra
  Mercosur sólo en las ligas sudamericanas (es una regla argentina) y cuenta
  los nacionalizados que están liberando lugar.
- **Todo el que entra o sale pasa por un embudo**: `sacarDelPlantel(p,tipo,det)`
  saca, anota el movimiento (`movAnota` → `G.movs`, pestaña Mercado →
  Movimientos) y **rellena el hueco** del once con `taparHueco`. Antes había
  diez lugares que sacaban gente y ninguno rellenaba: te quedabas con 10.
- **Ninguna firma es instantánea**: `firmaProgramar` encola y `firmasTick`
  (diario) cierra 2-5 días después. Ojo con `pagado:true` en los caminos que
  ya descontaron la plata, si no se cobra dos veces.
- **Rechazar una oferta grande tiene precio**: en `rejOff`, si el club que
  ofertó es un salto de carrera (`ofertaEsSalto`: liga top Y +1,5 de
  prestigio sobre el tuyo, o +6 de cualquier liga) y el jugador pasa de 78,
  hay 60% de que se rebele — moral a 10, `wantsOut`, `dtRel` −20 y un mensaje
  furioso al celular. Medido: 54-62% con un grande, **0% con un club de tu
  liga y 0% con un jugador de 75**. `wantsOut` ya bajaba el valor y la chance
  de retenerlo; ahora además **resta 0,55 al `rf` de `weeklyTraining`**, así
  que el rebelde rinde ~0,6 menos y, como `rf` alimenta `badSpell`, se oxida
  si lo dejás pudrir en el plantel.
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
  categoría, pero `checkFired` te pide la renuncia si terminás en los puestos
  que descienden. Antes sólo te echaban saliendo último.
  ⚠️ Desde la Fase 38 la **Primera Nacional sí se puede dirigir**, pero es una
  liga que se ELIGE al empezar: no hay ascenso ni descenso entre las dos
  todavía. Descender sigue siendo el final del ciclo, no un cambio de
  categoría.
- **En la Liga ARG la tabla anual NO da título**: los campeones son el Apertura
  y el Clausura, que ya van a `G.trophies`. `archiveSeason` guarda
  `champion:false` y `anual1:true` para no contar doble. Usá `titulosLiga()`
  para contar ligas ganadas, nunca `history.filter(h=>h.champion)`.
- **El partido simulado se juega en DOS TIEMPOS** y la defensa se cae al
  final: `matchStrengths` calcula `defFit` (energía de la línea de fondo, no
  del equipo entero) y `defCansada` (0 arriba del 70%, hasta 1 en 40). El xG
  se reparte 45/55 y el del rival se multiplica por `(1+defCansada*0.45)` sólo
  en el segundo tiempo. Medido con 5000 sorteos por escenario: la relación
  goles 2T/1T va de **1,20× con la defensa entera a 1,81× con la defensa en
  30%**, y cuesta **0,27 puntos por partido** (≈10 en una temporada). Arriba
  del 70% el efecto es exactamente cero. `G._tiempos` guarda el desglose para
  el resumen, que ahora muestra el marcador por tiempo y avisa si te fundiste.
  ⚠️ Esto NO se puede medir con 50 partidos: con ~13 goles por mitad la
  varianza de Poisson (±28%) se come el efecto. Medí el modelo aislado.
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
- **Autoridad del presidente** (`G.autoridad`, 0-100, arranca en 50, se lee
  siempre con `autoridad()`): sube al multar, al plantarte ante la barra y al
  imponerle una decisión al DT; baja al proteger a un jugador, al ceder y al
  arreglar con la barra. **No es decorativa**: con 90 el técnico te acepta un
  pedido el 87% de las veces y con 10 el 63%, y el plantel se manda 6,2
  indisciplinas por temporada con autoridad alta contra 9,8 con el vestuario
  perdido. Suma hasta ±3 puntos al voto de la elección.
- **La indisciplina es MENSUAL y va aparte de `DILEMAS`**
  (`weeklyIndisciplina`, cada 4 semanas): 7 macanas distintas, el jugador sale
  sorteado con peso por rating y moral baja, y hay dos salidas — **multar**
  (moral −20, autoridad +7, CD +4, entra la multa) o **proteger** (moral +12,
  autoridad −9, CD −5, humor −4). Metido en el pool general aparecía en el 13%
  de las temporadas; ahora cae ~8 veces al año. Su `fx` se reconstruye desde
  `d.pid` en `dilemaFx`, porque no está en `DILEMAS`.
- **Elecciones cada 4 temporadas** (`ELECCION_CADA`, `proximaEleccion`,
  `correrEleccion` dentro de `nextSeason`, después de `checkFired`).
  `votoEstimado()` pesa el humor de la hinchada tres veces más que la
  confianza de la CD: **el que vota es el socio**. Medido: gestión normal 56%,
  desastre 16%, y ganar títulos con la hinchada furiosa 50% (perdés).
  ⚠️ Encima del voto hay un **piso duro**: si `(boardConf+fanMood)/2 < 45`
  perdés la elección **siempre**, tengas los títulos que tengas (la autoridad
  arriba de 50 te da hasta 4 puntos de gracia). Sin ese piso, `votoEstimado`
  dejaba ganar con la comisión en 20 y la hinchada en 60 (52%), y con ambos en
  44 pero tres títulos en la vitrina (67%). Verificado en 10 escenarios.
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

### ⚠️ El 11v11 está sano salvo UNA cosa: la pelota nunca sale de la cancha

Medido sobre 8 partidos (`scratchpad/ia11.js`), normalizado a 90 minutos:

| | medido | fútbol real | |
|---|---|---|---|
| goles | 3,3 | 2,5-3,0 | ✅ |
| remates | 17,5 | 22-26 | ✅ |
| al arco | 8,7 | 8-9 | ✅ |
| faltas | 22,4 | 20-24 | ✅ |
| pases | 691 | 800-900 | ✅ |
| **córners** | **2,7** | **9-11** | ❌ |

Y la geometría (`scratchpad/corner.js`), que explica el por qué:

| saque | medido /90' | real |
|---|---|---|
| córner | 2,3 | 9-11 |
| **saque de arco** | **0** | 14-18 |
| **lateral** | **2,3** | 40-50 |
| tiro libre | 30,9 | 20-25 |

**La pelota cruza la línea de fondo 2,3 veces por partido; en la realidad son
~25.** No es que falten córners: es que **la pelota no sale nunca**. Está a
menos de 60px de una banda el **2,3% del tiempo** y a menos de 20px el
**0,37%**, aunque el ancho de cancha se usa entero (la pelota recorre y=15 a
1592 sobre 1600, y los jugadores 8 a 1586). Los pases de la IA siempre
encuentran compañero y nada se va afuera: la única interrupción que existe es
la falta, y por eso los tiros libres están inflados (30,9 contra 20-25).

**Arreglado a medias.** Se agregaron las tres fuentes de salida que faltaban:

1. **`fmMandarALaBanda(team)`** — el defensor que roba FUERA del área con un
   rival encima y en campo propio la revienta a la tribuna (34%). El quite
   dentro del área ya iba al córner; fuera del área siempre terminaba en pelota
   jugada, y de ahí venía la ausencia total de laterales.
2. **El portador apretado** en campo propio la tira afuera (3% por tick).
3. **El centro pasado de largo** (26% de los centros) se va por el fondo.

Medido con el mismo método antes y después (10 partidos, **agregado**):

| saque | antes | después | real |
|---|---|---|---|
| lateral | 3,6 | **8,6** | 40-50 |
| córner | 2,4 | **4,3** | 9-11 |
| tiro libre | 36,9 | 38,5 | 20-25 |
| saque de arco | 0,7 | 0,3 | 14-18 |

Y el partido sigue sano: pases 710 (antes 691), remates 22,1 (antes 17,5, ahora
en rango real), faltas 25,5.

⚠️ **Cada salida cuesta juego.** Medido con la rama del portador apretado en
0.055: los pases caían de 691 a **560** y los goles de 3,3 a **2,1**. A 0.030
el compromiso queda parejo. Si querés más laterales, ese es el número, pero
mirá siempre los pases y los goles.

⚠️ **NO subas las probabilidades a ojo.** Se probó (0.34→0.52 y 0.055→0.115) y
salió PEOR: laterales 15,6 → 12,9 y córners 4,0 → 2,8. Otra vez lo mismo que
dice la regla de arriba.

### El que arregló los laterales fue la guarda del aire, no las probabilidades

**La línea de banda es vertical.** El chequeo del lateral tenía una guarda,
`if(b.air>2){b.y=borde;return;}`: la pelota que cruzaba la banda **por el aire
no salía**, se clavaba contra el borde y volvía a la cancha. La línea de FONDO
nunca tuvo esa guarda — por eso el centro pasado sí volaba afuera, y por eso
`fmMandarALaBanda` tenía que ir rasante, que es justamente lo que hacía que la
enganchara cualquiera antes de cruzar.

Medido con la guarda puesta: **`fmMandarALaBanda` se disparaba 30,6 veces por
90' y salían 6,5 laterales — el 21% de efectividad.** Sacada la guarda, el
despeje va por arriba (cubriendo el trayecto, misma cuenta que
`fmMandarAfuera`) y sale casi siempre.

Y como ahora hay ~20 laterales por partido, `SETPIECE_T.throw` bajó de **80 a
45 ticks**: con 80 se congelaba más del 10% del partido en saques de banda. El
lateral es la reanudación más rápida del fútbol.

### Fase 13: error de pase angular, despejes de emergencia y desvíos

Tres mecanismos nuevos, todos con matemática nativa (`Math.cos`/`Math.sin`) y
sin tocar `fmMandarAfuera`:

1. **Error de pase angular** (`fmTeamPass`) — antes el error era un
   desplazamiento **lateral** sumado al vector ya armado, y como la fuerza del
   pase crece con la distancia, el desvío relativo salía igual de chico en un
   pase de 600px que en uno de 200. Ahora se **rota** el vector: el cono se
   abre con la distancia y con la presión rival (suma ponderada de los rivales
   a menos de 150px del pasador) y se cierra con el `PAS`.
2. **Despeje de emergencia** (`fmDespejeEmergencia` + `fmSinSalida`) — rodeado
   (2+ rivales a 112px) **en el propio tercio** y sin línea de pase, revienta:
   55% a la banda, 45% pelotazo al campo rival. `fmSinSalida` es el filtro que
   lo distingue de "estoy apretado": si hay un compañero a 150-460px sin nadie
   encima y con la línea limpia, el pase existe y se juega.
3. **Desvíos en el cuerpo** (`fmBodyBall`) — una pelota a más de 4,6 de
   velocidad que toca a alguien **que no es su destinatario** no se domina: se
   rota el vector y pierde fuerza. La guarda del destinatario
   (`p._recvTick` reciente) es obligatoria: sin ella la IA no completa un pase
   largo nunca.

Los tres coeficientes viven en **`FM13`** (`conoPase`, `desvio`, `despeje`),
fuera de las funciones y mutables, para poder hacer **ablación medida**
(`scratchpad/abl13.js`). Ablación a 6 partidos por escenario:

| escenario | pases | remates | laterales | córners |
|---|---|---|---|---|
| todo apagado | 557 | 19,8 | **21,3** | 2,2 |
| sólo cono de pase | 483 | 24,7 | 19,8 | 2,3 |
| sólo desvíos | 518 | 17,0 | 19,2 | 2,6 |
| sólo despeje emerg. | 587 | 19,5 | 22,1 | 2,5 |
| los tres al 100% | 557 | **13,0** | 19,6 | 1,4 |
| **los tres al 50%** | **589** | **25,3** | 19,2 | 2,1 |

⚠️ **Los tres mecanismos NO aportan laterales por sí solos** — "todo apagado"
ya da 21,3. Lo que compró los laterales fue la guarda del aire. Al 100% los
tres juntos hunden los remates a 13; a 0.50 quedan en 25,3 y los pases en el
máximo de los seis escenarios. Por eso `FM13` va en **0.50 / 0.50 / 0.115**.

Estado final, 12 partidos agregados, contra el estado anterior:

| | antes | ahora | real |
|---|---|---|---|
| lateral | 8,6 | **23,3** | 40-50 |
| tiro libre | 38,5 | **25,5** | 20-25 |
| faltas | 25,5 | **21,4** | 20-24 |
| goles | 1,7 | 2,4 | 2,5-3,0 |
| córner | 4,3 | **1,8** | 9-11 |
| saque de arco | 0,3 | 0,3 | 14-18 |
| pases | 710 | **558** | 800-900 |
| remates | 22,1 | 18,6 | 22-26 |

⚠️ **Los córners bajaron y es el precio, no un bug suelto.** Con la guarda
puesta, la pelota alta que se iba por la banda rebotaba contra el borde y
volvía a la cancha, muchas veces cerca del área, y algunas terminaban cruzando
la línea de fondo. Ahora sale por lateral. Se intentó recuperarlos abriendo el
cono del desvío hasta 2,0 rad **sólo dentro del área propia** (un rebote contra
una pierna a dos metros del arco sale para cualquier lado): medido a 12
partidos, córners 1,8 → 2,3 —ruido— y los pases se caían de 558 a 479.
**Revertido.** Es el cuarto intento fallido de comprar córners con un
parámetro; lo que falta es juego de área, no un número.

⚠️ **Sigue lejos de lo real y estas son las razones medidas:**
- Los **saques de arco no se movieron** (0,3 contra 14-18) porque el centro
  pasado casi no se ejecuta: hay ~1 centro por partido contra los 16-20 reales
  (bug ya documentado y sin resolver). Con 1 centro y 26% de pasados, son 0,26
  saques.
- Los ~9 **remates desviados** por partido deberían dar ~9 saques de arco y no
  llegan a cruzar la línea. Ese es el hilo con más rendimiento que queda.
- La rama `cBody` (despeje en el área → córner) se dispara **0 veces en 994
  minutos**: los centros llegan con `air>13` y nadie los toca, y las pelotas
  rápidas hacia el arco son `b.isShot` y se resuelven en la rama de bloqueo.

⚠️ **Medí AGREGADO, no la mediana por partido.** Un partido tiene 1-3 córners:
la mediana de eso salta entre corridas más que cualquier cambio de código
(medido: 8,8 / 15,6 / 12,9 / 7,6 laterales en corridas del mismo tipo). Sumando
todos los eventos sobre todos los minutos hay diez veces más señal.
`scratchpad/corner.js` ya lo hace así.

⚠️ **Lo demás del pedido de "reescribir la IA" ya está y medido**, algunas
cosas en dirección contraria a lo que parece intuitivo:
- **Amontonamiento**: ya hay repulsión tipo Boids (`sepR=100`). Medido: 177px
  al compañero más cercano, con ~200 como reparto ideal. No hay amontonamiento.
- **Presión**: ya es por cercanía rankeada (`dists.sort` + `myRank`). Medido:
  mediana de **1** jugador encima del portador rival.
- **Arquero**: NO hay que achicarle el alcance. Se lo agrandó a propósito
  porque con `p.r+22` cubría el 10% del arco y el 67% de lo que iba al arco
  era gol. Hoy ataja el 44% de los remates al arco (real 69%): si algo, está
  flojo. Y sale poco: se queda al 2,25% de la cancha de su línea.
- **Arquetipos de DT**: la tabla `T` de `dtProfile()` ya tiene Filósofo, Cholo,
  Heavy Metal, Técnico, Intenso y Defensivo con sus `press`/`line`/`direct`, y
  el 11v11 lee el perfil (10 claves, `press` 0,62 mío vs 0,50 del rival).
- **Faltas**: 22,4 por partido, clavado en el rango real.

### ⚠️ La mentalidad NO mueve el bloque en el 11v11. Medido, cerrado.

Esto estuvo abierto mucho tiempo con la excusa de "hacen falta más partidos".
Ya se midió con **48 partidos por táctica** (4 corridas independientes de 12,
`scratchpad/bloque3.js`) y el resultado es concluyente y **negativo**.

La métrica: posición media del bloque propio a lo largo de la cancha (0% = sobre
mi arco, 100% = sobre el arco rival), muestreada cada 35 ms, mediana por partido,
y después el cruce de cada partido ofensivo contra cada defensivo.

| corrida | Ofensivo − Defensivo | cruces que dan el signo correcto |
|---|---|---|
| 1 | −2,43 | **30,6%** |
| 2 | +3,56 | **75,7%** |
| 3 | −4,57 | **47,9%** |
| 4 | +1,02 (línea defensiva sola) | **50,7%** |

Promedio de los cruces: **51%** — o sea **azar puro** (50% sería tirar una
moneda). Las medianas por partido van de 16% a 64% de la cancha: la varianza
entre partidos es **diez veces** el efecto buscado.

Se probaron tres métricas, todas negativas: el bloque entero, el bloque
condicionado a la pelota en el medio, y **sólo la línea defensiva** (que es la
que más empuja `gBase` y la que menos persigue la pelota).

**Qué significa esto:**
- El mecanismo existe y es correcto: `baseShift=(push-1)*fieldW*0.115*gBase` da
  ±7% de cancha a la línea de fondo, es determinista y está verificado aislado
  (`scratchpad/shift.js`). La regresión verifica que `sitMent()` llegue a los
  dos motores.
- Pero es un **objetivo blando**: los jugadores lo persiguen con `fmMove(...,
  0.038)`, y antes de llegar ya cambió todo. La posición real la mandan la
  pelota, la presión, la línea de offside y los `return` tempranos de la IA.
- **No afirmes que la mentalidad mueve el bloque en el 11v11.** Donde SÍ se
  siente y está verificado es en las **jugadas clave** (`sitMent()`:
  acompañantes 2.5/2.4/1.8, cuántos suben al córner 4/3/2) y en el sim de texto.

**Si lo querés arreglar de verdad**, no toques las constantes (ya falló dos
veces: el empuje asimétrico 0.26/0.115 borró el repliegue, y subir `baseShift`
no se puede verificar). La única salida medible es cambiar el objetivo blando
por un **tope duro** a la línea de fondo (que no pueda replegarse más allá de
cierto % según la mentalidad): un tope se verifica determinista, tick a tick,
sin estadística. Ojo que hay que medir también los goles en contra, y eso sí
necesita muchísimos partidos.
- **Fricción de la pelota** en las jugadas clave: era una constante (.990 /
  .998) y la pelota rodaba eterna. Ahora distingue aire, rodada fuerte, media
  y lenta, y se detiene de verdad por debajo de 0.035.
- **La pelota del 11v11 ahora PARA**: el arrastre era sólo proporcional a la
  velocidad, o sea que se acercaba a cero sin llegar nunca (medido: 521 ticks
  —3,5 minutos de juego— para bajar de 0,002, y seguía). Se le suma un
  **rozamiento lineal** de 0,004/tick, que es desaceleración constante
  (Coulomb) y frena en tiempo finito: 304 ticks. Se SUMA al arrastre en vez de
  reemplazarlo para no romper las distancias de pase ya calibradas — un pase
  fuerte pierde 14% de recorrido y lo que desaparece es la cola infinita.
  Medido en partido: la pelota está quieta el 10,7% del tiempo (antes era
  imposible) y los pases quedan en 666, dentro del rango de siempre.
  ⚠️ Fricción lineal PURA (sin el arrastre) acorta los pases de 839 a 680px:
  rompe el balance. No la reemplaces, sumala.
- **El joystick del 11v11 es flotante**: `#fm-joyzone` captura el toque en
  todo el cuarto inferior izquierdo (90.552px², **7× el área del círculo
  dibujado**) y el joystick se planta DONDE apoyás el dedo, así que nunca
  arranca dando una dirección que no pediste. La zona muerta bajó a 0,07 del
  radio por eso mismo. El overlay se crea dentro de `startFullMatch`, así que
  el elemento no existe hasta abrir un partido (ojo al testearlo).
  Medido: **59,9 fps antes y después** — el joystick sólo toca el DOM en
  `touchstart`/`touchmove`, nunca dentro del `requestAnimationFrame`.

## Pantalla de inicio — selector País → Liga → Club

Todo sale de los datos, **nada está escrito en el HTML**: `tsLigas()` cuenta
las ligas en `PLAYERS_DB` (vía `ligasJugables()`), `buildAllTeams(lg)` arma
los clubes de la elegida y `tsValClub()` saca el valor del plantel. El HTML
tiene un solo `<div id="tsWizard">` vacío.

- `LIGA_PAIS` es lo único a mano: bandera y nombre de país por liga. Son
  metadatos de presentación, no la lista — una liga sin entrada igual aparece,
  con 🏳️.
- El estado son tres variables (`_tsPaso`, `_tsPais`, `_tsLg`) y `tsIr(paso,arg)`.
  El paso 3 llama a `setLigaSel(lg)`, que es el mismo camino que usaba el
  `<select>` viejo: **el flujo de arranque no se tocó**, se lo alimenta.
- El buscador normaliza acentos (`_tsNorm`): sin eso "vel" no encontraba
  "Vélez".
- ⚠️ El conteo de clubes del paso 2 sale de `clubesDeLiga()` / `AR_CLUBS`, NO
  de contar la base: contando la base, la Liga Profesional decía 66 clubes
  (con el ascenso adentro) contra los 30 que muestra el paso siguiente.
- El contenedor va en `justify-content:flex-start`: con `center` se recortaba
  arriba y abajo en cuanto la lista crecía.

## Retro-compatibilidad con partidas guardadas

Los campos nuevos se agregan **siempre con un valor por defecto en el punto de
lectura** (`G.socios||sociosBase()`, `l.apps||0`, `p.loanObligApps||0`), nunca
migrando el save. Un guardado viejo tiene que cargar y seguir jugando sin que
nada explote. La regresión lo verifica de verdad: borra del JSON guardado
`_tiempos`, `_S`, `seasonIni`, `miLiga`, `socios`, `ticketPrice`, `dilemas`,
`elecciones`, `movs`, los `obligApps`/`apps` de los préstamos y los
`loanObligApps`/`loanApps0` de los jugadores, y después carga esa partida y
toca los seis sistemas nuevos.

Un préstamo viejo sin `obligApps` se comporta como un préstamo simple: la
obligación no se dispara nunca (que es lo correcto, nadie la pactó).

## ⚠️ Nada que viva en `G` puede ser una función

`JSON.stringify` las descarta **en silencio**, así que al recargar la partida
el dato vuelve mutilado sin que nada avise. Ya pasó dos veces:

- `G.boardObjectives[].check` — los 3 objetivos de la Junta volvían con
  `check:undefined` y **no se podían cumplir nunca más** (cada uno vale +5 de
  confianza de la CD). Medido: 3 de 3 rotos tras guardar y cargar. Arreglado
  con `BOARD_OBJ` fuera de `G` y `boardObjCheck(id)`: en `G` van sólo
  `{id, desc, completed}`.
- `_DIL_FX` (dilemas) — mismo patrón, ya estaba resuelto así.

La regresión ahora **escanea `G` entero** buscando funciones. Si agregás algo
con un callback adentro, va a fallar ahí.

## La cancha de Táctica

- Las líneas de cal (áreas, área chica, punto de penal, arcos) son hijos
  vacíos `.pk-*` que agrega `rFormation`; el círculo central y la línea de
  mitad salen de `.pitch::after` con `box-shadow`. Nada de imágenes.
- Cada jugador es una mini-card: dorsal en la chapita dorada, nombre, badge
  de rating abajo y **aro de condición física** (`--fit` / `--fitc` en un
  `conic-gradient` enmascarado). Los estados se ven de un vistazo: `p-inj`
  (lesionado, borde rojo), `p-susp` (suspendido, borde punteado) y la llamita
  o el copo por el estado de forma.
- ⚠️ Si la ves gris no está rota: con el DT que no es tuyo la cancha va en
  `opacity:.45` + `grayscale(.7)` a propósito (táctica bloqueada). Para
  mirarla desbloqueada hace falta `dtIsMine()`.

## Sistema de diseño — Tactical Dark Glassmorphism

Los tokens viven en `:root` y **el acento lo pisa `applyTheme()` al arrancar**,
así que un color de acento nuevo va en `UI_THEMES`, no en el `:root`.

| token | valor | qué es |
|---|---|---|
| `--dark` | `#0b0e14` | fondo maestro, **igual para todos los clubes** |
| `--card` | `rgba(6,24,48,.80)` | superficie plana / stop oscuro del vidrio |
| `--card-2` | `rgba(12,40,80,.55)` | stop claro del vidrio (el azul del glassmorphism) |
| `--bdr` | `rgba(255,255,255,.08)` | borde luminoso, **blanco en todos los temas** |
| `--blur` | `blur(12px) saturate(1.2)` | el vidrio |
| `--green` | `#10b981` | verde neón — éxito / energía alta / finanzas en verde |
| `--gold` | `#f59e0b` | oro metálico — élite o advertencia (cambia por club) |
| `--gold-rgb` | `245,158,11` | el mismo, para los `rgba()` del CSS |
| `--red` | `#e84545` | rojo alarma — lesión, deuda, moral baja, expulsión |
| `--sh-deep` / `--sh-lift` | — | sombra en reposo / en hover |

La tarjeta estándar es una sola regla y **todo la hereda**:
`background:linear-gradient(160deg,var(--card-2),var(--card))` + `var(--blur)` +
`1px solid var(--bdr)`, y en hover `translateY(-2px)` con
`border-color:rgba(var(--gold-rgb),.28)`.

- ⚠️ **El club cambia el ACENTO, nunca la superficie.** `applyTeamTheme` pisaba
  `--card` y `--bdr` con valores propios por club, así que el vidrio estándar se
  perdía apenas arrancaba la partida: `--bdr` terminaba **dorado al 18%** en vez
  del blanco al 8%. Ahora `applyTeamTheme` y `applyTheme` sólo tocan
  `--gold` / `--gold-d` / `--gold-rgb`.
- ⚠️ **El borde de las tarjetas no se tiñe.** Un borde dorado permanente
  contradice la regla de que el oro significa "élite o advertencia": el acento
  aparece en el hover, los títulos y las insignias, que es donde comunica algo.
- La barra superior y la navegación van en la misma familia azul pero un escalón
  más oscuras que las tarjetas, para que el contenido quede adelante.
- Medido: 22 cajas de contenido con vidrio real y 2 sin (la cancha de Táctica,
  que es césped, y el bloque de notas). 732 números con `tabular-nums`, 0 sin.

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
- ⚠️ **El vidrio va en los CONTENEDORES, no en las filas.** `.card`, `.modal`,
  `.topbar`, `.tabs`, `.achip` y el cartel del cupo llevan `backdrop-filter`
  de verdad; las filas de listas (`.plc`, `.mkrow`, `.pr`) usan translucidez +
  borde luminoso + sombra, que es gratis. Un blur por fila son 30 capas de
  composición en el Plantel y 150 en el Mercado. La regresión falla si aparece
  un `backdrop-filter` en una `.plc`.

## Mini-cards del plantel (estilo FUT)

La lista del Plantel era una grilla de texto plano con cabecera de columnas.
Ahora cada jugador es una `.plc`: disco con la media, **aro de energía** en
`conic-gradient` (el mismo mecanismo que la cancha, vía `--fit` / `--fitc`),
dorsal en la chapita dorada, nombre en negrita y los estados como insignias.
Medido: 30 tarjetas en **1 ms**, todas de 66px (altura pareja) y 60 fps
scrolleando.

- El **borde del disco** dice el NIVEL (`ovrColor`) y el **aro** dice la ENERGÍA
  (`fitColor`): son dos datos distintos y no se pisan.
- `vbadgeTop(p)` muestra **una sola virtud** en las listas (la mejor, y sólo si
  llega a 80 o es élite). Con las dos de `vbadges()` la tarjeta se partía en dos
  líneas y las alturas quedaban desparejas.
- ⚠️ `.plc-sub` va en `nowrap` con `overflow:hidden` a propósito: si no entra,
  se recorta. Una lista que se escanea de un vistazo necesita filas iguales.

### El color comunica, no decora

| | | |
|---|---|---|
| `ovrColor(r)` | oro ≥84 · verde ≥76 · gris debajo | élite / bueno / del montón |
| `fitColor(f)` | verde ≥80 · oro ≥60 · rojo debajo | energía alta / aviso / problema |
| `valColor(v)` | oro ≥25M · texto ≥8M · apagado debajo | **la plata no es "éxito"** |

`valColor` existe porque `.vc` pintaba de verde neón CUALQUIER valor: el verde
es el color de "éxito/energía alta", no el de "acá hay un número".

⚠️ El medidor de contraste marca el **dorsal** como fallo (ratio 1.00): es un
falso positivo, no resuelve el `linear-gradient` del chip. Verificado a mano:
`--dark` sobre `--gold` da **8,99:1** y sobre `--gold-d` **6,06:1**, los dos muy
arriba del 4,5 de AA. Es el mismo falso positivo de los botones dorados.
- Contraste: todo el texto pasa AA salvo tres falsos positivos del medidor
  (texto oscuro sobre el botón dorado, que da 9,6:1). `--t3` se subió de
  `#6b7686` a `#7c8798` porque daba 4,20 contra el mínimo de 4,5.

## Memoria de la carrera: historial, leyendas y vitrina

- `G.history` (una fila por temporada cerrada, la escribe `archiveSeason`)
  guarda además del puesto el **patrimonio de cierre** (`budget`), los
  `titulos` de ESE año (`G.trophies` es de toda la carrera), `socios` y `rep`.
- `G.legends`: el que pasa `LEYENDA_APPS` (100) o `LEYENDA_GOLES` (50) con la
  camiseta entra y **no sale más**, aunque se venda o se retire (`activo`
  marca si sigue en el plantel). Se revisa al cerrar la temporada y también
  **después de cada partido**, así el salto se festeja cuando pasa.
  ⚠️ Usa `careerTotals(p)` cuando existe: `p.apps` es de toda la carrera del
  jugador, no de lo que hizo en TU club.
  ⚠️ **El umbral es generoso para este juego**: con ~50 partidos por
  temporada, 100 PJ son dos años, así que a las 6 temporadas hay ~17
  leyendas. Si querés que sea más exclusivo, subí las dos constantes.
- La **Vitrina** (`rVitrina`) y el **gráfico de patrimonio** (`rFinChart`)
  viven en la pestaña Presidente y se dibujan desde `rPresTab()`.
- El gráfico es **canvas nativo, sin librerías**: escala con
  `devicePixelRatio` para no salir borroso en el celular, dibuja la grilla, el
  área bajo la curva, la línea del cero cuando el rango la cruza, y es
  interactivo (mouse y touch) mostrando año, patrimonio y títulos.
- ⚠️ **La curva del patrimonio va en VERDE o ROJO, no en el acento.** El oro
  significa "élite o advertencia"; acá lo que comunica es la plata, así que
  manda la paleta financiera (`FINCOL` / `FINCOLA`, que leen `--green` /
  `--red` computados porque el canvas no resuelve variables CSS, igual que
  `GOLD()`). El trazo y el área toman el color del ÚLTIMO año y cada punto el
  del SUYO, así un ejercicio en rojo se ve dentro de una carrera en azul.
  Medido: 1.952 px verdes y 0 de oro con el patrimonio en azul, 2.065 rojos
  con deuda.
- ⚠️ **El check de memoria de la regresión no probaba nada.** Con 0
  temporadas cerradas y 0 leyendas, los `every` sobre arrays vacíos daban
  `true` y el check pasaba en verde sin haber ejercitado el sistema. Ahora
  fuerza el caso: cruza los dos umbrales por separado (112 PJ y 61 goles), deja
  un control de 70/31 que NO tiene que entrar, cierra una temporada de verdad
  con `archiveSeason`, y verifica la fila, que no se dupliquen las leyendas,
  los 2 tags en el plantel, los nombres y las copas en la vitrina y el color de
  la curva. Restaura `history`/`legends`/`trophies`/`budget` al terminar porque
  corre en la sesión compartida.

## Sistemas principales (dónde tocar)

- **Simulación rápida**: `simMatch` + `matchStrengths` + `applyMatchResult`
- **Simulación 11v11 que se mira**: `FM` global, `fmAI` / `fmTick` / `fmMove`
- **Jugadas clave jugables**: `SIT` global. Penal, tiro libre y centro usan una
  proyección pseudo-3D (`proj(wx, wz, wy)`); ataque y defensa son cenitales.
- **Mercado con tiempos reales**: `G.negs`, `negStartPlayer` → `negOpenClub` →
  `weeklyNegotiations`. Hay precontratos, libres y competencia de otros clubes.
- **Relación con el DT**: `G.dtRel` (0-100), `setDtRel`, `dtAskList` (pedidos del
  presidente al DT, que puede retrucar).

## Pretemporada: plata contra desgaste

`offerPreseason()` abre **✈️ Ofertas de Pretemporada** al arrancar la partida y
al empezar cada temporada (`setTimeout` de 500ms al final de `initGame`). Tres
opciones excluyentes (`PRESEASON_TOURS`):

| | caja | física en la fecha 1 | extra |
|---|---|---|---|
| ✈️ Asia/EEUU | **+3M** | **75%** | moral +10, rep +2 |
| 🏖️ Copa de Verano | +0,5M | 90% | — |
| 🏋️ Predio | 0 | 100% | química +15 |

⚠️ **`fitIni` es un objetivo para la FECHA 1, no un sumando.** Fijar la física en
la semana 1 no sirve para nada: entre la recuperación diaria (+1,6/día) y el
descanso semanal, un plantel puesto en 75 llega a 100 para la fecha 1 (medido:
**75 → 84,6 → 94,2 → 100**). Por eso se guarda en `G.giraFit` y lo ancla
`preseasonFit()` cuando empieza el torneo, una sola vez por temporada
(`G._giraFitAplicada`).

⚠️ **`preseasonFit()` se llama desde `updateUI()`, no sólo desde el bloque
semanal**, por dos motivos que se descubrieron midiendo: los amistosos adelantan
la semana con un `return` temprano en `simMatch` y **nunca pasan por el bloque
semanal**, y el bloque corre DESPUÉS de `G.week++`, o sea después de jugada la
fecha 1. Es idempotente, así que llamarlo seguido no cuesta nada.

**El costo deportivo está casi todo en el 11v11, no en el sim de texto:**

- Texto: la fuerza del equipo va de **0,77 (100%) a 0,75 (75%)** y la física se
  recupera sola para la fecha 2 (88,6%). Medido a 8 fechas con 7 corridas por
  opción: **22 puntos con la gira contra 20 en el predio** — o sea, ruido. La
  química tampoco mueve la aguja: `chemMod` es `0.97+chem/100*0.06`, así que
  +15 de química valen **+0,7%**.
- 11v11: `fmInit` saca la stamina inicial del `fit` del jugador, y ahí sí duele.
  Medido: llegando al **75%** el equipo cruza el 55% de stamina en el **minuto
  18**; llegando al 100%, en el **minuto 37**.

Si querés que la gira se sienta también simulando, el lugar es `matchStrengths`
(el peso de `avgFit`), no las constantes de la tabla.

## Banco, deuda y embargo

Todo vive en la tarjeta **🏦 Banco y Finanzas** de la pestaña Presidente
(`#loanBox` → `rLoans()`). Hay dos productos:

- **Crédito largo** (`BANK_OFFERS`): 8/20/45M a 52-104 semanas, con requisito de
  reputación. Es para reforzar.
- **Salvataje** (`BANK_RESCUE`, `takeRescue`): **5M → 6,5M en 10 semanas** y
  **15M → 22M en 20**. Usura a propósito: es para no morir, no para reforzar.
  Máximo dos abiertos, y ninguno con 40M de deuda.

Los dos entran al **mismo `G.loans`**, así que los cobra `weeklyLoans()` sin
tocar el loop financiero. Medido: 5M al firmar, 10 cuotas de 0,65 y el préstamo
se borra solo al llegar a 6,5M devueltos.

**Embargo** (`weeklyEmbargo` / `dispararEmbargo`, corre después de cobrar las
cuotas porque la cuota misma puede meterte en rojo): abajo de **−5M** arranca un
contador; a la **cuarta** semana seguida la AFA te saca **3 puntos de
`G.league.table[club].pts`** (la tabla de verdad: la misma que leen la posición,
el descenso y `archiveSeason`), te deja **la moral del plantel en 0**, −15 de
CD, −12 de hinchada, −4 de reputación y −10 de autoridad. Hay dos avisos al
celular antes (semana 1 y semana 3) y el contador se resetea al salir del rojo.

⚠️ **Dos bugs que este sistema destapó y hubo que arreglar para que sirviera:**

- **`p.morale||60` leía el 0 como "sin dato"** y lo devolvía a 60. O sea: la
  moral en 0 del embargo se borraba sola en el primer tick semanal (medido:
  0 → 60 en una semana). Estaba en **41 lugares** del archivo; ahora todos usan
  `(p.morale===undefined?60:p.morale)`. Si agregás un efecto de moral, **no uses
  `||`**: en una escala que empieza en 0, `||` es un bug esperando.
- **El drift semanal de moral se perdía entero por redondeo**: era
  `Math.round(morale + 0.4)`, y `round(3+0.4)=3`, así que un plantel hundido no
  subía nunca. Ahora guarda un decimal, como la línea de vestuario de al lado.
- Con eso arreglado el pozo seguía siendo mortal: a +0,4 por semana, volver de 0
  a 60 son **140 semanas (tres temporadas)**. Se agregó una **salida del pozo**
  proporcional (`+(35-morale)*0.10` sólo por debajo de 35, y sólo si no pidió
  salir ni está colgado). Medido: de 0 a **29 en 16 semanas**, y **arriba de 35
  no cambia nada** — un plantel sano en 72 sigue con el mismo +0,4 de siempre.
- **`fv()` con negativos** mostraba `€-3000K` en vez de `-€3.0M`: los negativos
  caían siempre en la rama de los miles porque `-3` no es `>=1`. Ahora el signo
  se extrae antes.

## Clima del partido (sólo el 2D)

`window.matchWeather` se sortea UNA vez por partido jugable (`weatherPick(key)`,
llamado desde `playMatch` y `startFullMatch`; la clave es el partido, así que
jugar las jugadas clave y después el 11v11 no vuelve a sortear). **La simulación
de texto no lo mira.** Reparto: soleado 60%, lluvia 25%, barro 15% (medido sobre
20.000 tiradas: 59,3 / 25,3 / 15,4).

| | pelota | jugadores |
|---|---|---|
| ☀️ soleado | 822px de recorrido | — |
| 🌧️ lluvia | **1500px (1,82×)**, patina | — |
| 🟤 barro | **387px (0,47×)**, se clava | **−20,1% de velocidad, 2,00× de gasto** |

- ⚠️ **La fricción se escala por la PÉRDIDA, no por el coeficiente.** En los dos
  motores es `Math.pow(k,dt)` con `k` = lo que la pelota conserva; multiplicar
  `k` la haría acelerar. Para eso está `wFric(k)` = `1-(1-k)*ballFric`, y
  `wStop(v)` mueve el umbral en el que se planta.
- ⚠️ **`stam:2.50` en el barro no es un error de tipeo.** El gasto es
  proporcional a la velocidad REAL y esa ya viene 20% más baja, así que un 2.00
  daba **1,60× medido**. Con 2.50 el gasto por minuto es exactamente 2×.
- ⚠️ **`passMul` es obligatorio, no un ajuste fino.** La IA calcula la fuerza del
  pase con `pwr = 1.5 + dd·0.0075`, atado a la fricción del campo. Sin corregir,
  un pase pensado para 200px recorría **407px con lluvia y 105 con barro**: la IA
  no completaba un pase y el partido se caía. La corrección es **parcial a
  propósito** (0.70 y 1.72 contra los 0.63 y 1.87 que igualarían el día
  soleado), así que queda **+15/18% largo con lluvia y −9/11% corto con barro**.
- El accesor se llama **`wxNow()`, no `wx()`**: las jugadas pseudo-3D usan `wx`
  como coordenada local en `proj(wx,wz,wy)` y en varios `forEach`.
- Dibujo: el **barro va en la cancha** (entre el césped y la cal, para no tapar
  las líneas) y la **lluvia en el loop**, arriba de todo, así cae sobre los
  jugadores y sirve para las 5 jugadas incluidas las pseudo-3D. En el 11v11 los
  charcos van en coordenadas de **mundo** y se proyectan con `P()`: dibujados
  sobre la pantalla quedan pegados al vidrio cuando la cámara panea.
- Medido a ×16: **60 fps con los tres climas**, y el equipo llega al 55% de
  stamina en el **minuto 23 con barro contra el 46 con sol**.
- ⚠️ La stamina NO se puede medir por el promedio al final del partido: el piso
  es 52 y con los dos climas se llega. Hay que medir en qué minuto se cruza cada
  escalón (`scratchpad/clima3.js`).

## Niebla de guerra en el mercado

Fuera de la liga que dirigís, un jugador es un rumor: **11,9% del mercado se ve,
13.651 de 15.503 están en niebla**. `isKnown(p)` es el ÚNICO portero (liga
propia, tu plantel, `p.scouted`) y **todo lo que la UI dibuja de un jugador del
mercado tiene que pasar por sus cinco envoltorios**: `rbK` (media), `potK`
(potencial), `vbK` (insignias doradas), `tagK` (⭐/🌟/💡, que sale del rating) y
`attrChipsK` (los 6 chips con `??`). Si agregás un dato a la ficha o a la lista,
gatealo también.

- ⚠️ **El rango NO se centra en el rating real.** Estaba centrado (`rat±m`), así
  que el punto medio de "79–89" era exactamente 84: el número que estás pagando
  por saber, servido en bandeja (medido: **100% de los rangos lo regalaban**).
  Ahora el informante tiene su propia estimación (`ratEst` / `potEst`, corrida
  hasta ±m y estable por jugador) y el rango se dibuja alrededor de ESA. Medido
  sobre los 13.651: el real cae adentro el **100%** de las veces, el punto medio
  lo clava sólo el **10,5%**, error medio **2,48 puntos**.
- ⚠️ **Los filtros y el orden son puertas de atrás.** Ordenar por media con
  `p.rat` te daba el **ranking exacto gratis**; ahora `rat`, `pot` y `ganga`
  ordenan por `ratEst`/`potEst`. El filtro de media mínima juzga al desconocido
  por el TECHO de su rango (así no se pierde el que puede servir) y el de
  virtudes directamente lo excluye: no se busca lo que no sabés.
- Los otros dos agujeros que había: **el comparador** (marcabas dos y te
  mostraba todo en claro) y **la pantalla de negociación** (`openNeg` imprimía
  `rb(p.rat)` y `rb(p.pot)`). Los dos gateados; negociar a ciegas ahora te
  avisa con un link al informe.
- `scoutOne(id)` cobra $0.1M, marca `p.scouted=true` y **cuenta qué salió**:
  media real, potencial, si el jugador es mejor o peor de lo que se decía, y las
  insignias que estaban tapadas (mensaje al celular + flash + log). La misión de
  ojeadores (`processScouts`) revela los 5 hallazgos de una liga por $0.5M.
- Retro-compatible sin migrar: un save viejo no tiene `scouted` en nadie y
  `undefined` es exactamente "sin informe".

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

## Dirigir afuera: el bug de la liga que no sobrevivía al guardado

Elegir Real Madrid y encontrarte con los equipos argentinos y la Libertadores no
era un problema del wizard —por ahí anda bien— sino del **guardado**:

- `_LIGA_ELEGIDA` es una **global que no se serializa**. Al recargar volvía a
  `'Liga ARG'` aunque `G.miLiga` dijera `'España'`.
- `loadGame()` llamaba a **`buildAllTeams()` sin argumento**, así que `TEAMS` se
  rearmaba con los clubes de la liga por defecto: escudo, colores y rivales
  argentinos.
- Y como **`buildCal` lee la global** (corre dentro del literal que crea `G`,
  cuando `G` todavía no existe), al empezar la temporada siguiente el Real
  Madrid se encontraba con las zonas, el Apertura/Clausura y la Libertadores.

Arreglado en tres puntos:

1. `loadGame()` restaura `_LIGA_ELEGIDA = saved.miLiga` **antes** de reconstruir
   nada, y llama a `buildAllTeams(_LIGA_ELEGIDA)`.
2. `squadFromDB` y `buildCal` prefieren **`G.miLiga`** cuando hay partida: es lo
   que sí se guarda. La global queda sólo para el momento de la creación.
3. Como consecuencia de (2), `initGame` hace **`G=null`** antes de armar el
   literal: si no, empezar en el Real Madrid desde una partida de Boca en curso
   habría leído el `G.miLiga` de Boca.

La regresión prueba el ciclo entero (elegir afuera → guardar → borrar el estado
en memoria → cargar → pasar de temporada) y verifica que la global, `TEAMS` y el
calendario queden en España.

### La copa continental depende del continente

Había cuatro textos que decían "Libertadores" sin mirar dónde dirigís: el
objetivo de temporada, el objetivo de la Junta (`setBoardTarget`), la virtud
`'Copero'` y el rótulo de la tabla de la pestaña Estadísticas — que además
dibujaba una tabla de Libertadores con 0 partidos. Ahora salen de **`COPA_CONT`
/ `copaCont()`** (Libertadores en Sudamérica, Champions en Europa,
Concachampions en México y la MLS, Champions asiática en Arabia).

⚠️ **Es sólo el NOMBRE que se muestra.** El torneo continental jugable
(`INT_COPAS`, grupos → octavos → final) sigue siendo únicamente sudamericano y
sólo para `Liga ARG`. Un club brasileño tampoco juega la Libertadores todavía.

`esLigaARG()` hace lo mismo con el formato: la tabla de la pestaña Calendario le
explicaba a un club español cómo suman el Apertura y el Clausura y dónde ver las
zonas. Ahora dice el nombre real de la liga y "todos contra todos, ida y vuelta".

Medido con Real Madrid, Man City y Boca: **0 rastros argentinos** en la UI de los
dos primeros (el único que quedaba era "Atl. **Rafa**ela" en el filtro de clubes
del mercado, un falso positivo de la búsqueda) y Boca conserva todo lo suyo.

## La base de datos de julio 2026

**17.108 jugadores · 617 clubes · 24 ligas** (antes 15.582 / 557). Lo que suma
son segundas divisiones: Alemania y Portugal pasan de 18 a 36 clubes en la base,
Francia de 18 a 35, la MLS de 26 a 30.

⚠️ **Eso NO agranda las ligas jugables**: `clubesDeLiga()` toma sólo la primera
división, así que Bundesliga sigue en 18, LaLiga en 20 y la Liga ARG en 30. Las
segundas quedan como clubes de mercado, que es donde suman. Verificado: el
conteo del wizard y el de `clubesDeLiga()` coinciden en las 24 ligas.

Tres cosas hubo que arreglar a mano sobre la extracción:

- **Stade Brestois** desapareció (22 jugadores) — el patrón de fallo pasajero de
  siempre. Recuperado de la base anterior.
- **Volos NFC** figuraba como perdido y sólo se había **renombrado** a `Volos`.
  Antes de dar un club por perdido, buscá el nombre parecido.
- **Níger venía como `NIG_NE`** (largo 6, porque `NIG` ya es Nigeria) en 5
  jugadores, y el juego exige códigos de 3 letras. Normalizado a **`NER`**.

Los DTs se **fusionaron, no se pisaron** (`dts-db.js` está curada a mano): la
extracción trae 617 nombres pero **cero edades y cero nacionalidades**, así que
se recuperan por nombre de la base vieja y se conservan los **47 DTs libres**
(sin club). Quedan **706 DTs · 618 clubes cubiertos · 134 con edad y
nacionalidad**.

⚠️ **El check de `nat2` de la regresión tenía un falso positivo.** Daba por
basura todo código que no apareciera 3+ veces como nacionalidad principal, y con
una base más grande eso marca países chicos que existen: CUB, SOM, AZE, NCA,
LVA, UAE, BRN, PUR (21 casos). Ahora verifica los códigos que la extracción
**realmente inventó** (`STA`, `ARA`, `RIC`, `RET` — los que salían de partir en
dos un país de dos palabras) más las invariantes estructurales, y **lista** los
códigos que aparecen sólo como segunda nacionalidad en vez de fallar. Ojo con
ampliar esa lista negra a ojo: agregarle `ISL`, `GUI` y `NOR` —que son Islandia,
Guinea y Noruega— daba 36 falsos positivos.

## Fase 14: extracomunitarios y cupos dinámicos

En España, Italia y Francia la plaza limitada **no es la de extranjero sino la
de EXTRACOMUNITARIO**: un francés en el Real Madrid no ocupa cupo, un brasileño
sí. Sin esa regla el cupo europeo no podía existir —por eso estaba en 11 = sin
límite—, porque contando a todo no-español el Madrid daba 15 de 27 y bloqueaba
el equipo.

`EU_NATS` (UE + EEE + Suiza) y `LIGA_UE` (`['España','Italia','Francia']`) son
lo nuevo. Medido sobre la base: el Real Madrid pasa de **15 extranjeros a 4
extracomunitarios** (2 en el once), el Barcelona a 2 (0 en el once) y el Girona
a 7 (4). Recién ahí un cupo de 3 significa algo.

| liga | cupo | qué cuenta |
|---|---|---|
| España, Italia | 3 | extracomunitarios |
| Francia | 4 | extracomunitarios |
| Colombia | 4 | extranjeros |
| Liga ARG, Chile, Uruguay | 6 | extranjeros |
| MLS | 8 | extranjeros |
| Brasil, Liga MX | 9 | extranjeros |
| Premier, Alemania, Holanda, Portugal, Turquía, Bélgica, Grecia | 99 | sin tope |

⚠️ **Los códigos son los de la BASE, no los ISO.** Escocia es `ESC` (no `SCO`) y
Gales `GAL` (no `WAL`): con los ISO, los 109 británicos de esos dos países se
contaban como extracomunitarios. Y **`MAL` es MALÍ, no Malta** (116 jugadores;
Malta es `MLT`, con 1): meterlo en `EU_NATS` haría comunitarios a 116 malienses.
Los que faltaban y sí son UE están agregados: HUN, BUL, SVK, SVN, EST, LVA, LTU,
LUX, MLT, CYP.

⚠️ **`UNK` no ocupa cupo.** Hay 246 jugadores sin nacionalidad en la base;
contarlos como extracomunitarios llenaba la plaza con gente de la que ni
sabemos de dónde es.

⚠️ **Serbia y los británicos están dentro de `EU_NATS` porque el usuario los
pidió**, pero en la realidad post-Brexit un inglés SÍ ocupa plaza de
extracomunitario en LaLiga, y Serbia no está en el EEE. Es una línea sola: si se
quiere realista, se borra.

### Dos cosas que la especificación pedía y habrían roto el juego

- **`pIsForeign(p)` NO puede sacar la liga de `p.lg`.** El cupo es contra la liga
  que **dirigís**: un brasileño que compra el Real Madrid tiene `lg:'Brasil'`, y
  preguntar "¿es extranjero en Brasil?" da que no — se colaría sin ocupar plaza.
  Además los jugadores de tu plantel no siempre traen `lg`. El tercer parámetro
  de `isForeign(nat,nat2,league)` es **opcional** y por defecto es `ligaMia()`.
- **`isForeign` no devuelve `false` para todos en la Premier.** "Sin límite" y
  "todos son locales" son cosas distintas: si mintiera, el cartel del Man City
  diría "0 extranjeros" (son 15) y se romperían `natsLocales()` y nacionalizar,
  que leen lo mismo. Lo que vale 99 es el **cupo**, no la nacionalidad.

### El grupo del vestuario es social, no administrativo

`vestGrupos()` usaba `isForeign` para armar "Los de afuera". Con la regla
comunitaria, el grupo del Real Madrid habría bajado a 4. Un francés en Madrid
hace rancho aparte igual aunque no ocupe plaza, así que ese grupo mira la
nacionalidad local pura: **15 jugadores contra los 4 del cupo**.

### Medido en 10 clubes de 5 ligas

Ningún once se pasa del cupo, ninguno queda con huecos y ninguna liga se bloquea
en 8 fechas. Los **planteles** sí exceden (Juventus 8/3, Nice 9/4) y eso es
correcto: el cupo se cumple en el ONCE, y el cartel en rojo es el problema a
resolver, igual que en la realidad.

Fichando con el cupo lleno (Madrid 4/3): el francés y el alemán entran, el
argentino queda bloqueado, y un brasileño **con pasaporte búlgaro** entra — que
es exactamente cómo funciona el mercado real.

⚠️ El cupo de la Liga ARG subió de 5 a **6** porque el usuario lo pidió. Afloja
un poco la liga principal respecto de la regla real de 5.

## Fase 15: el reloj mentía — playoffs, calendario y descensos

El síntoma era el solapamiento Apertura/Clausura, pero **el hueco ya existía**:
el Apertura terminaba en la semana 19, el Clausura arrancaba en la 24 y las
semanas 20-23 quedaban libres. Los playoffs igual caían encima (octavos S24,
cuartos S27). La causa estaba dos capas más abajo.

### `G.week` contaba PARTIDOS, no semanas

`simMatch` hacía `G.week++` a secas, una semana por partido. Como en la misma
semana se juega liga y copa —lo normal: **7 veces por temporada en Boca**—, el
reloj se adelantaba una semana cada vez. Medido con instrumentación:

| se juega la fecha de… | el reloj marcaba |
|---|---|
| semana 17 | **21** |
| semana 18 | **22** |
| semana 19 (fin del Apertura) | **24** |

Con el reloj en 24, los playoffs no podían caer en el hueco 20-23 aunque
estuviera reservado: se programaban sobre un reloj corrido. Y cada ronda
siguiente usaba `G.week+1`, así que se dispersaban (octavos 24, cuartos 27)
porque entre una y otra se jugaban fechas del Clausura.

Ahora el reloj lo manda el calendario: si queda algún partido de esta semana o
anterior, sólo se sincroniza; la semana avanza cuando la fecha terminó.

⚠️ **Esto cambia el balance y hay que saberlo.** Medido sobre una temporada
completa, mediana de 5 corridas:

| | antes | ahora |
|---|---|---|
| partidos | 51 | 53 |
| **semanas** | **52** | **49** |
| Δ presupuesto | −12,6M | −15,0M |
| puntos | 67 | 67 |
| **física (mediana)** | **100** | **93** |

Son 3 semanas menos de vida de club por temporada. La caída de física es el
efecto buscado: **jugar liga y copa la misma semana ahora cansa**, en vez de
regalar una semana de recuperación por cada partido extra.

### Los playoffs se programan en su hueco

`arBuildTournament` devuelve `playoffWeeks` (4 semanas, una por ronda) y queda
en `G.arPhases[fase].playoffWeeks`. `arPlayoffWeek(fase,idx)` las lee, y
`arStartPlayoff` / `arAdvancePlayoff` la usan en vez de `G.week+1`. El único
`Math.max` que queda es contra el pasado: no se puede programar un partido en
una semana que ya pasó.

⚠️ **El hueco son 4 semanas, no 3**: los playoffs son Octavos, Cuartos,
Semifinal y Final, una por semana (`PLAYOFF_RONDAS`). Con 3, la final caería sí
o sí sobre la primera fecha del Clausura. Verificado: las 4 llaves caen dentro
de 20/21/22/23 y el Clausura arranca limpio en la 24.

### Cuántos descienden depende de la liga

Era `nClubs>=26?2:1`: en la Liga ARG daba 2 (bien), pero en LaLiga, la Premier
o la Serie A daba **1 solo** cuando en la realidad bajan 3 — terminar 18º de 20
no tenía ninguna consecuencia. Ahora sale de `DESCENSOS` / `cuposDescenso()`:
España, Premier, Italia y Turquía 3; Brasil 4; Alemania, Francia y el resto 2;
Liga MX 1; **MLS 0** (no hay descenso).

⚠️ Ojo con `||` acá también: la MLS es **0**, así que `cuposDescenso` usa
`d!==undefined`. Y los **tres** lugares que decidían descenso —`checkFired`, la
franja roja de la tabla y `archiveSeason`— usan ahora la misma función: antes la
tabla podía pintar de rojo un descenso distinto del que se aplicaba.

### Lo que ya estaba hecho y no hacía falta tocar

- **Las ligas largas ya son round-robin de 38 fechas.** Verificado: España,
  Premier, Brasil y Colombia arman 380 partidos en 38 fechas, semanas 4-41, sin
  zonas ni playoffs (`buildCalOtra`). No hizo falta un `euBuildTournament`.
- **El nombre de la competencia ya es el real** (LaLiga, Premier League,
  Brasileirão, Liga BetPlay) vía `LIGA_NOMBRE`. Llamarlas "Primera División"
  sería un retroceso.

### Lo que NO se hizo, y por qué

Pasar **Colombia y México al formato de zonas + Apertura/Clausura** no es
viable tal como está: `arBuildZones` es específicamente argentino — necesita 30
clubes para partir en dos zonas de 15 y reparte `AR_CLASICOS`, que son las 10
parejas de clásicos **argentinos**. Colombia tiene 20 clubes en el juego y
México 18, y ninguno tiene tabla de clásicos. Se podría hacer, pero es un
motor nuevo por país, no un parámetro.

## Fase 16: jerarquía, préstamos realistas y paneles unificados

### El jugador puede decirte que no

`jugadorTeAtiende(p)` + `jerarquiaBloquea(p)`: una figura (`rat>=83`) no se muda
a un club con menos de **75 de reputación**, por más plata que pongas. El que
decide es el JUGADOR, así que el portero está en las **cuatro** vías —
`openNeg`, `payClause`, `openSwap` y `negLoanOffer`.

⚠️ **La ficha del jugador tiene botones directos de Cláusula y Canje que NO
pasan por `openNeg`**: sin blindar las cuatro, el filtro se esquivaba entrando
por la cláusula.

Medido sobre el mercado real (17.000 jugadores): con Boca (rep 78) y el Real
Madrid (rep 90) **no bloquea a nadie**; con el Girona (rep 64) bloquea los
**539 cracks (3,2% del mercado)** y le deja 1.135 jugadores de 78+ para
trabajar. O sea: muerde sólo a quien tiene que morder.

⚠️ Mira `p.rat` REAL, no `ratEst`. Eso significa que un rechazo te revela que el
tipo es de primer nivel: es una filtración mínima de la niebla de guerra, y es
la correcta — en la cancha te enterás de que un crack es un crack justamente
porque te dice que no.

### A una figura no te la prestan: la edad manda sobre el valor

El escalado por rating ya existía (97/80/50/20% de rechazo). Faltaba lo que más
pesa en un préstamo real: la **edad**. Ahora está en `loanRefusal(p)`, que
además devuelve los motivos y los muestra en el modal.

⚠️ **Primer intento mal, y el número lo delató.** Dejando el corte por valor
(`rat>=87||val>=20`) como estaba, un pibe de 22 con 80 de media y 25M de valor
quedaba "intocable", y medido daba el absurdo de que **el joven se prestaba
menos que el veterano: 58% de rechazo contra 54%**. El valor alto de un juvenil
es proyección, no jerarquía — a esos justamente se los cede. El corte por valor
ahora sólo aplica al que **no** es joven.

Medido después del arreglo, sobre la banda `rat` 76-82:

| | rechazo medio |
|---|---|
| joven (≤23) | **15%** |
| veterano (≥31) | **54%** |

Y la figura (`rat>=87`, o `val>=20` si no es joven) es **rechazo duro**: no se
abre el modal, va un mensaje del agente ("No ceden a sus figuras a préstamo,
solo venta directa"). Antes era 97%, o sea que una de cada 33 se colaba.

### Las compras instantáneas YA no existían

`payClause` → `confirmClause` → **`openPlayerTerms`** → `firmaProgramar`, y
`openSwap` → `confirmSwap` → `openPlayerTerms` → `negQueueClub`. Las dos vías ya
pasaban por términos personales y por el embudo de firmas, con el comentario en
el código: *"La cláusula saltea AL CLUB, no al jugador: primero tiene que firmar
él"*. No hizo falta cambiar nada; la regresión ahora lo **blinda** verificando
que `G.squad` no crezca al pagar una cláusula.

### `.mpanel`: unificación sin blur anidado

El mismo bloque (fondo translúcido + borde luminoso) estaba escrito a mano con
estilos inline en **18 lugares**. Ahora es una clase, con `.mpanel-t` y
`.mpanel-row` para el título y las filas.

⚠️ **NO lleva `backdrop-filter`, y usar `.card` adentro de un modal habría sido
un error**: `.card` y `.modal` llevan vidrio real los dos, así que anidarlos
apila blur — exactamente lo que prohíbe la regla medida de este proyecto ("el
vidrio va en los CONTENEDORES, no en las filas"). Translucidez + borde + sombra
da el mismo lenguaje visual y es gratis. La regresión falla si a `.mpanel` le
aparece un `backdrop-filter`.

## Fase 17: al clásico no le compran, y la cláusula deja enemigos

### El clásico es tabú absoluto

`CLASICOS_MUNDO` (47 parejas: Superclásico, Madrid–Barsa, Inter–Milan, Peñarol–
Nacional, Galatasaray–Fenerbahçe…) + `esClasico(a,b)`, que mira **también**
`AR_CLASICOS`. Esa tabla NO se toca porque además parte las zonas en
`arBuildZones`; los clásicos del resto del mundo van en la tabla nueva.

El bloqueo vive en `jerarquiaBloquea`, o sea en las **cuatro** vías (negociar,
cláusula, canje, préstamo). Medido: bloquea **28 jugadores, el 0,2% del
mercado** — cuesta nada y se nota mucho.

### El "rival directo" se cobra, no se bloquea

El pedido era bloquear también al rival directo. **No se bloquea a propósito**:
entre dos grandes de la misma liga los pases existen y son caros (Boca le compró
a Racing, River a San Lorenzo). Bloquearlos dejaría a los cinco grandes
argentinos sin poder comprarse entre sí, que es más restrictivo que la realidad.
Lo que sí pasa es que te lo cobran: `RIVAL_RECARGO=1.45`.

⚠️ **Un umbral ABSOLUTO de nivel no sirve, y el número lo dijo.** Se probó con
`|nivel−nivel|<=3 && nivel>=70` y medido **no encarecía a nadie**: los niveles
de una liga están comprimidos (la argentina va de 60 a 75), así que el único que
calificaba para Boca era River — que ya está bloqueado por clásico. Lo que
define a un rival directo es la posición **relativa**: `_topLiga()` toma los 6
de mayor nivel de tu liga y son rivales entre sí. Con eso entran Racing e
Independiente, y el precio pasa de **×1,19 a ×1,76** del valor de mercado.

`_topLiga` cachea por liga: si no, recalcularía `nivelClub` de 30 clubes en cada
`_negDemand`.

### Pagar una cláusula deja al club enemistado

`G.angryClubs` + `enojarClub` / `clubHostil`. Robarle un jugador **de tu misma
liga** por la cláusula te deja el club en contra: piden `HOSTIL_RECARGO=3.0`
(medido: la demanda pasa de 5 a 13,7 — **2,88×**, la varianza sale del random de
`_negDemand`) y el agente te avisa antes de que pierdas el tiempo. A un club de
otra liga no le importa tanto: la marca sólo se aplica si `esLigaLocal(p.lg)`.

Retro-compatible **sin migrar el save**: `clubesEnojados()` lee `G.angryClubs||[]`,
y en un guardado viejo eso es exactamente "todavía no le rompiste la relación a
nadie". Verificado borrando el campo del JSON: carga y `_negDemand` no explota.

### La contraoferta hablaba de vender aunque fuera un préstamo

`openNegSell` decía **"💸 Negociar venta"** y "Valor TM" SIEMPRE, aunque la
oferta entrante fuera un préstamo: regateabas un cargo de cesión con una
interfaz que te hablaba de vender. Peor: las condiciones que el club ya había
puesto sobre la mesa (opción de compra, obligación, canje, % de futura venta,
pago en cuotas) **desaparecían de la vista** justo cuando ibas a decidir.

⚠️ **La LÓGICA ya estaba bien.** `accOffAt` mira `o.type` y cede en vez de
vender —el jugador va a `G.loaned`, vuelve en 26 semanas, la obligación se gana
jugando—. Lo único roto era lo que veías. `ofertaCtx(o)` centraliza los rótulos
(título, campo, verbo, referencia) y el modal ahora lista las condiciones
vigentes aclarando que sólo estás regateando el cargo.

## Fase 18: el mercado de la IA

Estaba en **1-3 fichajes cada 3 semanas**: medido, **40 transferencias por
temporada** sobre un mercado de 17.000 jugadores (el 0,23%), todas del mismo
tipo —compra a secas—, sin un solo préstamo, cláusula ni libre.

### La jerarquía salía de dos listas escritas a mano, y estaban rotas

`bigClubs` / `midClubs` tenían 21 nombres a mano de los que **4 ni existían en
la base** ('Inter de Porto Alegre', 'Universidad de Chile', "Newell's Old
Boys", 'Talleres'), y los 17 restantes eran **todos sudamericanos**: dirigiendo
en Europa la jerarquía no aplicaba a nadie, y por eso el AC Milan fichaba a un
jugador de 2,8M sin despeinarse. Ahora el nivel sale de `clubRank()` —el
sistema de prestigio real del proyecto, que cubre los 612 clubes— vía
`aiTier()`: 1 grande (≥80), 2 medio (≥68), 3 chico.

Medido en una temporada: el club **grande** ficha una media de **81**, el
**chico** de **69**.

### Cuatro mecanismos, no uno

`aiCompra` (el grande va por la estrella o el pibe de potencial ≥84; el chico
por la ganga ≤74 y ≤6M), `aiPrestamo` (sub-21 de club grande a club chico, con
`pickBuyer(rat,-1)` que ya existía para eso), `aiClausula` (el grande le paga
la cláusula al de abajo) y `aiLibre` (veterano ≥33 a coste cero).

Medido en una temporada: **117 transferencias** (antes 40) repartidas en compra
38% · libre 39% · préstamo 22% · **cláusula 2%**. La cláusula es rara a
propósito: un bombazo no pasa todas las semanas.

⚠️ **La cláusula no aparecía en las noticias y NO era la lógica.** Aislada,
funciona el 61% de las veces; lo que pasaba es que sus titulares se caían por
el tope de noticias. Antes de tocar una probabilidad, contá la operación, no el
titular.

⚠️ **El primer umbral de la cláusula daba 0 candidatos.** Con `rat>=76 && tier
3` medido sobre una muestra de 260 había **cero**: un jugador de 76+ casi nunca
milita en un club de nivel <68. Aflojado a `rat>=74 && nivel<72`.

### El mercado era casi todo internacional

`pickBuyer` elige por NIVEL sin mirar el país, y como hay 24 ligas el comprador
casi nunca era compatriota: medido, **el 89% de los pases cruzaba de liga**.
`_aiComprador(rat,lgPref,dir)` intenta primero en la liga del jugador
(`AI_DOMESTICO=0.62`) y cae a `pickBuyer` si no hay nadie del nivel adecuado.
Medido: los pases dentro del mismo país pasan de **11% a 37%**.

⚠️ **`ligaDeClub()` recorre los 17.000 del mercado en CADA llamada.** Usarla
para filtrar los 612 clubes por liga serían 10 millones de operaciones por
fichaje. Por eso está `_ligaMap()`, cacheado por temporada igual que `aiClubs`.

### Dos detalles que sólo se ven mirando los titulares

- **El mismo jugador fichaba dos veces en la misma corrida** (Sven Ulreich
  apareció firmando en West Brom y en Stade Brestois). La muestra se arma una
  vez por corrida, así que se marca al que ya se movió (`p._aiMov`) y **la marca
  se limpia al terminar**: si quedara puesta, ese jugador no volvería a
  transferirse en toda la partida.
- **Las noticias de color hablaban siempre de Argentina** ("la Liga ARG es una
  de las más competitivas de Sudamérica", "la prensa argentina debate…") aunque
  dirigieras en la Premier. Ahora salen de `ligaComp()`.

### El tope de noticias estaba partido en dos

`aiNews` cortaba a 50 pero **`_pubRumor` seguía cortando a 35**, y como los
rumores se publican seguido, aplastaban las noticias de fichaje: se veían 11 de
transferencia contra 21 de rumor y el mercado parecía muerto. Los dos comparten
`AI_NEWS_MAX=50`.

Rendimiento: `aiTransfers` cuesta **2,6-3,2 ms por corrida** y el save queda en
3,4 MB. `_aiMuestra(260)` es lo que lo mantiene barato — filtrar los 17.000 por
cada operación y por cada semana es lo que haría lenta esta función.

⚠️ La IA **no puede robarte un fichaje que estás cerrando**: `_aiMuestra`
descarta los ids que están en `G.negs`, y `firmaProgramar` ya saca al jugador
de `G.market` apenas hay acuerdo.

## Fase 19: capitanía y química del vestuario

### La cinta ya existía: es `G.roles.captain`

⚠️ **No se creó `G.captainId`.** El capitán vive en `G.roles.captain` desde que
existen los Designados, y de ahí lo leen `matchStrengths` (bonus de liderazgo) y
el dibujo del once. Un segundo campo con el mismo dato son dos fuentes de verdad
que se desincronizan.

Lo que faltaba era que lo eligiera **el DT**: `dtPicksCaptain()` ordena a los
once por `capScore` — veteranía (27+ vale 18, 24+ vale 6), años en el club (×6),
nivel (×0,55), menos 25 si pidió salir. Con DT propio, si designaste a alguien y
está en cancha, no se lo toca.

**La UI dejaba cambiar al capitán SIEMPRE**, lo que contradice la regla del
proyecto. Ahora con DT de la IA se ve quién la lleva, su edad, sus temporadas en
el club y —si hay conflicto— por qué no cayó bien, pero no se toca.

⚠️ Los pateadores de penales, tiros libres, córners y la marca personal **siguen
abiertos** aunque son decisiones de cancha igual. Es la misma inconsistencia,
pero cerrarlas es otro pedido y cambia bastante la jugabilidad.

### El plantel inicial figuraba como once fichajes nuevos

Bug preexistente que destapó la química: `seasonsAtClub` sólo se ponía **al
fichar** (en 0) y subía +1 por temporada, así que el plantel con el que arrancás
la partida quedaba entero en 0. Rompía **cinco** cosas a la vez:

- la química estructural daba **24 sobre 100** el primer día,
- "los de la casa" del vestuario (`>=3` temporadas) era un grupo vacío,
- nadie llegaba a las 2 temporadas que pide **nacionalizar**,
- el bonus de `casa` en el rendimiento era 0 para todos,
- y todos tenían la misma chance de irse (`irse` descuenta por antigüedad).

`antiguedadInicial(p)` la reparte por edad —que es lo que la correlaciona en la
realidad— y es determinista por nombre para que no cambie entre recargas. Con
eso el capitán de Boca pasa a ser Paredes con **8 temporadas** y la química
inicial de 24 a **79**.

### La química ahora sale del once, pero no lo reemplaza todo

`updateChemistry` ya movía la química por **repetir** el equipo, y eso está bien:
la química se construye jugando. Lo que faltaba es de qué está hecho ese once.

`chemEstructural(xi)` suma sociedades por nacionalidad (el primero de cada país
no suma; los que lo acompañan sí, hasta +20), antigüedad media (×5,5) y resta
3,4 por cada recién llegado y 2,5 por conflicto de capitanía.

⚠️ **No reemplaza al acumulador: le pone TECHO y PISO** (`obj+12` / `obj−18`).
Si fuera absoluto, un mercado movido te reventaría la química de un día para el
otro; y sin techo, repetir once veces un equipo de recién llegados lo
convertiría en un equipo con historia. Medido:

| once | química |
|---|---|
| mismo país + 4 temporadas | **77** |
| once países distintos + 4 temporadas | 64 |
| mismo país, mitad recién llegados | 50 |
| todos recién llegados | **17** |

### Meterte con el once tiene precio

Dos conflictos, los dos en `capitanTrasOnce()`:

- **Cinta a un pibe** (<24) habiendo referentes en cancha (29+, 2+ temporadas,
  nivel parecido): `capConflicto()` devuelve el castigo, la moral baja 2 por
  referente y la química se resiente vía `chemEstructural`.
- **Le exigiste al DT que juegue alguien** (`_forced`, que sale de `dtAskList`)
  y por eso el capitán quedó en el banco: **`dtRel` −14**, moral −6, mensaje
  furioso del técnico al celular y noticia de vestuario. Medido: 65 → 51.
  Se dispara una vez por semana (`G._capQuejaSem`), no una por render.

## Fase 20: mentoreo (el veterano que le enseña al pibe)

Tarjeta **🎓 Grupos de Mentoreo** en la pestaña Entrenamiento (`#mentorBox` →
`rMentor()`). Hasta `MENTOR_MAX=3` parejas en `G.mentoring` — objetos planos
`{mid,pid,desde}`, nada de funciones (ver la regla de `G`). Retro-compatible sin
migrar: `mentorias()` lee `G.mentoring||[]`, que en un save viejo es exactamente
"todavía no armaste ninguna".

Requisitos, validados en `mentorAdd`: **mentor** 30+ y media 75+, **pupilo** ≤22,
y los dos de la **misma línea** (`pgr`). Un jugador no puede tener dos mentores
ni un veterano dos pupilos.

- **`MENTOR_DEV=1.40`** — el pupilo desarrolla 40% más rápido.
- **`MENTOR_HERENCIA=0.02`** — 2% por semana de empezar a heredar una virtud
  élite (≥85, la misma marca que usa `virtues()`) que el mentor tenga y el
  pupilo no.
- La pareja se **pausa sola** si alguno de los dos se lesiona o se va del club
  (`mentorActiva`), y la tarjeta lo muestra en rojo con el motivo.

### La herencia no es un salto

Al heredar queda `p._mentorLegado={k,techo}` y el atributo sube **de a un punto
por semana** hasta el nivel del mentor. Un salto instantáneo de 62 a 89 sería un
regalo; así se ve venir y el veterano se lleva el crédito cuando llega.
Verificado determinista: **ATA 62 → 89 en 27 semanas**, con aviso al celular,
noticia, y el legado se borra al completarse.

### Medido con clones idénticos

⚠️ **La primera medición estaba sesgada y daba +1.** Le había dado titularidad
al pupilo y no al control, y `isXI` mueve `rf`, que multiplica el crecimiento
por `perfMul` — el efecto medido era en buena parte el de jugar, no el del
mentor. Con dos clones idénticos, ambos titulares y los mismos partidos:

| | media ganada en 52 semanas |
|---|---|
| con mentor | **16** |
| sin mentor | 13 |

**+3 puntos de media por temporada.** Y la herencia sobre 200 pupilos: 161
heredan dentro de 150 semanas, **mediana 24 semanas** (el teórico de 2%/semana
es 34; la observada baja porque los 39 que nunca heredaron quedan censurados).

⚠️ **El check de la regresión no puede confiar en el plantel de Boca**: los
checks que corren antes venden, ceden y fuerzan cupos, así que puede no quedar
un veterano y un pibe de la misma línea. Si no los hay, los fabrica — lo que se
prueba es la regla, no la suerte de esa corrida.

## Fase 21: las obras tardan (y mientras tanto molestan)

Construir dejó de ser instantáneo. `confirmBuildStad` y `buildYouthUpg` cobran
la plata **ya** pero encolan la obra en `G.activeConstructions` (objetos planos
`{id,tipo,name,sem,total,eff,desde}`, sin funciones). `weeklyObras()` corre en el
bloque semanal, descuenta una semana a cada una y al llegar a cero marca
`built:true`, aplica los efectos vía `aplicarMejora()`, saca la obra de la lista
y avisa con flash, mensaje del arquitecto y noticia.

Retro-compatible sin migrar: `obras()` lee `G.activeConstructions||[]`, que en un
save viejo es "no hay nada en construcción", y las mejoras ya construidas
conservan su `built:true`.

### El plazo sale del efecto, no de una lista a mano

`obraSemanas(u)` lo deriva de `u.eff`, así que una mejora nueva ya entra con un
plazo razonable sin tocar nada:

| obra | plazo |
|---|---|
| Pantallas HD (`inc+0.3`) | 5 semanas |
| Clínica médica (`medical`) | 8 |
| +8.000 butacas (`cap+8000`) | 10 |
| Techo retráctil (`inc+1.0`) | 11 |
| Centro de entrenamiento (`train`) | 12 |
| +25.000 butacas (`cap+25000`) | **28** |

### ⚠️ La capacidad NO se guarda y se restaura: se calcula al leer

El pedido era guardar la capacidad original y restaurarla sumada a la nueva. **No
se hizo así, y por una razón concreta**: hay CUATRO ampliaciones (`exp1`..`exp4`)
y podés tener dos en curso a la vez. Al terminar la primera, restaurar su
snapshot **pisaría lo que ya sumó la segunda**.

`G.stadium.capacity` guarda siempre la capacidad REAL y `capacidadEfectiva()`
descuenta el 15% mientras haya una ampliación en curso. No hay estado que
restaurar, así que no hay nada que se pueda desincronizar. Sólo hay que
acordarse de leerla por el accesor: la usan la asistencia y el borderó (los dos
únicos lugares donde importa) y la ficha del estadio, que muestra "45.900 (de
54.000, obra en curso)".

Verificado justamente en ese caso: con `exp2` y `exp3` en curso a la vez, al
terminar la primera la capacidad sube **sólo** los 12.000 de la que terminó y la
penalización **sigue puesta** por la que queda.

### UI

`obrasHTML(tipo)` se inyecta arriba de las mejoras disponibles en las dos vistas
(`rStad` y `rJuv`), con barra de progreso que se llena semana a semana. Sigue el
estándar de vidrio: el contenedor (`.card`) ya es vidrio real, así que cada obra
va en un `.mpanel` — translucidez + borde luminoso, **sin `backdrop-filter`**,
para no anidar blur.

## Fase 22: patrocinadores regionales

Dirigiendo al Real Madrid te ofrecían **YPF, Quilmes y el naming de LA
BOMBONERA**. Cada sponsor lleva ahora `region` (`GLOBAL` / `LATAM` / `EU`) y
`SPON_REGION` dice qué mercados te golpean la puerta según la liga.
`sponsorEnRegion(s,lg)` es el portero.

### ⚠️ Filtrar sin rellenar habría borrado ingresos, no regionalizado nada

Medido sobre la tabla vieja: de las 10 categorías, **cuatro eran 100% LATAM**
(Patrocinador Principal 4/4, Bebidas 2/2, Tecnología 2/2, App 2/2). Y las
categorías son **excluyentes** (un contrato activo por `cat`), así que un club
europeo filtrado contra esa tabla se quedaba sin cuatro categorías enteras de
ingreso, sin nada con qué reemplazarlas. Por eso entraron marcas nuevas hasta
que **ninguna de las 24 ligas tiene una categoría vacía** — es la invariante
que verifica la regresión, no una lista a ojo.

### ⚠️ El segundo agujero lo destapó el número: el club chico europeo quedaba peor

Con los EU premium solamente (Emirates 84, Spotify 80, Sky 76, Allianz 78), el
**Girona (rep 64) llegaba a 2 categorías y 7,8M por temporada** contra las **7
categorías y 15,7M de un club argentino chico (rep 62)**: las marcas LATAM
baratas piden rep 48-55 y sus equivalentes europeas arrancaban en 64. Se agregó
la gama baja europea (Betsson 56, Eurosport 52, Kappa 50, Estrella Damm 52,
Orange 48, SEAT 50, Glovo 50) y el Girona pasó a **8 categorías y 19,6M**. La
curva de acceso quedó pareja: Europa paga más en **todos** los escalones, no
sólo arriba.

| club | rep | categorías | por temporada |
|---|---|---|---|
| Boca | 78 | 9 | 32,3M |
| club ARG chico | 62 | 7 | 15,7M |
| Real Madrid | 90 | 10 | **55,4M** |
| Girona | 64 | 8 | 19,6M |

### Lo que cuesta, aislado

Corriendo el Real Madrid una temporada completa con el catálogo viejo forzado
(`SPON_REGION['España']=['GLOBAL','LATAM']`) contra el nuevo, mediana de 3:
**+379M → +421M**. O sea el cambio pesa **+42M, el 11%**.

⚠️ **Los +379M por temporada del Real Madrid ya existían** y NO los trajo esta
fase. **Causa encontrada y arreglada en la Fase 23**: era el borderó, que salía
del valor del plantel en vez de la capacidad del estadio. Ver abajo.

⚠️ **`winBonus` amplifica el ingreso ×3,5 por victoria.** Los 0,33/sem extra
del Madrid son 16M teóricos en 49 semanas, pero el delta medido es 42M: la
diferencia son los bonos por partido ganado, que salen de `income*3.5`. Subir
el `income` de un sponsor pega **mucho** más fuerte de lo que dice la ficha.

### Tres cosas más que había que arreglar para que esto sirviera

- **El naming era `'Naming Bombonera'` escrito a mano** y se lo ofrecían a
  cualquiera. Ahora los sponsors con `dyn:'stad'` pasan por `sponName(s)`, que
  lo arma con `G.stadium.name`: "Naming Santiago Bernabéu", "Allianz Santiago
  Bernabéu".
- **El filtro también va en `signSponsor`**, no sólo en la lista: si no,
  `signSponsor('sp5')` firmaba YPF dirigiendo en la Premier. Misma regla que
  las cuatro vías de la Fase 16.
- **Los contratos activos NO se filtran.** `G.sponsors` guarda una COPIA, así
  que un save viejo puede tener Quilmes firmado en el Madrid: ese contrato se
  sigue cobrando hasta que vence. Filtrarlo le borraría al jugador un ingreso
  que ya pactó. Un sponsor sin `region` (save o tabla vieja) se trata como
  LATAM, que es lo que era el juego entero antes de esto.

### Y de paso, 23 capas de blur

Las filas de la pestaña eran **23 `.card` con `backdrop-filter` real**, contra
la regla medida del proyecto ("el vidrio va en los CONTENEDORES, no en las
filas"). Pasaron a `.mpanel`: misma translucidez + borde luminoso, sin blur. La
regresión falla si vuelve a aparecer una `.card` ahí.

⚠️ **MLS y Arabia van con el paquete `EU`, no con `LATAM`.** No tienen marcas
propias en la base, y dejarlas sólo con `GLOBAL` les daba una única opción por
categoría. Emirates es del Golfo y Spotify/Santander/Heineken operan en Estados
Unidos, así que se les abre el mismo mercado premium que a Europa.

## Fase 23: estadios reales — y el borderó que salía del plantel

`STADIUMS_DB` (136 entradas) mapea club → `{name, capacity}` con datos reales, y
`resolverEstadio(name, lg, squad)` lo resuelve en `initGame`. Antes de esto,
**todos los clubes menos los 5 grandes argentinos** jugaban en "Estadio de
&lt;primera palabra&gt;" con capacidad sacada del valor del plantel.

### El bug caro no era el nombre: era el ingreso

`G.stadium.income` es la base de la recaudación por partido (el bloque
`_homeGame` de `applyMatchResult`), y salía de `0.35 + val*0.022` — **lineal en
el valor del plantel**, que en Europa es 10-20 veces el argentino. Medido:

| | borderó por partido | temporada completa (mediana de 3) |
|---|---|---|
| Real Madrid **antes** | **29,7M** | **+282,7M** |
| Real Madrid **ahora** | 3,5M | **+21,4M** |
| Man City antes | 30,3M | — |
| Man City ahora | 2,4M | — |
| Boca (sin cambios) | 1,8M | −14,1M |

Una cancha de 53.400 no recauda 17 veces una de 54.000 por tener mejores
jugadores adentro. Ahora `stadIncomeDe(cap) = 0.3 + cap/25000`, anclado a los
números del pedido (Bernabéu 81.044 → 3,5 · Emirates 60.704 → 2,7).

⚠️ **Boca queda intacto en −14,1M**, que es la línea base documentada en la
Fase 15 (−15,0M): el balance con el que está tuneado el juego no se movió. Los
5 grandes argentinos conservan su `income` escrito a mano en el diccionario.

### Los otros dos bugs que tapaba el nombre genérico

- **`name.split(' ')[0]`** daba **"Estadio de Real"** para el Real Madrid *y*
  la Real Sociedad, y **"Estadio de Man"** para los dos de Manchester.
- **El tope de 48.000 saturaba**: **60 clubes clavados ahí**, o sea el
  Villarreal con la misma cancha que el Bernabéu. Es exactamente el mismo bug
  que ya había tenido la reputación con su tope de 76. El fallback nuevo es
  exponencial y no satura.

### El fallback sale del NIVEL, no del valor

`stadCapDeOvr(ovr)` toma la media de los 11 mejores y usa los dos anclajes del
pedido —OVR 65 → 12.000 y OVR 82 → 45.000, o sea ×1,081 por punto— así que se
extiende sola hacia los dos lados:

| OVR | 58 | 62 | 65 | 70 | 75 | 82 | 88 |
|---|---|---|---|---|---|---|---|
| capacidad | 7.000 | 9.500 | **12.000** | 17.500 | 26.000 | **45.000** | 71.500 |

Se resuelve en `initGame` y no en `buildAllTeams` porque necesita `G.squad`, que
recién existe una vez armado el literal de `G`.

### ⚠️ Las claves son las de la base, no las de memoria

Una clave mal escrita **no dispara nunca** y el club se cae al fallback sin que
nada avise. Escribiendo el diccionario de memoria se coló `'Vélez'`, que en la
base es `'Vélez Sarsfield'`. La regresión ahora verifica que **toda** clave de
`STADIUMS_DB` exista como club en `players-db.js`.

⚠️ **Hay nombres repetidos entre ligas** ('Racing Club' en Argentina y Uruguay,
'Nacional' en Uruguay y Colombia) — el mismo problema que ya documenta
`buildAllTeams`. Esas entradas van con prefijo `Liga|Nombre` y `stadiumDe()`
prueba primero la calificada.

Los estadios **compartidos sí son correctos** y no hay que "arreglarlos": San
Siro (Inter/Milan), Olimpico (Roma/Lazio), Maracanã (Flamengo/Fluminense),
Atanasio Girardot (Nacional/Medellín), El Campín (Millonarios/Santa Fe), King
Abdullah (Al-Ittihad/Al-Ahli) y "Diego Armando Maradona", que es el nombre real
de la cancha del Napoli **y** de la de Argentinos Juniors.

Cobertura: 11-12 clubes de cada liga top europea, 15/20 en Brasil, 20/30 en la
Liga ARG. Chile, Uruguay y Colombia quedan flojos (2-7) y ahí manda el fallback.

⚠️ `TEAMS[].stadName/stadCap/stadInc` ya **no los lee nadie** — `initGame`
resuelve el estadio por `resolverEstadio`. Se mantienen coherentes por si algo
los vuelve a leer, pero la fuente de verdad es el diccionario.

## Fase 24: los patrocinios se negocian, no se compran en una góndola

La pestaña era un supermercado: veías las 40 marcas y firmabas la más cara que
te permitiera la reputación. Ahora las marcas **te buscan**: `weeklySponsors()`
corre en el bloque semanal y, si tenés una categoría libre y les servís por
reputación, aparece una oferta en `G.sponsorOffers` con **tres** números —
`upfront` (prima a la firma, entra a la caja al instante), `weekly` y `bonus`
por salir campeón. Llega un mensaje del Gerente de Marketing al celular.

Retro-compatible sin migrar: `ofertasSponsor()` lee `G.sponsorOffers||[]`, y
`G.sponsors` **no se toca** — los contratos que ya tenías se siguen cobrando.
El contrato que firma `spnFirmar` entra con la MISMA forma de siempre
(`income`/`winBonus`/`obj`), así que el balance semanal, la vitrina y los saves
viejos no se enteran de nada.

⚠️ El estado del modal vive en **`_SPN`, fuera de `G`**, igual que `_PT` y
`_DIL_FX`: es de la pantalla, no de la partida. Verificado: 0 funciones en `G`.

### Sin góndola, ¿el club se muere de hambre? Medido: no

Es el riesgo real del cambio —el mismo de la Fase 22, filtrar sin rellenar— así
que se midió una temporada entera:

| | categorías cubiertas | primas | por semana |
|---|---|---|---|
| firmando todo lo que llega | 9 de 10 | 4,7M | 0,44M |
| **negociando al límite** | 9 de 10 | **6,7M** | **0,65M** |

Contra los 0,66M/semana que daba la góndola eligiendo lo mejor de cada
categoría. O sea: **negociar bien te devuelve exactamente lo que perdiste al
sacar la góndola**, y aceptar sin regatear cuesta un 33% del semanal. Ese es el
juego.

### ⚠️ El techo saturaba, y el número lo delató (tercera vez en este proyecto)

Lo que la marca banca sale del contrato escalado por **cuánto la superás en
reputación**: si estás justo en el mínimo que pide, no tenés nada para apretar.
El primer coeficiente (0,025 por punto, tope 1,35) **saturaba**: contra una
marca de `reqRep` 48, un club de rep 70 ya estaba 22 puntos arriba y quedaba
capado — medido, **+25% con rep 60 y +35% desde rep 70 para arriba**, o sea que
la reputación dejaba de discriminar justo en el rango donde se juega el juego.

Es el mismo bug que ya habían tenido la **reputación** (tope 76) y la
**capacidad del estadio** (tope 48.000). Con 0,012 y tope 1,45 se usa la escala
entera:

| marca | rep 55 | rep 65 | rep 78 | rep 90 |
|---|---|---|---|---|
| chica (`reqRep` 48) | +8% | +20% | +36% | +45% |
| media (65) | 0% | 0% | +16% | +30% |
| premium (84) | 0% | 0% | 0% | +7% |

Contra una marca premium a la que **apenas** calificás no tenés margen, que es
exactamente lo que se buscaba.

### Pasarse tiene precio, y hay un aviso

`spnEnviar()` compara el pedido contra `spnTecho(o)`. Si entra, firman en el
acto. Si no, **primero avisan** ("bajá el pedido o cerramos la carpeta") y al
segundo abuso **se levantan de la mesa y la oferta desaparece** — el mismo
patrón de los dos intentos que ya usa `clausulaResolver`. Los sliders llegan
hasta ×2,2 a propósito: si no te dejaran pasarte, no habría riesgo. El gerente
te da una pista del margen ("ve margen" / "estamos al límite" / "ojo que se
levantan") **sin revelar el número**.

Las ofertas **vencen a las 6 semanas** (`SPN_VENCE`) y el buzón topea en 4.

### ⚠️ Un check de la regresión verificaba "llegó un mensaje" por el LARGO del array

`addPhoneMsg` **topea en 80**: a partir de ahí cada `unshift` va seguido de un
`pop`, así que `G.phoneMsgs.length` **deja de crecer**. El check de mentoreo
comprobaba la herencia con `phoneMsgs.length > msgs0` y empezó a dar falso
negativo apenas otro check llenó el buzón antes — lo destapó justamente el de
ofertas de patrocinio, que manda ~50 mensajes. Ahora compara el **id del
mensaje más nuevo**, que sí cambia siempre. Si escribís un check que verifica
una notificación, no uses el largo.

## Fase 25: auditoría de los 5 pedidos de "reescribir la IA del 2D"

Se pidió reescribir `fmAI` (905 líneas) entero con máquina de estados, gravedad
zonal, raycasting de pases, tiro racional y física desacoplada. **Cuatro de los
cinco ya estaban**, medidos sobre 3 partidos y 670 muestras:

| pedido | estado medido |
|---|---|
| **Gravedad zonal / tethering** | ✅ ya está: el DFI pasa **0%** del tiempo en el campo derecho. `homeX`/`homeY` salen de la posición en el dibujo (`p.hx`/`p.hy`) + `gBase` + `blockLen` |
| **Raycasting en el pase** | ✅ ya está, y es **más fuerte** que un raycast: proyecta cada rival sobre la recta pasador→receptor y compara **tiempo de pelota contra tiempo de defensor**. El score de pase ya premia progresión (`fwdScore`), desmarque (`near`) y respeta la línea de offside |
| **Tiro racional** | ✅ ya está: `canShoot` escala la distancia con el `TIR` del rematador (`_pegada`) y el remate lejano exige TIR ≥74 **y** ángulo central (`\|b.y−mid\|<VH·0.34`) |
| **Física desacoplada** | ✅ ya está: la pelota está **sin nadie a menos de 26px el 70% del tiempo**. No está pegada al pie |
| **Fases de juego** | ❌ **roto de verdad** — ver abajo |

⚠️ **No hay campos de estado por jugador** (`estado`/`state`/`mode`): la IA es
una cascada de condiciones, no una máquina de estados explícita. Funciona, pero
si algún día se reescribe, ese es el cambio estructural.

### El único pedido que faltaba, y el tope duro NO lo arregla

Medido sobre 3 partidos: el equipo termina **más ancho DEFENDIENDO (1039px) que
atacando (923px)**, al revés del fútbol real. El multiplicador ya existe
(`spread` escala ×1,1 con pelota y ×0,8 sin) pero se lo comen los overrides que
vienen después —todos hacia la pelota, los de arriba al área—.

Se probó el **tope duro** al final de `homeY` (piso de amplitud atacando, techo
defendiendo), que es lo que la nota de la mentalidad dejó escrito como "la única
salida medible". Ablación a 5 partidos por escenario, 445 minutos por lado:

| | apagado | encendido (0.30 / 0.36) |
|---|---|---|
| ancho con pelota | 962 | 879 |
| ancho sin pelota | 1003 | 952 |
| **delta buscado** | **−41** | **−73 (PEOR)** |
| pases | 672 | **584** (−13%) |
| remates | 17,8 | **14,0** (−21%) |
| córners | 1,8 | 3,2 |
| faltas | 28,1 | 33,6 |

Con el techo apretado (0.26) fue peor todavía: **los remates se partieron al
medio, de 108 a 56 crudos**. **REVERTIDO.**

⚠️ Y la métrica es **ruidosa entre corridas**: el mismo tipo de código dio
delta **+26, −19 y −73** en tres corridas. Es la misma trampa que ya está
documentada para la posición del bloque (48 partidos por táctica → 51% de
aciertos, azar puro). No sirve para decidir con pocas corridas.

**Por qué falla y qué habría que hacer.** El ancho no lo manda el objetivo
lateral: lo mandan dónde está la pelota y los overrides de ataque al área.
Clampear `homeY` al final pelea contra esos y sólo empeora el posicionamiento
—de ahí que caigan pases y remates—. El arreglo estructural sería que la FASE
cambie la **base del dibujo** (`p.hy`), o sea dos formaciones por equipo que se
intercambian al perder/recuperar la pelota, en vez de corregir el objetivo
final. Eso es un motor nuevo, no un parámetro.

Es el **quinto** intento fallido de comprar comportamiento acá con una
constante. El patrón ya está claro: en este motor la geometría manda sobre los
números.

## Fase 26: los 4 "bugs críticos" del 11v11, medidos uno por uno

Se reportaron cuatro: pelota fantasma/NaN, enjambre, faltas constantes y offside
roto. Medido sobre **5 partidos y 450 minutos**:

| reportado | medido | veredicto |
|---|---|---|
| pelota desaparece / NaN | **0 NaN y 0 ticks fuera de la cancha** en 1.951 muestras | no se reproduce |
| enjambre / se amontonan | **167px** al compañero más cercano (~200 es el reparto ideal); mediana de **0** compañeros a menos de 70px de la pelota | no se reproduce |
| faltas constantes | 25,4 por 90 contra 20-24 reales | apenas alto — **pero ver abajo** |
| offside roto | 3,2 por 90 contra 4-5 reales | se cobra **de menos**, no de más |

### El offside ya estaba exactamente como pedía la especificación

Se evalúa **sólo en el frame del pase** (dentro de `fmTeamPass`), **sólo sobre
el receptor previsto** (`squad[bestI]`) y contra el **2º defensor más atrasado
sin contar al arquero** (`oDefXs` filtra `!o.isGK`). No hay chequeo por frame ni
sobre atacantes que no participan. Endurecerlo lo habría empeorado: ya está por
debajo del rango real.

### Lo único que se agregó: la red de seguridad de la pelota

`fmBallGuard(f)` corre como **última línea de la física**, después de `fmBall()`
(que ya resolvió lateral, córner y saque de arco):

- **NaN** en `x/y/vx/vy/air` → al centro con velocidad 0. Un NaN envenena todo
  lo que lo lee (distancias, colisiones, dibujo) y el partido no vuelve.
- **Fuera de los límites con 40px de margen** → se la mete adentro y se le baja
  la velocidad al 20%. ⚠️ **NO al centro**: mover la pelota media cancha se
  vería peor que el bug.
- Pelota sana → no la toca.

⚠️ **Es un SEGURO, no el arreglo de algo observado**: 0 activaciones en 450
minutos. Verificado determinista en la regresión inyectando los tres casos.

### ⚠️ El cooldown de faltas se probó y se REVIRTIÓ por no poder medirlo

`fmAI` no tiene ningún cooldown: **cada** defensor cerca del portador tira el
dado en **cada** tick. Se implementó uno (marca en `fmFoul`, chequeo en `fmAI`)
y al medirlo el instrumento se contradijo:

| corrida (mismo código, baseline) | faltas por 90 |
|---|---|
| 1 | **25,4** |
| 2 | **3,6** |
| 3 | **4,5** |

**Un factor 7 sobre el mismo código.** Y las ablaciones daban que un cooldown de
faltas **duplicaba los pases** (257 → 521), que es causalmente posible (menos
pitazos = más juego corrido) pero no verificable con un instrumento así.

La causa del ruido está identificada: al terminar el partido **`FM` se reinicia**
y la muestra siguiente trae los contadores en cero, así que el resultado depende
de en qué momento del ciclo cayó el último `setInterval`. Congelar en el minuto
más alto visto no alcanzó.

**Revertido.** La regla del proyecto es explícita: si no se puede verificar, se
dice — no se shippea. Si se retoma, primero hay que arreglar el arnés
(muestrear con un hook dentro del motor en vez de por `setInterval` desde
afuera), y recién ahí tocar el balance.

⚠️ **NO se tocó la hitbox del quite**, que era parte del pedido: la geometría
del robo está calibrada (`winProb` con `DEF` contra `REG`) y en este motor tocar
constantes de geometría salió mal cinco veces documentadas.

### Nombres de campos del motor, para no volver a perder tiempo

| dato | campo |
|---|---|
| minuto del partido | **`f.minute`** (no `f.min`) |
| marcador | **`f.sc`** (array `[my, opp]`) |
| estadísticas | **`f.stat`** (no `f.stats`), con `shots/sot/pass/corner/foul/off` |

## Fase 27: pruebas de inferiores (la camada anual)

`weeklyIntake()` corre en el bloque semanal y en la **semana 30**
(`INTAKE_SEMANA`) genera una camada de 3-5 pibes en `G.youthIntake` — objetos
planos, 0 funciones en `G`, sobreviven al guardado. Llega un mensaje del
Coordinador de Inferiores y se abre el modal (`rIntake`), donde cada chico se
firma o se descarta. Los que no firman **no vuelven**.

⚠️ **La marca de "ya pasó" es la TEMPORADA (`G._intakeSeason`), no un
booleano**: con un booleano las pruebas habrían pasado una sola vez en toda la
carrera. Verificado: dispara, la segunda llamada de la misma temporada no
re-genera, y la temporada siguiente sí.

| | |
|---|---|
| camada | 3-5 jugadores |
| edad | 15-16 |
| media | 45-55 |
| techo de potencial | `60 + nivel*6` → **66 / 72 / 78 / 84 / 90** por nivel de academia |

### ⚠️ El rango de potencial NO se centra en el real

Es la misma lección que la niebla de guerra del mercado: si el rango fuera
`pot±m`, el punto medio **es** el número que estás tratando de adivinar y la
decisión deja de ser una apuesta. El ojeador tiene su propia estimación
(`potEst`), corrida hasta ±`err` y **estable por jugador** (guardada en el
objeto, no recalculada en cada render). Medido sobre ~700 pibes: el real cae
dentro del rango el **100%** de las veces y el punto medio lo clava sólo el
**14%**.

### ⚠️ Los nombres salen de la BASE, no de una lista a mano

La cantera del Real Madrid producía "Thiago González" y "Santiago Romero"
porque `promOne` tenía 6 nombres y 6 apellidos argentinos escritos a mano.
`_youthNames(lg)` arma el pool con los jugadores **reales** de la liga que
dirigís (filtrando por `natsLocales()`), cacheado por liga porque recorre los
17.000 de `PLAYERS_DB`. Medido:

| liga | camada |
|---|---|
| Liga ARG | Valentín Barrios · Mateo Fenoglio |
| España | Àlex Bigas · Xavi Tárrega |
| Italia | Nicola Adorante · Giorgio Trombini |
| Premier | Jake Brewster · Dylan Swanson |

Si una liga tiene menos de 25 locales en la base, cae a la lista argentina.

### ⚠️ El canterano del Real Madrid ocupaba cupo de extracomunitario

`promOne` metía al juvenil con **`'ARG'` y `'Liga ARG'` fijos**. Medido: en el
Real Madrid el pibe subía con `nat:ARG`, `lg:'Liga ARG'` y **`pIsForeign` daba
true** — el cupo pasaba de **4 a 5 con un tope de 3**. Un canterano es local por
definición. Ahora sale de `natLocalPrincipal()` y `ligaMia()`, igual que
nacionalizar. Es el mismo bug que el `'ARG'` fijo de la Fase 14 y el naming de
la Bombonera de la Fase 22: **tercera vez que aparece un valor argentino
escrito a mano en un camino que corre en las 24 ligas.**

## ⚠️ Arrancar una partida NO puede heredar la liga de la anterior

Espejo del bug de "dirigir afuera" que ya estaba documentado — aquel cubría
Real Madrid **después** de Boca, pero no la vuelta.

El wizard fija `_LIGA_ELEGIDA` en su paso 3 (`setLigaSel`), pero entrar directo
por `startGame('boca')` **no la tocaba**: quedaba la de la partida anterior.
Medido: elegir Man City por el wizard y después arrancar Boca daba **Boca
Juniors jugando la Premier, con la primera fecha contra Coventry** y la
nacionalidad local en `ING`.

Arreglado en `startGame`, que ahora fija la global desde `TEAMS[teamId].liga`
antes de llamar a `initGame`. La regresión lo blinda ensuciando la global a
propósito y verificando que Boca vuelva a la Liga ARG sin rivales ingleses en
el calendario.

## Fase 28: masa societaria — el cobro que ya existía, con nombre

### ⚠️ El pedido, tal cual, cobraba las cuotas DOS VECES

"Cada 4 semanas sumá a `G.budget` el resultado de `(G.members * G.memberFee)`"
habría **duplicado un ingreso que ya estaba**: el balance mensual cobra las
cuotas desde siempre, escondidas adentro del rubro *"TV y socios"* con un
divisor mágico —`socios/42.000`— que nadie podía leer como una cuota. Y la
restricción del pedido ("que el cobro no se pise con los sponsors") apuntaba al
lugar equivocado: los sponsors cobran aparte y no chocan con nada; **el choque
real era con el socio**.

Tampoco se creó `G.members`: los socios ya viven en `G.socios` desde que existe
`sociosBase()`, y un segundo campo con el mismo dato son dos fuentes de verdad
que se desincronizan (la misma lección que `G.roles.captain` en la Fase 19).

Lo que se hizo es al revés: se le puso **nombre** al número que ya se cobraba.
`ingresoSocios()` = `socios × cuotaSocio() × humor`, que es **la misma plata**:

```
viejo:  socios*(0,28 + humor*0,0028)/42.000  = socios*(6,667e-6 + 6,667e-8*humor)
nuevo:  socios*10,3*(0,65 + humor*0,0065)/1e6 = socios*(6,695e-6 + 6,695e-8*humor)
```

Barrido de 8 tamaños de club × 21 niveles de humor: **peor desvío 0,83%**.

⚠️ **Tres decimales, no dos.** Con `Math.round(...*100)/100`, un club de 15.000
socios con la gente podrida daba 0,11 contra 0,105 — **4,8% de desvío por
redondeo justo donde menos plata hay**. El balance mensual redondea a un decimal
igual, así que la precisión extra no agrega ruido.

El rubro `tv` quedó como **derechos de TV solos** y las cuotas van a un rubro
nuevo, `socios`, así que la pestaña de Finanzas ahora muestra las dos cosas por
separado. `G.finLast.tv` sigue siendo la suma (lo lee la tarjeta de
Estadísticas, que tiene un solo renglón).

### Los socios reaccionan, y eso sí es nuevo

| evento | efecto | dónde engancha |
|---|---|---|
| salir campeón | **+15%** | `sociosTitulos()` |
| fichar una figura (`rat>=82`) | +5% | `firmasTick` |
| 3 derrotas al hilo | −5% | `updateFans` |
| vender al capitán | −5% | `sacarDelPlantel` |

- **Un solo portero para los títulos.** Hay tres lugares que empujan a
  `G.trophies` (torneo, copa internacional, copa corta) y las ligas largas ni
  siquiera pasan por ahí: el campeonato queda en `G.history[].champion`.
  `sociosTitulos()` es un watchdog sobre el TOTAL, así que no hay que tocar cada
  lugar donde se grita campeón y no se escapa ninguno. Con `G._socTitulos ===
  undefined` (save viejo) **se ancla sin disparar**: si no, cargar una partida
  con seis títulos en la vitrina regalaba seis empujones de golpe.
- **No existía ningún contador de racha de resultados.** Los `streak` del
  archivo son locales del armado del fixture (tiradas de local/visitante) y el
  `racha` del borderó es un multiplicador, no una cuenta. `G._socDerrotas` es
  propio: dispara a las 3, 6 y 9, y se limpia con cualquier resultado que no sea
  derrota.
- **Vender al capitán es distinto de perderlo.** El evento pide `tipo==='sale'`
  **y** `det.monto>0`: una rescisión, un retiro o el fin de un préstamo no son
  rifar al referente. Verificado en la regresión con los dos casos.

⚠️ **Es un EMPUJÓN, no un escalón.** `updateFans` acerca los socios de a 8% por
partido a un objetivo que sale de la reputación, así que el +15% del título se
sostiene sólo si el título además te subió la rep. Es lo correcto: la gente se
asocia con la ilusión y se borra si el club vuelve a ser el mismo.

### Lo que cuesta, medido con ablación

Temporada completa de Boca, 3 corridas por escenario, con los cuatro `pct` en 0
contra los valores reales:

| | socios al cierre | cuotas de la temporada |
|---|---|---|
| eventos apagados | 230-242k (**mediana 241k**) | 35,3M con 1 título |
| eventos encendidos | 262-264k (**mediana 262k**) | 38,0M con 1 título |

**+8,7% de masa societaria** y, a igual cantidad de títulos, **+7,7% de cuotas**
(≈ +2,8M por temporada). El Δ presupuesto de la temporada no se puede leer
directo de esta tabla: está dominado por cuántos títulos salieron en cada
corrida (las corridas "apagado" sacaron 3/1/2 y las "encendido" 1/1/2), que es
justamente lo que mueve la rep y la TV. Si algún día hay que apretar la
economía, el lugar es `SOC_EVENTOS.titulo.pct`.

### ⚠️ Un check de la regresión no puede sacar jugadores del plantel

El check nuevo probaba "vender al capitán" con `G.squad[0]`, y eso **rompió el
de mentoreo**, que corre después: el mentoreo elige mentor con un `find` sobre
`G.squad`, así que con dos jugadores menos caía en otro —a veces lesionado— y
la herencia no arrancaba nunca. Aislado daba **12 de 12**; dentro de la
regresión, falso negativo intermitente.

La regresión corre en **una sola sesión compartida**: lo que un check toca, lo
tiene que devolver. Ahora los capitanes de prueba son clones descartables
(`regCap1`/`regCap2`), se borran al final y el check verifica que el plantel
quede del mismo largo. Es el mismo tipo de trampa que el `phoneMsgs.length` de
la Fase 24: el check falla por el vecino, no por lo que prueba.

### Y de paso, el cuarto `'Liga ARG'` escrito a mano

`firmasTick` metía a **todos** los refuerzos con `p.lg='Liga ARG'` fijo: un
fichaje del Real Madrid quedaba anotado como jugador de la liga argentina. Es la
**cuarta** vez que aparece el mismo patrón (después del `'ARG'` de nacionalizar,
el naming de la Bombonera y el `'ARG'`/`'Liga ARG'` de `promOne`). Ahora sale de
`ligaMia()`.

## Fase 29: los dilemas ahora FRENAN el club

El motor de dilemas ya existía (`DILEMAS`, `weeklyDilema`, `dilemaResolver`) y
la parte que faltaba no era el banco de escenarios sino la **interrupción**.
Medido antes de tocar nada, con un dilema abierto:

| | antes |
|---|---|
| pasar el día | ✅ pasaba |
| simular el partido | ✅ jugaba |
| abrir el plantel | ✅ |
| modal en pantalla | ❌ nunca aparecía |
| quedaba en `G.news` | ❌ no |

O sea: llegaba al celular y se podía jugar la temporada entera sin contestar.

### Las cinco puertas del tiempo

`dilemaBloqueante()` + `dilemaFrena()` cierran **`advanceDay`, `playMatch`,
`startFullMatch`, `simMatch` y `runContinuousSim`**. Medido en 4 temporadas
completas: **4,3 dilemas del pool por temporada y 4,3 frenos** — frenó el 100%
de las veces.

⚠️ **`runContinuousSim` necesita su propio portero.** Bloquear `simMatch` no
alcanza: el bucle de la simulación continua ve `m.played` en `false` y hace su
`G.week++` de fallback, así que habría seguido corriendo las semanas sin jugar.

⚠️ **El portero no rebota: vuelve a abrir el modal.** Si sólo dijera "no
podés", una partida recargada con el modal cerrado quedaba trabada sin forma de
llegar a la decisión.

### ⚠️ El candado NO puede ser un flag propio — el juego se trabó, medido

Primer intento con un `_DIL_LOCK` booleano y salió un soft-lock de verdad: el
dilema salta **dentro del bloque semanal**, o sea DURANTE la resolución del
partido, y el resumen del partido abre su modal un instante después y lo pisa.
Con el flag puesto, `closeMod` seguía viendo "hay un dilema" y **se negaba a
cerrar un resumen que no tiene botones para contestar**. Reproducido:
`PANTALLA_TRABADA: true`, sin salida.

El candado ahora se **deriva del DOM**: `dilemaEnPantalla()` mira si lo que se
está viendo tiene los botones `dilemaResolver(`. `closeMod` se niega sólo en
ese caso, y **al cerrar cualquier otra cosa vuelve a asomar el dilema**. Con
eso el resumen del partido se lee entero y la decisión igual es inevitable.
Verificado: se pisa el modal → se cierra el resumen → aparece el dilema con sus
botones.

Es la misma lección de `G.roles.captain` y `G.members`: **un estado derivable no
se duplica en una variable**, porque las dos se desincronizan.

### Bloquea el POOL, no la indisciplina mensual

Sólo frena lo que lleva `bloquea:true`, que lo pone `weeklyDilema`. La
indisciplina mensual (`weeklyIndisciplina`, **7,0 por temporada medidas**) sigue
viviendo en el celular a propósito: frenar el juego nueve veces al año por la
misma macana sería un peaje, no una decisión. Un dilema de un **save viejo**
tampoco tiene la marca, así que no traba una partida en curso — se sigue
contestando desde el teléfono.

### Los 4 escenarios institucionales

Los seis viejos giran alrededor de un jugador; estos cuatro son del CLUB. Van al
mismo pool (el motor ya resuelve una vez por temporada cada uno, nunca dos
abiertos, `fx` fuera de `G`). Medido: **41% de los dilemas que salen son de los
nuevos** (7 de 17 en 4 temporadas), que es lo que corresponde a 4 de 10.

| dilema | A | B |
|---|---|---|
| 🌱 campo destruido | replantar 0,5M → lesiones **×0,80** | jugar así → lesiones **×1,35** |
| 🍾 fiesta antes del clásico | multar **+0,2M**, moral de los 3-4 al piso, autoridad **+12** | taparlo → moral intacta, **−4 de reputación** |
| 🚌 micro roto | chárter 0,1M → **química +10** | micro barato → **física al 80%** en el próximo partido |
| 💸 sueldos atrasados | pagar (~3,5M) → moral del plantel a **84** | pedir que aguanten → moral a **54** |

- **El estado del campo vence solo.** `G.campoEstado` es un objeto plano
  `{mult,hasta,nombre}` con vencimiento por semana, y `campoFactor()` multiplica
  el `injChance` del bloque semanal. Verificado: 1 → 1,35 → sigue 1,35 en la
  semana del borde → 1 y se limpia solo. Un save viejo no lo tiene y da 1.
- ⚠️ **La física del micro NO se puede aplicar al decidir.** Entre la decisión y
  el partido corren los días y la recuperación diaria (+1,6/día) se come el
  castigo — es exactamente el error de `fitIni` que ya está documentado en la
  pretemporada. Se guarda en `G.dilFitProx` y lo ancla `dilFitTick()` cuando
  arranca el partido, una sola vez. Medido: **100 al decidir → 100 tras 4 días
  → 80 en la cancha**, y llamarlo de nuevo no repite el castigo.
- Los fiesteros salen de `_dilFiesteros()`: 3-4 con peso hacia los titulares,
  que son los que hacen ruido en la tapa del diario.

### La decisión queda en el historial

`dilemaResolver` ahora escribe en **`G.news`** (`type:'misc'`) además del
celular y el log: la decisión es parte de la gestión y tiene que poder releerse.
⚠️ Ojo que `G.news` topea en `AI_NEWS_MAX` (50) y los rumores de transferencias
lo llenan rápido, así que las decisiones viejas se caen de la lista.

### ⚠️ Frenar el club rompe TODO bucle que simule una temporada

Es la consecuencia menos obvia del cambio y apareció en tres lugares:

- **En el juego**, `runContinuousSim` tenía el bug de verdad: el portero de la
  entrada no alcanza porque el dilema puede saltar **en medio** de la seguidilla
  (cae en el bloque semanal del partido recién jugado). A partir de ahí cada
  `simMatch` volvía bloqueado, `m.played` quedaba en `false` y el `G.week++` de
  fallback **quemaba una semana por iteración sin jugar un solo partido**. Ahora
  el bucle corta con `if(dilemaBloqueante())break;`.
- **En la regresión**, cuatro bucles de temporada se colgaron, y **dos pasaron
  en verde igual**: "temporada completa" contaba *iteraciones*, así que informó
  **900 partidos** en vez de 55 y se dio por bueno; los playoffs bajaron de 4
  llaves a 2 y su assert seguía dando `true`. Es el mismo pase vacío que ya
  había tenido el check de memoria con los `every` sobre arrays vacíos.

Ahora hay un `dilResolver()` compartido arriba de la regresión por el que pasan
los cuatro bucles, y el de temporada completa **exige 40+ partidos jugados de
verdad** en vez de contar vueltas.

### Lo que NO se tocó, y por qué

- **La probabilidad sigue en 8,5% por semana**, no 10%. El pedido decía "ej.
  10%": la diferencia son 0,75 dilemas por temporada, ruido contra los 4,3
  medidos. Cambiarla no se puede verificar con temporadas sueltas.
- **No se creó `triggerDilemma()`**: `weeklyDilema()` ya es esa función y está
  cableada en el bloque semanal con el pool, el "uno por temporada" y el "nunca
  dos abiertos" ya resueltos.
- **`G.morale` SÍ existe** — esta nota decía lo contrario y estaba mal (ver
  Fase 34). Es el medidor del CLUB: está en el literal de `G`, lo dibuja la
  barra de la UI y entra en `matchStrengths`. Lo que sí es cierto es que
  **`G.morale` y `p.morale` son cosas distintas**, y que la moral que mueve el
  rendimiento semanal y el `badSpell` es la de cada jugador. Por eso los
  dilemas que "bajan la moral" recorren el plantel en vez de tocar sólo el
  medidor.

## Fase 30: `DT_ARCHETYPES` — y la regla general de qué se puede tocar en el 11v11

Se pidieron cuatro palancas para que los arquetipos muevan el 11v11
(`lineaDefensiva`, `presionAgresividad`, `riesgoPase`, `amplitud`). **Las
cuatro ya existían** en el motor como `prof.line`, `prof.press`, `prof.direct` y
`prof.width`/`prof.flank`. Lo que faltaba era saber **cuáles funcionan**, y eso
se midió con un arnés nuevo.

### El arnés: hook DENTRO del motor, no `setInterval` desde afuera

La lección del cooldown de faltas (que se contradijo 7× sobre el mismo código)
era explícita: *"muestrear con un hook dentro del motor"*. `scratchpad/arq1.js`
envuelve **`fmTick`** —que es el loop real— y **`fmTeamPass`**, así que cada
muestra es un tick determinista y no depende de cuándo cayó un temporizador.
56.800 ticks por escenario, 170.000 en total.

⚠️ **`startFullMatch(true)` no alcanza para arrancar un partido de prueba: hay
que poner `G.day=7` antes.** Si no, sale por la guarda de "sólo se juega el día
del partido" y `FM` queda con `phase:null` — se pierde una corrida entera
mirando ceros. La receta de arriba en este archivo es de antes de esa guarda.

### Sólo 1 de las 4 palancas separa, y el patrón es nítido

| palanca | qué es en el motor | resultado medido |
|---|---|---|
| **`riesgoPase`** (`prof.direct`) | **una DECISIÓN**: qué pase elige | ✅ **funciona y es monótona** |
| `presionAgresividad` (`prof.press`) | umbral de radio de persecución | ❌ no monótona |
| `lineaDefensiva` (`prof.line`) | objetivo blando de posición | ❌ no monótona |
| `amplitud` (`prof.width`/`flank`) | objetivo blando + peso chico en el score | ❌ no monótona |

**`riesgoPase`, sobre 4 arquetipos:**

| `direct` | pases hacia adelante | pelotazos | fuerza del pase | pases totales |
|---|---|---|---|---|
| 0,10 posicional | **51%** | **1,0%** | 4,61 | 1.136 |
| 0,45 gegenpress | 58% | 3,9% | 3,81 | 663 |
| 0,62 bloquebajo | 64% | 3,0% | 3,55 | 861 |
| 0,88 directo | **74%** | **9,5%** | 5,57 | 494 |

Monótona en las dos columnas que importan y con un rango de **9,5×** en
pelotazos. Ésta es la palanca de verdad.

**`presionAgresividad`, aislada** (las otras nueve claves CLAVADAS — si se
cambia el arquetipo entero no se sabe cuál de las diez movió el número) y
**condicionada a que la pelota la tenga el rival** (sin condicionar se mide
posesión, no presión: posicional daba 1.136 pases contra 663):

| `press` | dist. del más cercano | jugadores a <300px | a <150px |
|---|---|---|---|
| 0,92 | 175 | 2,69 | 1,12 |
| 0,50 | 174 | **3,00** | 1,14 |
| 0,25 | 184 | 2,60 | 0,82 |

**Con 0,50 se presiona MÁS que con 0,92.** El `radio=(430+press*380)` existe,
pero lo tapa que sólo persiguen los 2-3 primeros del ranking (`myRank`) y que la
densidad natural de la formación cerca de la pelota manda sobre el umbral.

**`lineaDefensiva` y `amplitud`** re-confirman lo que ya estaba documentado:
gegenpress (`line` 0,80) juega **más atrás** (30,5% de cancha) que bloque bajo
(`line` 0,18, 33,4%), y el equipo más ancho es directo (974px) con `width` 0,55,
por encima de posicional (889px) con 0,78.

### ⚠️ Sexto intento fallido de comprar comportamiento con una constante

`flankBias` topeaba en ±25 contra un `Math.random()*40` del mismo score, así que
la hipótesis era buena: subirlo debería destapar la amplitud. Se probó
**60 → 170** y salió **peor**:

| `flank` | apertura con 60 | apertura con 170 |
|---|---|---|
| 0,92 | 34,1% | 35,5% |
| 0,55 | 39,9% | **26,6%** |
| 0,30 | 35,0% | **37,2%** |

Con 170 el de `flank` 0,30 quedó **más ancho** que el de 0,92, y el caso del
medio saltó **13 puntos entre corridas** — más ruido que cualquier efecto
buscado. **REVERTIDO**, queda en 60 con el número anotado en el código.

### La regla que sale de todo esto

**En este motor funcionan las palancas que cambian una DECISIÓN (qué pase
elige), no las que cambian un OBJETIVO DE POSICIÓN (dónde se para).** Es la
explicación de los seis intentos fallidos: el bloque, la amplitud por fase, el
tope duro de `homeY`, el cono del desvío, el cooldown de faltas y ahora
`flankBias`. Antes de tocar el 11v11, preguntate si lo que estás moviendo es una
decisión o un objetivo blando.

### Lo que sí se entregó

- **`DT_ARCHETYPES`**, la cara del arquetipo que mira el motor, con los cuatro
  nombres del pedido. ⚠️ **Es DERIVADA de `ARQ[k].prof`** vía `_arqEngine()`, no
  una segunda tabla: escribir los mismos números dos veces en unidades distintas
  es exactamente el bug que ya apareció en `G.members`/`G.socios`,
  `G.captainId`/`G.roles.captain` y `_DIL_LOCK`/DOM. Para retocar un arquetipo el
  lugar es `ARQ`, y la tabla del motor se recalcula sola (verificado en la
  regresión: cambiar `direct` a 0,11 mueve `riesgoPase` a 0,11).
- **`locolindo`, el 15º arquetipo** 🤪 — línea 0,93 y amplitud 1,278, los dos más
  altos de los quince, con cinismo 0,06 y la disciplina más baja (0,28). Es el
  contrario exacto del resultadista.

### El caso Resultadista/Copero YA estaba, y anda

`fmAdjustProfile` (línea 18964) lo resuelve desde antes: ganando y pasado el
minuto 62, `hold=min(1,late)*(0.35+cyn*0.65)` baja `line` y `press` **escalado
por el cinismo**. Verificado:

| Resultadista (`cyn` 0,94) | línea | presión | modo |
|---|---|---|---|
| empatando, min 40 | 0,320 | 0,380 | normal |
| **ganando, min 80** | **0,078** | **0,169** | **hold** |
| perdiendo, min 80 | 0,559 | 0,581 | allout |

Y el Loco lindo, que no tiene cinismo, **cae 0,098 contra los 0,242 del
resultadista**: no se cuelga del travesaño. Además `_mode==='hold'` sí tiene
efecto medible, porque entra en `fmTeamPass` (`longChance*0.3` y `fwdW=0.06`) —
o sea que actúa por la palanca que funciona, la de decisión.

## Fase 31: las DOS FORMACIONES por fase — implementadas, medidas y REVERTIDAS

Tres fases seguidas dejaron escrito que "la única salida estructural" para que el
bloque responda era **cambiar la base del dibujo (`p.hy`), o sea dos formaciones
por equipo que se intercambian al perder/recuperar la pelota**. Se hizo. **No
funciona tampoco**, y ahora sabemos por qué.

### Qué se construyó

Cada jugador pasó a tener tres pares de coordenadas en vez de uno:
`hx0/hy0` (el dibujo, intocable salvo el espejo del entretiempo), `hxA/hyA`
(atacando) y `hxD/hyD` (defendiendo). `p.hx/p.hy` —que es lo que leen `homeX` y
`homeY`— pasó a ser la forma VIGENTE. `fmShapeApply()` deriva las dos formas del
perfil del DT ya ajustado por el marcador, y `fmShapeTick()` las intercambia
según `f.possSide` con histéresis de 26 ticks.

El bloque se **comprime**, no se traslada: atacando los de atrás suben ×1,15 y
los de arriba ×0,40; defendiendo al revés (×0,45 / ×1,40). Trasladarlo entero
pondría a los once en fila.

### El mecanismo anda EXACTO — eso está verificado sin estadística

Sonda determinista sobre 15.472 ticks (`scratchpad/fase0.js`):

| | |
|---|---|
| `hx0` del volante | 925 |
| `hxA` (atacando) | **1.229** — hacia el arco rival |
| `hxD` (defendiendo) | **763** — hacia el propio |
| la fase sigue a la posesión | **99,8%** de los ticks |

O sea: la base se mueve, en la dirección correcta, y el cambio de fase engancha
bien. Nada de esto es dudoso.

### Y sin embargo el resultado emergente sale al revés

Ablación, métrica agregada sobre todos los ticks, condicionada a la posesión:

| | ancho atacando − defendiendo | bloque atacando − defendiendo |
|---|---|---|
| apagado | −54 | −3,3 |
| **encendido (sube + ensancha)** | **−195** | **−10,9** |
| sólo estrecha al defender | −13 | −2,0 |

Encendido es **claramente peor** (el equipo termina más angosto y más atrás
atacando, que es justo lo que se quería corregir). La variante conservadora
queda **dentro del ruido del propio baseline**: las tres corridas de "apagado"
dieron Δ ancho **−37, −8 y −54**, así que una mejora de 41px no se puede
distinguir de nada.

**REVERTIDO ENTERO.** Es el **séptimo** intento fallido, y el más caro, porque
falsifica la salida que las Fases 25, 29 y 30 habían dejado anotada como "la
buena".

### Las dos cosas que sí se aprendieron

1. **La base del dibujo también es un objetivo blando.** Se creía que `p.hy` era
   distinto de `baseShift` porque es la ENTRADA de la cascada en vez de una
   corrección al final. No lo es: los overrides que empujan a todos hacia la
   pelota dominan la posición final **sin importar dónde esté la base**. Mover la
   base sólo cambia de dónde salen antes de ser arrastrados.
2. **El dibujo YA usa todo el ancho de cancha** (`toMyXY` mapea `s.x` 0-100 a
   `y` 0-1600), así que "abrirse atacando" es **geométricamente imposible**: el
   clamp de banda se lo come y sólo el estrechar tiene efecto. Por eso la
   asimetría del resultado. Para que el ancho pueda crecer habría que dibujar la
   formación base más angosta, y eso recalibra todo lo demás que cuelga de ella.

### Qué queda abierto (y qué NO intentar de nuevo)

La conclusión de la Fase 30 se refuerza en vez de romperse: **en este motor sólo
funcionan las palancas que cambian una DECISIÓN** (qué pase elige, adónde va la
pelota). Ninguna palanca posicional ha funcionado nunca acá — ni la constante, ni
el tope duro, ni la base del dibujo.

Si alguna vez se retoma, lo único que queda sin probar es **tocar los overrides
mismos**: que la cascada de `fmAI` que manda a todos hacia la pelota mire la
fase antes de disparar (por ejemplo, que defendiendo sólo los 3 más cercanos
persigan y el resto ignore la pelota). Eso no es un parámetro ni una base: es
cambiar quién decide moverse, que es la única categoría que en este motor da
resultados. Y ojo que ahí se toca la marca y el offside.

## Fase 32: se tocaron los OVERRIDES — y acá se cierra el tema para siempre

Era lo último que quedaba sin probar: que la cascada de `fmAI` **mire la fase
antes de mandar a todos hacia la pelota**. Se hizo, y de paso apareció la causa
raíz de los siete fracasos anteriores.

### La causa raíz, que estaba a la vista en dos líneas

```js
let bCen = b.x + dirF*(...)                              // el bloque se ancla a la PELOTA
let homeY = mid + spread + (b.y-mid)*(theyHave?0.22:0.10);  // los ONCE se corren hacia la pelota
```

**La formación no es la referencia de nada — la pelota lo es.** `p.hx` entra sólo
como `depth01` (el rango dentro del bloque) y `p.hy` sólo como `spread`. Por eso
daba igual dónde estuviera la base del dibujo (Fase 31), dónde estuviera el tope
(Fase 25) o cuánto valiera la constante (Fases 13, 24, 30): **el jugador ignora
su posición y se va atrás de la pelota**, siempre.

### Qué se probó

`FM_FASE={lat,lon}`, con `_libre=(myRank-2)/4` (0 para los tres más cercanos, 1
del séptimo en adelante):

- **`lat`** corta el arrastre lateral `(b.y-mid)*0.22` para el que está lejos.
- **`lon`** ancla su profundidad al dibujo (`p.hx`) en vez de a la pelota.

Es un cambio de **decisión** —quién se mueve—, no de posición, que es la única
categoría que en este motor había dado resultados.

### Resultado, con pases y remates adentro

| | Δ ancho | Δ bloque | pases/90 | remates/90 |
|---|---|---|---|---|
| apagado | −188 | −8,9 | 255 | 10,4 |
| lat 0,6 | −191 | −6,0 | 313 | 8,3 |
| **lat 1,0** | **−401** | **−14,8** | **163** | **4,4** |
| sólo lon | −302 | −12,9 | — | — |

`lat 1.0` **parte los remates al medio** (10,4 → 4,4) y empeora las dos métricas
buscadas. `lat 0.6` no se distingue del apagado y cuesta 20% de remates. `lon` es
el mismo desastre que las dos formaciones. **REVERTIDO.**

### ⚠️ Lo importante no es el fracaso: es que la MÉTRICA no sirve

El mismo escenario "apagado", con **código idéntico**, dio:

| corrida | Δ ancho | Δ bloque |
|---|---|---|
| A | −65 | −1,0 |
| B | −188 | −8,9 |

**123px y 7,9 puntos de diferencia sobre el mismo código.** Eso es más grande
que el efecto de cualquiera de los ocho mecanismos probados. O sea: **la
diferencia de amplitud/bloque entre atacar y defender NO SE PUEDE MEDIR en este
motor con corridas de este tamaño**, y sin medirla no se puede decidir nada.

Retroactivamente eso explica los ocho "fracasos": algunos capaz no fracasaron,
pero son **inverificables**, y en este proyecto inverificable = no se shippea.

### 🛑 EL TEMA ESTÁ CERRADO. No lo intentes nueve.

Probado y revertido, con números, en este orden: constantes de `baseShift` ·
empuje asimétrico · tope duro de `homeY` · cono del desvío · cooldown de faltas ·
`flankBias` · dos formaciones por fase · overrides conscientes de la fase.

**Si alguien lo retoma, lo PRIMERO no es tocar el motor: es construir un arnés
que pueda medir esto.** Mientras el baseline se mueva ±120px entre corridas
idénticas, cualquier resultado —bueno o malo— es una moneda. Un arnés que
serviría: fijar la semilla del `Math.random` del motor y correr el mismo partido
con y sin el cambio, comparando tick a tick en vez de por promedios.

Y lo que **sí** funciona y ya está entregado sigue siendo lo mismo: las palancas
de **decisión** (`prof.direct` en el pase: 51% → 74% de pases hacia adelante y
1,0% → 9,5% de pelotazos, monótono y medido).

## Fase 33: aprobación presidencial y destitución

### ⚠️ NO se creó `G.approval` — la aprobación ya existía, derivada

El pedido era inicializar `G.approval=75` y moverlo a mano en cada evento. Eso
habría sido la **quinta** vez que este proyecto se hace el mismo daño: un campo
nuevo con un dato que ya vive en otro lado y que se desincroniza (`G.members` vs
`G.socios`, `G.captainId` vs `G.roles.captain`, `_DIL_LOCK` vs el DOM,
`DT_ARCHETYPES` vs `ARQ`).

La aprobación **ya se mueve sola en cada partido**: `boardConf` sube 3 por
victoria y baja 4 por derrota, `fanMood` lo mismo vía `updateFans`, y el piso de
la elección ya era literalmente `(boardConf+fanMood)/2 < 45`. O sea: el número
existía, la fórmula existía y el juego ya la usaba para decidir si te quedabas.
Lo único que faltaba era **mostrarla y darle consecuencias**.

```js
function aprobacion(){
  const cd=(G.boardConf===undefined?50:G.boardConf);
  const hi=(G.fanMood===undefined?55:G.fanMood);
  return Math.max(0,Math.min(100,Math.round((cd+hi)/2)));
}
```

Con eso, los seis eventos del pedido (ganar +2, perder −3, clásico +5, balance
mensual ±, venta de figura) **cuatro ya estaban aplicados** por los medidores de
siempre. Se agregaron los **dos que faltaban de verdad**:

- **Balance mensual**: en rojo `boardConf −10`, con caja arriba de `wages*6`
  `+5`. Antes el presupuesto no tocaba la confianza de la CD en ningún lado.
- **Vender a una leyenda o al capitán**: `fanMood −18` y `boardConf −12`, que
  dan exactamente los **−15 de aprobación** que pedía el pedido. Va en
  `sacarDelPlantel` (el embudo único), y exige `tipo==='sale'` **y**
  `det.monto>0`: rescindir, retirarse o volver de un préstamo no es rifar al
  referente. Medido: capitán −15, leyenda −15, rescisión 0.

⚠️ **Retro-compatible sin migrar**: no hay campo que agregar al save. Un
guardado viejo ya trae `boardConf` y `fanMood`, así que la aprobación funciona
en una partida en curso desde el primer render.

### Medido antes de elegir los umbrales

| escenario | aprobación |
|---|---|
| temporada normal de Boca | nunca baja de 43,5 y **se clava en 100** |
| 10 derrotas al hilo (modelo aislado) | 50 → **2,5** (cruza 25 en la 6ª, 15 en la 8ª) |
| 16 victorias al hilo | satura en 100 |
| desde 9, diez victorias | vuelve a 54 |

O sea: con el juego andando bien **el game over no dispara nunca**, y hace falta
un desastre sostenido de 8-10 partidos para cruzar el umbral. Eso es lo que se
quería. Los umbrales quedaron en `APROB_CRISIS=15` durante `APROB_SEMANAS=4`, y
un piso duro en `APROB_PISO=5` que destituye en el acto.

⚠️ **El piso tiene que ser 5, no 0.** `boardConf` está clampeado con
`Math.max(5,...)` en el golpe por derrota, así que la aprobación **no puede
llegar a 0** ni con 60 derrotas seguidas (medido: se planta en 2,5). Un game
over atado a 0 no se habría disparado jamás.

### El freno del tiempo reusa el patrón de los dilemas

`juegoTerminado()` + `finFrena()` se cuelgan de las **mismas cinco puertas** que
ya tenían los dilemas de la Fase 29 — `advanceDay`, `playMatch`,
`startFullMatch`, `simMatch` y `runContinuousSim` — con `if(finFrena())return;`
**antes** de `if(dilemaFrena())return;`: si te destituyeron, no importa que
quede un dilema sin contestar.

El modal es un overlay **propio** (`#destOv`, `z-index:99999`), no el `#modOv`
del juego: así `closeMod()` no lo toca y no hay forma de seguir jugando por
atrás. Verificado que sobrevive a un `closeMod()` suelto.

### ⚠️ El bug que casi brickea un save: "seguir la carrera en otro club"

`checkFired` ya ponía `G._fired=true` al final de una temporada mala **y no lo
leía nadie** — la destitución existía sólo como texto. Al engancharle el portero
del tiempo, apareció el camino que el modal viejo de fin de ciclo ya ofrecía:
**"📨 Ver ofertas de otros clubes"**, que cierra el modal y te deja asumir en
otro club con `G._fired` **todavía puesto**.

`acceptCareerOffer` tiene dos ramas. La de un club **con plantel jugable** llama
a `initGame` y rearma `G` entero, así que se limpiaba sola. La de un club **sin
plantel propio** conserva `G`: ahí el juego quedaba **frenado para siempre**, sin
modal en pantalla y sin manera de destrabarlo. Parcheadas las dos, más el reset
en `initGame`.

Y un segundo agujero en la misma rama: conservar `G` también conserva los
medidores. Venías de una destitución con la CD en 5 y la hinchada en 0, asumías
en el club nuevo con **aprobación 2** y te echaban a la semana siguiente. Un
mandato nuevo arranca con medidores nuevos (`boardConf 50`, `fanMood 55`),
igual que hace `initGame` en la otra rama.

La regresión blinda el camino entero: destituye, acepta una oferta de un club
que no está en `TEAMS`, y verifica que el día avance y que la semana siguiente
no vuelva a destituir.

### La barra

`rAprob()` dibuja `#presAprob` dentro de la tarjeta de la pestaña Presidente:
número grande, barra de progreso y rótulo por tramo (`Respaldo total` /
`Gestión aprobada` / `En la cuerda floja` / `Crisis institucional`), más el
contador de semanas en crisis cuando lo hay. Colores por `aprobColor()`: verde
arriba de 50, oro arriba de 25, rojo de ahí para abajo.

Sigue el estándar de vidrio: la `.card` lleva `backdrop-filter` real y las filas
de adentro van en `.mpanel` sin blur. La regresión falla si aparece uno.

Antes de destituir hay **dos avisos al celular** (la primera semana en crisis y
la anteúltima), y si repuntás el contador se limpia con un mensaje de que la CD
levanta la reunión.

## Fase 34: personalidades ocultas

Cada jugador tiene una cabeza además de una media: **Normal 60% · Mercenario
15% · Leal 15% · Conflictivo 10%**. No se ve en ningún lado — se descubre
negociando, renovando o dejando a alguien en el banco.

### ⚠️ NO hay un campo `p.personality` guardado, y no es pereza: son 395 KB

El pedido decía "asignale a cada jugador una propiedad `p.personality`".
`G.market` tiene **17.000 fichas** y el save ya pesa 3,2 MB. Medido guardando
el campo en todas: **3.147 KB → 3.542 KB, +395 KB** para un dato que se puede
derivar del nombre. Es la misma regla que ya salvó a `G.socios`,
`G.roles.captain`, `DT_ARCHETYPES` y `G.approval`: **un estado derivable no se
duplica**.

`persDe(p)` es el único portero. Honra `p.personality` si alguien lo fijó a
mano, y si no lo deriva del hash del nombre — **el mismo hash que ya usa
`antiguedadInicial`** (se probó uno con avalancha y da igual).

Medido sobre los 17.108 nombres reales de la base: **59,8 / 15,1 / 14,9 /
10,1**. En el mercado vivo de una partida, 59,8 / 15,1 / 15,1 / 10,0.

⚠️ **Es determinista a propósito.** Si se sorteara al leer, **recargar la
partida hasta que te toque un Leal sería una estrategia**. El `salt` por
carrera (`G._persSalt`, que se ancla en la primera lectura como
`G._socTitulos`) hace que el mismo jugador no sea siempre lo mismo en todas
tus partidas: medido, cambia el **58,9%** de las personalidades, contra un
máximo teórico de 58,5% con estos pesos. Verificado que sobrevive a guardar y
cargar sin re-sortear, y que un save viejo sin el campo ancla solo.

### El recargo del mercenario va en el EMBUDO, no en el modal

El pedido decía "modificá `negStep3`". Puesto ahí, **entrar por la cláusula lo
esquivaba** — es el mismo agujero de las cuatro vías de la Fase 16. Va en
`_negWageExpect`, que es lo que leen negociar, cláusula, canje y préstamo vía
`openPlayerTerms`. Medido: **×1,40 exacto**.

La renovación (`openContract`) es la excepción: **no usa `_negWageExpect`**,
tiene su propia cuenta (`rat*0.55`), así que el recargo hay que aplicarlo
aparte. Está.

### La ruptura instantánea es lo que le da precio al 40%

Sin eso el rechazo era gratis: el modal ofrece "↔ Mejorar oferta" y podías
tantear el número hasta dar con el que acepta. Con el mercenario **se termina
el tanteo** — `window._negData=null`, sin botón de mejorar, y lo mismo en
`ptSubmit` (tope de intentos 1 en vez de 3), que es la puerta de la cláusula,
el canje, el libre y el préstamo. Verificado que el **Normal conserva** su
segunda chance: es la asimetría lo que se prueba, no que el mercenario corte.

### El Leal: el preview tiene que decir la verdad

`renovPiso(p)` devuelve **0,80 para el leal y 0,85 para el resto**, y lo leen
**los dos** lugares: `submitContract` (la decisión) y `updContract` (el
semáforo). Si el semáforo dijera "🔴 rechazará" y el leal firmara igual, se
leería como un bug del juego, no como una personalidad.

### ⚠️ El umbral del Conflictivo, tal cual se pidió, NO disparaba NUNCA

El pedido era `rat>75` y **menos del 30% de los partidos**. Medido sobre una
temporada completa de Boca (49-51 partidos): de los **13 jugadores que pasan
de 75, el que menos jugó llegó al 35%**, y el resto va de 49% a 90%.
**Cero candidatos.** El motor rota y tapa lesiones, así que en el acumulado
nadie baja de un tercio.

| rat>75, % de partidos jugados | 35 · 49 · 51 · 53 · 65 · 71 · 71 · 73 · 73 · 78 · 84 · 90 · 90 |
|---|---|
| bajo 30% | **0** |
| bajo 50% | 2 |

Y el acumulado de temporada tampoco sirve como señal aunque se bajara el
número. Medido sobre un jugador al que se dejó afuera a propósito, su
porcentaje fue **50 → 63 → 63 → 69 → 73 → 71**: después del segundo mes ya casi
no se mueve, o sea que dejar de ponerlo HOY no se nota en el número hasta
dentro de medio año — al revés de cómo funciona un vestuario.

**Por eso la medida es una VENTANA MÓVIL**: cuántos de los partidos del último
mes jugó. Ahí el 30% del pedido sí significa algo (de 4 partidos, jugó 1 o
ninguno) y reacciona en el mes. El checkpoint son dos números planos
(`G._persPJ0`, `p._persApps0`), con guarda para el salto de temporada: los
contadores vuelven a 0 y sin la guarda la ventana daba negativa y el evento se
disparaba solo en la semana 4.

Medido en 3 temporadas: **2 explosiones** (~0,7 por temporada). Raro como para
que sea un evento, no tan raro como para no descubrirlo nunca.

### `G.morale` SÍ existe — la nota de la Fase 29 estaba equivocada

Decía "`G.morale` no existe y no se creó". **Existe**: está en el literal de
`G`, la dibuja la barra de la UI, la lee `boardConf` y **entra en
`matchStrengths`** (`0.70+(G.morale−70)/100*0.5`). Lo que es cierto es que
**`G.morale` y `p.morale` son dos cosas distintas**: una es el medidor del
club, la otra es de cada jugador y alimenta el rendimiento semanal y el
`badSpell`. El evento toca las dos: **−15 al equipo** (lo que se pidió) y **−6
a cada jugador**, menos al que armó el quilombo, que está convencido de que
tiene razón.

Lo que cuesta, medido en el modelo aislado (la varianza de una temporada se
come un efecto de este tamaño): la fuerza del equipo cae **−1,65%** y la moral
tarda **13 semanas** en volver.

Se dispara **una vez por temporada y por jugador** (`p._persQueja=G.season`,
no un booleano — con un booleano pasaba una sola vez en toda la carrera, la
misma trampa que `G._intakeSeason`), y **el lesionado no se queja**: el que no
juega porque está roto no tiene de qué.

### Invisible en la UI, que era el requisito

La regresión recorre las 7 pestañas **y la ficha del jugador** buscando
"Mercenario", "Conflictivo" y "personalidad": **0 fugas**. Lo único que te
delata a un jugador es lo que hace — el número que pide, que se levante de la
mesa, que firme una rebaja o que te rompa el vestuario.

### Y el quinto `'Liga ARG'` escrito a mano

Apareció al lado, en el relleno de libres cuando el plantel queda corto:
`p.lg='Liga ARG'` fijo, así que un libre que entraba al Real Madrid quedaba
anotado en la liga argentina. Es la **quinta** vez (después de nacionalizar, el
naming de la Bombonera, `promOne` y `firmasTick`). Ahora sale de `ligaMia()`.

## Fase 35: la conferencia de prensa que SÍ te frena el club

### ⚠️ El sistema de conferencias ya existía entero — y era ignorable

`pressConf()` ya tenía banco de preguntas por resultado (con variantes de
goleada, copa y Libertadores), repreguntas de presidente (el DT, los refuerzos,
la hinchada, la CD), 12 periodistas reales, modal glassmorphism titulado
"🎙️ Conferencia de prensa", 3 opciones con `{morale, conf, fans, dtRel}` y los
efectos a la vista antes de contestar. No hacía falta escribir nada de eso.

Lo que estaba roto era **cuándo aparece**. Medido sobre 3 temporadas:

| | |
|---|---|
| conferencias ofrecidas | **165 de 165 partidos** |
| conferencias obligatorias | **0** |

Es un botón optativo al pie del resumen del partido: se puede jugar la carrera
entera sin abrir una sola. O sea, color, no gestión. Y `G.pressConfDone` estaba
en el literal de `G` **sin que lo leyera ni lo escribiera nadie** — campo muerto.

### Las dos conviven a propósito: 53 bloqueantes al año sería un peaje

La conferencia post-partido queda **como está**, optativa. La nueva
(`prensaHito`) salta sólo cuando pasó algo y ahí sí frena el club. Hacer
bloqueantes las 53 del año es exactamente el error que ya está documentado con
la indisciplina mensual: *"frenar el juego nueve veces al año por la misma
macana sería un peaje, no una decisión"*.

Frecuencia medida con Boca, 3 temporadas:

| hito | por temporada |
|---|---|
| goleada en contra (3+) | 1 · 0 · 0 → **0,33** |
| títulos | 0 · 2 · 3 → **1,7** |
| fichaje bomba (>10M) | lo decidís vos |
| **total medido, contestando** | **2 · 2 · 1** |

El mismo orden que los 4,3 dilemas que ya bloquean.

⚠️ **"Diferencia de 3 goles" tiene que ser EN CONTRA, y el número lo dice.**
Medido, las goleadas **a favor** son **13, 17 y 14 por temporada**. Con
cualquier diferencia de 3 la conferencia saltaba ~15 veces al año y volvía a
ser peaje.

### ⚠️ No existe `G.approval`: para moverla hay que mover las dos patas

El pedido decía "aplicá los modificadores a `G.approval`". No existe y no se
creó (Fase 33): la aprobación es **derivada** de `boardConf` y `fanMood`.
`aprobMover(d)` mueve las dos `d` puntos, porque el promedio de (+d,+d) es
exactamente +d. Verificado: −5 → −5, +8 → +8, y contra el piso de un medidor
(7/2, −5) mueve lo que puede, −2.

⚠️ **Ojo al medir esto**: `prensaResolver` termina en `updateUI()`, que evalúa
los objetivos de la Junta y puede sumar `boardConf`. Medido paso a paso, un
−5 limpio quedó en −4 **por `updateUI`, no por la cuenta**. Si verificás el
delta exacto, medí `aprobMover` aislado.

### El banco vive fuera de `G`, y en `G` quedan tres primitivas

`PRENSA_HITOS` tiene funciones (la pregunta se arma con los datos del hito) y
`JSON.stringify` las descarta en silencio. En `G` va sólo
`{hito, dato, week}` más `G._confUltima` y `G._confTitulos`. Misma regla que
`_DIL_FX` y `BOARD_OBJ`. Verificado: **0 funciones en `G`**.

Retro-compatible sin migrar: un save viejo no tiene ninguno de los tres campos,
y eso es exactamente "no hay conferencia pendiente y nunca hubo una".

### Detalles que salieron de aplicar las lecciones ya documentadas

- **El título sale de un watchdog sobre el TOTAL** (`prensaTitulos`), no de
  parchear los tres lugares que empujan a `G.trophies` —las ligas largas ni
  pasan por ahí, quedan en `G.history[].champion`—. Es el mismo mecanismo que
  `sociosTitulos()`. Con `G._confTitulos===undefined` **ancla sin disparar**:
  si no, cargar una partida con seis copas en la vitrina abría seis
  conferencias.
- **El bombazo se engancha en `firmasTick`**, donde la firma se cierra de
  verdad, no en el acuerdo: entre una cosa y la otra la firma todavía se cae
  por plantel lleno o por falta de plata.
- **El cooldown mira la última conferencia CONTESTADA**, no la última
  encolada. Si mirara la encolada, un hito descartado por cooldown igual
  reiniciaba el reloj.
- **Nunca se apilan dos**: si ya hay una esperando gana la de mayor prioridad
  (título > bomba > goleada). Sin eso, una goleada de la fecha siguiente te
  borraba la conferencia del título.
- **El candado se deriva del DOM** (`prensaEnPantalla`), igual que el del
  dilema. Verificado el caso que en la Fase 29 trabó la pantalla: el resumen de
  temporada **pisa** el modal y al cerrarlo la conferencia **vuelve**.
- **`runContinuousSim` necesita su propio corte.** Es el mismo bug real de la
  Fase 29: la conferencia salta EN MEDIO de la seguidilla, y de ahí en adelante
  cada `simMatch` vuelve bloqueado mientras el `G.week++` de fallback quema una
  semana por vuelta sin jugar.
- **Una moral que baja 20 tiene que llegar a los jugadores**: `G.morale` es el
  medidor del club y `p.morale` es lo que mueve el rendimiento semanal. El
  resolver toca las dos (los jugadores, a la mitad).

### ⚠️ Frenar el club volvió a romper la regresión — y destapó dos checks podridos

Tercera vez que pasa lo mismo (Fase 29 lo documentó para los dilemas): el
`dilResolver()` compartido ahora tiene que contestar **también** las
conferencias, o los cuatro bucles de temporada se cuelgan.

Y al cambiar el estado compartido, dos checks que venían en verde se cayeron.
**Ninguno de los dos era culpa de la prensa** — los dos estaban mal escritos
desde antes y pasaban por suerte:

- **`personalidades` era FLAKY**: verde una corrida y rojo la siguiente sobre
  el mismo código. El salt de personalidad es aleatorio por carrera, así que
  cuáles de los 30 son Conflictivo cambia en cada corrida; si a otro con
  rat>75 le tocaba serlo, se quejaba él y "una por temporada" daba rojo. Ahora
  el check fija las 30 personalidades a mano: prueba la regla, no la suerte.
- **`mentoreo` tenía un bug latente de 4 fases de antigüedad.** Le inyectaba
  al mentor una virtud élite **después** de clonarle los atributos al pupilo, y
  siempre como `PAS`. **Un arquero no tiene la clave `PAS`** (sus atributos son
  ATA/REF/POS/SAQ/VEL/FIS), así que con un mentor arquero sin virtud élite
  propia el pupilo heredaba una clave inexistente: `P.attrs[V.k]` daba
  `undefined` y la herencia no podía completarse nunca. Pasaba o fallaba según
  qué mentor devolvía el `find`. Ahora la virtud se fuerza **antes** de clonar
  y sobre un atributo que el mentor realmente tiene.

⚠️ **La lección, por cuarta vez: el check de mentoreo falla por el vecino.**
Antes de tocar el producto porque un check se puso rojo, **verificá el
mecanismo aislado**. Acá la herencia daba 87/87 en una sesión limpia con el
código nuevo puesto: el producto estaba bien y el instrumento estaba roto.

## Fase 36: el buscador del Mercado, y el cartel "🆓 LIBRE" que mentía

### El buscador ya existía; lo que faltaba era la normalización

`#mkQ` está desde antes y además busca **nombre, club y liga**, no sólo el
nombre. Lo que no hacía era normalizar los acentos, y el número dice cuánto
costaba: de las **17.075 fichas, 4.687 nombres (27,4%) llevan tilde**.

| se busca | antes | ahora |
|---|---|---|
| `rodriguez` | 6 | **109** |
| `martinez` | 7 | **81** |
| `hernandez` | 0 | 33 |
| `gutierrez` | 0 | 26 |
| `munoz` | 0 | 24 |
| `tevez` | **0** | 5 |

Sobre esos ocho apellidos solos había **303 jugadores inalcanzables**.

⚠️ **Se reusa `_tsNorm`**, que ya existía para el buscador de clubes del
wizard, en vez de escribir el `.normalize('NFD')` de nuevo en `renderMkt`. Dos
normalizadores es la misma clase de bug que ya apareció cinco veces en este
proyecto: se desincronizan.

El input pasó a vidrio real (`.mksearch`). ⚠️ **Acá el `backdrop-filter` SÍ va**
—y no contradice la regla del proyecto— porque los filtros del Mercado **no
viven adentro de una `.card`**: `#tab-mkt` es un `.tc` pelado, así que no hay
vidrio sobre vidrio. Verificado en la regresión con `closest('.card')`. El chip
del filtro, en cambio, es una fila: translucidez y borde, sin blur.

### ⚠️ El filtro de libres destapó que `isFreeAgent` mentía

El pedido nombraba `p.teamId` nulo o `'FREE'`. **Ese campo no existe**: medido,
`p.teamId` está en **0 de 17.075** fichas (`teamId` en este juego es el id del
CLUB que dirigís — `boca`, `river`—, no un campo del jugador). Los libres se
marcan con `p.freeAgent` y `p.club==='Libre'`.

Pero al ir a usar el predicado que ya había, apareció el problema de verdad:

```js
function isFreeAgent(p){ return contractMonths(p)<=0 || p.freeAgent; }
```

`contractMonths` devuelve 0 cuando el contrato **vence esta temporada y la
temporada se está terminando** — pero el tipo sigue jugando en su club hasta
que `expireContracts` lo libera en el salto de temporada. Medido en la semana
49 de la primera temporada:

| | |
|---|---|
| `isFreeAgent` dice que hay | **5.262 libres** |
| de esos, con la marca `freeAgent` | **0** |
| de esos, con `club:'Libre'` | **0** |
| **siguen en su club** | **5.262** |

O sea: el mercado le ponía **"🆓 LIBRE"** a Imanol González **jugando en
Gimnasia (M)**, y la pantalla de negociación decía **"sin ficha"** y **"no hay
club con el que negociar"**. Entre ellos había **517 jugadores de 75+**.

⚠️ **La plata que se regalaba era poca y conviene no exagerarlo**: con el
contrato en 0 meses `askingPrice` ya está aplastado en **0,05M**, así que la
diferencia era 0,05M por cabeza. Lo que sí pasaba es que **el club dueño del
pase no participaba**: te llevabas a un jugador con contrato vigente sin que
nadie negociara ni pudiera negarse.

Arreglado separando las dos preguntas en vez de retocar una sola:

- **`esLibre(p)`** = `p.freeAgent===true || p.club==='Libre'` — no tiene club,
  llega sin ficha. Es lo que usan el filtro, el cartel de la fila y la
  negociación.
- **El contrato que se vence** ya estaba cubierto por otros dos mecanismos que
  no se tocaron: el **precontrato** (`months<=6`) y el descuento por contrato
  corto.

### El ciclo de vida de los libres, medido

| momento | libres de verdad |
|---|---|
| temporada 1, semana 1 | **0** |
| temporada 1, semana 49 | 0 (los 5.262 eran el falso positivo) |
| tras cerrar la temporada 1 | **948** |
| tras cerrar la temporada 2 | 1.219 |

De los 948, **126 pasan de 70 de media**: el filtro sirve, pero **recién a
partir del primer cierre de temporada**. Por eso el filtro con la lista vacía
no se queda mudo — explica que los libres aparecen al cerrar la temporada y que
mientras tanto el camino es el precontrato. Un filtro que devuelve una lista
vacía sin decir por qué se lee como un bug.

El estado del chip (`_mkLibres`) vive **fuera de `G`**, como `_PT`, `_SPN` y
`_DIL_FX`: es de la pantalla, no de la partida.

## Fase 37: de jugador a staff — el retiro que casi no existe

### ⚠️ Medido primero, y el número cambió el diseño entero

El pedido ataba la Junta Directiva a "cuando una leyenda se retira". Medido
con Boca antes de escribir una línea:

| | |
|---|---|
| retiros en 6 temporadas | **3** (0 · 0 · 3 · 0 · 0 · 0) |
| de esos, leyendas | **0** |
| leyendas acumuladas al final | 16 |

`seRetira` pide **41 años, o 35+ con media <60**, y una leyenda tiene 75-85:
la vendés o se te va libre mucho antes de decaer tanto. Y hay dos cosas peores,
las dos verificadas:

- **Una leyenda vendida desaparece entera**: no queda en `G.squad` **ni en
  `G.market`**. El objeto jugador se borra; lo único que sobrevive es su
  entrada en `G.legends` con `activo:false`.
- **0 de los 17.080 jugadores del mercado** cumplen `seRetira` jamás — el
  mercado no envejece hacia el retiro.

O sea: no existe **ningún** camino por el que una leyenda llegue a retirarse.
Tal cual se pidió, `G.board` quedaba **vacío toda la carrera**, y con él el
toggle de delegar y toda la automatización de los objetivos 2 y 3.

⚠️ **NO se tocó `seRetira`.** Las tres constantes (35 / 60 / 41) son perillas
de balance del plantel; moverlas para que esta pantalla dispare más seguido
sería cambiar la dificultad del juego entero para llenar una tarjeta.

**La solución sale del registro que sí sobrevive.** `juntaTick()` mira
`G.legends` y trae de vuelta al ídolo **dos temporadas después de que dejó el
club** (`JUNTA_ESPERA`), que además es lo que pasa en la realidad: el que se
fue vuelve de traje. `registrarLeyendas` ahora estampa `l.salio` cuando
`activo` cae; un save viejo no lo trae y cae a `l.desde`.

### ⚠️ El arquero no tiene DEF ni PAS

Segunda vez que aparece esta trampa (la primera fue el check de mentoreo).
El pedido decía "si `DEF` es su stat más alta → Bloque Bajo; si `PAS` → 
Posicional", pero `ATTR_PROFILES.ARQ` es **`{ATA,REF,POS,SAQ,VEL,FIS}`**: un
arquero que se retira **no caía en ninguna rama**.

`_staffArquetipo(p)` mapea el mejor atributo **de los que el jugador realmente
tiene**, cubre las seis claves de campo y manda al arquero por su puesto:

| mejor atributo | arquetipo |
|---|---|
| DEF | `bloquebajo` / `resultadista` ← los del pedido |
| PAS | `posicional` / `toque` ← los del pedido |
| TIR | `ofensivo` / `vertical` |
| REG | `bandas` / `toque` |
| VEL | `contragolpe` / `vertical` |
| FIS | `fisico` / `gegenpress` |
| (ARQ) | `bloquebajo` |

Los cuatro nombres del pedido existían tal cual en `ARQ` (`bloquebajo`,
`resultadista`, `posicional`, `toque`). La elección dentro del par es
**determinista por nombre**, para que el mismo tipo no cambie de arquetipo al
recargar. Verificado que los cuatro casos devuelven una clave que existe en
`ARQ`, incluido el arquero.

El ex jugador entra a `G.dtPool` como **técnico LIBRE**, así que lo podés
contratar de verdad; no se duplica si ya hay uno con ese nombre.

### ⚠️ `G.legends.includes(id)` da SIEMPRE false

El pedido lo usaba literal. `G.legends` es un array de **objetos**
`{id,name,pos,num,rat,activo}`, no de ids: medido sobre 6 temporadas, **0
aciertos**. El resto del archivo ya usaba `.some(l=>l.id===p.id)` y es lo que
se usa acá.

### La Junta

`G.board` son objetos planos `{id,name,pos,role,nivel,desde}` — 0 funciones en
`G`, verificado. Retro-compatible sin migrar: `junta()` lee `G.board||[]`, que
en un save viejo es "todavía no armaste ninguna Junta". Tope `JUNTA_MAX=4`, y
el primero que llega toma el cargo de **Director Deportivo**.

El `nivel` de gestión sale de la carrera del tipo (media × 0,55 + partidos +
goles + temporadas en el club), no de un número suelto.

### Delegar renovaciones: el nivel del director se nota

Con el toggle puesto, `weeklyJunta()` cierra hasta 3 contratos por mes. No es
gratis, y la medición lo confirma — 25 corridas por nivel:

| nivel del Director | contratos cerrados | sueldo mediano |
|---|---|---|
| 90 | **81-92%** | **37k** |
| 65 | 67% | 44k |
| 40 | **43-55%** | **51k** |

Monótono en las dos columnas: el bueno cierra más y paga menos. Un director
flojo te sale caro y encima te deja jugadores sin renovar.

⚠️ **Se apoya en `renovPiso(p)` y en la misma cuenta de pretensión que usa
`openContract`** (con el recargo del mercenario incluido), no en una fórmula
nueva. Si el manual y el automático usaran números distintos, delegar
cambiaría el precio de las cosas y se leería como un bug.

Corre **una vez por mes** (`DELEG_SEMANAS=4`), no todas las semanas, y no hace
nada sin Director Deportivo ni con el toggle apagado — las tres cosas
verificadas.

### UI

Tarjeta **🏛️ Comisión Directiva** en la pestaña Presidente (`#presJunta` →
`rJunta()`), con cada dirigente en un `.mpanel` y su barra de gestión. El
switch (`.sw`) es nuevo y **no lleva `backdrop-filter`**: vive dentro de un
`.mpanel` que vive dentro de una `.card` con vidrio real, así que ponerle blur
sería anidarlo. Con la Junta vacía la tarjeta explica cuándo llegan los
dirigentes y cuántas leyendas hay esperando afuera, en vez de quedarse muda.

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

## Estado auditado de los 3 bugs prioritarios

Re-auditados de cero sobre el código actual (`scratchpad/audit3.js` + `audit4.js`),
y ahora **blindados en la regresión** para que no puedan volver en silencio:

| bug | estado medido |
|---|---|
| `nat2` / cupos | 3.608 segundas nacionalidades, **0 basura**, 0 iguales al nat1, 0 con largo ≠3. `isForeign(nat,nat2,league)` con aridad 3 (la liga es opcional) y los 12 casos de la regla comunitaria correctos. **0 nacionalizados** contados como extranjeros por error |
| API | `fetch=0`, `XMLHttpRequest=0`, `tmapi/tmcoach/sportdb=0` en el juego, 0 URLs http fuera de las fuentes de Google, los 2 scripts locales. **0 peticiones** jugando una temporada + recorriendo toda la UI |
| `dtDemands` ≠ `dtAskList` | aridad 1 vs 0 · array de strings vs array de objetos `{id,label,desc,resist,argue,apply}` · las exigencias quedan en `G.dt.contract.demands`, los pedidos no dejan nada en `G`, y ninguno se cuela en el otro |

- **Nacionalizar da el pasaporte de la liga que dirigís**, no un `ARG` fijo.
  Verificado en 6 ligas: ARG→ARG, Portugal→POR, Premier→ING, MX→MEX,
  Turquía→TUR, MLS→USA, y en las seis el jugador deja de ocupar cupo.
- ⚠️ `naturalizePlayer(id)` **sólo abre el modal**; el que aplica es
  `confirmNaturalize(id)`. Si lo probás llamando al primero no pasa nada.
- ⚠️ **`autoFill` puede dejar huecos y eso es correcto.** Con 18 extranjeros
  forzados, cupo 5 y los lesionados de una temporada, puede no haber once
  jugadores LEGALES: el juego deja el puesto vacío antes que romper el cupo. La
  regresión verifica que nunca se pase, no que siempre llene 11.

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

## Fase 38: la Primera Nacional, y la economía del club chico que ya estaba rota

### La segunda división se DERIVA, no se re-etiqueta

`players-db.js` lo regenera el extractor, así que retaggear a mano los clubes
del ascenso se pierde en la próxima extracción. En su lugar hay
`LIGA_DB={'Primera Nacional':'Liga ARG'}` + `ligaDB(lg)`: la liga nueva lee las
filas de `'Liga ARG'` y `clubesDeLiga()` le saca los 30 de `AR_CLUBS`. Metadatos
nuevos: `LIGA_TAM` 20, `LIGA_NAT` `['ARG']`, `CUPO_LIGA` 6, `DESCENSOS` 4,
`LIGA_PAIS` y `LIGA_NOMBRE`. Formato: todos contra todos ida y vuelta, **38
fechas** (`buildCalOtra`), sin zonas, sin Apertura/Clausura y **sin copa
continental** (`hayCopaCont()` / `objetivoCopa()`: el objetivo es *ascender*,
no "clasificar a la Libertadores (Top 4)" — un torneo que esa categoría no
juega).

⚠️ **`clubesDeLiga('Liga ARG')` estaba mal desde antes.** Ordenaba los clubes
por valor de plantel y se quedaba con los 30 primeros: metía a **Gimnasia (M),
Ciudad Bolívar y Midland** (que son del ascenso) y dejaba afuera a **Central
Córdoba (11,0M), Aldosivi (10,4M) y San Martín SJ (7,1M)**, que sí son de
Primera. La lista tiene que ser `AR_CLUBS`, no un ranking.

⚠️ **`squadFromDB` no habría encontrado una sola fila** de un club del ascenso
—filtra por `r[6]===lg` y en la base dice `'Liga ARG'`— y habría caído al
plantel inventado. Ahora pasa por `ligaDB()`. Verificado: **0 jugadores
inventados**.

⚠️ **`buildAllTeams` tenía el mismo filtro y ahí el síntoma era peor**: el mapa
de valores quedaba VACÍO, así que los 20 clubes del ascenso salían con `val=0`,
o sea **rep 35, 9.000 de capacidad y 2M de presupuesto, los veinte idénticos**.
Ahora hay **8 reputaciones distintas**.

### ⚠️ Y ahí apareció lo de verdad: NINGÚN club chico del juego podía sobrevivir

El ascenso fundía en la primera temporada, pero **no lo traía este feature**.
Medido con temporada completa y el mismo arnés, en tres ligas que ya eran
jugables:

| liga | club | rep | presup. | cierre | en rojo desde |
|---|---|---|---|---|---|
| Liga ARG | San Martín (SJ) | 39 | 3M | **−36,6M** | semana 8 |
| Paraguay | CS San Lorenzo | 35 | 3M | **−20,8M** | semana 8 |
| Venezuela | Anzoátegui | 38 | 3M | **−18,9M** | semana 8 |
| Liga ARG | Boca (control) | 78 | 28M | +60,6M | nunca |

**Todos** entraban en rojo en la semana 8. La causa son tres números planos:

1. **El sueldo era lineal.** `wage = rat*0.4`: un plantel de media 60 pagaba
   **2,8M/mes contra los 3,5M de Boca —el 80%— teniendo el 7% del valor**. Ahora
   es `wageDeRat()`, convexo con el **mismo exponente que ya usa
   `_negWageExpect`** (2.35) — una sola curva de sueldos en el juego, no dos — y
   anclado en la media de Boca. Medido por rat 50/60/70/80/90: **12/18/26/35/47k**
   (antes 20/24/28/32/36). Un rat 90 cobra **3,9×** lo de un rat 50; antes, 1,8×.
2. **La parte FIJA de los gastos era la misma para todos.** `_estructura` ya
   hacía que crecer saliera caro, pero base + cuerpo técnico + estadio + plantel
   = **3,6M/mes idénticos** para Boca y para un club de rep 39 con 24.000
   socios. `escalaEstructura()` la escala por reputación: **×0,27 con rep 39**.
   ⚠️ **Tiene TOPE en 1 a propósito**: escala hacia abajo nada más. La punta de
   arriba ya la cubre `_estructura`, que está calibrada (Fase 23), así que de
   Boca para arriba no se mueve un peso.
3. **El catálogo de sponsors arrancaba en `reqRep:48`** y el juego tiene clubes
   jugables en rep 35: un club de rep 39 llegaba a **0 de las 10 categorías** y
   cerraba el año con **cero plata de patrocinio**. Es el mismo agujero que la
   Fase 22 tapó por REGIÓN, ahora por REPUTACIÓN. Se agregó la gama baja (8
   marcas, `reqRep` 28-36, GLOBAL porque un sponsor modesto existe en los 24
   países): el club chico pasa a **7 categorías, 8,3M/temporada**.

⚠️ **La gama baja lleva `maxRep`** porque `weeklySponsors` elige con
`cand[random]` **uniforme**: sin tope, a Boca le ofrecerían la marca de 0,02 en
vez de Nike. `sponsorEnRep(s,rep)` es el portero y va en las **dos** vías (la
oferta semanal y `signSponsor` por id), igual que las cuatro vías de la Fase 16.
Y `!==undefined` en vez de `||`, como `cuposDescenso`.

Resultado, mismo arnés antes y después:

| club | antes | ahora |
|---|---|---|
| San Martín (SJ) | −36,6M | **−5,7M** |
| Anzoátegui | −18,9M | **+4,2M** |
| CS San Lorenzo | −20,8M | **+2,6M** |
| Almirante Brown (2ª ARG) | — | **−1,6M** |

⚠️ **Boca no se movió, pero NO se puede demostrar con el delta de temporada.**
Con el arnés que firma todos los patrocinios, 5 temporadas del **mismo código**
dan **77,2 · 68,5 · 77,9 · 117,9 · 59,1** — 59M de dispersión, más que
cualquier efecto buscado (la misma trampa de la Fase 32). La mediana pasa de
**77,2 a 82,0**, que cae adentro del ruido. Lo que sí prueba que no se movió son
los **deterministas**: ops/mes 5,0 → 5,0, sueldos/mes 3,5 → 3,4, masa salarial
864k → 858k por semana, y las categorías de sponsor de Boca 9 → 9.

⚠️ **El balance mensual es NEGATIVO hasta para Boca** (−3,6M/mes): el club se
sostiene con el borderó y los sponsors, que sí escalan. Si alguna vez hay que
apretar la economía, el lugar es `escalaEstructura` — no las cuotas ni la TV,
que son lo único que le queda a un club de rep 39.

## Fase 39: temporadas históricas — el mundo cerrado sale del dato

Transfermarkt guarda los planteles de **todas** las temporadas. El extractor
los baja a `players-hist-AÑO.js`, **un archivo por temporada** (~170 KB del
fútbol argentino; treinta años en un solo archivo serían 5 MB que el juego
cargaría siempre, aunque juegues 2026).

Los archivos **se enchufan solos**: el juego escribe con `document.write` los
`<script src="players-hist-AÑO.js">` de 1992 a 2026 y los que no están fallan en
silencio. Dejar el archivo en la carpeta lo hace aparecer en el selector, sin
tocar una línea.

⚠️ **`document.write` y NO `appendChild`**: un script agregado por JS carga
asíncrono y `PLAYERS_DB_HIST` no existiría todavía cuando arranca el juego.
⚠️ **Tienen que ser `.js`, no `.json`** — el usuario juega con `file://` y ahí
un `fetch` de JSON muere por CORS. La misma razón que `players-db.js`.

### El mundo cerrado no es una regla: es la consecuencia del dato

`aplicarTemporada(y)` cambia `window.PLAYERS_DB` entero y el resto del juego no
se entera, porque las ligas jugables, los clubes, los valores, los nombres de la
cantera y el mercado salen **todos** de esa misma global. Si el archivo de 2015
sólo trae fútbol argentino, `ligasJugables()` devuelve `['Liga ARG']` y listo.
**No hay un modo histórico que apagar ni una lista de ligas que filtrar.**
Verificado: con un 2015 inyectado, `ligasJugables()` da exactamente `Liga ARG`.

⚠️ **Hay CINCO cachés derivados de la base** y hay que tirarlos todos o el juego
mezcla dos mundos (valores de 2026 con planteles de 2015): `_tsValCache`,
`_rankCache`/`_rankSeason`, `_ynCache`, `_aiClubsCache`/`_aiClubsSeason` y
`_topLiga._v`. Están enumerados en `aplicarTemporada` para que agregar uno nuevo
sin sumarlo se note.

⚠️ **`_DB_SEASON` es una global y las globales NO se serializan** — el mismo bug
de `_LIGA_ELEGIDA` un escalón más abajo. El año va en **`G.dbSeason`** y
`loadGame` llama a `aplicarTemporada` **antes** que a `buildAllTeams`, porque
esa función ya lee `PLAYERS_DB`. Sin eso, una partida de 2015 recargada rearmaba
`TEAMS` con los planteles de hoy.

⚠️ **`P()` firmaba contratos hasta 2028 jugando 2015.** El año base caía a
**2026 fijo** porque `squadFromDB` corre DENTRO del literal que crea `G`, o sea
cuando `G.season` todavía no existe: todo el plantel quedaba con treinta años de
vínculo y se rompían precontratos, libres y el descuento por contrato corto.
Ahora cae a `tempActual()`. Medido: contrato máximo **2018**, no 2028.

Verificado de punta a punta: sin archivos no aparece el selector · con 2015
aparece y cambia la base · mundo cerrado · Boca 2015 juega con plantel de 2015 ·
temporada completa de 48 partidos y salto a 2016 sin rivales de otro mundo ·
sobrevive al guardado con las dos globales ensuciadas · volver a 2026 no deja
restos.

### 🛑 El extractor histórico NO está verificado contra Transfermarkt

Se programó **sin poder hacer un solo pedido a transfermarkt.com**: el
contenedor donde se trabajó sólo tiene salida a GitHub. Lo que está probado es
el **parser contra el layout conocido** (17 asserts en `scratchpad/kader.js`:
nombre con acentos, dorsal, posición, edad, doble nacionalidad, altura, pie, el
contrato como la ÚLTIMA fecha de la fila, y el valor en los dos formatos que usa
TM — `€1,20 mill.` de la versión .es y `€1,200,000` de la .com). Lo que **no**
está probado es que el sitio tenga hoy ese layout.

Dos ramas nuevas en el Worker (`cloudflare-worker/sportdb-cache.js`), gratis y
sin créditos porque bajan el HTML server-rendered:

| | |
|---|---|
| `api=tmkader&path=/verein/{id}/saison/{año}` | el plantel de ese club en ese año |
| `api=tmclubs&path=/wettbewerb/{id}/saison/{año}` | los clubes de esa liga ese año |

⚠️ **Las dos SÓLO están en el Worker**, no en la función de Netlify.

**Todo está diseñado para que un fallo sea legible en UNA vuelta**, que es lo
único sensato cuando no se puede probar:
- las dos ramas devuelven **siempre** un bloque `diag` (`filas`, `parseados`,
  `conValor`, `conNac`, `conPos`) — si `filas` es 0 cambió el contenedor de la
  tabla; si `filas`>0 y `parseados` es 0, cambió la fila;
- con `&debug=1` viene además **el HTML crudo de la primera fila**;
- el botón **🩺 Diagnosticar una temporada** del extractor lo imprime entero;
- **una respuesta vacía NO se cachea**: cachear un fallo de parseo lo dejaría
  clavado 30 días y parecería que el club no existe (el bug de los 12 clubes
  perdidos, otra vez);
- los **IDs de competición son campos de la UI** (`AR1N` / `ARG2` por defecto),
  no constantes en el código: si TM los cambió, se corrigen sin tocar nada.

⚠️ `rawGet` del extractor **pegaba siempre en Netlify ignorando el Worker** y
cortaba el cuerpo en 400 caracteres, así que un diagnóstico podía decir "tu
proxy no lo soporta" con un Worker que sí lo soporta, y nunca mostraba el HTML.
Arreglado, y el `&debug=1` va como parámetro suelto: adentro de `path` se lo
comía el `encodeURIComponent`.

### Fase 40: el simulacro de extracción 2025, y los 4 bugs que destapó

No se puede pedirle nada a transfermarkt.com desde donde se programa esto
(el proxy devuelve **403 en el CONNECT** para `transfermarkt.com`, `.es`,
`transfermarkt-api.fly.dev` y `api.sportdb.dev`; el README del proxy dice que
un 403 así es política y que se reporte en vez de buscarle la vuelta). Pero
**todo lo que pasa después del fetch sí se puede probar**, y ahí estaba lo roto.

`scratchpad/hist2025.js` fabrica el HTML tal como lo sirve TM (20 clubes × 25
jugadores), lo pasa por el parser REAL del Worker (`parseKader`/`parseClubes`)
y por las funciones REALES del extractor (`histFila`, `mapPos`, `mapNat`,
`parseContractYear`), y escribe `players-hist-2025.js` **exactamente** como lo
escribiría `histDescargar`. Después `hist2025b.js` levanta el juego con ese
archivo en la carpeta, sin inyectar nada.

La conversión salió limpia de una: 500 filas, 500 parseadas, **0 posiciones
UNK, 0 nacionalidades UNK, 0 `nat2` basura, 0 edades fuera de rango, 0 valores
en cero**, pies `der/izq/amb`, contratos 2026-2028. Lo que estaba roto era el
JUEGO, no el extractor:

| bug | síntoma medido |
|---|---|
| **`AR_CLUBS` es la Primera de 2026** | `clubesDeLiga('Liga ARG')` devolvía **13 de los 20** clubes del archivo: todo club que hoy no está en Primera se borraba en silencio |
| **la liga se armaba igual con 30** | `arBuildZones` rellenaba con los 10 que faltaban de la lista de hoy → 17 rivales que ese año no existían, con plantel inventado |
| **`TEAMS` no se limpia** | el selector mostraba **36 clubes argentinos**, mezclando 2025 y 2026 |
| **`_tsLigasCache`** | el wizard seguía ofreciendo las **25 ligas** de 2026 aunque `ligasJugables()` ya decía sólo `Liga ARG` |

⚠️ **El primero es el patrón de "clubes que desaparecen sin que nadie se
entere"**, el mismo que ya costó 12 equipos en la extracción. En 2015 jugaban
Olimpo, Nueva Chicago, Crucero del Norte y Arsenal: filtrar ese año contra la
lista de hoy los tira a todos.

Arreglado con **una sola fuente de verdad**: `clubesDeCategoria(lg)` —que la
Liga ARG resuelve por `clubesPrimera()` y el resto por el corte por valor— y la
usan `buildAllTeams` **y** el paso 3 del wizard, que la tenían escrita cada uno
por su lado. `clubesPrimera()` deriva la lista **de la base cargada** cuando
`esHistorica()`, que a su vez es derivado (`PLAYERS_DB !== _PDB_ACTUAL`), no un
flag nuevo.

⚠️ **Las zonas exigen 30 clubes de verdad** (`_zonasOK` en `buildCal`). Con 20
va al formato común, todos contra todos ida y vuelta — reproducir el formato
REAL de cada año sería un motor por temporada, que es la misma razón por la que
Colombia y México no tienen zonas. Y el rótulo de la tabla sale ahora de
`juegaZonas()` (¿hay `G.arPhases`?) en vez de `esLigaARG()`: si no, le explicaba
el Apertura/Clausura a un año que no lo juega.

⚠️ Los cachés a tirar en `aplicarTemporada` pasaron de cinco a **siete** más el
purgado de `TEAMS` (sólo los `generado:true`; los 5 curados se quedan).

Medido después, con el archivo de 2025 en la carpeta y sin inyectar nada:
selector con **20 botones y 0 clubes de 2026** · Boca 2025 con plantel de 2025,
**38 fechas contra los 19 rivales del año**, sin zonas · temporada completa de
39 partidos, 11º de 20 · guardado y carga con las dos globales ensuciadas ·
salto de temporada sin rivales de otro mundo · volver a 2026 deja 17.108 filas
y 25 ligas.

### ⚠️ Y el check de la regresión que escribí en la Fase 38 no probaba nada

`const rivales=[...new Set(G.calendar.map(m=>m.opp))]` — **el campo no se llama
`opp`**: las fechas de `G.calendar` tienen `home`/`away`. Ese array daba `[]`
siempre, así que el assert de "sin rivales de Primera" pasaba en verde sin
ejercitar nada. Es el **quinto** pase vacío documentado en este proyecto
(después del check de memoria con `every` sobre arrays vacíos, la temporada que
contaba iteraciones, los playoffs con 2 llaves y el `phoneMsgs.length`).

El check histórico también era demasiado amable: usaba 30 clubes sacados de la
base actual, o sea que **ninguno de los cuatro bugs de arriba lo habría puesto
en rojo**. Ahora fabrica un 2015 de **20 clubes con dos que hoy no existen en
Primera** (`Olimpo BB`, `Nueva Chicago`) y verifica las cuatro cosas por
separado: que no se borre ningún club del año, que `TEAMS` no arrastre ninguno
de 2026, que se juegue contra los del año y que no haya zonas.

### ⚠️ Los 5 argentinos curados sobreviven al purgado de `TEAMS`, y está bien

El check nuevo lo agarró: tras cambiar de temporada, `TEAMS` seguía teniendo un
club argentino que el 2015 de prueba no traía. Son los **5 curados a mano**
(Boca, River, Racing, Independiente, San Lorenzo), que NO llevan
`generado:true` y por eso no se borran — guardan colores, escudo y el borderó
escrito a mano que `buildAllTeams` no puede reproducir (Fase 23). Borrarlos
para que el check diera verde habría perdido esos datos para toda la sesión.

Lo que importa no es que la bolsa quede limpia sino que **no se pueda LLEGAR a
un club de otro año**, y eso ya estaba cerrado: el paso 3 del wizard filtra por
`clubesDeCategoria` y `buildCal` nunca lee `TEAMS` para armar la liga. El check
ahora afirma las dos cosas por separado, y juntas son más fuertes que el assert
que tenía: el **selector muestra exactamente** los clubes del año, y si algo de
otro año quedó en `TEAMS` sólo puede ser uno de los curados (un `generado`
colado sigue dando rojo).

⚠️ **`players-hist-2025.js` NO está en el repo y no tiene que estarlo**: son
datos sintéticos para probar el pipeline. El archivo de verdad lo genera el
usuario con el extractor y lo deja en su carpeta.

### Fase 41: la primera corrida real contra Transfermarkt — y el error que no se leía

El usuario corrió el histórico 2015-2026 desde el sitio de Netlify. Resultado:
**12 temporadas vacías, 24 pedidos, `ERROR 400 en /wettbewerb/AR1N/saison/2015
(fuente: tmclubs)` repetido 24 veces**, y nada que dijera por qué.

El 400 es correcto y esperable —**los planteles históricos sólo están en el
Worker de Cloudflare**, no en la función de Netlify (decisión de la Fase 39:
el parser son ~150 líneas y tenerlo en los dos lados serían dos fuentes de
verdad)—. Lo que estaba mal era **todo lo demás**:

| | antes | ahora |
|---|---|---|
| pedidos para descubrirlo | **24** | **1** |
| el mensaje del proxy llegaba a pantalla | ❌ nunca | ✅ |
| decía qué hacer | ❌ | ✅ |

⚠️ **`apiGet` logueaba el status pero NUNCA el cuerpo**, que es justo donde el
proxy explica el error. La función de Netlify devolvía el texto exacto
—"api=tmclubs sólo está en el Worker de Cloudflare: pegá su URL en el
campo…"— y moría ahí adentro. Ahora el cuerpo se imprime (hasta 400 chars) y
el log dice **por qué proxy** salió el pedido.

⚠️ **Un fallo de CONFIGURACIÓN no se reintenta 24 veces.** `extraerHistorico`
hace ahora un **preflight**: un solo `tmclubs` antes del bucle. Si vuelve 400
(el proxy no conoce la fuente) o **0** (no se llega al proxy), corta y explica.
Un 500/502 avisa y sigue, porque ese sí puede ser pasajero.

⚠️ **Cortar sólo con 400 no alcanzaba, y lo dijo la medición.** Probado con un
Worker inalcanzable: `rawGet` devuelve **status 0** (el fetch ni sale) y la
corrida seguía las 24 vueltas igual. Verificado con la red interceptada, los
dos casos cortan en **1 pedido**:

| escenario | mensaje |
|---|---|
| sin Worker (Netlify) | "Los planteles históricos SÓLO salen por el Worker… Pegá la URL" |
| Worker que no responde | "No responde `<url>` — revisá que esté bien escrita y desplegado" |
| Worker viejo (400) | "Actualizalo con `cloudflare-worker/sportdb-cache.js` del repo" |

Y si **todas** las temporadas salen vacías con el proxy andando, el resumen
final ya no se limita a listarlas: dice que no es un problema de un año —o
cambiaron los IDs de competición, o cambió el HTML— y manda a 🩺 Diagnosticar,
que es lo único que permite distinguirlos.

⚠️ En ese momento **seguía sin verificarse que el parser casara con el HTML
real de TM**: el 400 frenó antes de llegar al sitio. **Ya está verificado** —
ver la Fase 43, con cinco temporadas bajadas de verdad.

### Fase 42: `?api=ping` — porque no había forma de saber si el Worker estaba actualizado

El usuario desplegó su Worker, abrió la URL en el navegador y vio
`{"error":"Missing API key"}`. Esa respuesta **no dice nada**: la devuelven
IGUAL la versión vieja y la nueva, porque sin parámetros `api` cae en
`flashscore` y ahí sí hace falta key. Verificado corriendo el archivo real del
Worker en un server local:

| | URL pelada | `?api=ping` |
|---|---|---|
| Worker **nuevo** | `{"error":"Missing API key"}` | `{ok, version:'2026.09-hist', historicos:true, cacheKV}` |
| Worker **viejo** | `{"error":"Missing API key"}` | `{"error":"Missing API key"}` |

O sea: **la pregunta "¿tomó el deploy?" no tenía respuesta**, y eso ya costó dos
vueltas completas. `?api=ping` la contesta y no pide key a propósito — tiene que
poder abrirse desde la barra del navegador.

Devuelve también **`cacheKV`**, que importa: un Worker recién creado desde el
dashboard no trae el binding KV, así que anda pero re-baja cada temporada entera
en vez de servirla del caché.

El extractor tiene el botón **🔌 ¿Mi Worker está actualizado?**, verificado
contra el código REAL del Worker (no una imitación) en los tres casos:

| Worker | lo que dice |
|---|---|
| nuevo | ✅ ACTUALIZADO — versión, fuentes, y si le falta el KV |
| viejo | ✗ WORKER VIEJO + los pasos exactos para actualizarlo |
| inalcanzable | ✗ NO RESPONDE + revisá la URL y el deploy |

⚠️ **Los mensajes ya no asumen que el Worker se llama `sportdb-cache`.** El del
usuario es `round-flower-f1cc` (el nombre que pone Cloudflare solo), así que
mandarlo a buscar "sportdb-cache" en el dashboard lo habría hecho buscar algo
que no existe.

### 🔶 El check `dilemas` es FLAKY — está sin arreglar, no sin ver

Medido sobre el MISMO código, cinco corridas: **verde 4, rojo 1**. En la roja
cayeron tres sub-flags a la vez (`destraba`, `saveViejo`, `indisciplina`).
Es el mismo patrón que ya tuvo `personalidades`, que se arregló fijando a mano
lo que el motor sortea; acá el pool de dilemas también es aleatorio por corrida.

**No se tocó el producto por esto**: antes de mover nada hay que verificar el
mecanismo aislado, que es la lección que este archivo ya repite cuatro veces
("el check falla por el vecino"). Queda anotado para pinchar el sorteo como se
hizo con `personalidades` — pero si lo ves rojo, **corré la regresión de
nuevo antes de creerle**.

## Fase 43: la primera extracción REAL — 2021-2025 en la carpeta

El usuario corrió el extractor contra Transfermarkt y bajó cinco temporadas.
Es la primera evidencia de que **el parser casa con el HTML real del sitio**,
que era lo único que este archivo tenía anotado como sin verificar. Andaba: 500
de 500 filas parseadas por club, 0 posiciones UNK, 0 nacionalidades UNK, 0
edades fuera de rango y planteles completos. Lo que vino mal fue todo lo de
alrededor, y son cinco cosas distintas.

Después llegaron veintiuna más (2000-2020) y **ya son VEINTISÉIS temporadas
en la carpeta**, de 2000 a 2025, **sin un solo hueco**. Todas vinieron limpias de valores y de
nacionalidades: lo único que traían era el mismo problema de los nombres,
porque el usuario las bajó con el extractor de antes.

| temporada | jugadores | clubes (Primera + Nacional) |
|---|---|---|
| 2000 | 693 | 16 + — |
| 2001 | 723 | 20 + — |
| 2002 | 825 | 18 + — |
| 2003 | 853 | 17 + — |
| 2004 | 602 | 16 + — |
| 2005 | 781 | 17 + — |
| 2006 | 955 | 22 + — |
| 2007 | 942 | 17 + — |
| 2008 | 1.271 | 17 + 20 |
| 2009 | 1.408 | 20 + 20 |
| 2010 | 1.484 | 20 + 20 |
| 2011 | 1.516 | 20 + 20 |
| 2012 | 1.493 | 19 + 20 |
| 2013 | 1.955 | 16 + 22 |
| 2014 | 2.283 | **30** + 22 |
| 2015 | 1.896 | **30** + 22 |
| 2016 | 2.261 | **30** + 23 |
| 2017 | 2.104 | 28 + 25 |
| 2018 | 2.109 | 26 + 25 |
| 2019 | 2.683 | 24 + 32 |
| 2020 | 2.773 | 26 + 35 |
| 2021 | 2.542 | 28 + 37 |
| 2022 | 2.541 | 28 + 37 |
| 2023 | 3.277 | 28 + 38 |
| 2024 | 2.609 | 28 + 36 |
| 2025 | 1.821 | 27 + 36 |

### ⚠️ El nombre del club salía del SLUG de la URL

`parseClubes` cae al slug cuando el `<a>` no trae `title` ni texto, y eso es lo
que pasa en la página de competición: llegaron **"club atletico boca juniors"**,
**"cd riestra"** y **"club atletico central cordoba sde "** (con espacio al
final). De 77 clubes distintos, **75 vinieron del slug**.

No es cosmético: el juego indexa los clubes **por nombre**. Con el slug, Boca
1994 juega sin escudo, sin sus colores y en un estadio genérico, porque los 5
`TEAMS` curados a mano, `STADIUMS_DB` y los clásicos se enganchan por ahí.

`HIST_CLUB_NOM` (77 entradas) + `histClubNombre()` viven en **el extractor**, no
en el juego: el que genera el dato es el que lo tiene que dejar bien. La clave
es el slug NORMALIZADO, así que la misma entrada sirve venga el nombre del
`title` o del slug. El club que no está en la tabla **se nombra en el log** en
vez de quedarse en minúscula en silencio.

⚠️ **La tabla es a mano y tiene que serlo.** Se probó un emparejador
automático contra los clubes de la base actual y los errores eran del peor tipo:
"defensores de belgrano" → **Belgrano**, "gimnasia y esgrima de jujuy" →
**Gimnasia** (que es la de La Plata), "independiente rivadavia" →
**Independiente**, "atletico racing cordoba" → **Racing Club**. Cuatro clubes
fusionados con un grande por parecido de nombre.

### ⚠️ "€930,000" se leía como 930 MILLONES

`valorEnMillones` normalizaba los separadores con "el último manda", que es
correcto para `€1,20 mill.` pero no para el formato sin unidad de la .com:
`€930,000` son 930 mil euros y quedaban en 930. Un jugador de Patronato valía
más que todo el fútbol argentino junto. Y la alternancia `(bn|m|k|mil|th)`
hacía que la `m` ganara antes que `mil`, así que **"€930 mil" también daba 930
millones**.

Ahora la unidad se lee entera y **sin unidad los separadores son de miles,
siempre**. 15 casos verificados (los dos formatos de TM, `Th.`, `mil`, `mill.`,
`mrd.`, euros crudos). El umbral viejo (`v>=10000 ? v/1e6 : v`) también se fue:
dejaba pasar `€2.500` como 2.500 millones.

### Dos categorías, un mismo club, y filas repetidas

Un club puede aparecer en las **dos** competiciones del año (medido en 2025:
Godoy Cruz, 34 filas repetidas). Si se baja dos veces, el plantel queda
duplicado y el club sale en las dos categorías. Ahora gana la primera, que es
Primera, y dentro de cada plantel se descarta el mismo nombre repetido. Total
sobre las cinco temporadas: **77 filas**.

### ⚠️ La 2ª división histórica venía etiquetada y el juego la leía como Primera

Los archivos traen la categoría REAL de cada club (`Liga ARG` / `Primera
Nacional`), que es mejor dato que el corte por valor. Pero `ligaDB` mandaba a
leer `Primera Nacional` bajo la etiqueta `Liga ARG` —el alias que necesita la
base actual, donde las dos categorías comparten etiqueta— y después le restaba
los de Primera. Medido con el 2023 real: **Primera 28 clubes ✓, Primera
Nacional 0**.

`tagsDB()` (cacheado, el **octavo** caché que tira `aplicarTemporada`) dice qué
etiquetas trae la base cargada y `ligaDB` prefiere la que existe. Derivado del
dato, sin flag nuevo.

⚠️ **La Nacional se recorta a 20 clubes** (`LIGA_TAM`) aunque el año tenga 38:
38 clubes son 74 fechas y la temporada no entra en el calendario. Es la misma
razón por la que Colombia y México no tienen zonas. La Primera sí entra entera
(28 clubes = 54 fechas, semanas 4-57) y la temporada se juega y se cierra bien:
medido con Boca 2023, 58 partidos, 2º con 122 puntos, salto a 2024 sin rivales
de otro mundo y guardado/cargado con las dos globales ensuciadas.

### ⚠️ Y apareció un candado en el juego NORMAL: el 🏋️ Predio

Probando el histórico, el club se quedó clavado en la semana 3 día 7. No era
del histórico: `advanceDay` se planta en el día 7 hasta que se juegue la fecha,
y los amistosos de pretemporada son los **únicos** partidos de las semanas 1-3.
`bookFriendlies` los repartía con `i%PRE_SEMANAS`, así que con menos amistosos
que semanas las últimas quedaban vacías. Medido en la partida normal de 2026:

| opción | amistosos por semana | hasta dónde llega el reloj |
|---|---|---|
| ✈️ Asia (4) | 2 · 1 · 1 | semana 25 |
| 🏖️ Verano (3) | 1 · 1 · 1 | semana 25 |
| **🏋️ Predio (2)** | **1 · 1 · —** | **semana 3, con 2 partidos jugados** |

Y cerrar el modal con la ✕ o con "no viajar" era peor: **cero** amistosos y el
candado en la semana 1. Ahora `bookFriendlies` garantiza uno por semana de
pretemporada (el predio pasa de 2 a 3), la ✕ pasa por `preseasonSaltear()` —que
reserva los amistosos igual— y el aviso del día 7 dice la verdad cuando no hay
partido. Medido: el predio llega a la semana 22.

⚠️ Se salía tocando "simular" (que salta al próximo partido), pero **"pasar el
día" estaba muerto** y no había nada en pantalla que lo explicara.

### ⚠️ La temporada 2025 es, en realidad, el plantel de hoy

Transfermarkt, para la temporada en curso, sirve el plantel ACTUAL. Medido con
Marcos Rojo: 30/31/32/33 años en 2021-2024 (coherente con cada año) y **36 en
2025, ya en Racing** — o sea el plantel de 2026. Por eso 2025 tiene menos
jugadores (1.821, mediana 29 por club) y por eso Godoy Cruz aparecía en la
Nacional. No hay nada que arreglar en el código: es cómo responde el sitio.
Las **temporadas viejas sí son del año** (Mastantuono 14/15/16 en 2022/2023/2024).

⚠️ La lista de clubes de cada año la da la página de competición y **viene
corrida un año** respecto de la temporada que juega el archivo (el "2023"
trae la Primera del 2024). Los PLANTELES sí son del año pedido, que es lo que
importa; la categoría de un club suelto puede no coincidir.

### Lo que blinda la regresión

El check `temporadas históricas` prueba el MECANISMO con un 2015 fabricado; el
nuevo, `temporadas reales`, prueba el DATO que está en la carpeta: 0 nombres
sacados del slug, 0 con espacio al borde, 0 filas repetidas, 0 clubes en las dos
categorías, 0 valores disparados, 0 nat/pos UNK, 0 `nat2` inventado, mundo
cerrado en 2 ligas, la Nacional jugable con plantel real y **Boca enganchando el
`TEAMS` curado**. Si una extracción futura vuelve a traer slugs, se pone rojo.

⚠️ **Y el check nuevo daba por sentado que River siempre está en Primera.**
Se puso rojo con 2011 — donde River está en la B, que es justamente lo que
prueba que la categoría sale del año y no de hoy. Ahora exige **Boca** en
Primera (nunca descendió) y de River sólo que ESTÉ en alguna de las dos.

⚠️ Y el check viejo tuvo que aprender a convivir con los archivos de verdad:
`sinArchivos` y `limpio` comprobaban `!hayHistoricos()`, que era cierto sólo
mientras la carpeta estuviera vacía. Ahora el check vacía `PLAYERS_DB_HIST`,
mide, y lo restaura.

### Lo que agregaron las veintiuna temporadas viejas (2000-2020)

- **18 clubes que no existían en la tabla de nombres**, y los nombró el log
  igual que estaba pensado: Olimpo, Crucero del Norte, Atl. Paraná, Boca
  Unidos, Douglas Haig, Estudiantes SL y Juventud Unida (G) en 2016-2020;
  Dep. Merlo, Sp. Desamparados, Sp. Belgrano (SF), Villa San Carlos, Guaraní
  A. Franco, Unión (MdP) y Juventud Unida (SL) en 2011-2015; y Tiro Federal,
  Sp. Ben Hur, Sp. Italiano y CAI en 2006-2010; y Alte. Brown (Arr.) y
  Gimnasia (CdU) en 2000-2004. Se agregan en una línea cada uno, y el aviso
  funcionó en las cinco tandas: ni un club quedó en minúscula en silencio.
  ⚠️ **Alte. Brown (Arr.) es el de Arrecifes**, no el Almirante Brown de
  Isidro Casanova que ya estaba en la tabla: dos clubes distintos con el
  mismo nombre corto.
- ⚠️ **Belgrano sale en las DOS competiciones en 2019, 2020 y 2021**, con dos
  slugs distintos (`Club Atlético Belgrano` y `ca belgrano`). Verificado que es
  el mismo club y no dos: los planteles coinciden **36/36, 55/55 y 31/31
  nombres**. De ahí salen las 39 y 56 filas repetidas de esos años — y quién
  gana el empate lo decidió recién el dato de 2011-2013 (ver abajo).
- **2016 tiene 30 clubes de Primera, así que SÍ juega con zonas** (`_zonasOK`)
  — Apertura + Clausura + playoffs, el formato argentino completo, con
  `AR_CLASICOS` filtrado a los clubes que ese año existen. Medido: Boca 2016
  con Tévez, Bentancur, Cardona y Rossi gana el Apertura y sale 2º en la anual.
  2014 y 2015 también llegan a 30 y juegan igual; de los quince años son los
  únicos tres. Medido además: Boca 2011 (Orión, Ustari, un Paredes de 18) juega
  38 fechas contra los 19 del año y River 2013 (Barovero, Driussi) 30 fechas
  contra los 15, los dos sin un jugador inventado y en su cancha real. Y más
  atrás todavía: Boca 2006 (Riquelme, Bobadilla, Caranta) sale campeón en 46
  partidos y River 2009 (Buonanotte) termina 2º en 42.
- ⚠️ **Los rivales de copa NO son del año.** La Libertadores y la Copa
  Argentina salen de listas escritas a mano (`INT_POW`, `caPool`), así que Boca
  2016 se cruza con Always Ready y LDU Quito de la lista de hoy. El TORNEO
  local sí es del año; el internacional no, y arreglarlo es bajar los cuadros
  históricos de cada copa, no un parámetro.
- **El contrato lo arregla `P()` solo y no hay que tocar el dato.** Un tercio de
  las filas viejas trae un contrato ya vencido para ese año (el parser toma la
  ÚLTIMA fecha de la fila y a veces es la de llegada): `(contractUntil >= _yr)`
  lo descarta y pone uno plausible. Verificado que los años se agrupan donde
  corresponde — el archivo 2018 tiene el pico en 2018/2019 y el de 2023 en
  2023/2024. Queda un ~1% con contratos largos de verdad, que es dato real.

### ⚠️ En 2011-2013 la lista de Primera que devuelve TM es la de HOY

Es el hallazgo caro de los años viejos, y no se ve mirando: los clubes de
Primera de 2011 y 2012 son **exactamente los 28 de 2025**, y los 26 de 2013
son un subconjunto de esos. Los PLANTELES sí son del año —salen de
`/verein/{id}/saison/{año}`, que es otra página—, pero la división no.

La prueba es un conteo, no una impresión: cuánto comparte la Primera de cada
año con la de 2025.

| año | 2011 | 2012 | 2013 | 2014 | 2016 | 2019 | 2022 | 2023 |
|---|---|---|---|---|---|---|---|---|
| clubes en común con 2025 | **28/28** | **28/28** | **26/26** | 20/30 | 21/30 | 21/25 | 26/28 | 28/28 |

De 2014 en adelante la serie crece de a poco hasta 2025, que es lo que hace la
historia de verdad. En 2011-2013 está pegada al techo: es la lista de hoy.

⚠️ **Ojo al medir esto**: comparar los nombres YA canónicos con
`histClubNombre` los rompe (`'Atl. Tucumán'` vuelve como `'Atl Tucuman'`) y la
primera medición dio 14/28 — el bug estaba en el instrumento. Normalizá los dos
lados con `histNorm` antes de comparar.

**La lista del ASCENSO sí es del año** (la de 2011 trae River, Quilmes,
Chacarita, Merlo, Desamparados), así que de ahí sale la regla: **cuando un club
aparece en las dos competiciones, gana la SEGUNDA**. Verificada en los 14 casos
que existen —los 8 de 2011, los 9 de 2012, los 10 de 2013, Belgrano 2019-2021
y Godoy Cruz 2025— y en todos es lo históricamente correcto:

| | con "gana Primera" | con "gana la segunda" |
|---|---|---|
| River 2011 | Primera | **B** ✓ (descendió en junio de 2011) |
| Independiente 2013 | Primera | **B** ✓ (descendió ese año) |
| Belgrano 2019-2021 | Primera | **B** ✓ |
| Primera 2011 | 28 clubes | **20**, que es el tamaño real de ese torneo |

⚠️ **NO se parchearon los archivos: la regla vive en el extractor**, donde el
club que ya vino en la otra competición no se vuelve a bajar (el plantel es el
mismo) y sólo se le **cambia la etiqueta**. Los quince archivos se
re-generaron con ella, así que una extracción nueva da exactamente lo mismo.

⚠️ **Sigue sin ser el torneo de ese año, y conviene no venderlo como tal.**
Con la corrección, la Primera 2011 tiene los 20 que corresponden, pero adentro
hay **Riestra, Barracas Central, Central Córdoba y Platense** —que ese año
estaban en el ascenso— y faltan Olimpo, All Boys, Arsenal, Colón y Rafaela. El
arreglo de verdad es bajar 2011-2013 con el ID de competición VIEJO de TM (la
Primera División anterior a la Superliga), si es que existe uno aparte; el
campo del extractor ya está para eso. De 2014 en adelante la lista es del año
y no hace falta nada.

### ⚠️ Antes de 2008, TM no cubre el ascenso — y una liga sin planteles NO se ofrece

Es el límite que trajeron los años viejos, y no tiene nada que ver con el
parser: el sitio directamente no tiene esas fichas. La medida que importa no es
"cuántos clubes hay" sino **cuántos tienen plantel de verdad** (15+ fichas),
porque a los demás `squadFromDB` les inventa el equipo entero:

| año | Primera | 2ª división |
|---|---|---|
| 2000 | 16 de 16 | **2 de 12** |
| 2002 | 16 de 18 | **5 de 11** |
| 2003 | 16 de 17 | **6 de 11** |
| 2006 | 17 de 22 | **8 de 15** |
| 2005 | 16 de 17 | **4 de 8** |
| 2007 | **15 de 17** | **7 de 20** |
| 2008 en adelante | 16-30 de 16-30 | **20 de 20** |

(2001 y 2004 directamente vuelven con la 2ª vacía o casi.)

**La Primera nunca cae ahí** —lo peor es 2007 con 15 de 17— así que el corte
separa exactamente lo que hay que separar. `ligasJugables()` ahora exige
**10 clubes con 15+ fichas** (`LIGA_MIN_CLUBES` / `LIGA_MIN_PLANTEL`) en vez de
contar clubes a secas, y con eso la 2ª división anterior a 2008 **desaparece
del selector**. Verificado que **no toca ninguna de las 25 ligas de la base
actual**: están todas al 100% (30/30, 20/20, 18/18…).

⚠️ Y hay una coincidencia que conviene entender: los clubes flacos de Primera
son casi siempre **los mismos que la lista de hoy metió de prestado** (Central
Córdoba, Barracas C., Sarmiento, Talleres). Están flacos *porque* ese año
militaban tres categorías más abajo y TM no los cubría. O sea que las dos
fallas —lista moderna y plantel incompleto— se explican con el mismo dato.

Los grandes están completos siempre: **Boca 2000 trae 50 fichas y River 48**.
Medido jugando: Boca 2000 (Óscar Córdoba, Abbondanzieri) sale campeón en 34
partidos, River 2003 (un Carrizo de 20, Celso Ayala) en 36, y Boca 2005
(Abbondanzieri, Bobadilla, Palermo) y River 2005 (Germán Lux y un **Gallardo
de 30, como jugador**) en 36 cada uno.

⚠️ **Un archivo que se vuelve a bajar puede ser idéntico al que ya está.** El
2004 llegó dos veces —la primera con la 2ª división vacía, que parecía una
corrida a medias— y comparando fila por fila salieron **602 idénticas, 0
diferencias**: no era una extracción incompleta, es lo que TM tiene de ese año.
Antes de re-instalar un archivo repetido, compará; si no, se reescribe por
nada y se pierde el rastro de qué cambió.

### ⚠️ Un arnés que no drena bien los dilemas informa una temporada de 7 fechas

River 2009 "terminó" con **7 partidos jugados y campeón con 9 puntos**, y el
juego estaba perfecto: el arnés resolvía los dilemas recorriendo `G.dilemas`
con `d.did`, y el que FRENA lo devuelve `dilemaBloqueante()` y se contesta por
`d.id`. Con eso arreglado la misma corrida da **42 partidos y 2º puesto**.
Es otra vez el instrumento y no el producto: **antes de creerle a una
temporada corta, revisá el drenaje**. La regresión ya lo hace bien
(`dilResolver()`), así que lo correcto es copiar de ahí y no escribirlo de
nuevo.

🔶 **`la fatiga no separa` es FLAKY**, como `dilemas`. El umbral es
`roto > sano*1.35` sobre 4.000 tiradas de Poisson y se cae por centésimas
(medido: 1,64 contra 1,647 de umbral, y verde en la corrida siguiente con el
mismo código). Si lo ves rojo, corré de nuevo antes de creerle.

## Fase 44: la inflación del mercado — un año viejo no se mide con la plata de hoy

El síntoma que reportó el usuario: **el mejor jugador del 2000 tenía 69 de
media**. La media sale del VALOR (`valToRat` es logarítmica) y la plata del
fútbol creció, así que una liga vieja entera quedaba aplastada contra el piso.

### El factor se DERIVA, no se escribe a mano

No hay índice de inflación en el código ni traído de memoria: se compara **la
misma liga contra sí misma**, el promedio de los 10 valores más altos de la
Primera de ese año contra el de 2026 (`_inflAncla`). Medido:

| año | 2000 | 2003 | 2005 | 2010 | 2015 | 2020 | 2025 |
|---|---|---|---|---|---|---|---|
| factor | **×6,86** | ×5,52 | ×1,70 | ×1,79 | ×1,11 | **×0,87** | ×0,87 |

⚠️ **No es una curva suave y eso importa**: la corrección es fuerte hasta 2003
y de 2004 en adelante es casi nada. En 2017-2020 el factor es **menor que 1**
—esos años la liga argentina valía MÁS que hoy— y se corrige para abajo, que es
lo consistente: la escala tiene que significar lo mismo en los 26 años.

Como el rating es logarítmico, multiplicar el valor **suma puntos fijos**:
×2 son +3,3 y ×10 son +10,9. Resultado contra la referencia de 2026
(mediana 66 · p90 74 · máx 82):

| 2000 | mediana | p90 | máx | jugadores de 80+ |
|---|---|---|---|---|
| antes | 56 | 61 | 76 | **0** |
| ahora | **65** | **70** | **85** | **4** |

### ⚠️ Lo que el factor NO arregla, y conviene no prometerlo

La **dispersión**. En 2000-2003 el **94-96% de las fichas no tiene valoración
en TM** (quedan en el 0,1 de fallback del extractor), así que el plantel sigue
siendo más plano que uno de hoy: **sd 3,4 contra 6,1**. Eso es dato que no
existe, no una constante para tunear.

Y ojo: **eso prueba que el parser anda**. Si fuera un fallo de parseo sería
todo o nada por página; acá la cobertura sube de a poco con el año (96% sin
valor en 2000 → 17% en 2025) y en la MISMA página de 2004 hay jugadores con
precio y jugadores sin él.

Se probó la alternativa —escalar **sólo** a los que sí tienen precio— y deja la
mediana en 56: le arregla la media a los cuatro cracks y abandona al resto.
Medido, peor. Por eso se escala la columna entera.

### Dónde vive

`_dbInflada(y,db)` devuelve una **copia** de la base del año con los valores
escalados y la cachea; `aplicarTemporada` la enchufa en lugar del array del
archivo. Verificado:

- **el archivo del disco no se toca** (el máximo de `players-hist-2000.js`
  sigue abajo de 3M),
- **ir y volver entre temporadas no escala dos veces** (2000 → 2026 → 2000 da
  el mismo 13,095 y el mismo factor),
- una partida de 2000 **sobrevive al guardado** con el factor puesto,
- y medido sobre la base ya corregida el ancla vuelve a dar **×1,00** contra
  2026, que es la definición de que quedó en escala.

⚠️ `_inflCache` está indexado por AÑO y sale del archivo, que no cambia, así que
**NO va en la lista de cachés que tira `aplicarTemporada`** (sería recopiar la
base entera en cada ida y vuelta). Es el único derivado de la base que
sobrevive al cambio de temporada, y está comentado ahí para que no se lo sumen
sin querer.

⚠️ **Una partida YA guardada conserva las medias viejas**: `G.squad` se
serializa con el `rat` calculado al crearla. Es la regla de siempre —no se
migra el save—, así que la corrección se ve en las partidas nuevas.

⚠️ Los clubes curados a mano (Boca, River, Racing, Independiente, San Lorenzo)
tienen reputación y presupuesto escritos en `TEAMS`, así que **no se mueven con
el factor**: Boca sigue en rep 78 y 28M en los 26 años. Lo que sí se empareja
es el ONCE, que es lo que se quería — medido, el promedio del once titular de
Boca queda en **73-77 de 2000 a 2026** en vez de caer a 60 en los años viejos.

## Fase 45: la lista del usuario — reconversiones, cláusulas y campos que se escriben

### Reconvertir a lateral te devolvía un delantero

`RECONV` usaba **`'LD'` / `'LI'`, que no son puestos en este juego**: son sólo
la ETIQUETA que dibuja la cancha (`lbl` en `FORMATIONS`). Los códigos de
verdad son `DFD` / `DFI`. Al terminar la reconversión el jugador quedaba con un
puesto que nadie reconoce y `pgr()` se caía por su última línea,
`return 'DEL'`. Medido: `pgr('LD')` da `'DEL'` y `pgr('DFD')` da `'DEF'`.

⚠️ **Los mismos códigos fantasma estaban en otros dos lugares**: `nuevasCamadas`
(que fabricaba juveniles del mercado como delanteros y sin perfil de atributos)
y el sorteo de asistencias, donde simplemente no coincidían nunca. `MI`/`MD`
además no tenían ninguna reconversión posible, y ahora sí.

### El filtro de puesto del Plantel se reseteaba solo

`rSq(f)` tomaba el filtro por argumento y `updateUI()` la llamaba con `'all'`
clavado, así que cualquier acción devolvía la lista entera. Ahora vive en
`_sqFiltro`, **fuera de `G`** como el resto del estado de pantalla (`_PT`,
`_SPN`, `_mkLibres`). Medido: con DEF muestra 10 de 30 y sobrevive a `updateUI()`.

El **tope del plantel es `PLANTEL_MAX` (45)**: estaba escrito a mano en nueve
lugares, así que subirlo era encontrarlos todos.

### La cláusula se PAGA, no se negocia — y no la tiene cualquiera

El bloqueo del clásico (`jerarquiaBloquea`) se aplicaba también a la cláusula,
que es justamente el camino que existe para saltear al club. Ahora recibe
`viaClausula`. Medido con un jugador de River: negociar sigue bloqueado, la
cláusula no. El club **igual queda hostil**, porque `enojarClub` ya se dispara
con cualquier cláusula de tu misma liga y un clásico lo es por definición. La
IA juega con la misma regla: dejar que sólo el presidente ignore un clásico
sería darle una herramienta que nadie más tiene.

⚠️ **`clauseOf` le inventaba una cláusula a TODOS.** Medido: **0 de las 17.108
fichas** de la base traen una de verdad, así que el botón salía en cada tarjeta
del mercado. Ahora `tieneClausula(p)` la decide por liga y perfil, determinista
por nombre igual que `persDe`: **España 100%** (allá es obligatoria por ley),
Brasil 57%, Liga ARG 37%, Premier 31% — **39% del mercado**. Las dos vías de la
IA exigen que exista antes de usarla.

### Los filtros del Mercado eran listas de cuatro opciones

Valor, edad y media se elegían de un `<select>` con 4 escalones fijos: no había
manera de pedir "más de 37,5M". Los seis son ahora **campos numéricos**
(`mkMaxV`/`mkMinV`, `mkMaxAge`/`mkMinAge`, `mkMinR`, `mkMinPot`), más un
selector de **situación contractual**.

⚠️ **El potencial mínimo NO puede leer `p.pot`.** Sería la misma puerta de atrás
que ya se tapó con la media: al desconocido se lo juzga por `potHi(p)`, el
techo de su rango estimado, igual que `ratHi` para `minR`.

⚠️ **`wantsOut` y `onLoan` no sirven para filtrar el mercado, y el código lo
dice.** Los cinco lugares que ponen `wantsOut` y el único que pone `onLoan`
tocan **sólo a tu plantel**, así que en el mercado dan 0 siempre — un filtro
que nunca encuentra nada se lee como un bug. Lo que sí existe en la ficha de
cualquiera es el año de contrato y la cláusula, así que las cuatro opciones son
**con cláusula · precontrato (≤6 meses) · último año (≤18) · contrato largo
(3+ años)**. El precontrato da 0 en la semana 1 y **lo explica**, igual que el
filtro de libres.

### El buscador del Plantel

`#sqQ` busca por nombre, puesto, segundo puesto y nacionalidad, con **el mismo
`_tsNorm`** del Mercado y del wizard — tres normalizadores distintos se
desincronizan. Si no encuentra nada lo dice en vez de dejar la lista en blanco.

### Los montos se escriben: `nPair` / `nRead` / `nClamp`

Siete montos negociables (sueldo de la oferta, términos personales, renovación,
propuesta al jugador, años, plata del canje, sueldo del DT, prima y semanal del
sponsor) eran **sliders puros**. Con un rango de 22 a 77 el slider obliga a
cazar el pixel. Ahora cada uno es un **par atado**: el slider para tantear y un
campo para escribir el número exacto.

⚠️ **Un `<input type="number">` NO se acota solo al tipear, y acotarlo en cada
tecla es peor**: escribir "35" con mínimo 12 daría 1 → 12 → 122. Por eso se
acota al **salir** del campo (`onchange`) y, sobre todo, **al leerlo**
(`nRead`), que es lo que usan las funciones que deciden. Si agregás un monto
escribible, leelo con `nRead` y no con `.value`.

⚠️ **`soft` es obligatorio cuando el callback REDIBUJA el panel que contiene al
par** — el sponsor (`spnSet` → `spnRender`) y el canje (`updSwapInfo`). Sin eso
el campo se destruiría a mitad del número y se perdería el foco. Con `soft` el
campo avisa al salir y el slider sigue dando la vista previa en vivo.

Medido en los siete: el campo se acota arriba y abajo, el slider lo sigue, y
`nRead` devuelve el tope aunque el campo tenga 999999 adentro. `.npair` no
lleva `backdrop-filter`: vive dentro de un modal que ya es vidrio real.

⚠️ **El `ticketSlider` y las barras de perfil del DT (`cdtProf`) quedan como
están**: ahí el control ES el dato (una preferencia continua de 0,50 a 2,00 y
unos diales 0-100), no un monto que se quiera escribir.

## Fase 46: el resto de la lista — giras, libres, cláusulas, % de reventa y el lag

### La gira no miraba quién sos

El usuario lo reportó jugando con Chacarita y cruzándose con el City. Medido
sobre 50 sorteos por club, `tourRivals` tomaba **los 40 de MAYOR nivel de la
zona** y sorteaba entre ellos:

| club | nivel | rivales de la gira internacional |
|---|---|---|
| San Martín (SJ) | 53 | Barcelona 88 · PSG 88 · Real Madrid 88 |
| Boca Juniors | 72 | Arsenal 88 · Barcelona 88 · Real Madrid 88 |

O sea **exactamente los mismos para los dos**. Ahora salen de una banda
alrededor de TU nivel (`TOUR_BANDA=7`, medido en la misma escala: el promedio
de tus 14 mejores, `_tourMiPow`). Después del arreglo:

| club | rivales |
|---|---|
| San Martín (SJ) | Estoril 71 · Rio Ave 71 · Rostov 71 … Celta Fortuna 64 |
| Boca | Crystal Palace 84 · Brentford 84 · Napoli 84 … Charleroi 70 |

⚠️ **La banda se ABRE hasta encontrar rivales.** Filtrar sin rellenar es el
error que este archivo ya documenta dos veces, y acá además sería un **candado**:
sin amistosos, las semanas 1-3 quedan sin partido y `advanceDay` se planta en el
día 7 (es el bug del 🏋️ Predio de la Fase 43).

⚠️ **No sirve `nivelClub` para la banda**: es el logaritmo del VALOR del
plantel, otra escala. Mezclarlas haría que la ventana no quiera decir nada.

### A la gira internacional te INVITAN

`reqRep:68` en `PRESEASON_TOURS.asia`. Sin eso, un club de rep 39 —cuyo
presupuesto ENTERO son 3M— elegía Asia/EEUU y **duplicaba la caja en la semana
1** cobrando lo mismo que Boca. Y la plata ya no es una constante:
`tourIngreso(t)` la escala por reputación (ancla en Boca, rep 78), con tope
1,6× y piso 0,35×.

El portero va en las **dos** vías, no sólo en la lista: `doPreseason` también
lo chequea, igual que `signSponsor` y las cuatro vías de la Fase 16.
Verificado: con rep 35 la gira no aparece, el modal **explica por qué** en vez
de esconderla, y forzarla por código cobra **0**.

### Con un libre sólo se negocia el contrato

Medido sobre un libre de 74 con 2,5M de valor: **`askingPrice` pedía 2,7M** de
ficha por alguien que no tiene club, la ficha del mercado le ofrecía **Cláusula
y Canje**, y `openNeg` abría la pantalla de traspaso hablando de "Valor TM".

- `askingPrice` y `clauseOf` devuelven **0** si `esLibre(p)`.
- `libreBloquea(p,via)` es el portero único y va en las **cuatro** vías más
  `openNeg`, porque la ficha tiene botones directos que no pasan por ahí. No
  rebota y ya: **te manda a los términos personales**, que es lo que sí existe.
- La ficha de un libre muestra un solo botón: *"🆓 Arreglar contrato (llega
  sin ficha)"*.

⚠️ De paso: el botón de Cláusula del mercado salía **siempre**, aun para el
61% de los jugadores que desde la Fase 45 no tienen una. Ahora se dibuja sólo
si `clauseOf(p)>0`.

### La cláusula de rescisión se negocia (al firmar y al renovar)

Era un número que el juego inventaba y con el que vos no tenías nada que ver.
Ahora es parte del contrato y tiene el sentido que tiene en la realidad: **es
la puerta de salida DEL JUGADOR**. `PT_CLAUS` son cinco opciones sobre el valor
de mercado —la misma escala que ya usaba `clauseOf`— y el peso va en la
dirección correcta, verificado monótono:

| | sin cláusula | 2× | 3,5× | 6× | 10× |
|---|---|---|---|---|---|
| puntaje del jugador al firmar | 3,00 | **4,80** | 4,35 | 3,80 | 3,10 |
| piso que pide para renovar | **0,910** | 0,802 | 0,829 | — | 0,904 |

Vive en **un solo lugar** (`PT_CLAUS`) y lo leen las tres pantallas: los
términos personales (las cuatro vías de fichaje), `negStep3` (la negociación
larga) y `openContract` (la renovación). Queda **escrita** en `p.clause`, que
`clauseOf` ya respetaba, y **"sin cláusula" deja `-1`** — la marca que
`tieneClausula` ya conocía, así que no se la vuelve a inventar por liga.

⚠️ El semáforo y la decisión usan la MISMA función (`renovClausAjuste`). Si el
preview dijera 🟢 y el jugador rechazara, se leería como un bug — es la misma
regla que `renovPiso` en la Fase 34.

### El % de futura venta se ofrece en la mesa

El mecanismo existía **sólo al revés**: cuando un club te compraba un jugador
podía dejarte un % (`o.sellOn`). Comprando no había manera de ofrecerlo, que es
justamente cómo se cierran los pases difíciles.

⚠️ **NO se creó un campo nuevo.** Se reusa `p.ownedPct`, que YA está cableado
en la venta (`val=val*p.ownedPct`) y en la insignia ➗ del plantel. `sellOnPct`
existía en el archivo y **no lo leía nadie** — campo muerto. Dos campos para el
mismo dato es el bug que este proyecto ya se hizo cinco veces.

Medido de punta a punta con Kevin Mac Allister (valor 12M, piden 14,5M):

| | oferta mínima que da verde |
|---|---|
| sin ceder nada | **12,8M** |
| cediendo el 30% de una futura venta | **10,8M** |

y al venderlo después en 20M cobrás **14M**. Ese es el trade.

### La Junta salva contratos en el cierre de temporada

`weeklyJunta` ya renovaba, pero corre **una vez por mes** y cierra hasta 3, así
que en el cierre quedaban varios vencidos y se iban libres. `juntaRenovFin()`
es el último barrido, **justo antes** de `expireContracts`. Medido, 12 corridas
por nivel con 8 contratos vencidos:

| | contratos salvados (mediana de 5) |
|---|---|
| sin delegar | **0** |
| sin Director Deportivo | **0** |
| Director nivel 40 | 2 |
| Director nivel 65 | 3 |
| Director nivel 90 | **4** |

⚠️ **No salva a todos** (`JUNTA_RENOV_MAX=5`): si lo hiciera, delegar apagaría
el riesgo entero de quedarte sin plantel. Con 8 vencidos salva 5 y **quedan 3**.

⚠️ **Corre ANTES de `expireContracts`, no adentro**: `seVaLibre` tira un dado en
CADA llamada, así que preguntarlo dos veces por el mismo jugador daría dos
respuestas distintas.

### Lo que pide un jugador mira su VALOR, y de qué club viene

Dos agujeros, los dos medidos:

1. **El valor no entraba en la cuenta.** A igual rating la dispersión es
   enorme —un rat 84 va de **12M (p10) a 75M (máximo)**, seis veces— y los dos
   pedían lo mismo. `_wageValFactor` compara contra la **mediana de su propia
   banda de rating**, así el rating no se cuenta dos veces: sólo entra lo que
   el rating no explica. `×3 de valor = +16%`, con tope. Medido: 0,88 en el
   p10 · 1,00 en la mediana · 1,14 en el máximo.
2. **El club de origen era un regex con 11 nombres a mano** que cubría **14 de
   los 612 clubes de la base**. Y peor: decía `Man\. City` con punto, y en la
   base el club se llama `Man City`, así que **el bonus nunca se disparó para el
   Manchester City**. Es el mismo patrón de `bigClubs`/`midClubs` de la Fase 18.
   Ahora sale de `clubRank()`: hay **27 clubes de nivel 84+** y 14 no estaban en
   la lista. Medido con el mismo jugador clonado: Man City/Real Madrid **68k** ·
   Boca **61k** · Aldosivi **56k**.

### ⚠️ El juego trabado: `updateUI` dibujaba las SIETE pestañas y guardaba 3,1 MB

El usuario lo reportó y la causa son dos líneas. Medido con `performance.now`,
mediana de 7 corridas:

| | antes |
|---|---|
| `updateUI` | **167 ms** |
| …de eso, `saveGame` | **137,6 ms** (el 82%) |
| …de eso, `renderMktSafe` | **58,5 ms**, aunque estuvieras mirando el Plantel |
| `renderMkt` | 37,5 ms, de los cuales **27,7 son el ORDEN** |

Tres arreglos:

1. **El guardado se agrupa** (`saveSoon` / `SAVE_DEBOUNCE=900`). ⚠️ **`saveGame()`
   sigue guardando en el acto**: hacer que la llamada explícita "guardá" no
   guarde sería el tipo de bug silencioso que este archivo documenta una y otra
   vez — y de hecho **lo destapó la regresión**, que hace `saveGame(); G=null;
   loadGame();` y se encontró con que no había nada. Lo que se agrupa es el
   guardado automático de cada render. Hay `saveFlush()` en el fin de partido,
   el cambio de temporada y `beforeunload`.
2. **Se dibuja la pestaña que se VE** (`_TAB_R` + `pintarTab` + `gTab`). ⚠️ Una
   función que no esté en `_TAB_R` no se dibuja nunca: si agregás una tarjeta,
   sumala a su pestaña.
3. **El orden del Mercado precalcula la clave** en vez de llamar a `ratEst`
   dentro del comparador (480.000 llamadas contra 17.075), y `_scoutHash` se
   cachea por jugador como propiedad **no enumerable** — con 17.000 fichas, un
   campo más se va al save, que es el problema de los 395 KB de `p.personality`.
   `nivelClub` pasó de un `find` lineal sobre 612 clubes a un mapa.

| | antes | ahora |
|---|---|---|
| `updateUI` en el Plantel | 167 ms | **2,9 ms** |
| `updateUI` en el Mercado | 167 ms | **13,2 ms** |
| `renderMkt` | 37,5 ms | **16 ms** |
| cambiar de pestaña | — | 0,6 ms |

### ⚠️ Y dibujar estaba CREANDO estado del juego

Es la consecuencia peligrosa de (2) y la destapó la regresión: `G.league` lo
construía **`rStand`**, o sea la tabla de posiciones. Con las pestañas
perezosas, una partida en la que nunca abriste el Calendario quedaba con
`G.league` en **null** — y de ahí leen la posición, el descenso y
`archiveSeason`.

Auditado comparando la huella de `G` antes y después de pintar las siete
pestañas: eran **cinco campos**. `G.league` (`rStand`), `trainIntensity` y
`trainFocus` (`rTrain` — y los **lee `weeklyTraining`**, así que sin abrir la
pestaña el club entrenaba con `undefined`) y `dtPool` (`rStaff`, del que sale
la Junta). Los cinco se inicializan ahora en `updateUI`, que es donde
corresponde. Los dos que quedan (`_dtF`, `_socialReal`) son estado de pantalla
y no los lee ninguna regla del juego.

**Dibujar no puede ser lo que crea el estado del juego**, y la regresión ahora
lo verifica comparando esa huella.

### Dos trampas nuevas del instrumento, las dos ya documentadas antes

- **El check de la gira comparaba contra la constante 3M.** La plata ahora
  escala con la reputación, así que se caía en cuanto otro check de la sesión
  compartida movía la rep. Peor: el esperado se calculaba DESPUÉS de la gira, y
  la de Asia da `rep:2` — se pedía un número más alto que el que se cobró.
- **El check del embudo dependía de un dado.** `submitNegTerms` acepta por
  puntaje con un `Math.random()` en la banda del medio, y el puntaje se mueve
  con la reputación. Verde una corrida y rojo la siguiente con el mismo código.
  Se fija el dado: lo que se prueba es que el número LLEGUE al embudo, no la
  suerte del jugador.

## Fase 47: inmersión — que el juego CUENTE lo que pasa

Medido antes de escribir una línea, jugando 8 fechas: llegaron **36 noticias y
ninguna era de tus partidos** (24 fichajes ajenos, 8 rumores, 4 varias), el
vestuario mandó **9 mensajes y ninguno mencionaba un gol o una derrota**, y
entre fecha y fecha el club no hacía absolutamente nada.

### ⚠️ Las "Calificaciones XI" eran la MEDIA del jugador

El resumen tenía un bloque titulado **📋 Calificaciones XI** que imprimía
`rb(p.rat)`. O sea: el mismo número todos los partidos, ganaras 5-0 o
perdieras 0-4. No era una calificación, era la ficha.

`calcNotas()` da una nota de 3,5 a 10 por titular, y sale **sólo de lo que
pasó en el partido**: el resultado, sus goles y asistencias, la valla invicta
(al arquero y a la defensa), la posesión (al mediocampo), los remates al arco
(al ataque), las tarjetas de ESE partido, con qué energía terminó y su nivel
dentro del once. Medido a 10 partidos: rango **5,3 a 10,0**, 11 notas por
partido y **3,2 puntos** de diferencia media entre el mejor y el peor.

⚠️ **El ruido tiene que ser DETERMINISTA por partido** (hash del nombre + la
semana + la competencia). Si se sorteara al dibujar, volver a abrir el resumen
cambiaría las notas y se leería como un bug. Verificado.

⚠️ **Van calculadas después de `stats`, no arriba con el MVP.** `stats` se
arma 65 líneas más abajo que el bloque del MVP: calculadas allá, `calcNotas`
recibía `undefined`, el `try/catch` se lo comía **en silencio** y las
calificaciones no se dibujaban nunca sin que nada avisara.

⚠️ **La figura del partido salía del jugador de mayor MEDIA.** En un 0-0 la
figura era siempre el más caro del once, jugara como jugara. Ahora es el de
mejor nota, que ya contempla los goles y la valla invicta.

⚠️ **`N&&N[p.id]` devuelve `null`, no `undefined`**, cuando no hay notas: el
guard tiene que ser `typeof n==='number'` o `.toFixed` revienta el resumen
entero. Lo agarró la primera medición.

### Tus goles no tenían asistencia

`G.league.assists` se acreditaba para los clubes de la IA desde siempre, pero
cuando el gol era **tuyo** no la anotaba nadie: la columna de asistencias de tu
plantel se movía sólo por los partidos ajenos. Ahora el pase gol tiene dueño
(68% de los goles, con peso hacia los `MCO`/`EI`/`ED`), aparece en el resumen
al lado del gol y va también a la tabla de la liga.

### La crónica: el resumen cuenta el partido

⚠️ **Esto NO es relato jugada a jugada** — el usuario pidió expresamente que
simular vaya directo al resumen, y va. Lo que cambia es que el resumen ahora
**cuenta** el partido en vez de sólo tabularlo, y se arma después, con el
partido terminado.

Todo el material ya estaba y no lo leía nadie: `G._tiempos` (goles por tiempo y
energía de la defensa), `G._S` (posesión, fuerzas, rival) y los minutos de cada
gol. Medido: **10 de 10 crónicas distintas**, todas con minutos, nombres y
porcentajes reales.

⚠️ **Cada frase tiene que salir de un dato del partido.** Una crónica genérica
("fue un partido intenso") es peor que no tenerla: se nota en dos fechas que
siempre dice lo mismo. Por eso hay variantes elegidas por el hash del propio
partido, y por eso la frase de la valla invicta —que es muy frecuente— sale
sólo en 1 de cada 3.

⚠️ **Nada de clima en la crónica.** `window.matchWeather` se sortea sólo en los
partidos JUGABLES y la simulación de texto no lo mira: al simular quedaría el
clima del último partido que jugaste a mano y la crónica contaría una lluvia
que no existió.

### La prensa cubre TU club

`prensaCubrePartido` publica un titular por partido en `G.news` con tipo nuevo
`'club'` (y su pestaña en el diario). Sale del partido: la goleada, el clásico,
el hat-trick, el arco en cero, el papelón — más el ángulo del día, que es la
nota más alta o la más baja con el nombre de un diario real.

⚠️ **Se publica en `applyMatchResult`, no en `showMatchSummary`**: el resumen se
puede reabrir desde el botón "📊 Ver resumen" y publicaría el mismo titular
dos veces.

⚠️ **EL TOPE DE NOTICIAS SE LA COMÍA, y el recorte estaba escrito en CUATRO
lugares.** Medido sobre una temporada de 40 partidos: se publicaron 40
titulares y **sobrevivieron 7**. `G.news` topea en 50 y los rumores y fichajes
de la IA entran varias veces por semana. Es exactamente el bug que la Fase 18
ya arregló entre `aiNews` y `_pubRumor` — con el tope partido en dos — sólo que
ahora eran cuatro `G.news.length=AI_NEWS_MAX` sueltos. Los cuatro pasan por
`newsRecortar()`, que tira **primero lo ajeno** y le reserva `NEWS_CLUB_MIN=18`
a tu club. Medido después: **18 sobreviven**. ⚠️ No agregues un quinto
`G.news.length=` suelto.

### El vestuario reacciona a la cancha

Los chats existían (`weeklyChats`) pero se disparan por el estado general
—moral baja, contrato por vencer, pocos minutos— y nunca por un partido
concreto. `vestuarioTrasPartido` agrega cinco reacciones al partido que se
acaba de jugar: el del hat-trick, la figura de una tarde enorme, el goleador
que no viene jugando, la goleada en contra (habla el **capitán** y cae la moral
de todos) y el que sacó una nota de desastre.

⚠️ **Una por partido y con umbral.** Un vestuario que te escribe 50 veces por
temporada es ruido, no inmersión — es la misma lección que la indisciplina
mensual (Fase 29) y las conferencias por hito (Fase 35).

⚠️ **Y había un bug que lo destapó la regresión**: la rama de "salió redondo"
se disparaba también **después de un 0-4**, porque sólo miraba la nota del
jugador. Felicitar a la figura tras una goleada en contra se lee como un bug
del juego. Ahora pide que el equipo no haya cobrado (`ga-gf<3`).

### La vida del club entre fecha y fecha

Pasar el día no era nada: se recuperaba la física, avanzaban las negociaciones
y de vez en cuando sonaba el teléfono por el mercado ajeno. `vidaDeClub()`
agrega seis voces, **todas derivadas del estado real**: el parte del cuerpo
médico del que está más cerca de volver, el juvenil que está pegando el salto,
el veterano cerca de los 100 partidos o los 50 goles, el humor de la calle
(que sale de `fanMood`), el técnico avisando quién entrena de mala gana, y la
tesorería cuando la caja está en rojo.

⚠️ **Lo que sale de acá tiene que ser VERDAD sobre el estado actual.** Un
generador de frases de color se gasta en una semana; un parte que te informa
algo que no sabías, no.

⚠️ **Dos cosas que hubo que medir para que no fuera ruido.** El primer valor
(`0.30`) daba **2,8 mensajes por semana (94 en una temporada)** y, peor, la
misma rama una y otra vez: 4 de cada 5 eran el Coordinador de Inferiores
elogiando a un pibe distinto. Ahora `VIDA_CLUB_P=0.16` (**1,3 por semana**
medido), nunca dos veces seguidas la misma rama, y al mismo juvenil no se lo
elogia dos veces en el mismo semestre.

### El estado, como manda el proyecto

`G._notas` (11 números por partido), `G._vidaUlt`, `p._vidaPibe`, `p._yelMatch`
y `p._redMatch` son primitivas: **0 funciones en `G`**, verificado. Retro-
compatible sin migrar: un save viejo no tiene ninguno y eso es exactamente "no
hay notas de ningún partido todavía" — el bloque de calificaciones no se dibuja
y el resto sigue igual.

## Fase 48: el fuera de juego, con la línea de la ley

⚠️ **El pedido decía `director-tecnico_2.html`: ese archivo no existe.** El
juego es `director-tecnico.html` y no hay ninguna copia `_2`.

Y la mitad del pedido **ya estaba desde la Fase 26**, que lo había medido: se
evalúa sólo en el frame del pase (dentro de `fmTeamPass`), sólo sobre el
receptor previsto, con la comparación dada vuelta según `attRight`, y se
reanuda con tiro libre para el que defiende y el cartel en el canvas. Eso no se
reescribió. Lo que estaba mal eran **cuatro cosas concretas**, y las cuatro se
midieron antes de tocar.

### 1 · ⚠️ La línea excluía al arquero y después tomaba igual el índice [1]

```js
const oDefXs = rivals.filter(o=>!o.isGK)...   // saca al arquero
const offLine = oDefXs[1];                     // …y toma el SEGUNDO igual
```

La ley dice **"el penúltimo ADVERSARIO"**, y el arquero es un adversario —
normalmente el último. Filtrándolo y tomando igual el `[1]`, la línea caía
sobre el **antepenúltimo**: un defensor entero más atrás.

Medido sobre **696 pases de un partido**, comparando la línea que usaba el
código contra la de la ley en cada frame de pase: **53px de diferencia
promedio**, y siempre en la misma dirección (más profunda). O sea que el
atacante quedaba en fuera de juego **53px antes** de lo que corresponde.

El caso que lo vuelve importante es el **arquero salido**: ahí el último
adversario ya no es él, y contar a los once es la única forma de que la línea
sea la correcta. Verificado determinista en la regresión con el arquero en
2000 y los defensores en 2600/2500: la línea pasa al 2500.

### 2 · ⚠️ El pitazo se tiraba a los dados

```js
if(bestOff && Math.random()<0.65){ ... }   // el 35% NO se cobraba
```

Jugado el pase al adelantado, **uno de cada tres fuera de juego reales no se
cobraba**. Una regla no depende del azar: si las dos condiciones se cumplen en
el frame del pase, es offside. Ahora es `if(bestOff)`.

⚠️ **Lo que SÍ sigue siendo un dado, y está bien, es otra cosa**: que el
pasador PREFIERA al compañero habilitado (`Math.random()<0.66` sobre la
elección del receptor). Eso no es el reglamento, es una decisión de la IA — un
equipo no le pasa a propósito a un tipo adelantado — y vive en el score del
pase, no en la validación.

### 3 · ⚠️ La raya que se DIBUJABA no era la que se cobraba

El dibujo de la cancha tomaba el **último** defensor de campo
(`max(q.x)` sobre los no-arqueros) y la validación usaba el **anteúltimo**.
O sea: veías una línea punteada y te sancionaban por otra, 53px más atrás.
Las dos salen ahora de `fmOffsideLine` — una sola fuente de verdad, la misma
regla que `G.roles.captain` o `ARQ`/`DT_ARCHETYPES`.

### 4 · Las tolerancias eran asimétricas

16px contra la línea y 30px contra la pelota, escritas en la misma expresión.
Ahora hay una sola, `OFF_TOL=6`, simétrica, y la duda favorece al atacante.
Verificada **en el píxel exacto** de los dos lados: a `offLine+6` está
habilitado y a `offLine+7` no.

### Cómo quedó

```js
const OFF_TOL=6;
function fmMasAdelante(a,b,attRight){ return attRight ? (a>b+OFF_TOL) : (a<b-OFF_TOL); }
function fmOffsideLine(rivals,attRight,f){
  const xs=(rivals||[]).map(o=>o.x).sort((a,c)=>attRight?c-a:a-c);
  if(xs.length>=2)return xs[1];
  if(xs.length===1)return xs[0];
  return attRight?f.rightGL:f.leftGL;
}
function fmEsOffside(tx,ballX,offLine,attRight,f){
  const enCampoRival = attRight ? (tx>f.VW/2) : (tx<f.VW/2);
  if(!enCampoRival) return false;
  return fmMasAdelante(tx,offLine,attRight) && fmMasAdelante(tx,ballX,attRight);
}
```

`f.VW/2` es la mitad de cancha de verdad: `VW=2960`, `leftGL=92`,
`rightGL=2868`, y `(92+2868)/2 = 1480 = VW/2`. Verificado antes de usarlo.

### 🛑 La FRECUENCIA no se pudo medir, y no se afirma que haya mejorado

Es la regla del proyecto y acá aplica de lleno. Con el mismo arnés, antes y
después:

| | minutos | pases | offsides | por 90 |
|---|---|---|---|---|
| antes | 90 | 312 | **2** | 2,0 |
| después | 360 | 1.676 | **7** | 1,8 |

**Dos eventos contra siete no deciden nada**, y encima el arnés ni siquiera
acumuló los mismos minutos en las dos corridas (90 contra 360) — es el mismo
problema del instrumento que la Fase 26 documentó con las faltas (25,4 / 3,6 /
4,5 por 90 **sobre el mismo código**) y la Fase 32 con el bloque. Así que:
**la regla está bien; cuántas veces por partido cae, no se sabe.**

Lo que sí queda anotado es la dirección de cada cambio, que se cancelan entre
sí: la línea correcta es **más benévola** (se corre 53px hacia el arco rival,
así que hay menos adelantados), el pitazo determinista es **más severo** (+35%
de los jugados), y la tolerancia de 6px también. Si algún día hay que acercarse
a los 4-5 por 90 reales, el lugar NO es la validación —que ahora es el
reglamento— sino el `0.66` de "el pasador ve el offside", que es lo que decide
cuántos pases se llegan a jugar a un adelantado.

### La regresión lo blinda DETERMINISTA, sin estadística

16 asserts de geometría pura, que es la única forma de blindar algo en este
motor (el baseline se mueve ±120px entre corridas idénticas): la línea con el
arquero adentro, la simetría atacando a la izquierda, el arquero salido, un
solo rival, ningún rival, las dos condiciones por separado (adelantarse a una
sola NO es offside), la propia mitad, la tolerancia en el píxel exacto de los
dos lados, que `fmTeamPass` ya no tenga `Math.random()` en la rama del cobro,
que se reanude con `freekick` y el cartel, que ninguna otra función del motor
llame a `fmEsOffside`, y que el dibujo use `fmOffsideLine`.

## Fase 49: nueve pestañas en blanco — las claves de `_TAB_R` eran inventadas

El usuario lo reportó con **Juveniles y CT vacías**. La causa es de la Fase 46,
donde `updateUI` dejó de dibujar las siete pestañas y pasó a dibujar la que se
mira (`_TAB_R` + `pintarTab` + `gTab`). La tabla que dice qué dibuja cada
pestaña **se escribió con nombres inventados**, no con los ids reales del DOM:

```js
const _TAB_R={ sq, tac, mkt, ent, cal, pres, est, social };   // 8 claves
```

Pero los `<div class="tc">` del juego son **quince**:

```
ov sq dt tac mkt trn stad juv ct pat cal stats news social pres
```

`ent` y `est` **no existen como pestaña**, y encima agrupaban cosas de cuatro
pestañas distintas bajo una sola clave (`ent` tenía `rTrain`, `rStaff`, `rInd`
y `rJuv`, que viven en `trn`, `ct`, `trn` y `juv`). `pintarTab` tiene
`if(!fns) return;`, así que **se iba en silencio**.

Medido con el archivo de antes del arreglo, entrando a las 15 pestañas:

| pestaña | antes (caracteres de texto) | ahora |
|---|---|---|
| Juveniles | **12** (vacía) | 1.534 |
| CT | **17** (vacía) | 14.370 |
| Stats | **15** (vacía) | 793 |
| Noticias | **21** (vacía) | 95 |
| Estadio | 11 al entrar de cero | 3.941 |
| Mi DT | 308 (a medias) | 1.894 |
| Entrenamiento | 112 (a medias) | 1.699 |
| Patrocinadores | 136 (a medias) | 325 |
| Inicio | 1.231 (sin la tabla) | 2.376 |

**Nueve de quince pestañas rotas**, cuatro de ellas permanentemente en blanco.
Las seis que andaban (Plantel, Táctica, Mercado, Temporada, Redes, Presidente)
son justo las que tenían la clave bien escrita.

### El reparto se MIDIÓ, no se leyó

Adivinar qué render va en qué pestaña es cómo se llegó al bug. Se hookeó
`document.getElementById` y se anotó, por cada render, dentro de qué `.tc` cae
el elemento que toca (`scratchpad/tabs2.js`). De ahí salen las 15 entradas, y
de ahí también que sólo van las funciones **raíz**: `rPresTab` ya llama a
rVitrina/rFinChart/rJunta/rAprob/rSocios, `rTrain` a rTrainMeta/rMentor,
`rStaff` a rDtList, `rDtTab` a rDtProfile/rDtReport/rDtXI, `rCal` a
`rOtherLeagues` y `rFormation` a `rBench`.

Dos cosas que la medición corrigió respecto de lo que estaba escrito:
**`rStand` dibuja en la portada (`ov`), no en el Calendario** —estaba en
`cal`— y **`rMovs` no estaba en ninguna clave**, así que la solapa de
Movimientos del Mercado tampoco se dibujaba sola.

### ⚠️ Una pestaña sin entrada ya no se va en silencio

`pintarTab` ahora avisa por `console.error` y por el log del juego la primera
vez que le piden una pestaña que no está en la tabla, y los errores de cada
render se imprimen con el nombre de la pestaña y de la función en vez de
morir en un `catch(e){}` pelado. Sin eso, el próximo `<div class="tc">` que se
agregue vuelve a quedar en blanco sin que nada avise.

### ⚠️ Y el check de la regresión era un PASE VACÍO (el sexto documentado)

Esto lo tenía que haber agarrado la regresión y dio verde con nueve pestañas
rotas. El motivo:

```js
const conts={sq:'sqList', mkt:'mkList', pres:'loanBox', cal:'calView'};
```

Probaba **cuatro pestañas elegidas a mano — justo cuatro de las seis que
funcionaban**. Ahora recorre **las que hay en el DOM**, exige que las 15
tengan entrada en `_TAB_R`, que no sobre ninguna clave, y que al entrar quede
texto de verdad (40+ caracteres). Es el mismo tipo de trampa que el check de
memoria con los `every` sobre arrays vacíos, la temporada que contaba
iteraciones, los playoffs con 2 llaves, el `phoneMsgs.length` y el
`m.opp` que no existía.

## Fase 50: la deflación histórica va en la MEDIA, no en el precio

Reemplaza el factor derivado de la Fase 44. El pedido traía una regla estricta
—**no tocar `p.val`**— y esa regla arregla un problema real que el sistema
viejo tenía y esta documentación no decía.

### ⚠️ El sistema viejo SÍ reescribía el precio de Transfermarkt

`_dbInflada` escalaba la columna de valor (`r[7]`) de la base del año y
enchufaba esa copia. Medido antes de tocar nada:

| año | archivo (lo que dice TM) | lo que mostraba el juego |
|---|---|---|
| 2000 | **€1,91M** | **€13,1M** |
| 2005 | €10M | €17M |
| 2010 | €8M | €14,3M |
| 2020 | €20M | €17,3M |

O sea: la ficha, el Mercado y el balance mentían sobre un dato ajeno. La media
es un número nuestro y se puede corregir; el precio no.

### ⚠️ Y el ancla derivada tampoco servía: no es inflación, es cobertura

Salía del promedio de los 10 valores más altos de Primera de ese año, o sea de
**si TM valuó o no a los cracks de ese año**. Medido año por año, salta:

```
2003 ×5,52  →  2004 ×1,31  →  2005 ×1,70  →  2011 ×2,86  →  2017 ×0,89
```

Un acantilado de 4× entre dos años consecutivos no es el mercado. Con ese
factor puesto, las medianas seguían hundidas justo en el medio de la serie:
**2015 daba 58 y 2020 daba 57** contra los 63 de 2026.

### Lo que hay ahora

`INFL_TABLA` + `getYearInflation(year)`: índice monótono, ×5,0 en 2000 bajando
a ×1,0 en 2022 y 1,0 de 2024 en adelante. Se aplica **adentro de
`ratValPts`, sobre una variable local**. Medido después:

| año | factor | mediana | p90 | máx | 80+ |
|---|---|---|---|---|---|
| 2000 | ×5,0 | **64** | 69 | 84 | 4 |
| 2005 | ×3,7 | 63 | 74 | 89 | 20 |
| 2010 | ×2,4 | 65 | 73 | 87 | 10 |
| 2015 | ×1,55 | **60** | 72 | 88 | 9 |
| 2020 | ×1,1 | 58 | 69 | 81 | 3 |
| 2025 | ×1,0 | 62 | 71 | 84 | 6 |
| **2026** | ×1,0 | **63** | 72 | 82 | 5 |

La serie queda pareja contra 2026 en vez de caer a 57-58 en el medio.

⚠️ **Los valores quedan intactos, verificado por identidad**: la base del año
que se enchufa es **el mismo array del archivo** (`window.PLAYERS_DB===H[y]`) y
la suma de la columna de valor coincide al centavo en los 6 años medidos.

⚠️ **Y 2026 no se movió ni un punto**: huella de las 17.108 medias de la base
moderna, antes y después — misma suma (1.150.306) y mismo hash. La fase es un
no-op exacto para una partida normal.

### ⚠️ Tres trampas que el pedido no veía y hubo que resolver

- **No existen `G.startYear` ni `G.seasonYear`.** El año que importa es el de
  la **BASE cargada** (`_DB_SEASON`, que `loadGame` restaura desde
  `G.dbSeason`), no `G.season`. Con `G.season`, empezar en 2000 y llegar a 2006
  le habría bajado la media a todo el plantel un poco cada año sin que nadie lo
  tocara — y los planteles siguen siendo los de 2000, con los precios de 2000.
  El accesor es `anioBase()` y tiene que andar con `G` en null, porque
  `squadFromDB` corre DENTRO del literal que crea `G` (el mismo motivo por el
  que el contrato de `P()` cae a `tempActual()`).
- **`ratToVal` es la inversa y tiene que DIVIDIR por el factor.** No es
  teórico: `calcVal` la llama cada vez que un jugador sube o baja un punto
  (`weeklyTraining`) y en cada tick del mercado. Sin la división, el plantel
  del 2000 arrancaba con sus precios de 2000 y se los reescribía ×5 solo, **de
  a un jugador por vez**, en cuanto empezaban a entrenar. Medido con un salto
  de +6 de media: **€1,86M → €5,41M** con la división puesta contra los
  **€29,9M** que daba sin ella (×5,53, o sea moneda de hoy).
- **Aplicar la tabla ENCIMA del factor derivado daba ×34 en el 2000.** Por eso
  `_dbInflada`, `_inflAncla`, `_inflCache` e `INFL_ANCLA/MIN/MAX` se fueron
  enteros: son dos correcciones para lo mismo y este proyecto ya se hizo cinco
  veces el daño de tener dos fuentes de verdad.

`inflFactor()` sigue existiendo pero ahora devuelve `getYearInflation(anioBase())`.
Y `aplicarTemporada` perdió un caché que tirar: la tabla no copia nada.

### Lo que esto NO arregla, igual que antes

La **dispersión**. En 2000-2003 el 94-96% de las fichas no tiene valoración en
TM, así que el factor las levanta a todas por igual y el plantel sigue siendo
más plano que uno de hoy. Es dato que no existe, no una constante para tunear.

⚠️ Y una consecuencia nueva del cambio: como el factor levanta también el
fallback de €0,1M, en los años viejos **ya no hay nadie en el piso de 55**
(2000: 0 jugadores) mientras que en 2020-2023 hay más de mil. Eso no es la
tabla funcionando mal — es la 2ª división de esos años, que TM valúa en cero.

## Fase 51: las copas existen en las 25 ligas (y el reloj no se traba más)

El usuario lo reportó así: *"después de unas temporadas se rompe el formato de
la liga, no se juega la champions ni la libertadores, ni ninguna copa
nacional"*. Son **cinco bugs distintos**, y ninguno era el obvio.

### ⚠️ Lo primero que había que medir: cuánto se juega de verdad

Jugando temporadas completas y contando los partidos **jugados** (no los del
calendario, que es lo que engañaba):

| club | antes |
|---|---|
| Real Madrid | 6 temporadas de **"LaLiga 38 + 1 partido de copa"**, cero Champions |
| Boca | temporada 1 completa (53 partidos) y **0 partidos de la 2ª en adelante** |
| Boca 2019 (histórico) | sin zonas, **sin Libertadores y sin Copa Argentina** |

### 1 · El motor internacional ya era genérico: lo ataban DOS líneas

`intBuildGroup`, `intProximaRonda`, `genIntKO` e `intGrpTabla` trabajan con la
clave de la copa y leen `INT_COPAS`. Lo único hardcodeado era:

```js
function intCopaDe(comp){ if(comp.includes('Libertadores'))return 'lib'; … }
const isLib=c.includes('Libertadores'), isCA=c.includes('Copa Argentina');  // resolveKO
```

Las dos preguntan por el NOMBRE. Ahora preguntan por la tabla
(`for(const k in INT_COPAS)`), y con eso quedaron cableadas solas las cuatro
copas nuevas: **Champions League, Europa League, Concachampions y la Champions
Asiática**. `INT_COPAS` pasó de 2 a **6** entradas, cada una con `ligas` y
`tier`, y el mapa liga→copa se **deriva** (`copaIntDeLiga`) en vez de
escribirse dos veces.

⚠️ **El bombo se deriva de `clubRank()`** (`intBombo`), con la lista escrita a
mano sólo como red. Una lista fija se desincroniza con la extracción
siguiente — es el bug de `bigClubs`/`midClubs` de la Fase 18, donde 4 de 21
nombres ni existían en la base.

### 2 · La copa nacional de las otras 24 ligas era un partido MUERTO

`buildCal` metía una sola llave llamada `'Copa Nacional R16'`, y `resolveKO`
no conocía ese nombre: **ganarla o perderla no hacía absolutamente nada**. Ni
ronda siguiente, ni título, ni eliminación.

`COPA_NAC` le pone nombre real a cada país (Copa del Rey, FA Cup, Coppa
Italia, DFB-Pokal, Copa do Brasil, Copa MX, US Open Cup, King's Cup…) y
`caProximaRonda` arma los nombres con el PREFIJO de tu liga en vez de con
`'Copa Argentina'` escrito cinco veces. Es el mismo motor de rondas sorteadas
una por vez que ya tenía la Copa Argentina.

⚠️ `esCopaNac` acepta también `'Copa Nacional'`: si no, una partida en curso
se quedaba con esa llave muerta sin ningún camino que la resolviera.

⚠️ El tope de la fecha era `Math.min(38,…)` — el largo de una liga europea,
no el de la Liga ARG con zonas, que llega a la semana 49. Sale del propio
calendario.

### 3 · ⚠️ `_intSemana` pedía una semana TOTALMENTE libre, y en una liga de 38 fechas no existe

Éste es el que explica "la Champions no se juega" aunque el grupo sí saliera:

```js
function _intSemana(desde){ const usadas=new Set(G.calendar.map(m=>m.week));
  let w=desde; while(usadas.has(w))w++; return w; }
```

En la Liga ARG hay huecos (los playoffs, el corte Apertura/Clausura) y por eso
zafaba. En LaLiga las semanas **4 a 41 están todas ocupadas**, así que cada
llave se empujaba más allá del fin de temporada: los octavos caían en la última
semana y **cuartos, semis y final no se jugaban nunca** — `intProximaRonda`
sorteaba el rival y el partido moría en el calendario.

Ahora son **dos pasadas**: primero una semana libre (así la Liga ARG sigue
metiendo las llaves en el hueco de los playoffs, **exactamente igual que
antes**) y, si no queda ninguna, comparte semana con otra competencia — que es
lo normal y el juego ya lo modela desde la Fase 15.

### 4 · ⚠️ Una semana vacía era un CANDADO, y por eso el club se moría a la 2ª temporada

El reloj sólo corre adentro de `simMatch`. `advanceDay` se planta en el día 7
si no hay partido, así que **una semana sin un solo partido deja "pasar el
día" muerto para siempre**. Dos caminos llegaban ahí:

- **La pretemporada sin amistosos.** `offerPreseason` sale de un `setTimeout`
  500 ms después de `nextSeason`, que termina en `closeMod()`. Cualquier modal
  que caiga en esa ventana —un dilema, una conferencia, el resumen de
  temporada— pisa la oferta, y entonces nadie reserva los amistosos. Medido:
  **0 partidos jugados de la segunda temporada en adelante**. La Fase 43 había
  tapado la ✕ y el botón "no viajar", pero no este camino.
- **El hueco de los playoffs.** La Liga ARG reserva las semanas 20-23 y si NO
  clasificás quedan vacías. Hasta ahora las tapaba de casualidad el sorteo de
  la copa, que justamente buscaba semanas libres.

Dos arreglos:

- **`preseasonGarantizar()`**, llamado desde `updateUI` igual que
  `preseasonFit`: si estás en pretemporada y no hay ningún amistoso, los
  reserva. Es idempotente y no pisa tu elección, porque **`bookFriendlies`
  ahora borra del calendario los amistosos que no se jugaron** antes de
  reservar (antes sólo vaciaba `G.friendlies` y los viejos quedaban huérfanos:
  elegir la gira después dejaba seis amistosos en vez de tres).
- **`advanceDay` corre el reloj una semana** cuando no hay ningún partido
  pendiente de esta semana o anterior. Avanza de a UNA y sólo habiendo un
  partido más adelante, así que no puede quemar semanas en el vacío (el bug
  del `G.week++` de fallback de `runContinuousSim`).

⚠️ La contra: los rubros semanales (finanzas, dilemas) no corren en esas
semanas vacías, porque el bloque semanal vive adentro de `simMatch`. Es un
peaje chico contra un candado.

### 5 · ⚠️ `G.qualifiedLib` se LEÍA y no lo escribía nadie

`buildCal` decidía la copa con `(tc.initRep>=72)||G.qualifiedLib`, y ese campo
**no se asignaba en ningún lado del archivo**. O sea: en qué copa jugás quedaba
clavado en una constante para toda la carrera. Medido: Barracas salió campeón
y siguió en la Sudamericana; Boca terminó 18º y siguió en la Libertadores.

Lo escribe `archiveSeason`: **top 4 de la tabla, o campeón de la copa
nacional**. Lo lee un solo lugar (`_tierCont`).

### 6 · Y el nivel del rival de copa era un 70 fijo — el "73 de la Libertadores" otra vez

`INT_RAT` es una tabla sudamericana, así que en la Champions **todos** los
rivales caían en el fallback de 70. Medido: el Real Madrid ganaba la copa las
4 temporadas seguidas. Ahora, para las copas que no son lib/sud, el nivel sale
del plantel real del club (`clubPowerAny`, la misma escala que `clubPower`,
que filtraba por `p.lg===ligaMia()` y por eso devolvía 66 a cualquier club de
afuera).

⚠️ **La Libertadores y la Sudamericana no se tocan**: su balance está
calibrado y cambiarle el rating a los clubes que no están en `INT_RAT` movería
una dificultad ya medida.

### Lo que da ahora, medido temporada a temporada

| club | liga | copa continental | copa nacional |
|---|---|---|---|
| Real Madrid | 38 | Champions: grupos + octavos + cuartos + semis + final | Copa del Rey R32→Final |
| Man City | 38 | Champions completa (campeón 2 de 2) | FA Cup R32→Final |
| Boca | 30 + playoffs | Libertadores completa + Recopa + Mundial de Clubes | Copa Argentina R32→Final |
| Flamengo | 38 | **Libertadores** (antes un club brasileño no la jugaba) | Copa do Brasil |
| Club América | 34 | Concachampions hasta semis | Copa MX |
| Al-Hilal | 34 | Champions Asiática completa | King's Cup |
| Boca 2019 (histórico) | 46 | Libertadores completa | Copa Argentina |
| Gimnasia (M), 2ª ARG | 38 | **ninguna** (correcto) | Copa Argentina |

Boca pasa de **53 partidos en la temporada 1 y 0 después** a **54-60 todas las
temporadas**, con las 30 fechas de liga completas.

### 7 · Y de paso: el ascenso no tenía amistosos

`tourRivals` arma la zona `local` con `[ligaMia()]`, pero la Primera Nacional
vive en la base bajo la etiqueta `'Liga ARG'` (ver `ligaDB`): no encontraba un
solo club y el ascenso jugaba **0 amistosos** en todas las temporadas. Ahora
mira las dos etiquetas.

### Lo que NO se arregló, y por qué

**El formato de un año histórico con menos de 30 clubes sigue siendo todos
contra todos.** Las zonas + Apertura/Clausura necesitan 30 equipos de verdad
(`_zonasOK`), y 2014/2015/2016 los tienen. Reproducir el formato REAL de cada
temporada —cuándo hubo torneos cortos, cuántas zonas, qué playoffs— es un
motor por año, no un parámetro: la misma razón por la que Colombia y México no
tienen zonas. Lo que sí se arregló de esos años es que **ahora juegan sus
copas**, que era la mitad de lo que faltaba.

### La regresión

Check nuevo, `copas en las 25 ligas`: las 6 copas continentales identificables
por prefijo, ninguna liga jugable sin copa continental ni nacional,
`_intSemana` devolviendo semana con el calendario lleno, una temporada entera
de Real Madrid con 38 + 6 de grupos + 7 de llaves + 5 rondas de Copa del Rey,
que una semana vacía destrabe el reloj y que `archiveSeason` escriba
`G.qualifiedLib`.

⚠️ Y el check `inmersión` se puso rojo por un vecino, otra vez: ahora hay
amistosos donde antes no había, y **los amistosos salen de `simMatch` por un
`return` temprano** (no tienen crónica ni calificaciones), así que contaban
7 de 10. Se juegan igual pero no entran en la muestra.

⚠️ `_LIGA_ELEGIDA='España'` **no alcanza** para arrancar con un club español
en la regresión: los `TEAMS` los arma `setLigaSel`, y sin eso el `find`
devolvía `undefined` y el check terminaba jugando la Liga ARG — 30 fechas en
vez de 38, con el assert en verde por el motivo equivocado.

## Fase 52: el centro por la banda, y la línea de fondo que ya estaba bien

### ⚠️ La mitad del pedido era un bug que no existe, y el eje lo delató

El pedido pedía que en `fmBall` "una pelota desviada que cruza la línea fuerce
saque de arco o córner" y que "no rebote infinitamente en los límites
verticales", con un ejemplo que hablaba de `y=0` y `y=f.VW`. **Ese eje está
cambiado**: en este motor `x` es el largo (`VW=2960`, `leftGL=92`,
`rightGL=2868`) e `y` es el ancho (`VH=1600`). `y=f.VW` no es ningún límite.

Medido determinista, inyectando la pelota en un `FM` de prueba y llamando a
`fmBall(1)`:

| situación | resultado |
|---|---|
| remate desviado que cruza la línea de fondo **por el aire** (`air=20`) | **saque de arco**, `v=0`, la pelota se planta en la línea |
| la misma, tocada por el que defiende | **córner** |
| pelota que cruza la banda por el aire | **saque de banda**, `v=0` |
| pelota adentro | **no dispara nada** |

O sea: **ya funcionaba**, y funciona incluso por arriba, que es el caso difícil
—la línea de FONDO nunca tuvo la guarda del aire que sí tenía la de banda, y
sacarle esa guarda a la banda fue justamente lo que arregló los laterales en su
momento—. No se tocó una línea de `fmBall`; lo que se agregó es la verificación
determinista, que es la única que vale en este motor.

### El centro por la banda: implementado, medido y APAGADO

Es una palanca de **decisión** (qué pase elige), que es la única categoría que
alguna vez funcionó acá, así que valía la pena probarla: el carrilero que llega
al fondo apretado, en vez de devolverla, tira el centro al área.

⚠️ **`p.pos` es `undefined` en los 22 jugadores del 11v11.** El motor no guarda
el puesto: arma a los once desde `hx`/`hy` y `roleStyle`. El primer intento
filtraba con `/^(EI|ED|MI|MD|DFI|DFD)$/.test(p.pos)` y **no matcheó nunca**
—0 de 318 llamadas a `fmTeamPass` en 45 minutos—. Es la misma trampa que los
códigos fantasma `LD`/`LI` de la Fase 45 y el `p.teamId` de la Fase 36: el
campo que parecía obvio no existe. Quién juega abierto se deriva del **dibujo**
(`|p.hy − mid| > VH·FM52.bandaDibujo`).

⚠️ **Y el área está VACÍA en el momento del centro.** El segundo intento exigía
un compañero ya dentro del área y daba `destino:0`: cuando el carrilero llega
al fondo, los delanteros todavía están entrando. Ahora el centro va al espacio
(punto de penal / palo lejano) y elige compañero sólo si hay alguno cerca.

**Resultado medido: no se puede verificar, así que va en 0.**

| | remates/90 |
|---|---|
| baseline (rama sin escribir) | 15,5 |
| `FM52.centro=0` (ablación) | 22,5 |
| `FM52.centro=0.42` | 18,3 |

La rama dispara **0,5 veces por 90'**, y el mismo camino de código da 15,5 y
22,5 remates entre corridas — **45% de dispersión sobre el mismo código**. Es
exactamente lo que la Fase 32 dejó cerrado: mientras el arnés se mueva así,
cualquier resultado es una moneda.

`FM52.centro` queda en **0**, o sea `Math.random()<0` — la rama no puede
disparar y el motor queda idéntico al de antes. **Poniéndolo en 0.42 se
enciende sin tocar una línea más**, para el día que haya un arnés con semilla
fija que permita medirlo.

## Fase 53: el bombo de copa contra el año — la mitad que el dato permite

La Fase 43 dejó anotado que "Boca 2016 se cruza con Always Ready y LDU Quito de
la lista de hoy". El pedido era derivar los bombos de la base del año.

⚠️ **No se puede, y el dato lo dice.** Medido sobre los 26 archivos de la
carpeta (2000, 2006, 2011, 2016, 2020, 2025): traen **únicamente `Liga ARG` y
`Primera Nacional`** — **cero clubes de Brasil, Chile, Uruguay, Colombia o
Paraguay**. Derivar el bombo extranjero de `PLAYERS_DB` daría una lista vacía y
dejaría la Libertadores sin rivales. Es el mismo error que ya está documentado
dos veces: **filtrar sin rellenar**.

Lo que SÍ existe en esos archivos es el fútbol argentino del año, así que
`histFiltraBombo(lista)` filtra **sólo a los clubes argentinos** del bombo
contra la base cargada: en 2000 no aparece Talleres —ese año no estaba— y sí
los que estaban. A los de afuera no se los juzga.

- Con la base moderna es un **no-op exacto** (todos los clubes existen).
- Con menos de 6 supervivientes **vuelve la lista entera**: el bombo nunca
  puede quedarse vacío.
- Entra por **un solo lugar**: la última línea de `intBombo` (que ya deriva de
  `clubRank()` cuando puede) y el sorteo de grupos de `buildCal`.

⚠️ **Y lo que cambia sobre el dato REAL es casi nada — conviene no venderlo
como más de lo que es.** Medido sobre los 42 clubes de los dos bombos
sudamericanos en las 26 temporadas de la carpeta:

| año | 2000 | 2006 | 2011 | 2016 | 2020 | 2025 |
|---|---|---|---|---|---|---|
| clubes del bombo que se caen | **1** (Godoy Cruz) | 0 | 0 | 0 | 0 | 0 |

La razón es que de los 42 sólo **seis son argentinos** (River, Racing,
Estudiantes LP, Lanús, Godoy Cruz, Huracán) y cinco de ésos están en la base
todos los años. El resto del bombo es extranjero y, como la base histórica no
trae un solo club de afuera, no se lo puede juzgar. O sea: **el mecanismo es
correcto y está blindado, pero la mejora visible es un club en un año**. Para
que Boca 2016 deje de cruzarse con Always Ready hay que bajar los cuadros
históricos de la Libertadores, que es otra extracción y no un filtro.

⚠️ **Los nombres son los de la BASE.** El club es `'CA Talleres'`, no
`'Talleres'`, y una clave mal escrita no dispara nunca y deja el filtro apagado
sin que nada avise — es el bug de `STADIUMS_DB` de la Fase 23. La regresión
verifica que el filtro pueda MORDER (3+ clubes del bombo de la Libertadores
existen como clubes de `AR_CLUBS`).

## Fase 54: libres desde la fecha 1, y dos checks que fallaban por el vecino

### ⚠️ El criterio del pedido daba CERO, y había que medirlo

El pedido era inyectar en `G.market` a los jugadores cuyo club no esté en
ninguna liga jugable **y** que tengan `freeAgent` marcado. Medido sobre
`players-db.js`:

| | |
|---|---|
| filas con `freeAgent` | **0 de 17.075** |
| filas con columna de contrato | 8 de 17.075 |
| jugadores en clubes que no juegan ninguna liga visible | **4.554** |
| de ésos, con 33 años o más | **434** |

`freeAgent` es un flag de RUNTIME, no viene en la base: ese AND no marca a
nadie. Lo que sí existe es el club invisible — segundas divisiones que la base
trae como mercado —, y un veterano ahí es exactamente el que en la vida real
está sin equipo.

`LIBRES_INI` + `libresIniciales()`: los mejores **150** de ese conjunto con
**33+ años y 62+ de media** arrancan la partida como agentes libres. Medido en
la semana 1: Areola 80, José Sá 80, Morata 79, Raúl Jiménez 78, Trippier 77.

- **Determinista** (orden por media y nombre, no `Math.random`): recargar hasta
  que salga el libre que querés no puede ser una estrategia. Misma regla que
  `persDe` y `antiguedadInicial`.
- **No le saca un jugador a nadie**: ninguno sale de un club de una liga
  jugable. Verificado contra `clubesDeCategoria` de las 25.
- Llegan **sin ficha ni cláusula** (`askingPrice` y `clauseOf` ya devuelven 0
  para un libre desde la Fase 46) y guardan `_exClub`/`_exLg`.
- Corre **sólo en `initGame`**: una partida guardada no se toca, que es la
  regla de siempre. Como viven en `G.market`, que se serializa, sobreviven al
  guardado sin migrar nada.

⚠️ **El check del filtro "Libres" daba por sentado que en la semana 1 no hay
ninguno** (probaba justamente el cartel "No hay agentes libres"). Ahora fabrica
ese caso desmarcándolos y los restaura: es el séptimo "pase vacío" del
proyecto, sólo que atrapado antes de shippear.

### Los tres checks flaky, arreglados por la causa y no por el síntoma

- **`la fatiga no separa`** era Monte-Carlo: 4.000 tiradas de Poisson por
  escenario contra un umbral con **7% de margen** (teórico sano 1,2222 / roto
  1,7722 contra 1,650). Caía por centésimas. Pero el modelo es **determinista**,
  así que ahora se verifica el modelo: los coeficientes se **leen de
  `simMatch`** (copiarlos sería una segunda fuente de verdad) y la escalera de
  `defCansada` se mide en cuatro puntos — 95%→0, 70%→0, 55%→0,50, 40%→1,00.
  Cero estadística.
- **`dilemas`** caía con tres sub-flags juntas (`destraba`, `saveViejo`,
  `indisciplina`), y esa firma —tres a la vez— era la pista: las tres son
  "`advanceDay` SÍ corre", y `advanceDay` tiene **otros tres porteros** además
  del dilema (la prensa de la Fase 35, la destitución de la Fase 33 y el día 7
  con partido pendiente). Cualquiera de ellos las ponía en rojo sin que el
  dilema tuviera nada que ver. Ahora el check despeja el entorno antes de
  medir.
- **`personalidades`** volvió a caer, esta vez en `rebajaLeal`: buscaba un Leal
  **entre los 30 del plantel** y el salt es aleatorio por carrera, así que una
  corrida de cada ~125 no tenía ninguno. Se fijan las dos personalidades a
  mano, igual que ya hacía el punto del Conflictivo.

⚠️ **El patrón es siempre el mismo y ya van seis: el check falla por el vecino
o por el dado, no por el producto.** Antes de tocar el juego porque un check se
puso rojo, verificá el mecanismo aislado.

## Deploy

Rama `claude/stoic-euler-7hUcb` → commit → push → ff-merge a `main` → push.
Netlify publica `main` en stately-elf-897da3.netlify.app.

## Cómo trabaja bien este proyecto

- Confirmá los bugs **midiendo**, no leyendo: el usuario reporta síntomas reales
  y varias veces la causa no fue la obvia.
- Si algo no se puede verificar (red bloqueada, API caída), **decilo** en vez de
  afirmar que funciona.
- Los mensajes de commit van en inglés; las respuestas al usuario, en español.
