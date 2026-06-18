# MINERVA — Briefing Bloque 9: Gestión de Material y Cartelas

> Documento de diseño y toma de decisiones (**fuente de verdad del Bloque 9**).
> Tema: recepción de material, cartelas de palet, stock libre y trazabilidad.
> Complementa `MINERVA_HUB_CONTEXTO_MAESTRO.md`, `FASES_HOJA_RUTA_DIGITAL.md` y briefings Bloques 6 y 7.
>
> **Estado:** 📋 Diseño / brainstorming — **sin implementación**.
> **Origen:** Optimus + cartelas CARPAPSA (15 jun 2026).
> **Actualizado:** 18 jun 2026 — albaranes reales CARPAPSA (B26-2525) y Papers Tordera (AV26-04186/179/187); §3b.
> **PENDIENTE:** audio/notas de Emma (administrativa).

**Relacionado:** sobrantes → Bloque 6 · expedición → Bloque 7 · material contenedor/hijas → Bloque 8 · FSC → maestro artículos.

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

## 3b. Insights de albaranes reales (18 jun 2026)

Albaranes analizados hoy: CARPAPSA (B26-2525) + Papers Tordera (AV26-04186, AV26-04179, AV26-04187).

### Insight 1 — Material que llega directamente a STOCK (sin OT asignada)
Confirmado con albaranes de Papers Tordera del 18 jun:
- OFFSET BLANC 102×72 200gr → **STOCK** → cartela 10.299
- OFFSET BLANC 70×100 300gr → **STOCK** → cartela 10.298

El stock libre al recepcionar NO es excepcional — es un caso habitual.
Emma anota "STOCK" en el albarán cuando no hay OT asignada.
Minerva debe soportarlo desde el primer día, no como caso especial.

### Insight 2 — Dos IDs distintos en Optimus
En Optimus coexisten dos contadores:
- **ID Stock** (cartela): 10295, 10296, 10297... → identifica el palet físico
- **ID Entrada**: 6027, 6028, 6029, 6095, 6096... → identifica la entrada de almacén

Un albarán de proveedor = 1 entrada (o varias si se divide). Cada palet = 1 ID Stock.
En Minerva se puede simplificar a un solo ID por palet, referenciando la recepción.

**ID Stock más alto conocido hoy: ~10.299** → arrancar Minerva desde 10.300 o superior.

### Insight 3 — Proveedores dan cantidad en KILOS, no en hojas
Papers Tordera entrega en kilos (35 kg, 29,38 kg, 52,50 kg).
Emma tiene que convertir manualmente. **Minerva puede automatizar esto:**

```
hojas = (kilos × 1.000) / (gramaje × formato_m2)
```

Ejemplos reales:
- OFFSET 70×100 100gr, 35 kg → formato_m2 = 0,70 × 1,00 = 0,70 → **500 hojas**
- OFFSET 102×72 200gr, 29,38 kg → formato_m2 = 1,02 × 0,72 = 0,734 → **200 hojas aprox.**
- OFFSET 70×100 300gr, 52,50 kg → formato_m2 = 0,70 → **250 hojas**

El formulario de recepción debe tener:
- Campo cantidad: en hojas O en kilos (toggle)
- Si kilos: calculadora automática con gramaje + formato → hojas resultantes
- Confirmación antes de guardar

### Insight 4 — El proveedor no siempre indica la OT en su albarán
- CARPAPSA: sí indica el pedido/OT en el albarán
- Papers Tordera: NO indica OT — Emma la anota a mano con rotulador/bolígrafo

Minerva debe permitir añadir la OT manualmente al recepcionar, no depender de
que el proveedor la informe.

### Insight 5 — Un albarán puede generar cartelas para distintas OTs
CARPAPSA B26-2525: 2 palets → 2 cartelas (10295, 10296), ambas para OT 36023.
Pero en otros albaranes (como G6-3305 de junio anterior) venían materiales
para 3 OTs distintas en el mismo envío.

La UI de recepción debe permitir:
1. Cabecera de recepción: proveedor + nº albarán
2. N líneas de material, cada una con su OT destino (o "Stock libre")
3. Cada línea genera sus cartelas según nº de palets

### Insight 6 — FSC/PEFC en el albarán del proveedor
CARPAPSA indica claramente: "ALLYKING 100% PEFC" con certificado FSC C116784.
El albarán lleva el número de registro de productor y certificación.
Minerva debe capturar estos datos al recepcionar para la trazabilidad FSC:
- `fsc_certificado_proveedor` (ej: FSC C116784)
- `pefc_certificado_proveedor`
- `es_fsc` / `es_pefc` (boolean)

Esto enlaza con el campo `fsc` del maestro de artículos y del despacho de OTs.

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
| `cantidad_kilos` | numeric | Kilos recibidos según albarán proveedor (si aplica) |
| `cantidad_inicial` | integer | Hojas al recepcionar (calculado o introducido) |
| `cantidad_actual` | integer | Hojas restantes (se descuenta al consumir) |
| `ot_destino_numero` | text | OT asignada (null si stock libre) |
| `estado` | enum | `reservado` / `disponible` / `consumido` / `parcial` |
| `ref_lote` | text | Ej: "36016 - TEIKIT" |
| `es_fsc` | boolean | Material certificado FSC |
| `es_pefc` | boolean | Material certificado PEFC |
| `fsc_certificado_proveedor` | text | Nº certificado FSC del proveedor (ej: FSC C116784) |
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
   - OT destino (opcional — puede dejarse como "Stock libre")
   - Cantidad: toggle **hojas / kilos**
     - Si kilos: calculadora automática (kilos × 1000) / (gramaje × formato_m2) → hojas
     - Confirmación antes de guardar
   - Nº de palets (Minerva divide la cantidad entre palets)
   - FSC/PEFC: checkbox + nº certificado proveedor si aplica
3. Minerva genera N cartelas (1 por palet) con ID Stock secuencial
4. Imprimir cartelas → Juan las pega en los palets

**Nota**: el proveedor no siempre indica la OT en su albarán (Papers Tordera no lo hace).
Emma la añade manualmente. El campo OT destino es siempre editable.

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

**Respondidas con albaranes del 18 jun:**
- ✅ ¿Hay material que se compra para stock sin OT? → **SÍ**, Papers Tordera lo confirma
- ✅ ¿ID Stock más alto actual? → **~10.299** (arrancar Minerva desde 10.300+)
- ✅ ¿Los proveedores siempre indican la OT? → **NO** (Papers Tordera no; CARPAPSA sí)
- ✅ ¿Cantidad en kilos o hojas? → **Depende del proveedor** (Papers Tordera en kilos)
- ✅ ¿FSC/PEFC en albarán proveedor? → **SÍ**, CARPAPSA indica certificado

**Pendientes:**
1. ¿Cuántos palets llegan habitualmente en un albarán? ¿5? ¿20? ¿más?
2. ¿Juan necesita ver las cartelas en tablet/móvil en almacén, o solo papel?
3. ¿El sobrante hoy lo apunta alguien o simplemente queda en almacén sin registrar?
4. ¿Cuándo el maquinista necesita más material del previsto, quién decide qué palet usar?
5. ¿Hay material que llega ya cortado (51×72) o siempre en formato de compra?
6. ¿Un palet puede usarse para varias OTs distintas (material compartido)?
7. ¿Emma trabaja desde su PC o necesita acceso desde tablet/móvil?
8. ¿Cuántos albaranes de proveedor recibe Emma de media por día/semana?

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
2. 📋 Responder las **8 preguntas pendientes** de §9 (5 ya respondidas con albaranes 18 jun)
3. 📋 Fase 9.0 — migración SQL: `prod_recepciones_material` + `prod_stock_palets`
4. 📋 Fase 9.1 — UI recepción + generación de cartelas imprimibles
5. 📋 Fase 9.2 — Consulta de stock disponible
6. 📋 Fase 9.3 — Integración con Bloque 6 (sobrantes al cerrar OT)
7. 📋 Fase 9.4 — Consumos y movimientos (cuando planta esté lista)

---

## 12. Nota sobre el MRP actual de Minerva

Hay un primer intento de **Almacén MRP** en la app (`src/components/produccion/almacen/almacen-mrp-page.tsx`)
sobre `almacen_materiales` + vista `almacen_control_inteligente` (stock agregado por material, no por palet).

**No se usa en producción** porque el stock se descuadra si no se alimenta a diario.

**Decisión pendiente:** Bloque 9 debe **reemplazar** el modelo MRP legacy — no convivir sin fuente de verdad.
El nuevo modelo es **por palet/cartela** (`prod_stock_palets`).

---

## 13. Historial del documento

| Fecha | Cambio |
|-------|--------|
| 18 jun 2026 | Primer briefing (Claude + cartelas CARPAPSA G6-3305). Modelo MVP, UX, roadmap 9.0–9.4. |
| 18 jun 2026 | Registrado en repo; enlazado desde contexto maestro y roadmap global. |
| 18 jun 2026 | **§3b** — insights albaranes CARPAPSA B26-2525 + Papers Tordera: stock al recepcionar, kilos→hojas, ID Stock ~10.299, FSC/PEFC, OT manual. Campos ampliados en modelo (`cantidad_kilos`, `es_fsc`, `es_pefc`, `fsc_certificado_proveedor`). §9 parcialmente respondida. |

### Implementación (rellenar al avanzar)

| Fase | Estado | Notas |
|------|--------|-------|
| 9.0 — SQL recepciones + palets + movimientos | ⏳ | Incluir campos FSC y `cantidad_kilos` |
| 9.1 — UI recepción + cartelas imprimibles | ⏳ | Toggle hojas/kilos + calculadora |
| 9.2 — Consulta stock disponible | ⏳ | |
| 9.3 — Sobrantes al cerrar OT (Bloque 6) | ⏳ | |
| 9.4 — Consumos y movimientos en planta | ⏳ | |
