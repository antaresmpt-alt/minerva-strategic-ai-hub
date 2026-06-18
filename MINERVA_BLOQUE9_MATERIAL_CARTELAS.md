# MINERVA — Briefing Bloque 9: Gestión de Material y Cartelas

> Documento de diseño y toma de decisiones (fuente de verdad del Bloque 9).
> Tema: recepción de material, cartelas de palet, stock libre y trazabilidad.
> Complementa `MINERVA_HUB_CONTEXTO_MAESTRO.md`, `FASES_HOJA_RUTA_DIGITAL.md` y los briefings de Bloques 6 y 7.
>
> **Estado:** 📋 Diseño / brainstorming — **sin implementación** (18 jun 2026).
> **Origen:** análisis del flujo real de Optimus + cartelas físicas CARPAPSA (15 jun 2026) + iteración Claude (18 jun).
> **PENDIENTE:** audio/notas de Emma (administrativa) cuando esté disponible.

**Relacionado:** cierre OT y sobrantes → Bloque 6 · expedición/trazabilidad → Bloque 7 · material compartido contenedor/hijas → Bloque 8 · FSC → maestro artículos.

---

## 1. El problema

Hoy la gestión de material se hace en Optimus + papel:
- Jordi/Ramón crean una OC (Orden de Compra) con código `9xxxxx`
- El proveedor entrega con su albarán (ej: G6-3305 de CARPAPSA)
- Emma recibe el albarán, busca las OCs relacionadas y genera cartelas en Optimus
- Juan (almacén) imprime las cartelas y las pega en cada palet físico
- El material queda identificado en almacén hasta que va a máquina

Minerva necesita replicar este flujo de forma más ágil, con trazabilidad real
y sin depender de que alguien recuerde manualmente qué hay en almacén.

---

## 2. Flujo real documentado (18 jun 2026)

```text
Proveedor envía material
  ↓
Albarán proveedor llega a Emma
  (un albarán puede incluir material para varias OTs)
  ↓
Emma busca las OCs relacionadas en Optimus
  (OC tiene código 9xxxxx, vinculada a OTs en pestaña Reservas)
  ↓
Emma crea cartelas en Optimus (1 por palet)
  ↓
Impresión de cartelas → Juan las pega en cada palet físico
  ↓
Palets en almacén identificados con ID Stock único
  ↓
Cuando la OT entra en producción:
  - maquinista o almacén lleva el palet a máquina
  - consume las hojas
  - si sobran → palet sobrante queda en almacén como stock libre
```

---

## 3. Anatomía de una cartela real (Optimus)

Basado en cartelas reales del 15-jun-2026 (CARPAPSA, albarán G6-3305):

| Campo | Ejemplo | Notas |
|-------|---------|-------|
| **ID Stock** | 10204 / 10205 / 10206 | Identificador único del palet. Número grande en la cartela. |
| **Cód. Artículo** | PHFOAL235072001020 | Código interno de material (coincide con OC) |
| **Descripción** | Folding de 235 gr/m2 72×102 cm - ALLYKING | Material + gramaje + formato + marca |
| **Cantidad** | 2.400 hojas / 1.000 hojas | Hojas en ese palet concreto |
| **Proveedor** | CARPAPSA, S.A. (000082) | Con ID interno |
| **Id entrada** | 5979 / 5980 / 5981 | ID de la entrada de almacén en Optimus |
| **Recibido** | 12:53 15-jun-2026 | Fecha/hora de creación de cartela |
| **Nota Entrega** | G6-3305 | Número de albarán del proveedor |
| **Ref. Lote** | 36016 - TEIKIT (T007) | OT destino + nombre trabajo |

**Observación clave**: un mismo albarán proveedor (G6-3305) puede generar
cartelas para distintas OTs. En este caso las 3 cartelas eran todas para OT 36016,
pero el albarán del proveedor mencionaba también OTs 35990 y 35949.

---

## 4. Los dos tipos de cartela

| Tipo | Cuándo se crea | OT destino | Estado |
|------|---------------|------------|--------|
| **Cartela OT** | Material llega para una OT concreta | OT asignada | `reservado` |
| **Cartela stock libre** | Sobrante de una OT / material sin OT asignada | Sin OT | `disponible` |

**Usos del stock libre:**
- Complementar una OT que se ha quedado corta (merma inesperada)
- Reproceso parcial de una OT con incidencia
- Aprovechar para un trabajo pequeño que entra y ese material sirve
- Simplemente tenerlo disponible "por si acaso"

---

## 5. El problema del sobrante

Caso típico:
- OT necesita 1.600 hojas
- El palet del proveedor tiene 1.800 hojas
- Después de imprimir sobran 200 hojas

Opciones:
- **A) Palet único para la OT**: se crea cartela de 1.800 para la OT. Al cerrar,
  el sistema detecta que sobraron 200 y genera automáticamente una cartela
  de stock libre con esas 200 hojas.
- **B) Partir el palet al recibir**: se crean dos cartelas al recepcionar:
  1.600 para la OT + 200 como stock libre desde el principio.

**Optimus hace algo parecido a A** — genera una entrada "ficticia" de stock
para el sobrante al cerrar. Recomendación para Minerva: también opción A,
porque en el momento de recepcionar no siempre se sabe exactamente cuánto
sobrará (depende de la merma real).

---

## 6. Modelo de datos propuesto (MVP)

### Tabla `prod_recepciones_material`
Representa una recepción (un albarán de proveedor).

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `albaran_proveedor` | text | Ej: G6-3305 |
| `proveedor_id` | FK | Proveedor |
| `proveedor_nombre` | text | Snapshot |
| `fecha_recepcion` | timestamp | |
| `oc_numero` | text | OC relacionada (9xxxxx) |
| `notas` | text | |
| `created_by` | UUID | Emma/Ramón |
| `created_at` | timestamp | |

### Tabla `prod_stock_palets` (las cartelas)
Cada fila = un palet físico con su cartela.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `id_stock` | integer | Número de cartela (autoincremental, grande y visible) |
| `recepcion_id` | FK | Recepción a la que pertenece |
| `codigo_articulo` | text | Código material (PHFOAL235072001020) |
| `descripcion_material` | text | Snapshot legible |
| `material_nombre` | text | Ej: "Folding" / "Zenith" / "Allyking" |
| `gramaje` | integer | gr/m2 |
| `formato` | text | Ej: "72×102 cm" |
| `marca` | text | Ej: "ALLYKING" / "ZENITH" |
| `cantidad_inicial` | integer | Hojas al recepcionar |
| `cantidad_actual` | integer | Hojas restantes (se descuenta al consumir) |
| `ot_destino_numero` | text | OT asignada (null si stock libre) |
| `estado` | enum | `reservado` / `disponible` / `consumido` / `parcial` |
| `ref_lote` | text | Ej: "36016 - TEIKIT" |
| `notas` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Tabla `prod_stock_movimientos`
Log de consumos y ajustes (para trazabilidad).

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `palet_id` | FK | Palet afectado |
| `tipo` | enum | `consumo` / `ajuste` / `sobrante` / `traspaso` |
| `cantidad` | integer | Hojas (+/-) |
| `ot_numero` | text | OT que consumió (si aplica) |
| `paso_id` | FK | Paso de itinerario (si aplica) |
| `notas` | text | |
| `created_by` | UUID | |
| `created_at` | timestamp | |

---

## 7. Flujo UX propuesto para Minerva

### 7.1 Recepción de material (Emma / Ramón)

Módulo: `Almacén → Recepciones`

1. Nueva recepción: proveedor + nº albarán + fecha
2. Añadir líneas de material:
   - Material (buscador por código/descripción)
   - OT destino (opcional — puede dejarse como stock libre)
   - Total hojas recibidas
3. Minerva calcula automáticamente cuántos palets según hojas/palet estándar
   (configurable por material) y genera N cartelas
4. Imprimir cartelas → Juan las pega en los palets

### 7.2 Cartela imprimible

Contenido mínimo (grande y legible para almacén):
```
┌─────────────────────────────┐
│  ID STOCK: 10.204           │
│                             │
│  Folding 235gr 72×102       │
│  ALLYKING                   │
│                             │
│  2.400 hojas                │
│                             │
│  OT: 36016 - TEIKIT         │
│  CARPAPSA  G6-3305          │
│  15/06/2026                 │
└─────────────────────────────┘
```

### 7.3 Consulta de stock disponible

Módulo: `Almacén → Stock`

- Filtrar por material / gramaje / formato / marca
- Ver palets disponibles (stock libre) y reservados (con OT)
- Ver cantidad actual (descontando consumos registrados)
- Acción: asignar palet libre a una OT

### 7.4 Consumo en producción

Dos opciones (a decidir con planta):

**Opción A — Registro manual al iniciar ejecución:**
Al iniciar un paso en la mesa, el maquinista selecciona qué palet(es) va a usar.
Minerva descuenta las hojas al finalizar el paso.

**Opción B — Registro al cerrar ejecución:**
Al finalizar el paso, el maquinista informa cuántas hojas usó.
Minerva busca el palet reservado para esa OT y descuenta.

**Opción C — Solo trazabilidad documental (MVP mínimo):**
No se descuenta en tiempo real. Solo se registra qué palet se asignó a qué OT.
El stock se ajusta periódicamente (como ahora con Emma/Ramón).

Recomendación MVP: **Opción C primero**, evolucionando a B.
La Opción A requiere que el maquinista interactúe más con Minerva en planta.

### 7.5 Gestión de sobrantes

Al cerrar una OT (Bloque 6 — `pendiente_revision` → `producida`):
- Si la OT tenía palets reservados con hojas restantes:
  - Minerva sugiere: "Sobraron X hojas del palet 10204. ¿Crear cartela de stock libre?"
  - Si sí → nuevo registro en `prod_stock_palets` con `estado = disponible`
  - Si no → ajuste manual posterior

---

## 8. Relación con otros bloques

| Bloque | Relación |
|--------|----------|
| **Bloque 6** (Histórico/Producidas) | Al cerrar OT → detectar sobrante → generar cartela stock libre |
| **Bloque 7** (Expedición) | Trazabilidad: qué material entró → qué producto salió |
| **Bloque 8** (OT contenedor/hijas) | Las hijas pueden compartir material del contenedor o tener el suyo |
| **FSC** | El material recibido tiene lote de proveedor → trazabilidad FSC completa |
| **Maestro de artículos** | `codigo_articulo` de la cartela puede enlazarse al maestro de referencias |

---

## 9. Preguntas abiertas (responder con Emma / Ramón / Juan)

1. ¿Emma siempre sabe a qué OT va el material al recepcionar, o a veces llega
   material "genérico" sin OT asignada?
2. ¿Cuántos palets llegan habitualmente en un albarán? ¿5? ¿20? ¿más?
3. ¿Juan necesita ver las cartelas en una tablet/móvil en almacén, o solo papel?
4. ¿El sobrante hoy lo apunta alguien o simplemente queda en almacén sin registrar?
5. ¿Hay material que se compra para stock (sin OT asignada desde el principio)?
6. ¿Cuándo el maquinista necesita más material del previsto, quién se lo trae
   y quién decide qué palet usar?
7. ¿Importa registrar el lote del proveedor para FSC? ¿Con qué detalle?
8. ¿Hay material que llega cortado (ya no es 72×102 sino 51×72) o siempre
   llega en el formato de compra?
9. ¿Un palet puede usarse para varias OTs distintas (material compartido)?
10. ¿Cuál es el ID Stock más alto actual en Optimus? (Para saber desde dónde
    arrancar la numeración en Minerva)

---

## 10. Lo que NO haría en el MVP

- No intentar sincronizar stock en tiempo real desde el primer día
- No obligar al maquinista a escanear/registrar consumos en planta hasta que
  haya tablet y flujo probado
- No replicar exactamente el modelo de Optimus (que tiene complejidades heredadas)
- No bloquear la producción si el stock no cuadra — avisos, no bloqueos

---

## 11. Orden de trabajo recomendado

1. 📋 Audio/notas de Emma — entender su flujo real exacto
2. 📋 Responder las 10 preguntas abiertas (§9)
3. 📋 Fase 9.0 — migración SQL: `prod_recepciones_material` + `prod_stock_palets`
4. 📋 Fase 9.1 — UI recepción + generación de cartelas imprimibles
5. 📋 Fase 9.2 — Consulta de stock disponible
6. 📋 Fase 9.3 — Integración con Bloque 6 (sobrantes al cerrar OT)
7. 📋 Fase 9.4 — Consumos y movimientos (cuando planta esté lista)

---

## 12. Nota sobre el MRP actual de Minerva

Hay un primer intento de **Almacén MRP** en la app (`src/components/produccion/almacen/almacen-mrp-page.tsx`)
sobre `almacen_materiales` + vista `almacen_control_inteligente` (stock agregado por material, no por palet).

**No se usa en producción** porque el stock se descuadra rápidamente si no se alimenta diariamente.

**Decisión pendiente:** Bloque 9 debe **reemplazar** o **sustituir el modelo** del MRP actual — no convivir
sin definir fuente de verdad. El nuevo modelo es **por palet/cartela** (`prod_stock_palets`), no solo
cantidad global por código de artículo.

**Coexistencia temporal posible:** mantener MRP como vista agregada derivada de cartelas (suma de
`cantidad_actual` por `codigo_articulo`) cuando exista el dato; hasta entonces el MRP legacy queda congelado.

---

## 13. Historial del documento

| Fecha | Cambio |
|-------|--------|
| 18 jun 2026 | Primer briefing (Claude + análisis Optimus/cartelas CARPAPSA). Modelo MVP, UX, preguntas planta, roadmap 9.0–9.4. |
| 18 jun 2026 | Registrado en repo; enlazado desde contexto maestro y roadmap global. |

### Implementación (rellenar al avanzar)

| Fase | Estado | Notas |
|------|--------|-------|
| 9.0 — SQL `prod_recepciones_material` + `prod_stock_palets` + movimientos | ⏳ | |
| 9.1 — UI recepción + cartelas imprimibles | ⏳ | |
| 9.2 — Consulta stock disponible | ⏳ | |
| 9.3 — Sobrantes al cerrar OT (Bloque 6) | ⏳ | |
| 9.4 — Consumos y movimientos en planta | ⏳ | |
