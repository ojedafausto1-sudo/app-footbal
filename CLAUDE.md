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
  categoría (no hay Primera Nacional), pero `checkFired` te pide la renuncia si
  terminás en los puestos que descienden. Antes sólo te echaban saliendo último.
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
  Usa `GOLD()` / `GOLDA()` porque el canvas no resuelve variables CSS.

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

## Deploy

Rama `claude/stoic-euler-7hUcb` → commit → push → ff-merge a `main` → push.
Netlify publica `main` en stately-elf-897da3.netlify.app.

## Cómo trabaja bien este proyecto

- Confirmá los bugs **midiendo**, no leyendo: el usuario reporta síntomas reales
  y varias veces la causa no fue la obvia.
- Si algo no se puede verificar (red bloqueada, API caída), **decilo** en vez de
  afirmar que funciona.
- Los mensajes de commit van en inglés; las respuestas al usuario, en español.
