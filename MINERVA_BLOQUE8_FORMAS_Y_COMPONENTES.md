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

Tabla auxiliar candidata `prod_ot_hija_componentes` (nombre provisional):

| Campo | Uso |
|-------|-----|
| `ot_hija_numero` | FK hija |
| `referencia_id` | FK maestro |
| `poses` | Poses de ese modelo en la forma |
| `cantidad_objetivo` | Estuches/unidades objetivo |

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
- Estado global: % hijas con pool `cerrada`.
- Filtros: agrupado (default) | solo simples | solo contenedores | todas planas.
- Módulo: `src/lib/planificacion-contenedor-query.ts`.
- **Sin esta fase no se despliegan hijas en producción** — UI lista; falta 8.2 para crear hijas.

### Fase 8.2 — Despacho contenedor + wizard de hijas

- Al despachar `contenedor`, definir N hijas:
  - `tipo_hija`, descripción, material (heredado o propio), hojas, planchas, poses.
  - Componentes/referencias por hija (`prod_ot_hija_componentes`).
  - Clon de plantilla de itinerario; override por hija.
- Creación batch de OTs hijas + despachos pre-rellenados.
- Respetar límite práctico ~8 formas (avisar / partir pedido).

### Fase 8.3 — Ejecución por hija

- Mesa y `ExecutionCard`: hijas son OTs normales.
- Maquinista ve identificador claro (ej. `35698 · F2 — Hoja exterior`).
- Contenedor agrega estado de hijas.

### Fase 8.4 — Cierre del contenedor

- Contenedor → `pendiente_revision` cuando todas las hijas cumplen su ruta (regla configurable).
- Bloque 6: snapshot del **barco** + detalle de hijas en JSON.

### Fases posteriores (fuera del MVP Bloque 8)

- **8.5** Engomado y embalaje por referencia/componente tras convergencia.
- **8.6** Semáforo/proyección por componente.
- **8.7** Vista hoja de ruta / PDF del contenedor agregado.

---

## 11. Impacto en módulos existentes

| Módulo | Impacto |
|--------|---------|
| `prod_ots_general` | +4 campos nullable (8.0). Migración aditiva. |
| Pool / Pipeline | **Agrupación visual** (8.1). Queries filtran `ot_tipo != hija` por defecto. |
| Despacho | Wizard hijas para `contenedor` (8.2). Form `simple` sin cambios. |
| Mesa / ejecución | Por hija: **sin cambio de motor** (8.3). |
| Hoja de ruta | Por hija: sin cambio. **Nuevo:** vista agregada contenedor (posterior). |
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

---

## 16. Orden de trabajo recomendado

1. ~~**Fase FORMATO** — encadenado tamaño de hoja (código).~~ ✅ 17 jun 2026
2. ~~**Fase 8.0** — migración SQL aditiva.~~ ✅
3. ~~**Fase 8.1** — agrupación UI pool/pipeline.~~ ✅ 17 jun 2026
4. **Responder §12** con planta.
5. **Fase 8.2** — wizard despacho contenedor + hijas.
6. **Fase 8.3** — ejecución (mayormente gratis).
7. **Fase 8.4** — cierre contenedor + Bloque 6.

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
4. Diseño wizard despacho (Fase 8.2) para Caso A con 6 formas.

--- BRIEFING ---
<pegar MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md>
```
