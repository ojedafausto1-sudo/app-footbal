# Cómo se calculan las valoraciones (la media de cada jugador)

Todo lo que está acá está **medido contra el código de hoy**, corriendo
`director-tecnico.html` de verdad. No es de memoria ni de la documentación
vieja: donde hay un número, salió de una corrida.

---

## 1. La idea de fondo: la media sale del VALOR DE MERCADO

No hay ninguna tabla con la media de cada jugador escrita a mano. La base
(`players-db.js`, 17.108 fichas) trae **el precio de Transfermarkt**, y de ahí
se deriva todo:

```
valor (€M)  →  media (rat)  →  sueldo · potencial · atributos · nivel del club
```

Medido con Boca: **30 de 30 jugadores del plantel** tienen exactamente el `rat`
que devuelve la calculadora. Cero excepciones, cero overrides por club.

La fórmula, tal cual está en el código (línea ~1155):

```js
const RAT_LN0 = Math.log(0.1);
const RAT_LNR = Math.log(200) - Math.log(0.1);

function ratValPts(val){
  const v = Math.min(200, Math.max(0.1, val));
  return 36 * (Math.log(v) - RAT_LN0) / RAT_LNR;
}

function valToRat(val, age, pos){
  return Math.min(91, Math.max(55,
    Math.round(55 + ratValPts(val) + ageAdj(age) + ratPosMod(pos))
  ));
}
```

O sea, en castellano:

> **media = 55 + (puntos por el valor, hasta 36) + (ajuste por edad) + (ajuste por puesto)**,
> y el resultado se recorta entre **55 y 91**.

---

## 2. Los puntos por el valor son LOGARÍTMICOS

Ése es el corazón. La escala va de **€0,1M a €200M** repartida en 36 puntos de
media. Como es logarítmica, **multiplicar el valor SUMA una cantidad fija de
puntos**, no lo duplica.

| valor | puntos |
|---|---|
| €0,1M o menos | 0,00 |
| €0,25M | 4,34 |
| €0,5M | 7,62 |
| €1M | 10,91 |
| €2M | 14,19 |
| €5M | 18,53 |
| €10M | 21,81 |
| €20M | 25,09 |
| €50M | 29,43 |
| €100M | 32,72 |
| €200M o más | 36,00 |

Las dos constantes que conviene tener en la cabeza, medidas:

- **×2 de valor = +3,28 de media**
- **×10 de valor = +10,91 de media**

Por eso un jugador de €10M y uno de €20M se llevan 3 puntos y no 30. Y por eso
un club de €500M de plantel no tiene jugadores el doble de buenos que uno de
€250M.

⚠️ **Arriba de €200M la escala se planta.** Haaland (€220M) y Mbappé (€200M)
dan los dos 91. Abajo de €0,1M también: todo lo que no tiene precio en TM queda
en el piso.

---

## 3. El ajuste por edad: el veterano está premiado

```js
function ageAdj(age){
  return age<=18 ? -3 : age<=21 ? -2 : age<=24 ? 0 : age<=29 ? 1 : age<=34 ? 5 : 7;
}
```

| edad | ajuste |
|---|---|
| ≤18 | **−3** |
| 19-21 | −2 |
| 22-24 | 0 |
| 25-29 | +1 |
| 30-34 | **+5** |
| 35+ | **+7** |

Esto **no es un bug, es una corrección**: el valor de mercado castiga fuerte al
veterano porque nadie lo compra para revenderlo, pero en la cancha sigue siendo
bueno. Sin este ajuste, un tipo de 34 años con €3M de valor daría 70 de media
cuando en realidad juega como 77.

El efecto es grande y conviene verlo. **Mismo valor, distinta edad** (puesto DC):

| valor | 17 años | 22 | 25 | 27 | 30 | 33 | 36 |
|---|---|---|---|---|---|---|---|
| €0,5M | 60 | 63 | 64 | 64 | **68** | 68 | **70** |
| €2M | 66 | 69 | 70 | 70 | 74 | 74 | 76 |
| €10M | 74 | 77 | 78 | 78 | 82 | 82 | **84** |
| €30M | 79 | 82 | 83 | 83 | 87 | 87 | 89 |
| €80M | 84 | 87 | 88 | 88 | **91** | 91 | 91 |

O sea: **el mismo precio a los 33 vale 4 puntos más de media que a los 27**.

---

## 4. El ajuste por puesto: el valor de mercado no paga igual a un arquero

```js
function ratPosMod(pos){
  if(pos==='ARQ') return 3;
  if(['DFC','DFI','DFD'].includes(pos)) return 2;
  if(['MCD','MC','MCO'].includes(pos)) return 1;
  return 0;
}
```

| puesto | ajuste |
|---|---|
| ARQ | **+3** |
| DFC · DFD · DFI | +2 |
| MCD · MC · MCO | +1 |
| MI · MD · EI · ED · DC | 0 |

Misma razón que la edad: el mercado paga mucho más por un delantero que por un
arquero del mismo nivel. **Con €10M a los 27 años**, medido:

| ARQ | DFC | MC | MCO | DC |
|---|---|---|---|---|
| 81 | 80 | 79 | 79 | **78** |

---

## 5. El único retoque a mano: `PERF_ADJ` (17 nombres)

Es la excepción, y es chica. Una tabla de deltas para casos de trayectoria real
que la calculadora sola subvalúa (campeones del mundo, carreras largas en el top
europeo):

```js
const PERF_ADJ = {
  'Leandro Paredes':+4, 'Ángel Di María':+5, 'Enzo Pérez':+5, 'Marcos Rojo':+2,
  'Javier Mascherano':+3, 'Ramiro Funes Mori':+2, 'Gabriel Mercado':+2,
  'Fernando Gago':+2, 'Óscar Romero':+1, 'Ever Banega':+3, 'Nicolás Otamendi':+3,
  'Germán Pezzella':+2, 'Guido Rodríguez':+2, 'Lucas Ocampos':+2,
  'Paulo Dybala':+3, 'Cristian Pavón':+1, 'Sebastián Villa':+2,
};
```

Medido contra la base de hoy: **14 de los 17 están en la base** (Mascherano,
Gago y Banega ya se retiraron y no figuran) y **los 14 mueven de verdad la
media** — ninguno queda comido por el techo de 91.

Se aplica **después** de la calculadora y **antes** del recorte:

```js
const rat = Math.min(91, Math.max(55, valToRat(val, age, pos) + perfAdj(name)));
```

⚠️ `squadFromDB` acepta un parámetro `overrides` por nombre, pero **ninguno de
los dos lugares que la llaman le pasa algo**: hoy está sin usar. Si algún día
querés clavarle una media a alguien, ése es el gancho.

---

## 6. Cómo queda repartida la base

17.108 fichas pasadas por la calculadora:

| | media |
|---|---|
| mínimo | 55 |
| p25 | 62 |
| **mediana** | **66** |
| p75 | 72 |
| p90 | 77 |
| p99 | 86 |
| máximo | 91 |

Los ocho más altos, medidos:

| jugador | puesto | edad | valor | media |
|---|---|---|---|---|
| Erling Haaland | DC | 26 | €220M | **91** |
| Kylian Mbappé | DC | 27 | €200M | 91 |
| Jude Bellingham | MCO | 23 | €160M | 91 |
| Pedri | MC | 23 | €150M | 91 |
| Vitinha | MCD | 26 | €140M | 91 |
| Michael Olise | ED | 24 | €170M | 90 |
| Lamine Yamal | ED | 19 | €220M | **89** ← le pega el −2 de edad |
| João Neves | MC | 21 | €140M | 88 |

⚠️ **Los dos topes aprietan, y de un lado bastante:** hay **678 jugadores
clavados en 55** y sólo **8 en 91**. Los 678 son los que no tienen valoración en
TM: no es que sean todos igual de malos, es que de ellos no hay dato. Es el
mismo fenómeno que se documentó con las temporadas históricas de 2000-2003,
donde el 94-96% de las fichas viene sin precio.

---

## 7. El potencial

```js
function valToPot(val, age, pos){
  const bonus = age<=18 ? 7 : age<=21 ? 5 : age<=24 ? 3 : age<=27 ? 1 : 0;
  return Math.max(valToRat(val,age,pos),
                  Math.min(92, Math.round(55 + ratValPts(val) + 1 + ratPosMod(pos) + bonus)));
}
```

Es la misma cuenta del `rat` pero **sin el ajuste por edad**, +1 fijo, y con un
bonus de juventud. Lo importante: el potencial **no incluye `ageAdj`**, y por eso
el margen se cierra solo con los años.

Medido con €5M, puesto DC:

| edad | media | potencial | margen |
|---|---|---|---|
| 17 | 71 | **82** | +11 |
| 19 | 72 | 80 | +8 |
| 22 | 74 | 78 | +4 |
| 25 | 75 | 76 | +1 |
| 28 | 75 | 75 | **0** |
| 32 | 79 | 79 | 0 |

En el plantel de Boca el margen va de **0 a 8, con mediana 1**.

---

## 8. Los 6 atributos salen de la media, no al revés

La media es el número madre; los atributos se derivan de ella con un perfil por
puesto (`ATTR_PROFILES`) más un ruido de ±4,5:

```js
function genA(pos, r){
  const prof = ATTR_PROFILES[pos] || ATTR_PROFILES.MC;
  const out = {};
  for(const [k,mod] of Object.entries(prof)){
    out[k] = Math.max(35, Math.min(99, Math.round(r + mod + (Math.random()*9-4.5))));
  }
  return out;
}
```

Tres perfiles de ejemplo:

Jugadores de campo (`VEL TIR PAS REG DEF FIS`):

| | VEL | TIR | PAS | REG | DEF | FIS |
|---|---|---|---|---|---|---|
| **DC** | +5 | **+10** | −3 | +3 | **−16** | +4 |
| **DFC** | −3 | −16 | −4 | −10 | **+9** | +7 |

Arqueros (`ATA REF POS SAQ VEL FIS` — **otras claves**):

| | ATA | REF | POS | SAQ | VEL | FIS |
|---|---|---|---|---|---|---|
| **ARQ** | +8 | +7 | +5 | 0 | **−14** | +2 |

⚠️ **El arquero NO tiene DEF ni PAS.** Sus seis claves son
`ATA/REF/POS/SAQ/VEL/FIS`. Es una trampa que ya rompió cosas dos veces en este
proyecto (el mentoreo y la Junta Directiva): si escribís algo que lee
`p.attrs.DEF`, con un arquero te da `undefined`.

Ejemplo real de un DC de media 80: `VEL 89 · TIR 87 · PAS 74 · REG 84 · DEF 61 · FIS 86`.

Las **virtudes** (las insignias doradas) son los 2 atributos más altos, y sólo
si llegan a `rat−1` y a 68:

```js
function virtues(p){
  return Object.entries(p.attrs).sort((a,b)=>b[1]-a[1]).slice(0,2)
    .filter(([k,v]) => v >= p.rat-1 && v >= 68)
    .map(([k,v]) => ({k, v, ...ATTR_INFO[k], elite: v>=85}));
}
```

---

## 9. El camino de vuelta: de la media al valor

Para los jugadores que ya están en el juego (no los de la base), el valor se
recalcula desde la media con la función inversa:

```js
function ratToVal(rat, age, pos){
  const pts = Math.max(0, Math.min(36, rat - 55 - ageAdj(age) - ratPosMod(pos||'MC')));
  return Math.max(0.1, Math.round(0.1*Math.exp(pts/36*RAT_LNR)*10)/10);
}
function calcVal(p){ return valCap(p, ratToVal(p.rat, p.age, p.pos) * (p.perf||1)); }
```

Medido, puesto DC a los 27 años — y acá se ve por qué es exponencial:

| media | 60 | 65 | 70 | 75 | 80 | 85 | 88 | 91 |
|---|---|---|---|---|---|---|---|---|
| valor | €0,2M | €0,7M | €1,9M | €5,5M | €15,9M | €45,6M | €86M | **€161,9M** |

⚠️ **`valCap` es obligatorio.** Sin tope, un pibe que subía de media pasaba de
€10M a €46M en una temporada y con una sola venta el presupuesto dejaba de
importar. El tope está **dentro de la temporada**: como mucho se duplica
(`base*2,1 + 1,5`) y como mucho cae a `base*0,45`.

---

## 10. La media SE MUEVE durante la partida (tres sistemas distintos)

Esto es lo que más se confunde: `p.rat` no es fijo.

### a) Tu plantel — `weeklyTraining()`, cada semana

Acumula `p.dev` y al llegar a 10 sube **un punto**. Lo que entra:

```js
let rf = (share-0.55)*1.5 + Math.min(0.6, scoreBonus) + (p.form*0.09) + (isXI ? 0.12 : -0.12);
if(p.wantsOut) rf -= 0.55;
rf = clamp(rf, -1, 1);

let ageMul  = age<=20 ? 1.6 : age<=23 ? 1.25 : age<=27 ? 0.7 : age<=31 ? 0.35 : 0.12;
let perfMul = Math.max(0.12, 1 + rf*1.15);
let gain    = 0.9 * intMul * ageMul * (0.9+asstLv*0.05) * ctr * perfMul;
```

- **`rf`** (−1 a +1) es qué tan bien viene jugando: minutos, goles, estado de
  forma, si es titular. El que no juega **no crece**.
- **intensidad del entrenamiento**: suave ×0,6 · normal ×1,0 · intensa ×1,7.
- **mentor al lado**: ×1,40 (`MENTOR_DEV`).
- Y no puede pasar de `p.pot`: `p.rat = Math.min(p.pot, p.rat+1)`.

**Para abajo** manda `bajarRat(p, piso)`, que tiene un **tope anual por
jugador** — 2 puntos, 3 a partir de 33 años, 4 a partir de 36 — porque había
tres sistemas bajando media a la vez y un 78 de 34 años hacía 77 → 71 → 60.

### b) El mercado entero — `weeklyMarketEvolution()`, cada semana

Los 17.000 del mercado también se mueven, con una media interna con decimales
(`p._ratF`):

```js
const ageTrend = age<=21 ? 0.055 : age<=24 ? 0.035 : age<=28 ? 0.008
               : age<=31 ? -0.012 : age<=34 ? -0.030 : -0.055;
const room  = Math.max(0, (pot-p.rat))/12;
const drift = ageTrend*(0.4+room) + p.mform*0.016 + perfR*0.030;
p._ratF += drift;
```

`p.mform` es una racha que va y vuelve a cero, y `p.hype` mueve el **valor**
aunque la media no cambie.

### c) El estado de forma — no cambia `p.rat`, cambia lo que rinde HOY

```js
function formSwing(p){ return Math.round(Math.max(-3,Math.min(3,p.form||0))*1.7*10)/10; }
function ratNow(p){ return clamp(Math.round(p.rat + formSwing(p)*0.7), 40, 99); }
```

Medido sobre un jugador de 78 con VEL 68:

| forma | `ratNow` | VEL efectiva |
|---|---|---|
| 🧊 −3 | **74** | 65 |
| ➖ 0 | 78 | 68 |
| 🔥 +3 | **82** | 71 |

⚠️ **`p.rat` es la ficha; `ratNow(p)` es lo que vale hoy.** El partido y el
11v11 usan `ratNow`/`attrNow`, no el número crudo.

---

## 11. Lo que la media NO es: el nivel del club

Para el prestigio de un club **no se promedian las medias**, se usa el valor en
log de los 15 mejores:

```js
niv = 52 + Math.log10(Math.max(1, sumaTop15) / 5) * 17
```

Medido sobre los 612 clubes: Real Madrid **92,8** · Man City 92,7 · PSG 92,5 ·
Barcelona 92,1 · Arsenal 91,4 · **Boca 72,2** · mediana 63,4.

Y para la fuerza en un partido de liga sí se usa el promedio de las medias de
los 15 mejores (`clubPower`), que es otra cosa y otra escala. **No las mezcles.**

---

## 12. Lo que vos VES no es siempre la media real (niebla de guerra)

Fuera de tu liga, la media está tapada. Medido con Boca: **de 17.075 fichas del
mercado ves 1.845, el 10,8%.**

```js
function isKnown(p){
  if(p.scouted === true) return true;
  if(p.club === G.teamName) return true;
  return p.lg === ligaMia();
}
```

El rango que se dibuja **no está centrado en el número real** — si lo estuviera,
el punto medio sería justo el dato que estás pagando por saber. El informante
tiene su propia estimación, corrida hasta ±margen y estable por jugador:

| jugador | media real | lo que estima el informante | rango que ves |
|---|---|---|---|
| Davy Roef | 78 | 83 | 77–89 |
| Kjell Peersman | 65 | 62 | 59–65 |
| Tom Vandenberghe | 67 | 67 | 62–72 |
| Victor De Coninck | 67 | 71 | 65–77 |

Medido sobre los 15.230 desconocidos: **el valor real cae dentro del rango el
100% de las veces**, pero el punto medio casi nunca lo clava.

Los cinco envoltorios que la UI tiene que usar siempre: `rbK` (media), `potK`
(potencial), `vbK` (insignias), `tagK` (⭐/🌟/💡) y `attrChipsK` (los 6 chips
con `??`).

---

## 13. Las temporadas históricas se corrigen por inflación

Un año viejo no se mide con la plata de hoy. El factor **se deriva**, comparando
la misma liga contra sí misma (promedio de los 10 valores más altos de Primera
contra el de 2026):

| año | 2000 | 2003 | 2005 | 2010 | 2015 | 2020 | 2025 |
|---|---|---|---|---|---|---|---|
| factor | **×6,86** | ×5,52 | ×1,70 | ×1,79 | ×1,11 | ×0,87 | ×0,87 |

Como el rating es logarítmico, multiplicar el valor **suma puntos fijos**. El
2000 pasa de mediana 56 / máximo 76 a **mediana 65 / máximo 85**.

⚠️ **El archivo del disco no se toca**: `_dbInflada(y,db)` devuelve una copia y
la cachea por año, así que ir y volver entre temporadas no escala dos veces.

⚠️ **Una partida ya guardada conserva las medias viejas**, porque `G.squad` se
serializa con el `rat` ya calculado. La corrección se ve en partidas nuevas.

---

## 14. Qué cuelga de la media (para saber qué rompés si la tocás)

| sistema | cómo la usa |
|---|---|
| **sueldo** | `wageDeRat(rat)` — convexo, exponente 2,35: 50→12k · 70→26k · 80→35k · 90→**47k** |
| **valor de mercado** | `ratToVal` + `valCap` |
| **atributos** | `genA(pos, rat)` |
| **virtudes** | `v >= rat-1 && v >= 68` |
| **fuerza en el partido** | `matchStrengths` usa `ratNow` y `attrNow`, no `p.rat` |
| **nivel del club** | `clubRank()` por VALOR (log), `clubPower()` por MEDIA |
| **colores de la UI** | `ovrColor`: oro ≥84 · verde ≥76 · gris debajo |
| **jerarquía** | `jugadorTeAtiende`: un `rat>=83` no va a un club de rep <75 |
| **cesiones** | `loanRefusal`: figura = `rat>=87` (o `val>=20` si no es joven) |
| **leyendas** | por partidos y goles, no por media |

---

## Resumen en cuatro líneas

1. La media **sale del precio de Transfermarkt**, en escala logarítmica:
   ×2 de valor = **+3,3** · ×10 = **+10,9**.
2. Se le suma **edad** (el veterano gana hasta +7, el pibe pierde hasta −3) y
   **puesto** (el arquero gana +3), y se recorta entre **55 y 91**.
3. Sólo hay **17 nombres retocados a mano**; todo lo demás es la fórmula.
4. Durante la partida se mueve por **entrenamiento** (tu plantel), **drift de
   mercado** (los otros 17.000) y **estado de forma** (que no toca `p.rat` sino
   `ratNow`).
