# MINERVA — Bloque 15: Stock de Artículos (Producto / WIP)

> **Fuente de verdad del Bloque 15.**  
> Tema: stock de **producto terminado** y **semielaborado** (estuches, cajas, etiquetas, Takeit…).  
> **No** es materia prima: eso sigue siendo Bloque 9 (cartelas / palets de papel).  
> Complementa: maestro · Bloque 6 (cierre) · Bloque 8 (contenedor) · Bloque 9 (material) · Bloque 16 (digests).
>
> **Estado:** 🚧 Fase A en `feature/bloque15-stock-articulos`. Hecho: **15.0–15.1d**, **15.3**, **15.4**. Pendiente: **15.2** (ATP al despachar) y **15.5** (alerta crítico).  
> **Urgencia:** Gabri controla PT a ojo. Albert: al **despachar** una OT, Minerva avisa si hay stock usable.  
> **Personas:** Gabri (PT + calendario engomado), Juan/Ramón (ubicación), oficina/Zada/Manel (OT + despacho), Albert (ATP).
>
> **Permisos escritura:** roles `admin|gerencia|administracion|almacen|oficina_tecnica|logistica` **o** capacidad `profiles_capacidades.stock_articulos_write` (Gabri con rol `engomado`). Tableta `engomado@` **sin** esa capacidad.  
> **15.4:** OT de entrega nace en **Optimus**; Minerva solo tag `OT_ENTREGA` + reserva. No crear nº OT en `prod_ots_general` mientras haya paralelo.  
> **Proceso DB:** toda migración / RPC nueva → **revisión Claude antes de aplicar en remoto**. (Aviso 25 sep: `20260925150000` se aplicó sin pasar; esta vez OK porque solo columnas nullable + recreate vistas/función.)

**Tres mundos de stock (no mezclar pestañas):**

| Mundo | Bloque | Qué es |
|-------|--------|--------|
| Material | **9** | Papel, cartón, bobinas → `prod_stock_palets` / cartelas |
| **Producto** | **15** | Terminado + WIP → tablas nuevas (`prod_stock_articulos*`) |
| Consumibles | Futuro | Tintas, cauchos, toners… → **otro** bloque; no en 15 |

---

## 1. Problema

- Fabrican de más (run económico), dejan stock de cliente, o WIP largo (Takeit).
- Flujo planta actual (Optimus): OT con pedido `FABRICACION` / `FABRICACIÓ` produce; luego OTs con nº pedido real **entregán** de ese pool. El remanente se deduce a ojo (fechas + suma mental + “Gabriii ¿hay X?”).
- Al despachar nadie pregunta de forma sistemática: ¿stock o fabricar?
- Albert: *«en Minerva estará controlado; si abren una OT del artículo, el sistema alerta»*.

**Impacto:** tiempo perdido, stock invisible, cero ATP de producto.

---

## 2. Qué NO es este bloque

- **No** reutilizar `prod_stock_palets` (unidades, gente y riesgos distintos).
- **No** consumibles.
- **No** confundir **despacho OT** con **Bloque 7** albarán (aparcado). El ATP de Albert es al **despachar / crear OT**, no al albarán.
- **No** SQL libre en UI.

---

## 3. Referencia: Minerva manda, cliente se busca

| Concepto | Regla |
|----------|--------|
| **Canónico** | Siempre `referencia_id` → `prod_referencias` (`M-xxxxx`). Siempre existe. |
| **Búsqueda humana** | **Referencia cliente** + cliente (Simón, Cata, Anur, Turris…). Gabri, Zada y oficina buscan así. |
| **Sin ref. cliente** | Válido (interiores, clientes que no codifican). UI muestra Minerva + descripción; no inventar código cliente. |

**UI / ATP:** columnas y buscador priorizan **cliente · ref. cliente · descripción**; Minerva visible en secundario. Equivalencia siempre clara al despachar.

`cliente` en el lote = **texto** como en la OT / Optimus (aún no hay Odoo). Vacío = usable por cualquiera; con valor = **solo ese cliente** (Takeit / stock suyo).

---

## 4. Anatomía del lote (`prod_stock_articulos`)

| Campo | Notas |
|-------|--------|
| `id` | uuid PK |
| `referencia_id` | FK `prod_referencias` (obligatorio) |
| `referencia_codigo` / `referencia_descripcion` | denorm UI (Minerva) |
| `referencia_cliente` | denorm UI; puede ser null |
| `cliente` | texto Optimus; null = libre cualquier cliente |
| `cantidad_actual` | físico en la unidad del lote |
| `unidad` | `uds` \| `hojas` (WIP a menudo en hojas) |
| `poses` | opc.; convierte hojas → estuches en el aviso ATP |
| `estado_proceso` | `terminado` \| `impreso` \| `troquelado` \| … |
| `ot_origen` | OT FABRICACION / origen; null = alta manual |
| `bultos` | nº bultos/cajas completos (opc.) |
| `unidades_por_bulto` | uds por bulto (opc.) |
| `pico` | uds sueltas (opc.) |
| `palets` | nº palets **del lote en general** (opc.; no desglose por palet) |
| `caja_embalaje` | tipo embalaje MN2L / BP1N… (opc.) |
| `ubicacion_fisica` | texto libre MVP |
| `notas` / `condicion` | |

**Mínimo de alerta:** no vive en el lote. El umbral crítico está en `prod_referencias.stock_cantidad_minima` (vista `stock_articulos_critico_por_ref`).

**No** guardar en el lote: `ot_destino_reserva`, `cantidad_reservada`, `estado` persistido, `num_pedido_asignado` como única verdad. Eso va a **reservas** + vista ATP (mismo principio que B9).

---

## 5. Reservas (como B9)

### `prod_stock_articulos_reservas`

Una fila = (lote, OT, cantidad [, nº pedido]). Varias OTs / 1ª–2ª–3ª sobre el mismo lote.

| Campo | Notas |
|-------|--------|
| `stock_articulo_id` | FK lote |
| `ot_numero` | OT de entrega / destino |
| `num_pedido` | opc.; pedido Optimus si aún no hay OT o para audit |
| `cantidad_reservada` | dura (MVP: siempre con cantidad) |
| `bultos_reservados` | opc. |

### Vista `stock_articulos_atp`

- `cantidad_libre = cantidad_actual − Σ(reservada − consumida)` de reservas en estado `activa` \| `parcial` (nunca &lt; 0)
- `estado_derivado`: `agotado` \| `disponible` \| `reservado` \| `parcial` (**calculado**)
- `sobre_reservado` si reservas &gt; físico

**Ciclo:** al crear OT entrega / “usar stock” → **reservar**. Al confirmar salida / cierre entrega → **consumir** (baja físico + cierra reserva). Si se anula la OT → liberar reserva.

---

## 6. Movimientos (`prod_stock_articulos_movimientos`)

Tipos: `entrada` | `reserva` | `liberacion` | `consumo` | `ajuste` | `transformacion`.

- **transformacion:** sale del lote A (p. ej. impreso) y entra lote B (troquelado); opcional merma en el mismo movimiento o ajuste. Pregunta §9.
- Cantidad siempre ≥ 0; el signo lo da el tipo.
- En **ajustes** se registran `cantidad_antes` / `cantidad_despues` (auditoría).
- Inmutable (no borrar filas).

---

## 7. Casos de uso (Optimus → Minerva)

### Caso A — FABRICACION + entregas según van llegando pedidos

Ej. Turris I02997: OT `FABRICACION` 256k → luego OTs con `PC-xxxxx` van sacando. Remanente visible en **Stock de artículos**.

### Caso B — Un pedido, varias entregas

Ej. Instant / Naturdao 100714: OT `FABRICACION - 26000388` 25k + OTs 1ª/2ª entrega. El día D el pedido se deja limpio para albarán.

### Caso C — Takeit (WIP)

Stock `impreso` / `troquelado`, normalmente con `cliente` relleno. No ofrecer a otro cliente.

### Caso D — Desde Stock → OT de entrega (flujo estrella Gabri/oficina)

1. Abrir **Stock de artículos**; buscar por ref. cliente / cliente / Minerva.  
2. Hay 150k, hacen falta 50k → **«OT entrega»**.  
3. Minerva **marca** una OT ya importada de Optimus con tag **`[OT_ENTREGA]`** (en la reserva) + **reserva** del lote (uds + bultos). No crea nº OT.  
4. Al salir / cerrar → **consumo** + reetiqueta (María José).

### Caso E — Al despachar OT de pedido (Albert)

Modal ATP: stock usable del **mismo cliente** (o libre) → Usar / Fabricar completo / Mezclar.

### Caso F — Alta manual

Entrada sin OT (compra / ajuste inventario) → lote con `ot_origen` null.

### Tag `OT_ENTREGA`

Flag/tag en la OT (o en despacho) para informar y filtrar: **no fabrica**, sale de almacén. Itinerario corto o vacío — detalle en implementación. No es un tipo Optimus nuevo; es control Minerva.

Detección ayuda (no exclusiva): pedido tipo `FABRICACION` / `FABRICACIÓ` → candidata a **entrada** a stock al cierre; pedido nº real / 1ª–2ª → candidata a **consumo**.

---

## 8. UX

### 8.1 `Almacén → Stock de artículos` (hermano de Stock material)

Ruta: `/produccion/almacen/stock-articulos` (menú: **Stock artículos** junto a Stock material).

Bandeja: cliente, ref. cliente, Minerva, descripción, proceso, físico, libre, bultos, ubicación, crítico.  
Acciones: alta, ajuste, detalle + movimientos, **Asistente IA** (NL sobre ATP), **Generar OT de entrega** (15.4).  
**Referencia en alta:** solo **buscar** existentes — **no crear** ref. nueva desde esta pantalla (evitar duplicados en maestro).  

#### Alta de lote — datos de embalaje (opcionales, ideal para inventario)

Todo **opcional**, pero conviene rellenarlo para saber qué hay físicamente:

| Campo | Notas |
|-------|--------|
| **OT origen** | Buscador sobre maestro (`prod_ots_general` / `OtDestinoSearchInput`), no texto libre a ciegas. FABRICACION / OT de origen. |
| **Bultos** | Nº de bultos/cajas completos. |
| **Uds/bulto** | `unidades_por_bulto` — estuches (u otra ud) por bulto. Prefill desde maestro si hay `unidades_por_embalaje_habitual`. |
| **Pico** | Unidades sueltas fuera de bultos completos. |
| **Palets** | Nº de **palets en general** del lote. **MVP: no** desglose «palet 1 / palet 2…» (futuro si hace falta). |
| **Tipo embalaje** | Código caja (`caja_embalaje`: MN2L, BP1N…). Prefill desde `caja_embalaje_habitual` del maestro. |

Acuerdo 25 sep: **PALETS general** basta; hilar fino por palet queda fuera de MVP.

**Aviso embalaje (UI, no bloquea):** si `bultos × uds/bulto + pico ≠ cantidad` (unidad uds), confirmar: *«Bultos × uds/bulto + pico = X ≠ Y uds. ¿Guardar igualmente?»*. Embalaje a veces aproximado.

#### 8.1.1 Huecos post-15.1 (Claude 25 sep) — orden de cierre

1. **Picker ref. = solo búsqueda** (UI, sin DB). Quitar «crear» en alta de stock.  
2. **`prod_stock_articulos_editar_datos`** (DB → **revisión Claude antes de aplicar**): editar ubicación, palets, pico, uds/bulto, caja_embalaje, notas, bultos… **nunca** la cantidad. Historial: movimiento `ajuste` con cantidad 0 y nota tipo `Edición datos: ubicación A3 → B1`. Motivo: tras consumos, embalaje se desfasa; mover de sitio no cabe en `ajustar`.  
3. **15.1b** plantilla + import Excel (revisión en tabla, como OCR 9.7).  
4. **15.1d** export PDF / Excel de la bandeja filtrada.

### 8.1b — Carga inicial Excel (15.1b)

- **Plantilla generada en app** (botón «Plantilla» / «Descargar plantilla»): no hay `.xlsx` en el repo. Cabeceras = columnas del alta; si mañana se añade un campo, la plantilla se actualiza sola.  
  - Referencia: código `M-xxxxx` **o** ref. cliente + cliente.  
  - Hoja `Stock` **solo cabecera**; hoja `Ejemplo` con 2 filas de muestra (no se importa); hoja `Listas`. Notas con «Ejemplo» → rojo.  
  - Desplegables en `unidad` / `proceso` (best-effort SheetJS) + Listas.  
- **Números:** lectura `raw: true`; enteros quitan puntos/comas de miles (`"35.900"` → 35900).  
- **Sinónimos:** `ud`/`unidades`/`u` → `uds`; `hoja` → `hojas`; `term`/`acabado` → `terminado`; `troquel`/`troquelada` → `troquelado`. (Desplegables SheetJS no se escriben; exceljs solo si Gabri se queja.)  
- **Lookup maestro:** solo códigos/refs del Excel vía `.in` / `ilike` + `fetchAllInChunks`. Códigos Minerva en mayúsculas; ref. cliente case-insensitive.  
- **Import:** tabla semáforo → confirmar → `alta_lote` fila a fila. Diálogo **no cierra**: cada fila creada/error; reintentar solo fallidas.  
- **Anti-doble:** tag `[import:hash]` en notas; aviso lote ref+cantidad+OT; aviso **filas repetidas en el mismo archivo**.  
- **Carga real:** empezar con 5–10 filas conocidas, validar en bandeja, luego el inventario completo.  
- Sin SQL nueva.

### 8.1d — Export bandeja (15.1d)

PDF y Excel de la bandeja **con los filtros activos**, cabecera con fecha + usuario (email). Patrón compras/residuos (jsPDF + SheetJS). Útil para Gabri en almacén con hoja en mano.

### 8.1.3 — Reservas UI (15.3)

Sin SQL nueva (RPCs ya existen). En detalle del lote:
- Lista de reservas (OT, pedido, reservado, consumido, estado).
- Reservar / consumir / liberar; **consumir sin reserva** en flujo aparte con motivo obligatorio.
- Confirmación antes de consumir (baja físico).
- Aviso amarillo si cliente OT ≠ cliente lote (no bloquea; datos para validar 15.2).
- Cantidades con `parseStockImportInt` (miles ES).
- Error claro si la OT no está en Minerva (`prod_ots_general`).

### 8.1.4 — OT de entrega (15.4)

Sin crear nº OT en Minerva. Botón **OT entrega**: elige OT ya importada de Optimus → reserva con tag `[OT_ENTREGA]` en notas + badge en lista.  
**Limitación:** si luego se amplía la reserva con otra nota vía «Reservar», `coalesce` puede sustituir las notas y **perder el tag**. Para filtrar en **15.2** hace falta campo real (`es_ot_entrega` u similar) → SQL a revisar con Claude antes de aplicar.

### 8.2 Modal ATP en despacho

Texto del estilo: *Stock: ref. cliente X (Cliente) · Minerva M-… · N uds libres · ubicación…*

### 8.3 Cierre OT (Fase B)

FABRICACION / sobrante → proponer entrada a stock. Entrega con reserva → consumir.

---

## 9. Relación con otros bloques

| Bloque | Relación |
|-------|----------|
| **6** | Entrada al cierre FABRICACION; consumo al cerrar entrega |
| **7** | Futuro albarán; **no** el ATP inicial |
| **8** | Hijas pueden generar WIP |
| **9** | Complementario; nunca la misma tabla |
| **14** | Maestro referencias = clave |
| **16** | Digest stock producto crítico (tras 15.1) |

---

## 10. Preguntas abiertas (§9)

1. ¿Ubicación física PT/WIP? ¿Zona Gabri o repartido?  
2. ¿Quién decide sobrante → stock vs merma?  
3. ¿Mínimos por referencia? ¿Quién los mantiene?  
4. ¿FIFO o mezclan lotes?  
5. ¿Cajas embalaje (Simón…) entran aquí? (probablemente sí)  
6. ¿Takeit: entrada WIP automática al cerrar impresión/troquel o manual al inicio?  
7. ¿Estados de proceso exactos?  
8. ¿Valoración €? (después)  
9. Si usan stock ya impreso, ¿el despacho/itinerario **empieza en troquel**?  
10. Al transformar impreso→troquelado, ¿hay merma y cómo se registra?  
11. ✅ **Respondida:** OT de entrega nace en **Optimus**. Minerva solo tag `OT_ENTREGA` + reserva. **MVP:** no crear nº OT en `prod_ots_general`.

---

## 11. Fuera de MVP

- Compra automática de reposición  
- Multi-almacén / FIFO estricto  
- Inventario cíclico contable  
- Consumibles  
- SQL libre  

---

## 12. Roadmap

### Fase A — Core (esta rama)

| ID | Entregable | Estado |
|----|------------|--------|
| **15.0** | Migración: lotes + reservas + ATP/crítico + RLS SELECT + RPCs | ✅ remoto + smoke |
| **15.1** | UI bandeja + alta/ajuste + búsqueda ref. + IA + embalaje en alta | ✅ casi; pulidos §8.1.1 |
| **15.1a** | Editar datos (no cantidad): RPC `editar_datos` + UI detalle | ✅ |
| **15.1b** | Plantilla Excel + import con tabla de revisión (carga inicial) | ✅ |
| **15.1d** | Export PDF / Excel bandeja filtrada | ✅ |
| **15.3** | Reserva + consumo + liberar (vía RPC) en UI | ✅ |
| **15.4** | Tag `OT_ENTREGA` + reserva sobre OT Optimus | ✅ (tag en notas reserva; sin crear OT) |
| **15.2** | Modal ATP en despacho OT (usar / fabricar / mezclar) | ⏳ **al final** (inventario cargado) |
| **15.5** | Alerta crítico agregado por referencia | ⏳ |

Orden acordado (Claude 25 sep): **picker solo buscar** → **15.1a editar_datos (review DB)** → **15.1b** → **15.1d** → luego **15.3 → 15.4 → 15.2**.

### Fase B

| ID | Entregable |
|----|------------|
| **15.6** | Entrada WIP automática (Takeit) |
| **15.7** | Popup sobrante al cierre OT (B6) |
| **15.8** | Transformación impreso→troquelado con merma |
| **15.9** | Multi-ubicación / FIFO / valoración |

---

## 13. Historial

| Fecha | Cambio |
|-------|--------|
| 25 sep 2026 | Creación Claude + niquelado Cursor (despacho≠B7, claves, sin consumibles). |
| 25 sep 2026 | Acuerdos planta + Fase A. |
| 25 sep 2026 | 15.0 RPC/capacidades; fix Claude: libre en consumir sin reserva, crítico uds+terminado, transformar unidad/locks, num_pedido OT, ajustar p_forzar, revoke anon. |
| 25 sep 2026 | Smoke OK remoto + 15.1 UI fixes Claude (KPI PT/WIP, ajuste nota, load límite/agotado, crítico key, alta OT origen). |
| 25 sep 2026 | Alta: OT buscable en maestro; embalaje opc. (uds/bulto, pico, palets general, caja); Asistente IA. |
| 25 sep 2026 | Roadmap: 15.1a editar_datos, 15.1b import review, 15.1d export; proceso DB → Claude antes de aplicar; picker sin crear. |
| 25 sep 2026 | **15.1b:** plantilla generada en app (desplegables unidad/proceso + hoja Listas); import con semáforo; anti-doble `[import:hash]`; `alta_lote` fila a fila (sin RPC batch). |
| 25 sep 2026 | **15.1b fix:** miles ES (`raw:true` + strip); lookup `.in` chunks; hoja Ejemplo aparte; diálogo ✅/❌ + reintento; duplicados intra-archivo. |
| 25 sep 2026 | **15.1b:** lookup case-insensitive (Minerva UPPER + ref. cliente `ilike`). **15.1d:** export PDF/Excel bandeja filtrada (fecha + usuario). |
| 25 sep 2026 | **15.1b:** sinónimos unidad/proceso. **15.3:** UI reservas en detalle (lista + reservar/consumir/liberar; sin reserva aparte). Sin SQL nueva. |
| 25 sep 2026 | **15.3 fix:** miles en cantidades UI; confirm consumir; aviso cliente OT≠lote. **15.4:** OT entrega = tag `[OT_ENTREGA]` + reserva (sin crear OT). |
| 25 sep 2026 | Hardening: auth Gemini antes de LLM; sumas IA por unidad + count exact; parseInt miles solo grupos de 3; PDF descripción/reservado; docs Caso D / maestro. |

---

## 14. Próximo paso (código)

Rama: **`feature/bloque15-stock-articulos`**.

**Siguiente:** poner lotes `TEST_PILOTO` a 0 (liberar reservas antes si las hay) → Gabri carga real → **15.2** modal ATP despacho.  
~~15.1a~~ · ~~15.1b~~ · ~~15.1d~~ · ~~15.3~~ · ~~15.4~~.

Validar §10 con Gabri cuando toque UX de ubicación/mínimos.
