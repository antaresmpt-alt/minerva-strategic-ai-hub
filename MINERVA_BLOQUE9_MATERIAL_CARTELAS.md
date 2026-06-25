# MINERVA — Briefing Bloque 9: Gestión de Material y Cartelas

> Documento de diseño y toma de decisiones (**fuente de verdad del Bloque 9**).
> Tema: recepción de material, cartelas de palet, stock libre y trazabilidad.
> Complementa `MINERVA_HUB_CONTEXTO_MAESTRO.md`, `FASES_HOJA_RUTA_DIGITAL.md` y briefings Bloques 6 y 7.
>
> **Estado:** ✅ **9.0 + 9.1 + 9.1b + 9.4-preview** (25 jun 2026) — cartelas en almacén + enlace documental al **cerrar impresión** (procesos 1 y 2) → hoja de ruta y PDF. Smoke: cartelas #10310–#10313; cierre OT **35858** con ID Stock en HR. **Pendiente:** 9.2 Stock, 9.3 sobrantes, **9.4 operativo** (movimientos + descuento `cantidad_actual`).
> **Origen:** Optimus + cartelas CARPAPSA (15 jun 2026).
> **Actualizado:** 25 jun 2026 — 9.4-preview en mesa ejecución; wizard 3 tabs (Albarán · Palet · Resumen); ver §15.5 y `docs/referencias/cartelas-optimus-campo.md`.
> **PENDIENTE:** H1/H2 recuento global. Ubicación por filas de material (catálogo UI sin definir en planta). `codigo_articulo` en wizard. Ajuste impresión A6 física vs A4 PDF.

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

> **Objetivo Minerva (24 jun, validado con Ramón):** Juan en **Muelle** (recepción rápida + albarán). **Emma o Ramón** cartelan (paso separado). El §1–§2 describen el **hoy en Optimus**; el diseño objetivo está en §7 y §3g.

---

## 2. Flujo real documentado (18 jun 2026) — Optimus hoy

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

**ID Stock más alto conocido hoy: ~10.307** (Ramón, 22 jun) → arrancar Minerva desde **10.310** (margen; verificar justo antes del deploy de 9.0).

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

> **Tabla de referencia → ver §3d** (tabla completa de 7 albaranes). La tabla corta de 4 que había aquí quedó obsoleta tras ampliarla en §3d.

---

## 3c. Respuestas de Ramón (22 jun 2026)

Cuestionario enviado a Ramón (encargado de planta/logística). Respuestas recibidas por escrito.

### P1 — ¿Emma siempre sabe a qué OT va el material al recepcionar?
> "Cada pedido lleva un número de OT ligado al material. Normalmente viene indicado en el albarán. Si no viene es porque no se ha indicado en el pedido, porque el proveedor no lo ha indicado o porque es un material para STOCK sin pedido."

✅ Confirma lo ya documentado (§3b Insight 4). El campo OT siempre manual/editable. Sin novedad de diseño.

### P2 — ¿Cuántos palets llegan habitualmente en un albarán?
> "En un albarán pueden llegar más de 1 referencia de material y más de un palet."

No da número concreto. **Implicación de diseño:** la UI de recepción de Emma debe escalar bien — la lista de líneas puede ser larga. Formulario en modo "añadir líneas dinámicamente", no un formulario fijo de N campos.

### P3 — ¿Juan necesita ver las cartelas en tablet/móvil, o solo papel?
> "Juan debería saber qué hay pedido para darle entrada en el almacén asignándole un número de reserva (cartela) que asigne ese material a una OT concreta o destinado a stock."

⚠️ **Matiz importante:** Ramón no habla de tablet/papel — describe a Juan con un rol más activo del que teníamos documentado. Juan no es solo "el que imprime y pega": también *da entrada* y *asigna la cartela*. Esto abre la pregunta de si en Minerva Juan tendrá acceso directo (tablet en almacén) o si sigue siendo Emma quien gestiona el sistema y Juan solo imprime papel. **Pendiente de aclarar** (ver §9).

### P4 — ¿El sobrante hoy lo apunta alguien?
> "Cuando se imprime un trabajo (...) el maquinista descuenta el material usando el número de cartela. Si esa cartela marca 3.500 hojas y se imprimen 3.000, en el stock de Optimus relacionado con esa cartela se verá que quedan 500h. Esa cartela se guarda para las 500h sobrantes y se corrige a mano (se tacha 3.500 y se escribe 500)."

**Clave:** en Optimus no se crea una cartela nueva para el sobrante — se reutiliza la misma cartela física corrigiendo la cantidad a mano. Minerva lo hará diferente (movimiento de ajuste, `cantidad_actual` actualizada) porque es más limpio y trazable. **La cartela imprimible debe mostrar claramente la cantidad actual**, no solo la inicial.

### P5 — ¿Hay material que se compra para stock (sin OT)?
> "Sí, alguna vez. Para digital."

✅ Confirma §3b Insight 1. Sin novedad.

### P6 — ¿Quién decide qué palet usar cuando el maquinista necesita más material?
> "Hasta ahora, Ramón. Ahora, Juan (que pregunta a Ramón si puede usar ese material para asegurarse de que no está reservado)."

**Implicación de diseño:** Juan necesita consultar el estado de los palets (reservado vs. libre) antes de moverlos. La vista **Almacén → Stock** (fase 9.2) es necesaria y Juan debe tener acceso a ella como mínimo en modo lectura. La consulta "¿está este palet reservado?" tiene que ser rápida y obvia.

### P7 — ¿Importa registrar el lote del proveedor para FSC?
> "El material ya está entrado en 'Maestro artículos' como FSC, y ese es el que se debería escoger para entrar el material y que en la cartela aparezca especificado. No siempre se hace, pero se puede hacer."

**Implicación de diseño:** al seleccionar el artículo en la recepción, Minerva debe **heredar automáticamente** el flag FSC/PEFC del maestro de artículos (sin que Emma tenga que recordarlo). El campo será editable pero vendrá pre-marcado si el artículo del maestro tiene FSC. Esto también reduce errores de omisión.

### P8 — ¿Hay material que llega ya cortado (ej: 51×72)?
> "Hay materiales que llegan estándar y muchos materiales que llegan a corte. Medias hojas de materiales estándar no suelen llegar."

⚠️ **Implicación de diseño:** el campo `formato` del palet **no puede heredarse ciegamente del maestro de artículos** — en la UI de recepción Emma debe poder editarlo. El artículo del maestro puede ser "72×102" pero el palet que llega puede ser "51×72". El formato real del palet es el que se imprime en la cartela.

### P9 — ¿Un palet puede usarse para varias OTs distintas (material compartido)?
> "Sí. Es bastante frecuente. Por eso el maquinista o Miguel corrigen la cantidad de hojas de la cartela, porque así se sabe lo que sobra para otras OT."

⚠️ **Cambio de modelo (ver §6 actualizado):** esto confirma que `ot_destino_numero` en la cartela no puede ser "OT exclusiva". El campo pasa a ser **"OT prevista al recepcionar"** (la del pedido original). La trazabilidad real de qué OT consumió qué cantidad vive en `prod_stock_movimientos`, no en la cabecera del palet.

### P10 — ¿ID Stock más alto actual en Optimus?
> "Hoy estaba en 10.307, pero habría que mirar."

**Actualizado:** arrancar Minerva desde **10.310** como mínimo (margen razonable sobre 10.307). Revisar el valor real justo antes de hacer el deploy de 9.0.

---

## 3d. Albaranes nuevos (22 jun 2026)

Tres albaranes adicionales analizados. Amplían la muestra y aportan casos nuevos.

### Albarán PROEMBASA (02/095606) — 18 jun 2026

| Campo | Valor |
|-------|-------|
| Proveedor | PROEMBASA (Sta. Margarida de Montbui) |
| Material | PRONATUR 300 GR FSC 100% RECICLADO |
| Formato | 505×870 mm (= 50,5×87 cm) — **formato no estándar, a corte** |
| Cantidad | 0,185 **Tn** — nuevo caso: proveedor usa toneladas, no kilos |
| Hojas | 1.400 (el albarán las calcula — lote PRO26F10085) |
| OT | **35929-B** (con sufijo "-B") — anotada a mano |
| Nombre trabajo | "Caixa Pizza Miramar" |
| ID Stock | **10.306** / ID Entrada **6035** |
| FSC | Sí — certificado BMC-COC-007045 |

**Insights nuevos:**
- **Toneladas como unidad**: el toggle de cantidad necesita 3 opciones: hojas / kilos / toneladas (o conversión automática Tn → kg × 1000 antes de calcular hojas).
- **PROEMBASA calcula las hojas en el albarán**: cuando el proveedor las indica, Minerva debe permitir introducirlas directamente sin pasar por la calculadora.
- **OT con sufijo alfanumérico** (35929-B): confirma que `ot_destino_numero` debe ser `text` libre.

### Albarán Comart (443799) — 18 jun 2026

| Campo | Valor |
|-------|-------|
| Proveedor | Comart (Montornès del Vallès) |
| Material | PAPEL KRAFTLINER FSC® 225 GR |
| Formato | 57×97 cm — **a corte** |
| Cantidad | 0,982 Tn total → 2 palets × 0,491 Tn |
| Hojas | 3.940 por palet / 7.880 total |
| Lotes | Palet 1: lote 3238711 / Palet 2: lote 3238712 — **lote diferente por palet** |
| OT(s) | **35946 y 35986** — dos OTs en el mismo albarán, anotadas a mano "CATÀS" |
| ID Stock | **10.301** (ID 6032) y **10.302** (ID 6033) |
| FSC | FSC Mix Credit CU-COC-821792 + PEFC/43-00014 |

**Insights nuevos:**
- **1 albarán, 2 palets, 2 OTs distintas**: el proveedor escribe "Su pedido nº: 35946-35986" en una sola línea. Emma desglosa manualmente al cartelar. Minerva debe soportarlo.
- **Lote de proveedor por palet, no por albarán**: `ref_lote_proveedor` va en `prod_stock_palets`. Ya diseñado así — confirmado.

### Albarán Papers Tordera (AV26-04239) — 19 jun 2026

| Campo | Valor |
|-------|-------|
| Proveedor | Papers Tordera |
| Material | ESTUCAT MAT 135 gr |
| Formato | 100×70 cm |
| Cantidad | 75,60 K (kilos) |
| Hojas | ~2.500 (calcular con fórmula) |
| OT | **36054** — anotada a mano "Etiquetes Chocofruits Bubó" |
| ID Stock | **10.304** / ID Entrada **6034** |
| FSC | No indica |

### Tabla resumen completa — 7 albaranes de referencia

| Nº albarán | Proveedor | Material | Formato | Cant. | Hojas | OT(s) | ID Stock | Lote prov. | FSC |
|---|---|---|---|---|---|---|---|---|---|
| AV26-04186 | Papers Tordera | OFFSET 100gr | 70×100 | 35 K | ~500 | 36033 | 10.297 | — | No |
| AV26-04179 | Papers Tordera | OFFSET 200gr | 102×72 | 29,38 K | ~200 | STOCK | 10.299 | — | No |
| AV26-04187 | Papers Tordera | OFFSET 300gr | 70×100 | 52,50 K | ~250 | STOCK | 10.298 | — | No |
| B26-2525 | CARPAPSA | ALLYKING 295gr | 60×102 | 550 K | 2×1.500 | 36023 | 10.295–96 | — | PEFC |
| 02/095606 | PROEMBASA | PRONATUR 300gr | 50,5×87 | 0,185 Tn | 1.400 | 35929-B | 10.306 | PRO26F10085 | FSC |
| 443799 | Comart | KRAFTLINER 225gr | 57×97 | 0,982 Tn | 2×3.940 | 35946 / 35986 | 10.301–02 | 3238711 / 3238712 | FSC+PEFC |
| AV26-04239 | Papers Tordera | ESTUCAT MAT 135gr | 100×70 | 75,60 K | ~2.500 | 36054 | 10.304 | — | No |

---

## 3e. Emails de pedido de Jordi (contexto del flujo de compra)

Jordi Gayà hace los pedidos por email a los comerciales de cada proveedor, copiando siempre a Ramón y Gemma. Estos emails son la **primera documentación** del pedido — antes de que exista ninguna OC en el sistema.

### Patrones observados

**Patrón 1 — Una OT = una línea de pedido** (caso limpio):
Papers Tordera, Union Papelera, Eurokarpa. Cada línea del email = una OT con su material.
```
OT 35833 - 250 fulles Paper Estucat Mate 300g 70x100
OT 35846 - 250 FULLES ESTUCADO BRILLO 65x90 350gr
```

**Patrón 2 — Varias OTs agrupadas bajo una comanda** (el caso problemático):
```
comanda 35834 - 35851 - 35856   4.925 fulles Zenith 295gr 65x92
```
Jordi agrupa 3 OTs porque el material es idéntico y quiere un solo pedido. CARPAPSA recibe "4.925 hojas" sin saber que van a 3 OTs. El albarán llega con una línea y varios palets sin desglose por OT. Juan tiene que asignar manualmente.

**Patrón 3 — Una comanda con varias referencias distintas** (mismo proveedor, materiales distintos):
```
comanda 35869
11.000 fulles folding COMCOTE 310gr 70,5x90
11.000 fulles folding COMCOTE 260gr 70,5x90
```

**Patrón 4 — Jordi especifica número de palets** (poco frecuente):
```
comanda 35862   750 fulles (1 palet) kraft liner 300gr 72x102
```

### Implicaciones para Minerva

- El email de Jordi **no entra en Minerva directamente**. Ramón/Gemma crean las OCs (una por OT).
- El agrupamiento de Jordi (3 OTs en 1 comanda) es su forma de relacionarse con el proveedor, no la estructura de Minerva. **En Minerva, cada OT tiene sus propias OCs.**
- Cuando llega el albarán de CARPAPSA con 4.925 hojas para 3 OTs, Juan necesita ver las OCs pendientes de ese proveedor/material para poder asignar los palets. **Minerva le presenta ese contexto; Juan decide el reparto.**
- El nombre del trabajo ("Caixa Pizza Miramar", "CATÀS") aparece anotado a mano en el albarán. En Minerva viene de la OT — no hay que introducirlo manualmente.

---

## 3f. Ficha de acabados externos de Rita (flujo paralelo documentado)

**Rita** (responsable de etiquetas y digital) gestiona un flujo de trabajo completamente en papel que Optimus no cubre. Rellena una ficha física con cabecera de Minerva y la entrega a Patricia, Hugo y Paula para ejecutar:

- Plastificado digital (PP Mate / PP Brillo / Soft Touch)
- Otros acabados externos

**Campos de la ficha:** OT · Faena (nombre trabajo) · Cantidad de hojas · Tamaño de hojas · 1 cara / 2 caras · Observaciones.

**Por qué existe:** Rita se ha fabricado su propio sistema porque Optimus no le da visibilidad del itinerario de la OT en formato operativo.

**Relación con Minerva:** Este flujo es estructuralmente idéntico a un paso de itinerario (Bloque 8 — paso de "plastificado" o "acabado externo"). Si el itinerario está bien construido, ese paso podría generar automáticamente la ficha que Rita necesita. **No es Bloque 9 — es un bloque posterior** (módulo Externos/Flujos). Se documenta aquí como necesidad real identificada.

---

## 3g. Cuestionario Ramón respondido (23–24 jun 2026)

> Fuente completa: `MINERVA_CUESTIONARIO_CARTELAS_RAMON.md`. Este apartado resume **decisiones que cambian el diseño**.

### Regla de oro — cartela = palet

**CARTELA = IDENTIFICADOR DE PALET INDIVIDUAL** (1 ID Stock = 1 palet físico).

- Un palet puede servir a **varias OTs** (ej. 300 + 600 + 500 hojas “mentales” para OT1/2/3 + 400 sobrante en el mismo palet).
- **No** se desglosa cantidad por OT en la cartela — el maquinista conoce las hojas brutas de la OT.
- En físico se pegan **2 copias iguales** de la misma cartela (por pérdida), no dos cartelas con datos distintos.
- Trazabilidad fina (qué OT consumió cuánto de qué ID Stock) → **`prod_stock_movimientos`**, no la cabecera de la cartela.

### Roles (corrección 24 jun)

| Persona | Muelle | Cartelas | Consumo / stock |
|---------|--------|----------|-----------------|
| **Juan** | ✅ Recepciona, sube albarán enseguida | ❌ **Nunca** cartela | Consulta stock; entrega material (con traspaso autorizado) |
| **Emma / Ramón** | Pueden | ✅ Crean cartelas e imprimen | Supervisión, correcciones, autorización traspasos (Ramón) |
| **Maquinista** | — | — | Descuenta en planta por ID Stock + OT **tras cada trabajo** |
| **Otros** | — | ❌ No conviene ampliar | — |

### Riesgos operativos a cubrir en MVP

1. **Doble entrada de albarán** (Emma por mail + Ramón al llegar físico) → antiduplicado en Minerva por `nota_entrega` / albarán proveedor.
2. **Consumo multi-palet** en urgencias: un trabajo puede descontar **varios ID Stock**.
3. **No** wizard “pasar sobrante a stock libre” al cerrar OT si el palet sigue referenciando otras OTs (J2).

### Barco / OT contenedor (I1 — WhatsApp 24 jun)

| Caso | Cartelado |
|------|-----------|
| Hijas con **mismo material** | **1 cartela por palet**, OTs hijas listadas en la cartela |
| Hijas con **material distinto** (ej. cara 350g / dorso 250g) | **1 cartela por material distinto** (cada palet/material su ID Stock) |

La compra puede seguir siendo **una sola en el padre** (Bloque 8); el cartelado obedece a palet + material, no a “una cartela por hija”.

### Ubicación en almacén (C3)

Filas por familia de material: ALLYKING, ZENITH, COMCOTE/TPWHITE, GRISES, GRISES PAPRINSA, KRAFTLINER, ESTUCADOS, PAPELES ESPECIALES Y OFFSET. Campo `ubicacion_fila` (o catálogo) en consulta de stock — MVP puede ser texto; no bloquea cartelado.

### Palets post-guillotina (C5)

Sobrantes de corte no impreso deben **entrarse en stock con cartela** (flujo futuro enlazado a salida guillotina / entrada manual).

### Prioridad MVP según Ramón (I3)

1. Ver material **disponible / no reservado** para ninguna OT.
2. Cartelas con **ID Stock** claras e impresión fiable.
3. **Descuento tras cada trabajo** (imprescindible día 1 del piloto — E4).

### Arranque — piloto paralelo (H3)

Ver **§13c**. No corte limpio: Optimus sigue para el grueso del almacén; **10–20 OTs** piloto en Minerva con ciclo completo.

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

**En Optimus hoy:** se tacha la cantidad en la cartela física y se corrige a mano (§3c P4). No se crea cartela nueva.

**En Minerva — un solo ID Stock, cantidad que muta:**

| Momento | Qué pasa |
|---------|----------|
| **Al consumir** | Maquinista registra consumo por OT + ID Stock; `cantidad_actual` baja. Puede consumir **varios ID Stock** en un mismo trabajo urgente. |
| **Sobrante en palet** | **Misma cartela** (mismo ID Stock): movimiento `ajuste`/`consumo`, `cantidad_actual` actualizada. **No** se crea fila nueva. Cartela imprimible muestra **cantidad actual**. |
| **Varias OTs en el palet** | Al cerrar OT **no** sugerir automáticamente “pasar a stock libre”: las hojas restantes pueden ser para **otra OT ya listada** en la cartela (§3g J2). |

Regla: **Opción A del diseño anterior (partir palet en N cartelas al recepcionar) queda descartada** tras cuestionario 24 jun. Un palet = una cartela; el reparto por OT vive en movimientos, no en líneas de cartela.

---

## 6. Modelo de datos propuesto (MVP)

### ⚠️ `prod_recepciones_material` ya existe — extender, no duplicar

Minerva **ya tiene** recepción en muelle + fotos (operativo hoy):

| Pieza | Dónde | Qué hace |
|-------|--------|----------|
| UI muelle | `src/components/produccion/muelle/muelle-recepcion-page.tsx` | Marca compra recibida, albarán, hojas, palets, **foto cámara** |
| Tabla | `prod_recepciones_material` | Una fila por evento de recepción (`compra_id` → `prod_compra_material`) |
| Fotos | `prod_recepciones_fotos` + bucket `recepciones-fotos` | Imágenes del albarán en muelle |
| Consulta admin | `compras-material-page.tsx` | Modal «Fotos de recepción (muelle)» |

**Decisión Bloque 9:** el **núcleo nuevo** es `prod_stock_palets` (cartelas) + `prod_stock_movimientos`.
La tabla `prod_recepciones_material` se **reutiliza y amplía** (FK desde cartela, campos FSC/kilos si faltan) — no crear una segunda tabla homónima.

**Gap actual:** el muelle va por **compra/OC**; no cubre aún STOCK sin OT ni albarán multi-línea (§3b). Eso entra en fases 9.0–9.4 (administración) y mejoras 9.5+ (puente muelle → Emma).

### Relación OC → OT confirmada (22 jun 2026)

En Minerva la relación es **1 OT → N OCs** (no N:M):
- Una OT puede tener varias OCs: portada (300gr) + tripa (offset 90gr); cartón impreso + microcanal.
- Una OC es siempre para **una sola OT** en Minerva.
- El agrupamiento de Jordi en los emails (3 OTs en 1 comanda al proveedor) es su forma de pedir, no la estructura de datos. Ramón/Gemma crean una OC por OT al registrar el pedido.

Esto simplifica el modelo: `prod_ot` → `prod_compra_material` es 1:N, sin tabla intermedia.

### Cartela = Palet físico (modelo validado 24 jun 2026)

**Una fila en `prod_stock_palets` = 1 cartela = 1 palet físico = 1 `id_stock`.**

- Varias OTs pueden referenciarse en la **misma cartela** (tabla puente `prod_stock_palet_ots` o campo JSON `ots_referencia` — a decidir en 9.0).
- **No** hay cantidad por OT en la cartela (Ramón D1).
- ~~N cartelas por palet con `palet_fisico_ref`~~ — **deprecado** en favor de 1:1 palet/cartela.
- Impresión: opción **“2 copias”** de la misma cartela para pegar en el palet (C1).

### Tabla nueva `prod_stock_palets` (las cartelas) — **corazón del Bloque 9**
Cada fila = 1 palet identificado con un ID Stock.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `id_stock` | integer | Número de cartela (autoincremental desde **10.310**) |
| `tipo_stock` | enum | `materia_prima` (MVP) · `semielaborado` · `producto_terminado` · `consumible`. Permite extender el mismo motor a futuras capas sin rehacer SQL (ver §14). MVP solo usa `materia_prima`. |
| `unidad` | enum | `hojas` (MVP) · `uds` · `kg` · `m` … Unidad de `cantidad_inicial`/`cantidad_actual`. MVP solo usa `hojas`. |
| `recepcion_id` | FK nullable | → `prod_recepciones_material` (si viene del muelle/compra) |
| `compra_id` | FK nullable | → `prod_compra_material` (atajo si no hay recepción muelle aún) |
| `codigo_articulo` | text | Código material (PHFOAL235072001020) |
| `descripcion_material` | text | Snapshot legible |
| `material_nombre` | text | Ej: "Folding" / "Zenith" / "Allyking" |
| `gramaje` | integer | gr/m2 |
| `formato` | text | Ej: "72×102 cm". **Editable al recepcionar** — puede diferir del maestro de artículos si el material llega a corte (ej: 51×72). |
| `marca` | text | Ej: "ALLYKING" / "ZENITH" |
| `cantidad_peso` | numeric | Peso recibido según albarán proveedor (si aplica) |
| `cantidad_peso_unidad` | enum | `kg` / `tn` — unidad del peso indicado por el proveedor. PROEMBASA usa Tn, Papers Tordera usa Kg. |
| `cantidad_inicial` | integer | Hojas al recepcionar (calculado o introducido) |
| `cantidad_actual` | integer | Hojas restantes (se descuenta al consumir) |
| `ot_destino_numero` | text nullable | **Legacy / stock libre:** null = disponible; si una sola OT prevista al cartelar. Para varias OTs usar `prod_stock_palet_ots` (§3g). |
| `ots_referencia` | text[] o FK N:M | OT(s) previstas al cartelar (sin cantidad por OT). Ej. `{98010-01, 98010-02, 98010-03}`. |
| `estado` | enum | `reservado` / `disponible` / `consumido` / `parcial` |
| `ubicacion_fila` | text nullable | Fila de almacén (ALLYKING, ZENITH, … — §3g C3) |
| ~~`palet_fisico_ref`~~ | — | **Deprecado** (24 jun): 1 cartela = 1 palet; ya no agrupa N cartelas. |
| `ref_lote_proveedor` | text | Nº lote del proveedor por palet (ej: 3238711). Para trazabilidad FSC. Distinto por palet incluso en mismo albarán (ver Comart §3d). |
| `ref_lote` | text | OT + nombre trabajo (ej: "36016 - TEIKIT") — campo legacy Optimus, mantener para compatibilidad. |
| `es_fsc` | boolean | Material certificado FSC. **Se hereda automáticamente del maestro de artículos** al seleccionar el artículo; editable. |
| `es_pefc` | boolean | Material certificado PEFC. Idem herencia del maestro. |
| `fsc_certificado_proveedor` | text | Nº certificado FSC del proveedor (ej: FSC C116784) |
| `pefc_certificado_proveedor` | text | Nº certificado PEFC del proveedor (ej: PEFC/43-00014 — ver Comart §3d) |
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
| `ot_numero` | text | OT que consumió o recibió (según tipo; ver §7.6) |
| `ot_origen_numero` | text nullable | Solo `traspaso`: OT de la que se saca material reservado |
| `ot_destino_numero` | text nullable | Solo `traspaso`: OT urgente que recibe el material |
| `autorizado_por` | text nullable | Obligatorio en `traspaso` (ej. Ramón) — conversación hoy de viva voz |
| `paso_id` | FK nullable | Paso de itinerario (si aplica) |
| `notas` | text | |
| `created_by` | UUID | |
| `created_at` | timestamp | |

---

## 7. Flujo UX propuesto para Minerva

### 7.0 El Muelle existente — qué hay y qué NO cambiar

La pestaña **Muelle** ya existe en Minerva y Juan la usa hoy para recepcionar. Análisis de las capturas (22 jun 2026):

**Lista de OCs pendientes de recepcionar** — tarjetas por OC, una por una. Cada tarjeta muestra: OT, cliente, material, gramaje, formato, nº compra (OCM-XXXXX), hojas esperadas, proveedor. Diseño mobile-first, limpio, funcional. Juan lo entiende.

**Modal de recepción** — 4 campos: nº albarán proveedor, hojas recibidas, nº palets, notas (incidencias/observaciones). Más foto opcional. Botón "Finalizar recepción" / "Recepción parcial".

**Limitación actual:** diseño 1 OC = 1 recepción. Si Jordi ha agrupado 3 OTs en 1 comanda y llega 1 albarán, Juan tiene que entrar el mismo nº de albarán en 3 tarjetas distintas. Funciona pero no refleja la realidad física.

**Decisión:** **NO tocar el Muelle**. Está bien para su propósito — confirmar que el material ha llegado físicamente. Es rápido, Juan lo entiende, y el camión no espera. El campo `albaran_proveedor` que ya existe se usará como agrupador en la pantalla de cartelas.

**Lo único que se añade al Muelle:** asegurarse de que el nº de albarán queda bien guardado en `prod_recepciones_material`, porque es el nexo entre la recepción física y el cartelado posterior.

---

### 7.1 Flujo objetivo: Muelle (Juan) → Cartelas (Emma/Ramón)

**Roles validados (24 jun 2026):**
- **Juan:** recepciona en Muelle, introduce albarán/hojas/palets, sube el albarán **en cuanto puede** (acelera cartelado). **No cartela.**
- **Emma o Ramón:** bandeja “pendiente de cartelar” → crean cartelas (1 por palet), asocian OT(s), imprimen (2 copias opcionales), pegan en palet.
- Interfaz cartelas: **PC en oficina/almacén** para Emma/Ramón; Juan puede seguir en **tablet solo en Muelle**.

**Flujo:**

```
[YA EXISTE — Muelle · Juan]
Recepciona OC(s), nº albarán, hojas, palets
→ "Finalizar recepción"

[NUEVO — Almacén → Cartelas · Emma/Ramón]
Bandeja agrupada por albarán (antiduplicado si ya cartelado)
→ Por cada palet físico: material, cantidad, OT(s) referencia, STOCK si aplica
→ "Imprimir cartela" (×2 copias opcional)
→ Pegar en palet
```

Cartelado **separado** de recepción — dos momentos, dos intenciones.

### 7.2 Pantalla "Cartelas pendientes" (nueva)

Módulo: `Almacén → Cartelas`

Bandeja de OCs recibidas en muelle pero sin cartela todavía. Agrupadas por albarán:

```
┌─────────────────────────────────────────────┐
│ CARPAPSA  ·  Albarán B26-2525  · 18/06      │
├─────────────────────────────────────────────┤
│ OT 35834  Zenith 295gr 65×92   2.000 h      │
│ OT 35851  Zenith 295gr 65×92   1.500 h      │
│ OT 35856  Zenith 295gr 65×92   1.425 h      │
│                        Total:  4.925 h      │
│                   [Generar cartelas  →]     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ COMART  ·  Albarán 443799  · 18/06          │
├─────────────────────────────────────────────┤
│ OT 35946  Kraftliner 225gr 57×97  3.940 h   │
│ OT 35986  Kraftliner 225gr 57×97  3.940 h   │
│                        Total:  7.880 h      │
│                   [Generar cartelas  →]     │
└─────────────────────────────────────────────┘
```

Juan pulsa "Generar cartelas" en el grupo → pantalla de asignación de palets.

### 7.3 Pantalla de cartelado por palet (nueva)

Paso guiado para Emma/Ramón. **Un palet = una cartela = un ID Stock.**

```
CARPAPSA · Albarán B26-2525
Recibido: 4 palets · 4.925 hojas (muelle)

┌── Palet 1 de 4 ─────────────────────┐
│ Material: Zenith 295gr 65×92          │
│ Cantidad en palet: [1.500] hojas      │
│ OT(s) referencia: [35834] [35851] [+] │
│ □ Stock libre (sin OT)                │
│ Ubicación fila: [ZENITH ▼]            │
└───────────────────────────────────────┘
… repetir por palet …

[ Imprimir cartelas ]  [ 2 copias por palet ✓ ]
```

- **No** se pide cantidad por OT en la cartela (D1).
- Validación suave: suma hojas palets ≈ hojas recepcionadas (aviso, no bloqueo).
- **Antiduplicado:** si albarán ya tiene cartelas, bloquear o avisar fuerte (A5).

~~Modo reparto / partir palet en N cartelas~~ — eliminado (§3g).

### 7.4 Cartela imprimible

Contenido mínimo (grande y legible para almacén).
⚠️ Mostrar siempre **cantidad actual** — en Optimus se corrige a mano; en Minerva la cartela refleja el estado real.

```
┌─────────────────────────────┐
│  ID STOCK: 10.310           │
│                             │
│  Folding 235gr 72×102       │
│  ALLYKING  [FSC]            │
│                             │
│  2.400 hojas iniciales      │
│  ► 500 hojas actuales ◄     │
│                             │
│  OT(s): 35834 · 35851 · 35856     │
│  (sin cantidad por OT)            │
│  CARPAPSA  G6-3305          │
│  15/06/2026                 │
└─────────────────────────────┘
```

### 7.5 Consulta de stock disponible (Juan en almacén)

Módulo: `Almacén → Stock`

Juan necesita poder responder a dos preguntas rápidas:

**"¿Este palet está reservado?"** → busca por ID Stock → ve OT asignada, hojas disponibles.

**"¿Qué material tengo para la OT X?"** → busca por OT → ve qué cartelas/palets tiene asignados y dónde están.

**"¿Qué hay disponible de Zenith 295gr?"** → filtro por material → lista de palets libres.

Esta vista es **lectura** para Juan. No crea ni modifica nada aquí — solo consulta antes de mover un palet.

- Filtrar por material / gramaje / formato / proveedor
- Ver estado: reservado (con OT) / disponible (stock libre) / parcial
- Ver cantidad actual (descontando consumos registrados)
- Ver **déficit de material** por OT (tras traspasos — ver §7.6; nota visible, sin conectar a `material_status` en MVP)
- Acciones de movimiento de material: ver §7.6 (Juan autónomo en entrega desde libre)

### 7.6 Movimientos de material desde almacén

Tres flujos distintos — todos en `prod_stock_movimientos`:

| Flujo | Origen | Destino | Quién | Autorización | Efecto en cartela |
|-------|--------|---------|-------|--------------|-------------------|
| **Consumo normal** | Cartela reservada de la OT | OT en máquina | Maquinista / almacén | — | `cantidad_actual` baja |
| **Entrega desde libre** | Stock libre (`disponible`) | OT que pide material | **Juan (autónomo)** | Aviso a Ramón/Emma, **sin bloqueo** | Libera −Xh; OT recibe trazabilidad en movimiento |
| **Reasignación de reserva** | Cartela reservada OT-A | OT-B urgente | Juan / Ramón | Campo **`autorizado_por` obligatorio** | OT-A queda con déficit; nota en vista Stock |

**Flujo 2 — "Juan, dame 100 hojas más" (desde stock libre):**

```
Maquinista pide 100h más para OT 35834
  ↓
Juan: Almacén → Entregar material
  → Busca stock libre (ej. cartela 10.311, Folding 300gr, 400h restantes)
  → Cantidad: [100] · OT: [35834]
  → Confirma
  ↓
Movimiento consumo · cartela 10.311 · −100h · ot_numero 35834
Cartela 10.311: cantidad_actual = 300h
Aviso: "Juan entregó 100h de 10.311 a OT 35834"
```

**Flujo 3 — Reasignar reserva de OT-A a OT-B urgente:**

```
Ramón: "Coge 100h del material de OT 35851 para la urgente 35834"
  ↓
Juan: Reasignar material
  → Cartela 10.301 (1.500h · OT 35851 · reservado)
  → Cantidad: [100] · Destino OT: [35834]
  → Autorizado por: [Ramón]  ← obligatorio
  ↓
Movimiento traspaso · ot_origen 35851 · ot_destino 35834 · −100h
Cartela 10.301: 1.400h · OT 35851 · estado parcial
Vista Stock: "OT 35851 — déficit 100h (pendiente reponer)"
```

**Déficit y `material_status` (Bloque 8):** en MVP el déficit es **nota visible en vista Stock** (y en detalle de cartela/OT). **No** conectar al semáforo `material_status` de pool/mesa hasta que los movimientos estén rodados (fase 9.4+). Destino futuro: recalcular semáforo cuando el stock por palet sea fiable.

### 7.7 Consumo en producción

**Decisión planta (24 jun — E4):** descuento **imprescindible tras cada trabajo**, como hoy en Optimus (“Captura de datos en planta”).

| Campo en consumo | Origen |
|------------------|--------|
| `id_stock` | Cartela(s) usadas (puede ser **>1** en urgencias) |
| `ot_numero` | OT en ejecución |
| `cantidad` | Hojas consumidas en esa tirada |
| Quién | **Maquinista** (E2–E3) |

**Implementación — dos fases:**

| Fase | Estado | Qué hace |
|------|--------|----------|
| **9.4-preview** | ✅ 25 jun 2026 | Al **Cerrar proceso** (impresión offset `1` / digital `2`): ID Stock + hojas opcionales → `datos_proceso` + vista hoja de ruta/PDF. **Sin** movimientos ni descuento. Aviso piloto en UI. |
| **9.4 operativo** | ⏳ post-demo | Mismo punto de captura; además `INSERT prod_stock_movimientos` + bajar `cantidad_actual`. Solo OTs piloto (§13c). |

**Opción B — Registro al cerrar paso de impresión (elegida):**
Al cerrar ejecución / tirada, el maquinista indica ID Stock + hojas usadas.
En 9.4-preview solo documenta; en 9.4 operativo descuenta stock.

Enlace natural con **“Cerrar proceso”** ya existente en mesa de ejecución (§15.5).

~~Opción C solo trazabilidad~~ — **descartada** para el piloto (Ramón E4).

**Opción A** (selección de palet al iniciar): fase posterior si planta lo pide.

### 7.8 Gestión de sobrantes

Al consumir o al cerrar tirada:
- `cantidad_actual` baja en el **mismo** ID Stock; movimiento en log.
- **No** crear cartela nueva.

Al cerrar OT (Bloque 6) — **no** popup automático “¿pasar X hojas a stock libre?” si el palet tiene **varias OTs referenciadas** (§3g J2). El sobrante puede ser para otra OT del mismo palet.

Ajuste manual / vista Stock sigue disponible para Emma/Ramón cuando el palet queda realmente libre (`estado` → `disponible`, OTs referencia vacías o solo stock).

---

## 8. Relación con otros bloques

| Bloque | Relación |
|--------|----------|
| **Bloque 6** (Histórico/Producidas) | Al cerrar OT → detectar sobrante → misma cartela pasa a `disponible` (§7.8) |
| **Bloque 7** (Expedición) | Trazabilidad: qué material entró → qué producto salió |
| **Bloque 8** (OT contenedor/hijas) | Las hijas pueden compartir material del contenedor o tener el suyo |
| **Muelle (existente)** | Foto + recepción física hoy; en Fase B (9.5+) alimenta cartelado Emma |
| **FSC** | El material recibido tiene lote de proveedor → trazabilidad FSC completa |
| **Maestro de artículos** | `codigo_articulo` de la cartela puede enlazarse al maestro de referencias |

---

## 9. Preguntas abiertas (responder con Emma / Ramón / Juan)

**Respondidas con albaranes del 18 jun:**
- ✅ ¿Hay material que se compra para stock sin OT? → **SÍ**, Papers Tordera lo confirma
- ✅ ¿ID Stock más alto actual? → **10.307** (arrancar Minerva desde **10.310**)
- ✅ ¿Los proveedores siempre indican la OT? → **NO** (Papers Tordera no; CARPAPSA sí)
- ✅ ¿Cantidad en kilos o hojas? → **Depende del proveedor** (Papers Tordera en kilos)
- ✅ ¿FSC/PEFC en albarán proveedor? → **SÍ**, CARPAPSA indica certificado

**Respondidas por Ramón (22 jun):**
- ✅ ¿OT en el albarán? → A veces sí, a veces no — igual que ya sabíamos
- ✅ ¿Material para stock sin OT? → Sí, alguna vez (digital)
- ✅ ¿Hay material que llega cortado? → Sí, es frecuente → formato editable al recepcionar
- ✅ ¿Un palet puede usarse para varias OTs? → **Sí, bastante frecuente** → cambio de modelo (§3c P9, §6)
- ✅ ¿Quién decide qué palet usar? → Juan (consultando a Ramón) → necesita vista Stock
- ✅ ¿ID Stock actual? → **10.307** → arrancar desde **10.310**
- ✅ ¿FSC en la cartela? → El maestro de artículos ya lo marca → heredar automáticamente

**Respondidas en sesión 22 jun (análisis emails + albaranes + capturas Muelle):**
- ✅ ¿Juan es usuario del Muelle? → **SÍ**, ya lo usa hoy. Diseño mobile-first existente, correcto.
- ✅ ¿Juan puede crear cartelas? → **SÍ**, objetivo de gerencia — Juan autónomo. Emma supervisa.
- ✅ ¿Relación OC→OT? → **1 OT → N OCs** (portada + tripa, cartón + microcanal). OC siempre para 1 OT.
- ✅ ¿Un palet puede tener N cartelas? → **SÍ** — cuando se parte entre OTs. Campo `palet_fisico_ref` para agruparlas.
- ✅ ¿Toneladas como unidad de peso? → **SÍ** (PROEMBASA). Toggle: hojas / kg / Tn.
- ✅ ¿OT con sufijo alfanumérico? → **SÍ** (35929-B). Campo `text`, nunca entero.
- ✅ ¿Lote de proveedor por palet? → **SÍ** (Comart: lote diferente por palet). Va en cartela, no en cabecera de recepción.
- ✅ ¿Entrega desde stock libre? → Juan autónomo, aviso sin bloqueo (§7.6)
- ✅ ¿Reasignación reserva OT-A → OT-B? → `traspaso` + `autorizado_por` obligatorio + déficit en Stock (MVP; `material_status` en fase posterior)

**Respondidas en sesión 23 jun (dispositivo Juan + rol Emma):**
- ✅ ¿**Dispositivo de Juan**? → **Tablet/móvil** en Muelle. Cartelas: Emma/Ramón (PC).
- ⚠️ ¿**Juan crea cartelas**? → **Corregido 24 jun: NO.** Solo Emma/Ramón (A2, A3).
- ✅ ¿**Quién autoriza traspasos**? → Ramón; ejecuta Juan con `autorizado_por`. Ver §7.6.

**Respondidas cuestionario 23–24 jun (§3g):**
- ✅ Modelo **1 cartela = 1 palet = 1 ID Stock**; varias OTs sin qty por OT.
- ✅ Consumo maquinista **obligatorio** tras cada trabajo (E4).
- ✅ Prioridad: stock **libre / no reservado** visible (I3).
- ✅ Barco: mismo material → 1 cartela multi-hija; distinto material → cartela separada (I1).
- ✅ Arranque **piloto paralelo** Optimus + 10–20 OTs Minerva (H3, §13c).
- ✅ Antiduplicado albarán (A5).
- ⏳ H1/H2 recuento global — sin respuesta escrita.

**Permisos resultantes (resumen — detalle en `MINERVA_ROLES_Y_NAVEGACION.md`):**

```
Juan  (almacen) → Muelle + Stock (consulta + entrega libre + traspaso con autorizado_por)
Emma / Ramón    → Muelle (opc.) + Cartelas (crear/imprimir) + Stock + correcciones
Maquinista      → Consumo ID Stock al cerrar tirada (piloto)
Ramón           → todo + autoriza traspasos de reserva
Admin/Gerencia  → todo
```

**Pendientes (prioritarias):**
1. ¿**Cuántos albaranes** recibe Minerva de media por día/semana? (Volumen para decidir si la bandeja de pendientes necesita paginación.)

**Pendientes (pueden esperar):**
4. ¿Cómo crea Ramón/Gemma las OCs hoy? ¿Directamente en Optimus desde el email de Jordi, o hay otro paso intermedio?

---

## 10. Lo que NO haría en el MVP

- **No generar cartelas automáticamente** al finalizar la recepción en muelle — son dos pasos distintos con dos intenciones distintas. El camión no espera decisiones sobre distribución de palets.
- **No tocar el Muelle existente** — funciona, Juan lo entiende, está bien diseñado. Solo asegurar que el nº albarán queda guardado correctamente.
- No intentar sincronizar stock en tiempo real desde el primer día.
- No obligar al maquinista a escanear en planta **excepto en OTs del piloto**, donde el descuento es **obligatorio** (E4).
- No replicar exactamente el modelo de Optimus (complejidades heredadas sin valor).
- No bloquear la producción si el stock no cuadra — avisos, no bloqueos.
- **No priorizar OCR / lectura automática de albaranes** — primero cartelas y stock real; la foto del muelle ya existe como apoyo visual.
- No resolver la ficha de Rita (acabados externos) en este bloque — es Bloque posterior (módulo Externos/Flujos).
- No conectar déficit de material a `material_status` (pool/mesa) hasta que movimientos estén rodados (post-9.4).

---

## 11. Roadmap — dos fases

### Fase A — Core (ahora): cartelas y stock real

Objetivo: sustituir Optimus/papel en lo esencial — **qué hay en cada palet y para qué OT va**.

| Fase | Entregable |
|------|------------|
| **9.0** | SQL: `prod_stock_palets` + `prod_stock_movimientos` + `prod_stock_palet_ots`; ampliar `prod_recepciones_material` (`cantidad_peso`); secuencia `id_stock` desde **10.310** | ✅ **Hecho** |
| **9.1** | UI **Almacén → Cartelas**: bandeja pendientes por albarán + cartelado 1 palet = 1 ID Stock + OT(s) + impresión (2 copias). Usuarios: **Emma/Ramón**. Antiduplicado albarán. | ✅ **Hecho** |
| **9.1b** | Post smoke: filtros bandeja, wizard split, selector OTs + hijas barco, fallback cliente/trabajo (`prod_ots_general`), `ref_lote` Optimus, fix impresión, cartela print estilo scan | ✅ **Hecho** |
| **9.2** | UI **Almacén → Stock** + filtros **libre vs reservado** (prioridad I3) + entregar desde libre + reasignar reserva (§7.6). | ⏳ |
| **9.3** | Sobrantes — misma cartela muta; **sin** wizard auto “pasar a libre” multi-OT (§7.8) |
| **9.4-preview** | ✅ Enlace documental ID Stock ↔ cierre impresión → `datos_proceso` + hoja de ruta/PDF (§15.5) |
| **9.4 operativo** | **Consumo maquinista al cerrar tirada** + movimientos (piloto 10–20 OTs). Tras rodar: déficit → `material_status`. |

**Prerrequisitos ligeros:** audio/notas Emma; ir respondiendo §9 pendientes en paralelo.

### Fase B — Mejoras (después del core)

No bloquean 9.0–9.4. Se encadenan cuando el flujo administrativo de cartelas funcione en planta.

| Fase | Entregable |
|------|------------|
| **9.5** | **Puente muelle → administración**: bandeja «Recepciones en muelle pendientes de cartelar» (foto + datos del muelle ya guardados) |
| **9.6** | Recepción **STOCK sin OC** y albarán **multi-línea** (varias OTs / líneas en un mismo envío) |
| **9.7** | **Sugerencia desde foto** (Gemini Vision u OCR asistido): prefill proveedor, nº albarán, líneas, kilos — **siempre confirmación humana** (patrón import externos Optimus) |
| **9.8** | Adjuntar/reenlazar fotos muelle en flujo de cartelado; menos papel físico circulando |

```text
[Fase A — primero]
  Juan: muelle → cartelas → stock + entregas desde almacén

[Fase B — luego]
  Muelle (foto) ──► cartelado agrupado ──► (opcional) IA sugiere campos
```

---

## 12. Nota sobre el MRP actual de Minerva

Hay un primer intento de **Almacén MRP** en la app (`src/components/produccion/almacen/almacen-mrp-page.tsx`)
sobre `almacen_materiales` + vista `almacen_control_inteligente` (stock agregado por material, no por palet).

**No se usa en producción** porque el stock se descuadra si no se alimenta a diario.

**Decisión pendiente:** Bloque 9 debe **reemplazar** el modelo MRP legacy — no convivir sin fuente de verdad.
El nuevo modelo es **por palet/cartela** (`prod_stock_palets`).

**Por qué el MRP legacy falló y este no:** el MRP guardaba un **número agregado por material** que alguien tenía que mantener a mano → se descuadraba en cuanto se dejaba un día. En el modelo cartela, el agregado es **derivado** (suma de `cantidad_actual` de las cartelas + movimientos), no un dato que se mantiene. El "stock de Zenith 295" deja de ser un campo y pasa a ser una **vista calculada**. Por eso construir cartelas primero **no** es hacer la casa por el tejado: es poner los cimientos. La vista agregada por material (con mínimos/reposición) se monta **encima** como evolución (ver §14).

---

## 13. Extensibilidad del modelo de stock (capas futuras)

> Añadido 23 jun 2026. El patrón **cartela** no es solo "stock de papel": es el **motor de stock** de Minerva. Misma arquitectura (registro identificado + `cantidad_inicial`/`cantidad_actual` + `estado` + `ot_origen` + movimientos), distintos `tipo_stock` y `unidad`.

### Las 3 capas de stock de la planta

| Capa | Qué es | Ejemplo | `tipo_stock` | Cuándo |
|------|--------|---------|--------------|--------|
| **Materia prima** | Papel/cartón en palets, se consume en máquina | Zenith 295gr, cartela 10.310 | `materia_prima` | **Bloque 9 (ahora)** |
| **Semielaborado (WIP)** | Ya pasó un proceso, no es entrega | Hojas impresas, estuches desbrozados, cajas sin engomar | `semielaborado` | Fase futura |
| **Producto terminado (PT)** | Listo para expedir | 1.500 cajas Simón UC10 sobrantes de OT X | `producto_terminado` | Fase futura (caso Gabri) |

A esto se suma una capa transversal: **consumibles** (tintas, barnices, colas, cauchos) → `consumible`, stock por material **sin palet ni OT**, con mínimos. Modelo más simple que la cartela.

### El caso Gabri (producto terminado) — documentado para el futuro

Hoy Gabri (engomado + logística + entregas) controla el PT **a ojo**: cuando entra una OT de, p. ej., caja Simón UC10, va físicamente a su zona a ver qué hay y decide si fabrica completo, parcial o solo entrega. No hay número fiable.

Esto enlaza con dos cosas que Minerva ya tiene/tendrá:
- **Sobreproducción permitida (3–5%)**: el sobrante de cajas debería caer en stock PT trazable a la OT origen.
- **Bloque 6 (cierre OT)** + **Bloque 7 (expedición)**: al cerrar una OT con exceso, generar entrada a stock PT; al expedir, descontar.

Flujo objetivo (fase futura, mismo motor):
```
OT 35834 fabrica → sobran 1.500 uds Simón UC10
  → stock PT (tipo_stock=producto_terminado, unidad=uds, ot_origen=35834)
Cliente repite pedido
  → Gabri consulta stock PT → usa 800 del sobrante
  → solo fabrica el resto (o solo expedición)
```

### Orden de fases (consolidado)

1. **Bloque 9 — Materia prima (ahora)**: muelle → cartelas → movimientos → consulta.
2. **Vista agregada + mínimos**: roll-up sobre cartelas; reemplaza MRP legacy (§12).
3. **Semielaborado (WIP)**: cuando la ejecución registre salidas reales por proceso.
4. **Producto terminado (Gabri)**: liga Bloque 6 + 7; sobrante al cerrar OT → stock PT.
5. **Consumibles (tintas, barnices, cauchos)**: stock por material, más simple.

**Regla de oro:** no mezclar PT/consumibles en el sprint de cartelas de papel — diluye el foco. Pero el modelo (`tipo_stock`, `unidad`) ya queda preparado en 9.0 para no rehacer SQL.

---

## 13b. Prerrequisito de arranque — recuento físico "día 0"

> Decisión operativa 23 jun 2026. **Crítica** para que Minerva arranque con datos reales.

Cuando Minerva sustituya a Optimus en cartelas, necesita una **foto inicial** del stock físico (saldo de apertura). Sin ella, el sistema arranca vacío y tarda semanas en reflejar la realidad.

**El orden es: recuento primero (con Optimus/papel), import después (cuando 9.1 esté listo).** No hay que tener Minerva montado el día del recuento.

```
Recuento físico (sábado, Optimus + papel + Excel)
  ↓  Excel con el inventario de palets
[Desarrollo Minerva en paralelo: 9.0 / 9.1]
  ↓  cuando 9.1 esté rodado
Import del Excel → cartelas iniciales en prod_stock_palets
  ↓
Juan trabaja en Minerva; a partir de aquí solo movimientos
```

**Columnas mínimas del Excel** (para que el import sea trivial, sin transformar formato Optimus):

| Columna | Ejemplo | Notas |
|---------|---------|-------|
| `id_stock` | 10.301 | Vacío si palet nuevo sin número Optimus |
| material / descripción | Zenith 295gr 65×92 | |
| gramaje | 295 | |
| formato | 65×92 | Formato real del palet (puede ser a corte) |
| proveedor | CARPAPSA | |
| cantidad_actual | 1.500 | Hojas reales hoy en el palet |
| ot_destino | 35834 | Vacío si stock libre |
| estado | reservado / disponible | |
| es_fsc | sí / no | |

**Tarea puntual asociada:** Juan/Ramón hacen el inventario; Emma (o el responsable) lo importa como cartelas iniciales con `estado` según corresponda. Es trabajo único pero **bloqueante del corte final** (no necesariamente del piloto — ver §13c).

---

## 13c. Arranque en piloto — paralelo con Optimus (H3, 24 jun 2026)

> Acordado con Manel tras respuestas de Ramón. **No** corte limpio día 1.

### Estrategia en 3 fases

| Fase | Optimus | Minerva |
|------|---------|---------|
| **1 — Piloto** | Fuente de verdad del **stock general** y OTs fuera del piloto | **10–20 OTs** elegidas: muelle → cartela → consumo → sobrante |
| **2 — Ampliación** | Stock viejo / OTs restantes | Más OTs y familias de material |
| **3 — Corte** | Solo consulta o histórico | Recuento global (§13b) → import → cartelas nuevas solo en Minerva |

### Reglas del piloto (evitar duplicados — lección A5)

1. **Un albarán = un solo sistema:** si se cartela en Minerva (piloto), **no** volver a entrar en Optimus.
2. **OTs piloto = ciclo completo en Minerva:** cartela, consumo maquinista, ajuste sobrante.
3. **Maquinistas informados:** OTs piloto consumen **ID Stock Minerva** (≥10.310), no Optimus.
4. **Stock inicial Minerva:** mini-recuento de palets de esas OTs **o** solo entradas nuevas desde fecha de inicio del piloto (sin importar todo el almacén).
5. **Criterio de éxito antes de ampliar:** stock libre/reservado fiable; descuento sin líos; cero dobles entradas de albarán.

### Selección sugerida de OTs piloto

Mezcla recomendada: 2–3 OTs simples + 1 barco (si aplica, regla I1) + 1 con material a corte o multi-albarán. Acordar lista con Emma/Ramón antes de fecha de inicio.

---

## 14. Historial del documento

| Fecha | Cambio |
|-------|--------|
| 18 jun 2026 | Primer briefing (Claude + cartelas CARPAPSA G6-3305). Modelo MVP, UX, roadmap 9.0–9.4. |
| 18 jun 2026 | Registrado en repo; enlazado desde contexto maestro y roadmap global. |
| 18 jun 2026 | **§3b** — insights albaranes CARPAPSA B26-2525 + Papers Tordera: stock al recepcionar, kilos→hojas, ID Stock ~10.299, FSC/PEFC, OT manual. Campos ampliados en modelo (`cantidad_kilos`, `es_fsc`, `es_pefc`, `fsc_certificado_proveedor`). §9 parcialmente respondida. |
| 18 jun 2026 | **Roadmap dos fases**: A (9.0–9.4 cartelas/stock core) + B (9.5+ muelle/foto/IA). `prod_recepciones_material` ya existe — extender, no duplicar. Tabla 4 albaranes referencia. |
| 22 jun 2026 | **§3c** — respuestas de Ramón. Cambios de diseño: (1) `ot_destino_numero` pasa a "OT prevista" no exclusiva — trazabilidad real en movimientos; (2) `formato` editable al recepcionar (material a corte); (3) FSC/PEFC se hereda del maestro automáticamente; (4) cartela imprimible muestra cantidad actual; (5) Juan necesita acceso lectura a vista Stock; (6) ID Stock arrancar desde 10.310; (7) UI recepción con líneas dinámicas. §9 pendientes reducidas a 4. |
| 22 jun 2026 | **§3d** — 3 albaranes nuevos (PROEMBASA, Comart, Papers Tordera AV26-04239). Tabla ampliada a 7 albaranes de referencia. Insights: toneladas como unidad, lote por palet, OT con sufijo alfanumérico, proveedor que calcula hojas en albarán. |
| 22 jun 2026 | **§3e** — emails de pedido Jordi. Confirmado: relación 1 OT → N OCs en Minerva. El agrupamiento de Jordi (varias OTs en 1 comanda) es su forma de pedir, no la estructura de BD. |
| 22 jun 2026 | **§3f** — ficha de acabados externos de Rita documentada. No es Bloque 9 — es módulo Externos/Flujos posterior. |
| 22 jun 2026 | **§6 revisado** — modelo OC→OT confirmado (1:N, no N:M). Cartela ≠ palet físico: N cartelas pueden compartir palet (`palet_fisico_ref`). Campos nuevos: `palet_fisico_ref`, `ref_lote_proveedor`, `cantidad_peso_unidad`. |
| 22 jun 2026 | **§7 revisado** — Juan como usuario principal. §7.0: análisis Muelle existente (no tocar). §7.1: flujo Juan-céntrico. §7.2: pantalla "Cartelas pendientes" agrupada por albarán. §7.3: pantalla asignación palets→OTs. Roadmap 9.1 actualizado. |
| 23 jun 2026 | **Limpieza §7** — eliminadas secciones duplicadas; §7.6 movimientos desde almacén (3 flujos); §7.7 consumo; §7.8 sobrantes. Sobrante = cartela que muta (§5, §7.8). ID Stock unificado **10.310**. `pefc_certificado_proveedor`, `ot_origen`/`ot_destino` en movimientos. Modo rápido/avanzado §7.3. Déficit en Stock (MVP); `material_status` diferido a post-9.4. |
| 23 jun 2026 | **§13 Extensibilidad** — patrón cartela como motor de stock; capas materia prima / semielaborado / producto terminado (Gabri) / consumibles. Campos `tipo_stock` + `unidad` en `prod_stock_palets` (MVP: `materia_prima` + `hojas`). Por qué el MRP legacy falló (agregado manual) y este no (derivado). **§13b** recuento físico "día 0" como prerrequisito: recuento con Optimus → Excel con columnas acordadas → import a cartelas cuando 9.1 esté listo. |
| 24 jun 2026 | **§3g** — cuestionario Ramón respondido (`MINERVA_CUESTIONARIO_CARTELAS_RAMON.md`). **Modelo corregido:** 1 cartela = 1 palet = 1 ID Stock; varias OTs sin qty en cartela; Juan no cartela; consumo MVP obligatorio; I1 barco; **§13c** piloto paralelo 10–20 OTs; antiduplicado albarán; deprecado `palet_fisico_ref` / reparto N cartelas por palet. |
| 24 jun 2026 | **§15 Implementación** — 9.0 SQL + 9.1 UI cartelas + 9.1b post smoke desplegados. Cartelas #10310–#10312 en prod. Archivos en `src/components/produccion/almacen/cartelas/`, migración `20260624183000_…`, helper `cartelas-ot-metadata.ts`. Muelle **no tocado**. |
| 25 jun 2026 | **§15.5** — 9.4-preview: bloque cartela en `Cerrar proceso` (impresión 1/2), campos en `datos_proceso`, hoja de ruta + PDF. Wizard cartelas: 3 tabs, `codigo_articulo`, hijas barco. Smoke OT 35858 + PDF `hoja-ruta-35858.pdf`. |

### Implementación (rellenar al avanzar)

**Fase A — core**

| Fase | Estado | Notas |
|------|--------|-------|
| 9.0 — SQL `prod_stock_palets` + movimientos | ✅ | Migración `20260624183000_bloque9_stock_palets_cartelas.sql`. Bridge `prod_stock_palet_ots` (decisión documentada en migración). Secuencia `prod_stock_id_stock_seq` desde **10310**. RLS: almacen, gerencia, produccion, etc. |
| 9.1 — UI cartelas + impresión | ✅ | Ruta `/produccion/almacen/cartelas`. Nav en `produccion-shell.tsx`. Ver §15. |
| 9.1b — Mejoras post smoke | ✅ | Filtros, wizard split, OTs checkboxes + hijas, fallback metadata, ref_lote Optimus, fix print 29→2 págs. Commit `c212e52` wizard ancho demo. |
| 9.2 — Stock + entregas/traspasos | ⏳ | §7.6; déficit visible en Stock |
| 9.3 — Sobrantes al cerrar OT (Bloque 6) | ⏳ | Cartela muta, no nueva fila |
| 9.4-preview — Enlace documental cierre impresión | ✅ | §15.5; procesos 1 y 2; sin stock |
| 9.4 operativo — Consumos y movimientos en planta | ⏳ | Mismo UI; `prod_stock_movimientos` + `material_status` |

**Fase B — mejoras (después)**

| Fase | Estado | Notas |
|------|--------|-------|
| 9.5 — Puente muelle → cartelar | ⏳ | Bandeja + fotos existentes |
| 9.6 — STOCK sin OC + multi-línea | ⏳ | |
| 9.7 — Sugerencia desde foto (IA) | ⏳ | Confirmación humana obligatoria |
| 9.8 — Fotos/adjuntos en flujo cartelas | ⏳ | |

---

## 15. Implementación en repo (24 jun 2026)

> Detalle técnico de lo desplegado. Para decisiones de negocio seguir §3g y `MINERVA_CUESTIONARIO_CARTELAS_RAMON.md`.

### 15.1 SQL (9.0)

| Artefacto | Ubicación / notas |
|-----------|-------------------|
| Migración | `supabase/migrations/20260624183000_bloque9_stock_palets_cartelas.sql` |
| `prod_stock_palets` | 1 fila = 1 palet = 1 `id_stock`. Campos material, cantidades, `ref_lote`, `ref_lote_proveedor`, `nota_entrega` (= albarán), `estado`, FSC/PEFC, etc. |
| `prod_stock_palet_ots` | Bridge OTs referenciadas **sin cantidad por OT** (elegido vs `text[]` por convención repo + queries) |
| `prod_stock_movimientos` | Log inmutable (consumo, ajuste, traspaso…) — listo para 9.4 |
| Secuencia | `prod_stock_id_stock_seq` START **10310** |
| Recepciones | `prod_recepciones_material` extendida: `cantidad_peso`, `cantidad_peso_unidad` |
| Enums | `tipo_stock`, `unidad`, `estado` como `TEXT` + `CHECK` (extensible sin `ALTER TYPE`) |

### 15.2 UI (9.1 + 9.1b)

| Pieza | Archivo |
|-------|---------|
| Página | `src/app/produccion/almacen/cartelas/page.tsx` |
| Bandeja + listado | `src/components/produccion/almacen/cartelas/cartelas-page.tsx` |
| Wizard cartelado | `src/components/produccion/almacen/cartelas/cartela-wizard-dialog.tsx` |
| Impresión | `src/components/produccion/almacen/cartelas/cartela-print.tsx` |
| Tipos | `src/types/prod-stock.ts` |
| Fallback OT metadata | `src/lib/cartelas-ot-metadata.ts` — `cliente`/`titulo` desde `prod_ots_general` si compra vacía |
| Referencia visual | `docs/referencias/cartela-optimus-ejemplo.pdf` |

**Bandeja "Pendientes de cartelar"**
- Agrupación por `albaran_proveedor` (vacío → label `(sin albarán)`).
- Filtros: búsqueda (OT, albarán, proveedor, cliente, material), **Ocultar sin albarán** (ON por defecto), **Solo 30 días**.
- Cada línea OT: `OT · cliente · trabajo · material gramaje formato · hojas`.
- Antiduplicado: badge si ya hay cartelas del albarán; no bloquea "Añadir cartelas".

**Wizard**
- Modal ancho: `w-[95vw] max-w-7xl` (demo desktop; responsive tablet).
- Panel izquierdo sticky: proveedor, albarán, líneas OC (clic **usar** → prefill **solo esa OT**).
- Panel derecho: form palet(s); por defecto **1 palet** (no forzar N del muelle).
- OTs: checkboxes del albarán + hijas de contenedor (`prod_ots_general.ot_padre_numero`); input manual OT extra.
- Al guardar: `ref_lote = "{primeraOT} - {trabajo}"` con fallback `prod_ots_general.titulo`.

**Impresión**
- 2 copias por palet (`copies={2}`) — requisito Ramón.
- `CartelaPrint` fuera del Dialog; `window.print()` desde página padre (fix bug 29 páginas desde modal).
- ID Stock dominante centrado; Ref. Lote estilo Optimus.
- En PDF A4 las 2 copias A6 pueden verse apiladas en una hoja — comportamiento navegador, no bug de duplicado de palets.

### 15.3 Smoke test (24 jun 2026)

| ID Stock | Albarán | OT | Notas |
|----------|---------|-----|-------|
| **10310** | CARPAPSA g3-9999 | 98010-01 | Primera cartela Minerva. Barco / hija. |
| **10311** | G6-3305 | 35990 | Prueba post-9.1; `ref_lote` solo OT (sin trabajo en compra). |
| **10312** | G6-3305 | 35990 | Post-9.1b; `ref_lote` = `35990 - EXPOSITOR SEGLE - BLUSH STICK 4x6u` (fallback `prod_ots_general`). |
| **10313** | G6-3426 | 35970 | Wizard 3 tabs; impresión 2 copias. |

**Validado OK:** filtros, wizard split, prefill por línea, impresión 2 copias, listado Creadas, cliente/trabajo en bandeja (COMART, CARPAPSA).

**Pendiente UX / datos (no bloquea demo):**
- ~~`codigo_articulo` no se rellena en wizard~~ → ✅ desde commit `e514e6c`.
- Auto-quitar OT padre (98010) del prefill cuando hay hijas barco — pendiente post-demo.
- Ubicación fila: catálogo fijo en código; planta aún sin convención operativa.
- Permitir varias cartelas mismo OT/albarán (aviso amarillo, no bloqueo) — coherente con pruebas pero vigilar en piloto (§13c regla 1).
- Impresión en etiquetadora A6 física: validar en planta (ahora probado en PDF A4).

### 15.5 Enlace cierre impresión — 9.4-preview (25 jun 2026)

> Documental únicamente: registra qué palet se usó, visible en hoja de ruta. **No** escribe `prod_stock_movimientos` ni modifica `cantidad_actual`.

**Flujo UX (como Optimus RDC — David teclea Id stock):**

```text
Mesa ejecución → Cerrar proceso (OT en impresión offset o digital)
  → Bloque opcional "Cartela / material usado"
  → ID Stock (lookup prod_stock_palets) + hojas consumidas (opcional)
  → Confirmar y finalizar → datos en prod_ot_pasos.datos_proceso
  → Hoja de ruta (diálogo + PDF): ID Stock, material real, hojas
```

**Campos en `datos_proceso`:**

| Clave | Tipo | Notas |
|-------|------|-------|
| `id_stock_cartela` | number | Normaliza "10.313" → 10313 |
| `material_real_cartela` | string | Snapshot desde palet (nombre · gr · formato) |
| `cartela_hojas_consumidas` | number? | Opcional |
| `cartela_palet_id` | uuid? | FK interna para 9.4 operativo |

**Archivos:**

| Pieza | Archivo |
|-------|---------|
| Lógica compartida | `src/lib/cartela-ejecucion.ts` — `procesoUsaCartela`, lookup, `buildCartelaCamposVista` |
| UI cierre | `src/components/produccion/planificacion/cartela-cierre-block.tsx` |
| Diálogo | `src/components/produccion/planificacion/cerrar-proceso-dialog.tsx` |
| Hoja de ruta / PDF | `src/lib/hoja-ruta/hoja-ruta-formatters.ts` — append tras campos del proceso |

**Procesos:** `PROCESOS_IMPRESION_CARTELA = [1, 2]` (offset + digital plana).

**Comportamiento:**

- ID Stock **opcional** — se puede cerrar sin cartela.
- Si el ID no existe en Minerva: aviso ámbar; se guarda el número igualmente.
- Banner amarillo: *Piloto — sin descuento automático*.

**Smoke test (25 jun 2026):**

| OT | Proceso | ID Stock | Validado |
|----|---------|----------|----------|
| 35858 | Impresión offset | 10.310 / 10.313 (pruebas) | ✅ Diálogo cierre + `HojaRutaOtDialog` + PDF `hoja-ruta-35858.pdf` |

**Siguiente (9.4 operativo):**

1. En `confirmCerrarProceso`: si hay `id_stock_cartela` + hojas → `INSERT` movimiento `consumo` + `cantidad_actual -= hojas`.
2. Flag o lista de OTs piloto (§13c) — no aplicar a todo el parque hasta validar.
3. Tras rodar: conectar déficit stock ↔ `material_status` (pool/mesa).

**Wizard cartelas — mejoras demo (mismo sprint, commits previos):**

- 3 tabs: **Albarán · Palet · Resumen** (crear solo en Resumen).
- `codigo_articulo` en wizard y BD.
- Hijas barco vía `ot_padre_numero`; quitar OT padre del prefill cuando hay hijas — **pendiente UX** (~10 min post-demo).
- Referencia campo a campo: `docs/referencias/cartelas-optimus-campo.md`.

**Decisión maestro artículos:** no importar `prod_materiales_stock` en piloto; lookup por `id_stock` basta (como David en Optimus).

### 15.4 Commits de referencia (rama `feature/bloque8.1-pool-mesa-ejecucion-fixes`)

| Commit | Descripción |
|--------|-------------|
| `8f354e8` | Primera versión cartelas — Bloque 9.0 SQL + UI MVP |
| `3adcbe9` | Estilos cartelas-page |
| `05509ef` | `cartelas-ot-metadata.ts` + mejoras 9.1b |
| `c212e52` | Wizard modal más ancho (demo) |
| `e514e6c` | Ajustes wizard cartelas (tabs, codigo_articulo, hijas) |
| `d844d93` | 9.4-preview cierre impresión + docs |
