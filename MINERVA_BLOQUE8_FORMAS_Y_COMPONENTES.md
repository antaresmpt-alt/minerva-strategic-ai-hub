# MINERVA — Bloque 8: Formatos de hoja, Formas, Componentes y Pedidos Complejos

> **Fuente de verdad** del Bloque 8 (fusionado 17 jun 2026).
> Documento de diseño y toma de decisiones.
> Complementa a `FASES_HOJA_RUTA_DIGITAL.md`, `FASES_MAESTRO_ARTICULOS.md` y `MINERVA_HUB_CONTEXTO_MAESTRO.md`.
>
> Origen: brainstorming 16 jun (Cursor) + análisis casos Optimus 17 jun (Claude) + revisión cruzada.

---

## 1. Resumen ejecutivo

Minerva hoy asume **1 OT = 1 referencia = 1 formato = 1 tirada**. En planta hay dos lagunas:

| Tema | Problema | Solución (dirección) |
|------|----------|----------------------|
| **Formato de hoja** | `tamano_hoja` en despacho ≈ formato de **compra**, no de impresión/troquel/externo | Cadena por proceso + encadenado salida→entrada (como las hojas) |
| **Formas y componentes** | Pedidos con varias imposiciones y/o piezas físicas (cara+dorso, 6 modelos…) | **OT contenedor (barco) + OTs hijas** en BD, **agrupadas en UI** (no listado plano) |

**Decisión de arquitectura (17 jun):** Opción A — hijas como OTs reales en `prod_ots_general` con `ot_padre_numero`, reutilizando pool/mesa/ejecución/hoja de ruta. La UX **no** muestra un océano de OTs: por defecto solo **contenedores** y OTs `simple`; las hijas al expandir.

**Primer paso de código:** encadenado de formato (independiente de hijas).

---

## 2. El problema actual

### Lo que cubre bien el modelo 1:1

- Estuche simple: 1 hoja → N estuches, 1 referencia, 1 troquel, 1 tirada.
- Todo lo ya construido (pool, mesa, `datos_proceso`, hoja de ruta, PDF).

### Lo que no cubre

- Varias **formas de imposición** (varias referencias en la misma plancha, hojas distintas por forma).
- Varios **componentes físicos** (exterior + interior, forro + dorso).
- Combinación de ambos (penjador 6 modelos × exterior/interior).
- Formatos que **cambian** a lo largo de la ruta (compra → guillotina → impresión → troquel).
- Captura de **horas prep + tiraje por unidad de ejecución** (Abraham a veces total, a veces por forma).

### Cómo lo resuelve Optimus

Genera **OTs hijas** automáticamente (desde presupuesto), agrupadas bajo un pedido padre. Cada hija tiene material, planchas, tareas y ejecución propios. **No distingue en el modelo** si la hija es “forma de imposición” o “componente físico” — solo sub-OTs numeradas.

---

## 3. Los tres casos reales (Optimus)

### Caso A — Multi-referencia / Imposición pura

**Ejemplo:** BLISTER LLAVORS (FEM) — Oferta 9592 — 100.800 uds — troquel 24 poses.

```text
Pedido (contenedor)
├── OT 3.104.501 — FORMA 1 (2.768 hojas, 4 planchas, offset 350gr 72×102)
├── OT 3.104.502 — FORMA 2 (4.452 hojas, 4 planchas)
├── …
└── OT 3.104.506 — FORMA 6 (4.452 hojas, 4 planchas)
```

- Comparten: mismo papel, troquel, procesos (CTP → CD 72×102 → Polar → JR 75×105 → Destroquelado).
- Varía: hojas por forma, combinación de referencias y poses.
- **Convergencia:** tras **destroquelado/troquelado**, cada referencia sigue por separado (engomado, embalaje, expedición).

**Nota Zaida:** con más de ~8 formas, Optimus parte en 2 pedidos. Límite a tener en cuenta en el wizard de creación de hijas.

### Caso A.2 — Ampollas 4 modelos / 2 formas / troquel 4 poses ✅ **REFERENCIA OFICIAL 8.2** (jul 2026)

> **OT Optimus real:** `36204` (creada jul 2026). PDF de referencia: `docs/referencias/` o export del usuario.
> **Uso:** diseño del wizard despacho contenedor (Fase 8.2), smoke test y **demo pedidos complejos**.
> **Comparación:** `98010` = barco ya en ejecución (pool/mesa/cartelas); `36204` = **definición de formas** al despachar.

#### Pedido cliente (contenedor)

| Campo | Valor |
|-------|--------|
| Producto | Estuches 30 ampollas |
| Total | **6.000 estuches** en **4 modelos** |
| Troquel común | **4 poses** (compartido por las dos formas) |
| Material (indicativo) | Folding 295 g · 60×76 cm (validar en Optimus/PDF) |

**Referencias:**

| Código | Cantidad pedida | Modelo |
|--------|-----------------|--------|
| `605212` | 2.000 uds | VERLAVY HYPERTONIQUE |
| `605229` | 2.000 uds | VERLAVY ISOTONIQUE |
| `115735` | 1.000 uds | BIOTHALASSOL HYPERTONIQUE |
| `202037` | 1.000 uds | EST LA VIE CLAIRE ISOTONIQUE |

#### Dos formas de impresión

```text
OT contenedor 36204 (barco)
  ESTUCHES 30 AMPOLLAS — 6.000 uds
  Troquel: TAM00534 (ej.) — 4 poses
  Compra material: ~1.800 hojas brutas (1.300 + 800) en el PADRE
  │
  ├── 36204-01  tipo_hija: forma
  │     "Forma 1 — Verlavy (2 modelos)"
  │     Hojas netas: 1.000  |  Aumento: 300  |  Brutas: 1.300
  │     Imposición en chapa (4 poses):
  │       605212 · VERLAVY HYPERTONIQUE     · 2 poses → 1.000×2 = 2.000 uds
  │       605229 · VERLAVY ISOTONIQUE       · 2 poses → 1.000×2 = 2.000 uds
  │
  └── 36204-02  tipo_hija: forma
        "Forma 2 — Biothalassol + La Vie Claire"
        Hojas netas: 500   |  Aumento: 300  |  Brutas: 800
        Imposición en chapa (4 poses):
          115735 · BIOTHALASSOL HYPERTONIQUE    · 2 poses → 500×2 = 1.000 uds
          202037 · EST LA VIE CLAIRE ISOTONIQUE · 2 poses → 500×2 = 1.000 uds
```

#### Validación aritmética (obligatoria en wizard antes de guardar)

| Regla | Cálculo | Resultado |
|-------|---------|-----------|
| Por referencia | `hojas_netas_forma × poses_en_forma` | 2.000 / 2.000 / 1.000 / 1.000 ✓ |
| Por forma | `hojas_netas × poses_totales_chapa` | F1: 1.000×4=4.000 · F2: 500×4=2.000 ✓ |
| Barco | Σ estuches todas las formas | 4.000 + 2.000 = **6.000** ✓ |
| Poses vs troquel | Σ poses componentes en cada forma | 2+2 = **4** = poses troquel ✓ |
| Compra padre | Σ hojas brutas hijas | 1.300 + 800 = **1.800** |

Fórmula por componente: **`cantidad_objetivo = hojas_netas × poses_en_forma`**.

#### Wizard 8.2 — pestaña Formas/Hijas (mock UX)

```text
┌─ FORMA 1 ─────────────────────────────────────┐
│ Descripción: Verlavy (2 modelos)             │
│ Hojas netas: [1000]  Aumento: [300]  → 1300 brutas │
│                                              │
│ Componentes (poses en esta forma):           │
│ ┌──────────────────────────────────────────┐ │
│ │ Ref.        │ Poses │ Uds calculadas     │ │
│ │ 605212 ···  │  [2]  │ 1000×2 = 2.000 ✓  │ │
│ │ 605229 ···  │  [2]  │ 1000×2 = 2.000 ✓  │ │
│ │ [ + Añadir referencia ]                  │ │
│ └──────────────────────────────────────────┘ │
│ Total poses en chapa: 4 ← = troquel contenedor │
└──────────────────────────────────────────────┘

┌─ FORMA 2 ─────────────────────────────────────┐
│ (misma estructura)                           │
└──────────────────────────────────────────────┘
[ + Añadir forma ]
```

**Validaciones UI:**

1. Suma poses componentes de la forma = poses del troquel del barco (si no → aviso bloqueante o warning fuerte).
2. Σ `cantidad_objetivo` todas las hijas = cantidad del contenedor.
3. Aviso si > 8 formas (partir pedido, nota Zaida).

#### Desbroce — aviso automático multi-referencia (Fase 8.3+)

Cuando Laury/Mayo abren la tarjeta de **36204-01** en desbroce y la forma tiene 2+ referencias en `prod_ot_hija_componentes`:

```text
⚠️ ATENCIÓN — FORMA CON MÚLTIPLES REFERENCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2 poses → VERLAVY HYPERTONIQUE (605212)
  2 poses → VERLAVY ISOTONIQUE (605229)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NO MEZCLAR. Separar por referencia al desbrocar.
Resultado esperado: 2.000 uds de cada modelo.
```

Generado desde componentes; sin texto manual en despacho.

#### CTP (pendiente §12.10)

Con 2 formas y mismo material, candidato: **una hija `preimpresion`** (36204-00) o CTP en cada forma. Validar con planta mañana en demo.

#### Script smoke test

| Script / OT | Uso |
|-------------|-----|
| `scripts/setup-contenedor-test-98010.mjs` | Barco en ejecución (pool/mesa/cartelas). **No re-ejecutar** si hay datos reales. |
| **OT 98011** (maestro solo) | Demo wizard **desde cero** — clone 36204 en `prod_ots_general`, sin hijas ni despacho. Creada 2 jul 2026 en prod. |
| **OT 36204** | Caso real Optimus ya **despachado** vía wizard (36204-01/02 + componentes). Referencia post-despacho. |

`scripts/setup-contenedor-test-36204.mjs` — **no creado**; sustituido por flujo wizard + **98011** para demo en vivo.

---

### Caso B — Multi-componente físico

**Ejemplo:** FOLDERS PORTAMUESTRAS CÉSPED 2026 — 4.000 uds.

```text
Pedido (contenedor)
├── OT 3.589.100 — Preimpresión (CTP)
├── OT 3.589.101 — Hoja exterior (4.000 hojas CD 72×102 + JR 75×105)
├── OT 3.589.102 — Hoja interior (4.000 hojas CD 72×102 + JR 75×105)
└── OT 3.589.103 — Folder (acabado final)
```

- Exterior e interior en paralelo → **contracolado externo** → troquelado del conjunto.
- Material puede ser igual o distinto (cara/dorso).
- **Convergencia:** tras **contracolado externo**, el conjunto es una sola pieza.

### Caso C — Multi-componente + Multi-forma

**Ejemplo:** PENJADOR BUFF — 6 modelos — 100.000 uds — Oferta 14808.

```text
Pedido 35.690 (contenedor)
├── OT 3.569.000 — Preimpresión (CTP, 36 planchas total)
├── OT 3.569.001–004 — Pliegos exterior (4 formas)
├── OT 3.569.005–008 — Pliegos interior (+ contracolado)
└── OT 3.569.009–012 — Acabados por modelo (colores)
```

12 hijas + 1 CTP = 13 unidades bajo un pedido.

### Ejemplo interno (estuches 4 modelos — brainstorming 16 jun)

| Modelo | Cantidad |
|--------|----------|
| Mod 1–2 | 10.000 c/u |
| Mod 3 | 20.000 |
| Mod 4 | 10.000 |

- **Forma A:** 10.000 hojas, poses mod1×1 + mod2×1 + mod3×2 → 40.000 estuches.
- **Forma B:** 2.500 hojas, poses mod4×4 → 10.000 estuches.

---

## 4. Patrones comunes (los tres casos)

1. **Contenedor = unidad comercial** — cliente, pedido, fecha entrega, facturación. El **barco**.
2. **Hija = unidad de ejecución** — lo que ve Abraham: papel, planchas, prep+tir, horas propias.
3. **Aguas arriba:** CTP, impresión, troquelado, desbroce (según producto) **por hija**, itinerario puede divergir.
4. **Aguas abajo:** convergencia en un **punto variable** → luego trabajo por referencia/modelo (engomado, embalaje, expedición).
5. **Optimus:** sub-OTs secuenciales; Minerva puede igualar el comportamiento con agrupación visual.

### Metáfora del barco (decisión UX)

```text
OT 35698 (contenedor)          ← 1 fila en pipeline/despacho por defecto
├── Hija F1 (ejecución)        ← OT real en BD, oculta hasta expandir
├── Hija F2
└── Hija F3
```

> **OT hija en base de datos ≠ OT suelta en pantalla.**

---

## 5. Punto de convergencia (no hardcodear “siempre desbroce”)

| Tipo de producto | Convergencia típica | Después |
|------------------|---------------------|---------|
| Estuche clásico (Caso A simplificado) | Tras **desbroce** | Engomado por referencia |
| Blister multi-ref (Caso A) | Tras **troquelado/destroquelado** | Engomado/embalaje por referencia |
| Folder cara+dorso (Caso B) | Tras **contracolado externo** | Troquelado conjunto → acabado |
| Penjador (Caso C) | Varias (por componente y modelo) | Reglas por plantilla de producto |

**Diseño:** el contenedor (o plantilla de tipo de producto) debería poder indicar `punto_convergencia` (proceso o paso), no una regla fija global.

---

## 6. Problema A — Formato de hoja (cadena, no atributo único)

### Situación actual

- `produccion_ot_despachadas.tamano_hoja` ≈ **formato de compra** (Jordi).
- No es necesariamente formato de impresión, troquel ni externo.

### Flujo real

```text
Compra 72×102 → Guillotina 51×72 → Impresión 51×72 → Troquel (corte) → Externo (si aplica)
```

### Lo ya construido (`hoja-ruta-campos-config.ts`)

| Proceso | Campos formato |
|---------|----------------|
| Guillotina | `tamano_inicial` → `tamano_final` |
| Impresión | `formato_hojas_impresion` |
| Troquelado | `tamano_corte` |

Falta **encadenar** formato como las hojas (`salidaAnterior` ampliado a canal texto/dimensiones).

### Fase FORMATO (primer código del Bloque 8) ✅ **IMPLEMENTADO 17 jun 2026** (`aadad81`)

1. ~~UI: etiquetar `tamano_hoja` como **formato de compra**.~~ ✅
2. ~~Encadenado por **orden de itinerario**: guillotina `tamano_final` → impresión/externos `formato_hojas`; entrada guillotina `tamano_inicial`.~~ ✅  
   - Troquelado: banner de pliego de entrada; `tamano_corte` sigue siendo el troquel (independiente).
3. Maestro (futuro): `formato_compra_habitual` + `formato_impresion_habitual` en `prod_referencias`.

**Archivos clave:** `hoja-ruta-formato-encadenado.ts`, `hoja-ruta-campos-config.ts`, `planificacion-ots-ejecucion-tab.tsx`, `hoja-ruta-query.ts` (`resolveEstadoOtLabel`), `supabase-query-chunks.ts`.

**Prueba:** OT 98009 (clon 35842) — flujo CTP → Guillotina → Impresión → Troquelado → Engomado; PDF hoja de ruta OK.

**Sin dependencia** del modelo contenedor/hijas.

---

## 7. Problema B — Formas, componentes y captura en planta

### Por qué no basta JSON informativo

```json
{
  "num_formas": 2,
  "formas": [
    { "forma": 1, "hojas": 10000, "refs": "mod1×1, mod2×1, mod3×2", "poses": 4 }
  ]
}
```

- **Válido** si CTP/maquinista solo necesitan nota y las horas son **siempre totales**.
- **Insuficiente** si Abraham apunta **prep + tir por forma** (visita planta 16 jun: a veces total, a veces detalle).

### Prep + tiraje

Optimus: siempre **PRE** + **TIR** por unidad de ejecución.

Minerva (Impresión): `horas_entrada` (prep) + `horas_tiraje` — ya existen.

Con hijas como OTs: cada hija registra su prep+tir en su tarjeta de ejecución (comportamiento actual, sin reinventar mesa).

### Itinerario por hija

Casi siempre plantilla común clonada del contenedor. **Excepción real:**

```text
F1 Forro  → … → Stamping (externo) → …
F2 Dorso  → … → (sin stamping) → …
```

> **Regla:** plantilla común + **override por hija**. No mezclar pasos “solo F1” en una sola tarjeta.

### CTP compartido (Caso B/C)

En Optimus aparece hija tipo **Preimpresión** (`3.589.100`, `3.569.000`) con planchas agregadas.

**Pendiente decidir:** ¿CTP es hija especial `tipo_hija = preimpresion`, paso del contenedor, o se repite por hija? Recomendación inicial: **hija `preimpresion`** cuando agrupa planchas de varias formas (como Optimus).

### Tipos de hija (semántica en UI, misma tabla)

| `tipo_hija` (propuesto) | Ejemplo |
|-------------------------|---------|
| `forma` | Forma 3 del blister |
| `componente` | Hoja exterior, hoja interior |
| `preimpresion` | CTP agregado del pedido |
| `acabado` | Paso final folder / color penjador |

En BD pueden ser todas `ot_tipo = hija`; el subtipo guía wizard y listados.

### Componentes dentro de una forma (referencias / poses)

Tabla **`prod_ot_hija_componentes`** ✅ **2 jul 2026** — migración `20260702200000_prod_ot_hija_componentes.sql` aplicada en prod (RLS + grants).

| Campo | Uso |
|-------|-----|
| `ot_hija_numero` | FK → `prod_ots_general.num_pedido` (ej. `36204-01`) |
| `referencia_id` | FK opcional → `prod_referencias` |
| `referencia_codigo` | Código Optimus / cliente (ej. `605212`) |
| `referencia_descripcion` | Texto legible (ej. `VERLAVY HYPERTONIQUE`) |
| `poses_en_forma` | Poses de esa ref en la chapa (no confundir con poses troquel total) |
| `cantidad_objetivo` | Uds calculadas: `hojas_netas × poses_en_forma` |
| `orden` | Orden en UI |

**Borrador SQL** (ajustar FKs al implementar):

```sql
create table prod_ot_hija_componentes (
  id uuid primary key default gen_random_uuid(),
  ot_hija_numero text not null
    references prod_ots_general(num_pedido) on delete cascade,
  referencia_id uuid references prod_referencias(id),
  referencia_codigo text not null,
  referencia_descripcion text,
  poses_en_forma integer not null check (poses_en_forma > 0),
  cantidad_objetivo integer check (cantidad_objetivo >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_ot_hija_componentes_ot
  on prod_ot_hija_componentes(ot_hija_numero);
```

**Caso de referencia:** ver **§3 Caso A.2** (OT 36204).

Responde pregunta §12.7: Caso A = **varias referencias** por forma; a veces misma familia con poses distintas.

---

## 8. Opciones de diseño evaluadas

### Opción A — OTs hijas + contenedor (ELEGIDA)

- `prod_ots_general`: `ot_tipo` (`simple` | `contenedor` | `hija`), `ot_padre_numero`, `tipo_hija`, `forma_descripcion`.
- Hijas = OTs normales (despacho, `prod_ot_pasos`, ejecución, hoja de ruta).
- **Pros:** máxima compatibilidad con lo construido; material e itinerario distintos por hija; Abraham registra horas como hoy.
- **Contras:** muchas filas en BD → mitigado con **agrupación UI obligatoria** (Fase 8.1).
- Creación asistida en despacho del contenedor (no manual para 12 hijas).

### Opción B — Tabla `prod_ot_formas` sin OTs hijas

- **Pros:** listado no se multiplica en BD.
- **Contras:** refactor de pool, mesa, ejecución, histórico — todo cuelga de OT hoy.
- **Veredicto:** no como primer paso; coste altísimo.

### Opción C — Híbrido JSON + hijas solo a veces

- **Veredicto:** deuda técnica si ~50% pedidos son complejos. **Descartada.**

### Síntesis UX + BD

| Capa | Decisión |
|------|----------|
| Base de datos | Hijas = OTs reales (Opción A) |
| Pantalla | Solo contenedores por defecto; hijas colapsadas (requisito no negociable) |

---

## 9. Lo que NO tiene Minerva hoy

- `ot_tipo` / `ot_padre_numero` / contenedor.
- Despacho multi-hija con wizard.
- Formas con hojas/planchas/poses por hija.
- Agrupación en pool/pipeline.
- Vista agregada del contenedor (progreso N/M hijas, hoja de ruta del barco).
- Semáforo/proyección por componente (asume poses uniformes).
- Encadenado de formato entre procesos.
- Punto de convergencia configurable.

---

## 10. Roadmap de implementación

### Fase FORMATO — Encadenado de tamaño de hoja ✅ **17 jun 2026**

- ~~Encadenado compra → guillotina → impresión → troquelado.~~ Implementado (ver §6).
- ~~Etiquetas UI en despacho ("Formato compra").~~
- **Independiente** de hijas. **Hecho.**

### Fase 8.0 — Modelo de datos (sin UI)

- Migración aditiva en `prod_ots_general`:
  - `ot_tipo` text: `simple` (default), `contenedor`, `hija`
  - `ot_padre_numero` text nullable
  - `tipo_hija` text nullable: `forma` | `componente` | `preimpresion` | `acabado`
  - `forma_descripcion` text nullable
- Todas las OTs existentes → `simple`.
- Estimación: ~30 min.

#### Numeración oficial de hijas

**Convención:** `{num_padre}-{nn}` donde `nn` son **siempre 2 dígitos** (`01`, `02`, … `12`).

| Rol | Ejemplo |
|-----|---------|
| Contenedor (padre) | `98010` |
| Hija 1 | `98010-01` |
| Hija 2 | `98010-02` |
| Hija 3 | `98010-03` |

- `num_pedido` de la hija = `98010-01` (identificador completo en BD y despacho).
- `ot_padre_numero` = `98010` (solo el padre, sin sufijo).
- `forma_descripcion` = etiqueta legible (ej. `AU260 — Expositor Milical Ananás`).
- El wizard 8.2 generará estos números automáticamente; no manual para N hijas.
- OT de prueba Bloque 8.1: script `scripts/setup-contenedor-test-98010.mjs`.

### Fase 8.1 — Vista agrupada (BLOQUEANTE para UX) ✅ **IMPLEMENTADO 17 jun 2026**

- Pool y Pipeline: contenedor con hijas expandibles (lazy load).
- Filtros: agrupado (default) | solo simples | solo contenedores | todas planas.
- Módulo: `src/lib/planificacion-contenedor-query.ts`.
- **Sin esta fase no se despliegan hijas en producción** — UI lista; falta 8.2 para crear hijas.

#### 8.1.1 — Refinamientos post-prueba OT 98010 ✅ **18 jun 2026**

Rama: `feature/bloque8.1-pool-mesa-ejecucion-fixes` (commit `2d9d3ab`).

| Área | Cambio |
|------|--------|
| **Pool contenedor** | Hijas heredan `material_status` del padre (barco); checkbox y envío a mesa solo en hijas; padre no seleccionable. |
| **Pool mesa lateral** | Mesa diaria + secuenciación: filtro estricto por `planificacionTipoPaso` = tipo de máquina visible (sin leak `null`). SpeedMaster no muestra hijas en CTP; CTP muestra solo pendientes no colocadas en mesa. |
| **Progreso barco** | Badge **primario** = % pasos finalizados / pasos totales (todas las hijas). **Secundario** = % hijas con pool `cerrada`. Ej.: `3 hijas · 20% · 3/15 pasos`. |
| **Impresión merma** | Fórmula planta: `brutas − merma = hojas_impresas` (netas/buenas). Encadena a troquel vía `outputField: hojas_impresas`. |
| **Troquel prefill** | `hojas_troquelar` ← salida del proceso anterior (impresión); fallback despacho brutas. |
| **Script prueba** | `scripts/setup-contenedor-test-98010.mjs` — padre `98010` + hijas `-01/-02/-03`. **No re-ejecutar** si ya hay itinerarios/ejecuciones reales (purga compras/pool, no toca `prod_ot_pasos`). |

#### 8.1.2 — Agrupación Maestro OTs y OTs despachadas ✅ **23 jun 2026**

- Mismo patrón que Pool/Pipeline: contenedor colapsado, hijas al expandir.
- Filtro UI: agrupado (default) | solo simples | solo contenedores | todas planas.
- Módulos: `src/lib/ots-contenedor-display.ts`, `ot-contenedor-ot-numero-cell.tsx`.
- Maestro OTs: query paginada excluye `ot_tipo = hija` en vistas no planas.

**Estado prueba manual 98010 (18 jun noche):**
- Padre: compra conjunta + recepción muelle OK.
- `98010-01`: CTP → Impresión → Troquel → Desbroce disponible en Pipeline.
- `98010-02`: CTP confirmado en mesa diaria.
- `98010-03`: pendiente en pool lateral CTP (correcto: aún no arrastrada a mesa).

### Fase 8.2 — Despacho contenedor + wizard de hijas ✅ **MVP 2–3 jul 2026** (rama `wizard-despacho`)

> **Caso de referencia:** §3 **Caso A.2 — OT 36204** (ampollas, 2 formas, 4 refs, troquel 4 poses).
> **Smoke test real:** OT **36204** despachada en prod (36204-01, 36204-02 + `prod_ot_hija_componentes`).
> **Demo wizard en vivo:** OT **98011** (solo maestro, sin hijas) — despachar mañana en reunión.

| Pieza | Estado | Dónde |
|-------|--------|-------|
| Pestaña **Formas/Hijas** en wizard | ✅ | `despacho-wizard-dialog.tsx` — detecta `ot_tipo = contenedor` |
| Componentes por forma | ✅ | `prod_ot_hija_componentes` + UI refs/poses |
| Validaciones aritméticas | ✅ | poses = troquel, Σ uds, Σ hojas brutas compra |
| Creación batch hijas + pasos | ✅ | `36204-01`, `-02`… en `prod_ots_general` + `prod_ot_pasos` |
| Seed `datos_proceso` **por forma** | ✅ | `buildDatosProcesoSeedForForma` en `despacho-wizard-shared.ts` |
| Desglose desbroce en wizard | ✅ | Bloque informativo por forma antes de guardar |
| **Hoja simplificada** contenedor | ✅ | Portada barco + 1 A5 por hija + NO MEZCLAR (`hoja-ruta-cartelita-pdf.ts`) |
| Errores Supabase legibles | ✅ | `formatSupabaseErrorMessage` |
| Plastificado Select en Dialog | ✅ | z-index `select.tsx` |

**Pendiente 8.2 (no bloqueante demo):**

- Re-despachar **36204** si se quieren pasos con seed por forma (despacho anterior al fix).
- Itinerario override distinto por hija (MVP usa misma plantilla).
- Script `setup-contenedor-test-36204.mjs` (opcional; **98011** cubre demo wizard).
- Merge `wizard-despacho` → `main` + deploy estable.

### Fase 8.3 — Ejecución por hija 🟡 **parcial 2–3 jul 2026**

- Mesa y `ExecutionCard`: hijas son OTs normales — **sin cambio de motor** (ya OK).
- Maquinista ve identificador claro (ej. `36204-01 · Forma 1 — Verlavy`) — vía maestro + forma.
- Contenedor agrega estado de hijas — **8.1** ✅.
- **Desbroce multi-ref:** bloque «NO MEZCLAR» si forma tiene 2+ componentes — ✅ `planificacion-ots-ejecucion-tab.tsx` + `desbroce-hija-componentes.ts`.
- Fallback despacho hija vía padre cuando no hay fila en `produccion_ot_despachadas` — ✅.

**Pendiente 8.3:**

- Validar en planta desbroce **36204-01** con banner + prefill real.
- Horas prep/tiraje por forma (Abraham) — sin cambio aún.

### Fase 8.4 — Cierre del contenedor

- Contenedor → `pendiente_revision` cuando todas las hijas cumplen su ruta (regla configurable).
- Bloque 6: snapshot del **barco** + detalle de hijas en JSON.

### Fases posteriores (fuera del MVP Bloque 8)

- **8.5** Engomado y embalaje por referencia/componente tras convergencia.
- **8.6** Semáforo/proyección por componente.
- **8.7** Vista hoja de ruta / PDF del contenedor agregado. ✅ **23 jun 2026:** modal barco (progreso + hijas + drill-down) + PDF `hoja-ruta-barco-{OT}.pdf` (resumen + anexos por hija).

#### 8.7.1 — Smoke test OT 35990 + refinamientos planificación ✅ **23 jun 2026 (tarde)**

| Área | Cambio |
|------|--------|
| **Cerrar proceso** | Diálogo con tiempo mesa (reloj, no editable) + horas declaradas ajustables + sync a `prod_mesa_ejecuciones`. Sustituye "Finalizar" directo en todos los procesos. |
| **Horas totales HR** | Modal y PDF de hoja de ruta muestran previsto / real / desviación sumando campos reales por paso (`hoja-ruta-horas.ts`). |
| **Pool filtro barco** | Filtro "Próximo paso" considera tipos de paso de las hijas al filtrar contenedores (`matchesPlanificacionAreaTipoFilter`). |
| **Pool hijas cerradas** | Al expandir barco se listan **todas** las hijas (incl. `estado_pool = cerrada`); visual verde + "Itinerario completo", sin checkbox. |
| **Filtro próximo paso** | Nuevos tipos **Guillotina** y **Desbroce** en dropdown (migración `20260623210000`). Externo pendiente revisión aparte. |
| **Impresión proyección** | Badge y prefill usan salida de Guillotina (`hojas_finales`) vía `inputFromProcessIds: [17]`; fallback a despacho si no hay corte previo. |
| **Manipulados** | Campos **Etiquetar** + uds./paquete etiqueta (paralelo a Retractilar); cálculo automático de paquetes. |
| **Merma troquel → siguiente** | Semáforo en paso posterior (ej. Manipulados) con aviso amarillo/rojo si proyección < pedido ±5%. |

**Pendiente explícito:** encadenado y prefill de **procesos externos** (formato hojas recibidas, hojas recibidas automáticas, badge informativo).

**OT de prueba:** `35990` — flujo CTP → Guillotina → Impresión → Plastificado ext. → Troquel → Manipulados (sin desbroce/engomado en itinerario).

---

## 11. Impacto en módulos existentes

| Módulo | Impacto |
|--------|---------|
| `prod_ots_general` | +4 campos nullable (8.0). Migración aditiva. |
| Pool / Pipeline | **Agrupación visual** (8.1). Queries filtran `ot_tipo != hija` por defecto. Material barco + % pasos (8.1.1). |
| **Maestro OTs / OTs despachadas** | **Agrupación visual** (8.1.2). Mismo patrón barco + expandir hijas. **2 jul:** expand hijas sintéticas si solo existe despacho padre; **compra en lote** solo en contenedor (no hijas). |
| Despacho | Wizard hijas para `contenedor` (8.2) ✅ MVP. Form `simple` sin cambios. Compra conjunta en padre (validado 98010 + fix selección 36204). |
| Mesa / ejecución | Por hija: **sin cambio de motor** (8.3). Pool lateral filtrado por tipo de paso (8.1.1). Merma impresión + prefill troquel corregidos. **Cerrar proceso** con horas reloj + declaradas (8.7.1). |
| Hoja de ruta | Por hija: sin cambio. **Vista agregada contenedor (8.7):** modal + PDF barco con anexos por hija. **Horas totales** prev/real/desv. en cabecera (8.7.1). |
| Semáforo | Sin cambio en hijas simples; **futuro** ajuste por componente (8.6). |
| CTP | Definir hija `preimpresion` o regla compartida (pendiente §12). |
| Histórico (Bloque 6) | Cierre y snapshot del contenedor (8.4). |
| Maestro artículos | Formato compra/impresión; Fase 2 auto-enriquecimiento independiente. |
| OTs `simple` | **Sin cambios.** Mayoría del tráfico actual. |

---

## 12. Preguntas abiertas (responder antes de Fase 8.2)

Responder con Jordi / Zaida / Abraham / Carlos:

1. ¿Quién define las hijas al despachar — oficina técnica (Manel/Zaida) o Jordi?
2. ¿Las hijas comparten siempre fecha de entrega con el contenedor?
3. ¿Material: una compra para el barco o pedidos separados por hija?
4. ¿Itinerario distinto por hija? (ej. exterior + plastificado, interior + contracolado) → **se asume que sí, debe poder.**
5. ¿Punto de convergencia siempre externo o depende del producto? → **se asume variable (§5).**
6. ¿Reimpresión de una hija fallida: nueva hija “repetición” o reabrir la misma?
7. ¿Referencias en hijas tipo forma: varias `referencia_id` o una con poses distintas?
8. ¿Quién crea las sub-OTs en Optimus: presupuesto automático o manual?
9. ¿Maquinista ve pedido completo o solo la hija activa?
10. ¿CTP compartido: una hija `preimpresion` o CTP en cada hija de impresión?
11. ¿Cierre del contenedor automático al terminar hijas o siempre revisión humana (Bloque 6)?
12. ¿Cara = forma siempre en impresión 2 caras, u otra lógica?

### Orientación provisional (hasta validar con planta)

| # | Intuición |
|---|-----------|
| 1 | Oficina técnica al despachar |
| 2 | Sí, heredada salvo excepción |
| 3 | Compra conjunta; imputación por hija |
| 6 | Nueva hija repetición (no borrar histórico) |
| 7 | Caso A: varias referencias por forma |
| 10 | Hija `preimpresion` cuando agrupa planchas (como Optimus) |
| 11 | Alineado Bloque 6: `pendiente_revision` manual |

---

## 13. Lo que NO cambia

- OTs **`simple`**: flujo actual intacto.
- Motor `datos_proceso`, PDF beta, semáforo en OTs simples.
- Bloque 6 y 7: diseñar primero para `simple`; extender a contenedor después.
- **Formato de hoja** se puede desplegar antes que hijas.

---

## 14. Relación con otros bloques

| Bloque | Relación |
|--------|----------|
| **Maestro** (Fase 2) | Auto-enriquecimiento al despachar; independiente. Formato compra/impresión pendiente. |
| **Bloque 6** | Snapshot del contenedor + hijas; cierre cuando todas las hijas cierran. |
| **Bloque 7** | Expedición/albarán por referencia/componente, no por forma. |
| **Cartelas / stock** | Bloque 9 — §3b: stock al recepcionar, kilos→hojas, ID Stock 10.300+; ver `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`. |

---

## 15. Historial de decisiones

### 16 jun 2026 (Cursor + planta)

- Metáfora del **barco**; no inundar listados.
- JSON solo informativo insuficiente (Abraham: horas por forma a veces).
- Encadenado de formato = primer código.
- Ejemplo 50k / 4 modelos / 2 formas documentado.
- Merge `feature/fase0.6-hoja-ruta-virtual` → `main`.

### 17 jun 2026 (Claude + casos Optimus)

- Tres casos A/B/C documentados con números reales.
- **Opción A** (hijas OT reales) elegida sobre tabla `prod_ot_formas` pura.
- Roadmap 8.0–8.4 definido.
- Límite ~8 formas en Optimus.

### 17 jun 2026 (implementación Fase FORMATO)

- Código en `main` commit `aadad81`.
- Encadenado por `orden` del itinerario (soporta 2+ guillotinas en la misma OT).
- Fix consultas masivas Pool/Pipeline (`.in()` troceado + singleton Supabase browser).
- OT prueba 98009 validada en planta (PDF + ejecución).

### 17 jun 2026 (revisión fusionada)

- UX: hijas en BD **sí**, en listado plano **no** (agrupación 8.1 obligatoria).
- Convergencia **variable** (no siempre desbroce).
- Tipos de hija: forma | componente | preimpresion | acabado.
- CTP compartido como hija especial — pendiente validar.
- Opción C híbrida JSON descartada.

### 18 jun 2026 (prueba campo OT 98010 + fixes 8.1.1)

- Rama `feature/bloque8.1-pool-mesa-ejecucion-fixes`: pool mesa, material barco, merma, progreso por pasos.
- Validado flujo barco: compra en padre → hijas heredan material → planificación/ejecución por hija independiente.
- Pool lateral mesa diaria: misma regla genérica para todos los tipos (`preimpresion`, `impresion`, `troquelado`…); no secuencia entre hijas (03 visible aunque 02 ya en mesa = **comportamiento esperado**).
- Demo planta (Albert/Jordi): historia recomendada con `98010-01` avanzada + Pipeline mostrando 02/03 en CTP.

### 23 jun 2026 (8.1.2 maestro + despachadas + doc Bloque 10)

- Agrupación contenedor en **Maestro OTs** y **OTs despachadas** (módulo `ots-contenedor-display.ts`).
- Documentado **Bloque 10 Presupuestos** (versión real, puente 8.2 al despachar).
- Reunión Albert/Jordi: jueves — `MINERVA_REUNION_HOJA_RUTA_JUEVES.md`.

### 23 jun 2026 tarde (smoke test 35990 + cerrar proceso + filtros)

- **Cerrar proceso:** `cerrar-proceso-dialog.tsx` + `planificacion-ejecucion-horas.ts` (tiempo mesa → horas declaradas).
- **HR horas totales:** `hoja-ruta-horas.ts` en modal y PDF.
- **Pool:** filtro Guillotina/Desbroce; hijas cerradas visibles al expandir barco.
- **Impresión:** encadenado desde Guillotina en badge y datos proceso.
- **Manipulados:** etiquetar + paquetes. Externos: revisión pendiente.

### 2 jul 2026 — Caso referencia OT 36204 (ampollas) para wizard 8.2

- Documentado **§3 Caso A.2** en este archivo: 4 modelos, 2 formas, troquel 4 poses, validaciones aritméticas.
- Borrador SQL `prod_ot_hija_componentes` ampliado (§7).
- Mock UX wizard Formas/Hijas + aviso desbroce «NO MEZCLAR».
- Prioridad demo: **8.2 contenedor** usando 36204; ejecución demo sigue con 98010.

### 2–3 jul 2026 (noche) — Wizard contenedor MVP + fixes OTs despachadas ✅

**Rama:** `wizard-despacho` (commits `1b07777` … `bf9ea93`).

| Área | Hecho |
|------|--------|
| **Wizard 8.2** | Pestaña Formas/Hijas, validaciones, batch hijas, componentes, seed pasos por forma, hoja simplificada pack (portada + 1/hija) |
| **SQL prod** | `prod_ot_hija_componentes` aplicada en Supabase prod (`20260702200000`) |
| **Despacho real** | OT **36204** → 36204-01/02 en prod |
| **Demo mañana** | OT **98011** creada en maestro (clone 36204, sin hijas) para wizard en vivo |
| **Ejecución 8.3** | Banner NO MEZCLAR desbroce + fallback despacho hija vía padre |
| **OTs despachadas** | Expand hijas sin fila despacho (filas sintéticas desde maestro) |
| **Compra material** | Selección lote: **contenedor sí, hijas no**; update por `ot_numero` (fix error lote) |

**Pendiente inmediato:**

- Demo: despachar **98011** en wizard; compra en **36204** (padre); desbroce **36204-01**.
- Responder **§12** con planta (CTP compartido, quién define hijas).
- Merge `wizard-despacho` → `main`.
- Re-despachar 36204 si se quieren `datos_proceso` por forma en pasos ya creados.

---

## 16. Orden de trabajo recomendado

1. ~~**Fase FORMATO** — encadenado tamaño de hoja (código).~~ ✅ 17 jun 2026
2. ~~**Fase 8.0** — migración SQL aditiva.~~ ✅
3. ~~**Fase 8.1** — agrupación UI pool/pipeline.~~ ✅ 17 jun 2026
4. ~~**Fase 8.2** — wizard despacho contenedor + hijas — MVP ✅ **2–3 jul 2026** (rama `wizard-despacho`).
5. **Responder §12** con planta — **👉 PRIORIDAD DEMO mañana** (puede ir en la misma sesión).
6. **Fase 8.3** — ejecución desbroce multi-ref — 🟡 parcial; validar **36204-01** en planta.
7. **Fase 8.4** — cierre contenedor + Bloque 6.
8. **Merge** `wizard-despacho` → `main` + deploy estable.

### Retomar — demo pedidos complejos (3 jul 2026)

| Qué leer primero | Dónde |
|------------------|--------|
| Caso completo 36204 | Este doc **§3 Caso A.2** |
| Barco en ejecución | `GUIA_MAÑANA.md` · OT **98010** |
| Wizard en vivo (sin script) | OT **98011** — solo maestro |
| Caso ya despachado | OT **36204** — compra padre + desbroce 36204-01 |
| Wizard código | `DespachoWizardDialog` + `despacho-wizard-shared.ts` |

**Historia demo sugerida (8–10 min):**

1. **98010** agrupado en Pool/Pipeline (barco + hijas a distinto avance) — “así se ejecuta”.
2. **98011** en Maestro → abrir wizard → definir 2 formas / 4 refs → despachar en vivo — “así se crea sin Optimus ni script”.
3. **36204** ya despachada: expandir en OTs Despachadas → generar **compra en el padre** (no hijas) → hoja simplificada (portada + 2 formas).
4. **36204-01** en Ejecución → desbroce → banner **NO MEZCLAR**.
5. Preguntas §12 (CTP compartido, quién parte formas).

**No mezclar en la demo:** wizard OT simple (CTP, cartelita) — ya desplegado; foco en **complejos**.

---

## 17. Prompt para brainstorming

```text
Te paso el Bloque 8 definitivo de Minerva (formatos + formas + componentes).
Minerva sustituye a Optimus en imprenta/packaging.

Modelo: OT contenedor + hijas reales en BD, agrupadas en UI.
Prioridad código: encadenado de formato de hoja.

Devuélveme:
1. Riesgos del modelo y mitigaciones.
2. SQL mínimo Fase 8.0 + tabla componentes por hija.
3. Cambios concretos en pool/pipeline (Fase 8.1).
4. Diseño wizard despacho (Fase 8.2) para **Caso A.2 — OT 36204** (2 formas; ver §3).

--- BRIEFING ---
<pegar MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md>
```
