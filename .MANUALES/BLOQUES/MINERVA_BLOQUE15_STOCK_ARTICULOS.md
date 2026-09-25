# MINERVA — Bloque 15: Stock de Artículos (Producto / WIP)

> **Fuente de verdad del Bloque 15.**  
> Tema: stock de **producto terminado** y **semielaborado** (estuches, cajas, etiquetas, Takeit…).  
> **No** es materia prima: eso sigue siendo Bloque 9 (cartelas / palets de papel).  
> Complementa: maestro · Bloque 6 (cierre) · Bloque 8 (contenedor) · Bloque 9 (material) · Bloque 16 (digests).
>
> **Estado:** 🚧 Fase A — rama `feature/bloque15-stock-articulos`. Migración 15.0 reescrita (RPC + capacidades); **no aplicar remoto hasta revisión Claude**.  
> **Urgencia:** Gabri controla PT a ojo. Albert: al **despachar** una OT, Minerva avisa si hay stock usable.  
> **Personas:** Gabri (PT + calendario engomado), Juan/Ramón (ubicación), oficina/Zada/Manel (OT + despacho), Albert (ATP).
>
> **Permisos escritura:** roles `admin|gerencia|administracion|almacen|oficina_tecnica|logistica` **o** capacidad `profiles_capacidades.stock_articulos_write` (Gabri con rol `engomado`). Tableta `engomado@` **sin** esa capacidad.  
> **15.4:** OT de entrega nace en **Optimus**; Minerva solo tag `OT_ENTREGA` + reserva. No crear nº OT en `prod_ots_general` mientras haya paralelo.

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
| `bultos` / `palets` | embalaje físico |
| `ubicacion_fisica` | texto libre MVP |
| `cantidad_minima_alerta` | opc. |
| `notas` / `condicion` | |

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

- `cantidad_libre = cantidad_actual − sum(reservas)` (nunca &lt; 0)
- `estado_derivado`: `agotado` \| `disponible` \| `reservado` \| `parcial` (**calculado**)
- `sobre_reservado` si reservas &gt; físico

**Ciclo:** al crear OT entrega / “usar stock” → **reservar**. Al confirmar salida / cierre entrega → **consumir** (baja físico + cierra reserva). Si se anula la OT → liberar reserva.

---

## 6. Movimientos (`prod_stock_articulos_movimientos`)

Tipos: `entrada` | `reserva` | `liberacion` | `consumo` | `ajuste` | `transformacion`.

- **transformacion:** sale del lote A (p. ej. impreso) y entra lote B (troquelado); opcional merma en el mismo movimiento o ajuste. Pregunta §9.
- Cantidad siempre &gt; 0; el signo lo da el tipo.
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
2. Hay 150k, hacen falta 50k → **«Generar OT de entrega»**.  
3. Minerva crea OT con tag **`OT_ENTREGA`** (cantidad, cliente, ref, nº pedido) + **reserva** del lote (uds + bultos).  
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

Ruta propuesta: `/produccion/almacen/stock-articulos` (menú: **Stock artículos** junto a Stock material).

Bandeja: cliente, ref. cliente, Minerva, descripción, proceso, físico, libre, bultos, ubicación, crítico.  
Acciones: alta, ajuste, detalle + movimientos, **Generar OT de entrega**.

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
11. ¿Crear OT entrega desde Stock escribe ya en `prod_ots_general` + tag, o MVP solo reserva contra OT existente?

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

| ID | Entregable |
|----|------------|
| **15.0** | Migración: lotes + reservas (consumida) + movimientos inmutables + vistas ATP/crítico + RLS solo SELECT + RPCs |
| **15.1** | UI Stock artículos: bandeja + alta/ajuste + búsqueda ref. cliente |
| **15.1b** | Carga inventario inicial (Gabri / Excel) **antes** de activar aviso despacho |
| **15.2** | Modal ATP en despacho OT (usar / fabricar / mezclar) |
| **15.3** | Reserva + consumo + liberar (vía RPC) |
| **15.4** | Tag `OT_ENTREGA` + reserva sobre OT ya creada en Optimus (no crear OT en Minerva) |
| **15.5** | Alerta crítico agregado por referencia |

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

---

## 14. Próximo paso (código)

Rama: **`feature/bloque15-stock-articulos`**.  
Orden: **15.0** → **15.1** → **15.3** → **15.4** / **15.2**.  
Validar §10 con Gabri cuando toque UX de ubicación/mínimos; no bloquea 15.0–15.1.
