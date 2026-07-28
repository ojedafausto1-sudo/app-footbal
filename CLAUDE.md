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
- **Extranjeros**: un nacionalizado NO ocupa cupo. `isForeign(nat, nat2)`.
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

## Deploy

Rama `claude/stoic-euler-7hUcb` → commit → push → ff-merge a `main` → push.
Netlify publica `main` en stately-elf-897da3.netlify.app.

## Cómo trabaja bien este proyecto

- Confirmá los bugs **midiendo**, no leyendo: el usuario reporta síntomas reales
  y varias veces la causa no fue la obvia.
- Si algo no se puede verificar (red bloqueada, API caída), **decilo** en vez de
  afirmar que funciona.
- Los mensajes de commit van en inglés; las respuestas al usuario, en español.
