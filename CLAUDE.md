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
- **Tácticas de los DTs**: 14 arquetipos (`ARQ`) asignados por
  `ARQ_DT` (a mano, ~100 nombres) → `ARQ_LIGA` (default por escuela) →
  hash. La tabla `REAL` de `dtProfile()` pisa al arquetipo. La formación sale
  del arquetipo (`ARQ[k].forms`).
- La **arenga** solo aparece en partidos importantes (`isBigMatch`).
- **Sin relato** jugada a jugada: simular va directo al resumen.

## Sistemas principales (dónde tocar)

- **Simulación rápida**: `simMatch` + `matchStrengths` + `applyMatchResult`
- **Simulación 11v11 que se mira**: `FM` global, `fmAI` / `fmTick` / `fmMove`
- **Jugadas clave jugables**: `SIT` global. Penal, tiro libre y centro usan una
  proyección pseudo-3D (`proj(wx, wz, wy)`); ataque y defensa son cenitales.
- **Mercado con tiempos reales**: `G.negs`, `negStartPlayer` → `negOpenClub` →
  `weeklyNegotiations`. Hay precontratos, libres y competencia de otros clubes.
- **Relación con el DT**: `G.dtRel` (0-100), `setDtRel`, `dtAskList` (pedidos del
  presidente al DT, que puede retrucar).

⚠️ **Ojo con los nombres**: existe `dtDemands(d)` (exigencias del DT al firmar) y
`dtAskList()` (pedidos del presidente). Ya hubo una colisión por esto.

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
