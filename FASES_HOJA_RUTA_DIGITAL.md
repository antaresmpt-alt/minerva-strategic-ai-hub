# FASES: Hoja de Ruta Digital

## 📋 Visión General

La **Hoja de Ruta Digital** es el sistema que reemplaza la tradicional "hoja viajera" en papel. Cada departamento completará campos específicos a medida que el trabajo avanza por la planta. El sistema capturará datos en tiempo real, generará históricos reutilizables y mejorará la precisión de la planificación.

### Arquitectura Elegida: **Opción C - Virtual + PDF Impreso Mínimo**

- **Vista digital completa**: cada departamento accede a un formulario dinámico en pantalla
- **PDF token**: documento impreso ultra-simple (cabecera + checkboxes de procesos) que viaja físicamente con el trabajo como referencia
- **Datos en JSONB**: campos específicos por proceso en `prod_ot_pasos.datos_proceso` (flexibilidad sin migraciones continuas)
- **Config-driven**: definición TypeScript de campos → generación automática de formularios

---

## 🏗️ Bloque 1: Motor de Campos por Proceso ✅ **COMPLETADO**

**Objetivo**: Crear la infraestructura técnica para almacenar y definir campos específicos por proceso.

### Tareas ✅
1. ✅ Migración SQL: añadir `datos_proceso jsonb` a `prod_ot_pasos`
   - Archivo: `supabase/migrations/20260603190000_prod_ot_pasos_datos_proceso.sql`
   - Añadido campo JSONB con índice GIN para búsquedas eficientes
   - Migración aplicada exitosamente a la BD

2. ✅ Crear configuración TypeScript con campos por proceso:
   - Archivo: `src/lib/hoja-ruta-campos-config.ts`
   - Definidos 7 procesos con campos específicos:
     - Guillotina (6 campos)
     - Impresión Offset (14 campos + densidades + incidencias)
     - Impresión Digital Plana (11 campos + incidencias)
     - Troquelado (11 campos con previsto/real en horas)
     - Engomado (10 campos con previsto/real en tiempo)
     - Externo (enlace a módulo Externos + notas)
     - Manipulados Internos (descripción + unidades + tiempo)
   - Soporte para tipos: text, number, boolean, select, textarea, array, dimension, tintas
   - Soporte para campos previsto/real
   - Soporte para campos condicionales

3. ✅ Componente de formulario dinámico reutilizable
   - Archivo: `src/components/produccion/hoja-ruta/datos-proceso-form.tsx`
   - Componente `DatosProcesoForm`: renderiza campos según procesoId
   - Gestión automática de campos previsto/real (genera 2 campos)
   - Gestión de arrays dinámicos (añadir/quitar elementos)
   - Gestión de campos condicionales (ej: código caucho solo si caucho=true)
   - Modo readonly para visualización
   - Validaciones básicas (min, max, required)

### Archivos Creados
- ✅ `supabase/migrations/20260603190000_prod_ot_pasos_datos_proceso.sql`
- ✅ `src/lib/hoja-ruta-campos-config.ts`
- ✅ `src/components/produccion/hoja-ruta/datos-proceso-form.tsx`

### Campos Definidos por Proceso

#### **Troquelado**
- Troquel (texto)
- Poses (número)
- Tamaño corte (largo × ancho mm)
- Pinza (número mm)
- Expulsor (select: mascle / femella / completo)
- Arreglos (boolean)
- Nº hojas a troquelar (número)
- **Previsto/Real**: Horas preparación, Horas tiraje
- Hojas troqueladas (número)
- Hojas merma (número)

#### **Engomado**
- Nº estuches a realizar (número)
- Tipo de engomado (select: lineal / automático / semiautomático / especial / 2 pases / 4 puntos / konica)
- **Previsto/Real**: Tiempo (horas)
- Nº estuches engomados (número)
- Estuches por bulto (número)
- Código caja embalaje (texto)
- Bultos por palet (número)
- Palets (número)
- Cantidad total (número)

#### **Impresión Offset**
- Nº hojas brutas impresión (número)
- Nº hojas netas impresión (número)
- Formato hojas impresión (texto, ej: "70×100 cm")
- Nº hojas merma impresión (número)
- Tintas CARA (texto, ej: "4+1" = cuatricromía + 1 pantone)
- Tintas DORSO (texto, ej: "3+0")
- Acabado principal (texto: barniz graso, barniz acrílico brillo, mate...)
- Caucho (boolean)
- Código caucho (texto, condicional si Caucho=true)
- Acabados secundarios (array de textos)
- **Previsto/Real**: Horas entrada, Horas impresión
- Densidades tintas (array de 8 campos: CYAN/MAGENTA/YELLOW/BLACK/BLANCO/PANTONE #)
- Incidencias (textarea)

#### **Impresión Digital Plana**
- Nº hojas brutas impresión (número)
- Nº hojas netas impresión (número)
- Formato hojas impresión (texto)
- Nº hojas merma impresión (número)
- Tintas CARA (número)
- Tintas DORSO (número)
- Acabado CLEAR (select: no / 1 cara / 2 caras)
- Acabados secundarios (array de textos)
- **Previsto/Real**: Horas entrada, Horas impresión
- Incidencias (textarea)

#### **Guillotina**
- Tamaño inicial papel/cartón (largo × ancho mm)
- Hojas iniciales (número)
- Patrón corte guillotina (texto)
- Tamaño final papel/cartón (largo × ancho mm)
- Hojas finales (número)
- Horas proceso (número)

#### **Externo**
- **Enfoque híbrido**: enlazar con el módulo "Gestión de Externos" existente
- Mostrar tags prediseñados del catálogo (tipo, cantidad, orden de acabados)
- Campos adicionales mínimos en `datos_proceso` si es necesario (estado sync, notas específicas)

#### **Manipulados Internos**
- Descripción (textarea larga)
- Unidades (número)
- Tiempo total (número, horas)

---

## 🎯 Bloque 2: Captura de Datos por Proceso desde Ejecución ✅ **COMPLETADO**

**Objetivo**: Integrar el formulario dinámico en el flujo de ejecución existente (`prod_mesa_ejecuciones`).

### Tareas ✅
1. ✅ Detectar el proceso del paso actual en mesa de trabajo
   - Join `prod_ot_pasos(proceso_id, datos_proceso)` en la query de ejecuciones
   - FK `prod_mesa_ejecuciones.ot_paso_id → prod_ot_pasos.id` ya existente
   - Nuevos campos en `MesaEjecucion`: `procesoId`, `datosProcesoJson`

2. ✅ Renderizar formulario dinámico según configuración del proceso
   - Sección colapsable "Datos del proceso" en cada `ExecutionCard`
   - Solo visible si el proceso tiene configuración en `getCamposConfigByProcesoId`
   - `DatosProcesoForm` integrado con estado local `datosProcesoLocal`
   - Modo readonly para ejecuciones finalizadas/canceladas

3. ✅ Guardar/actualizar `prod_ot_pasos.datos_proceso` al guardar o finalizar ejecución
   - `patchExecution` acepta `datosProcesoUpdate` y hace UPDATE a `prod_ot_pasos`
   - Se persiste tanto al clicar "Guardar" como al "Finalizar"

4. ✅ Campo nuevo: `hojas_impresas` (resultado real) en Offset y Digital
   - Diferenciado de `hojas_netas` (objetivo mínimo del jefe de producción)
   - `hojas_netas` = PLAN, `hojas_impresas` = REAL
   - Este campo es la "salida" que viajará al siguiente proceso (Bloque 2.5)

### Archivos Modificados
- ✅ `src/lib/hoja-ruta-campos-config.ts` (campo `hojas_impresas` + tipos)
- ✅ `src/types/planificacion-mesa.ts` (`procesoId`, `datosProcesoJson` en `MesaEjecucion`)
- ✅ `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx` (join, form, save)
- ✅ `src/lib/planificacion-analytics-query.ts` (compatibilidad nuevos campos)

---

## 🎨 Bloque 2.1: Cabecera + Prefill + Limpieza UI ✅ **COMPLETADO**

**Objetivo**: Hacer la tarjeta de ejecución usable con contexto de despacho, datos previstos pre-rellenados, y sin redundancia de campos.

### Tareas ✅
1. ✅ **Cabecera informativa compacta** (datos de despacho)
   - Query adicional a `produccion_ot_despachadas` + `prod_ots_general`
   - Banda compacta con: Cliente, Cantidad, Trabajo, Entrega, Material+gramaje, Formato, H.brutas/netas, Tintas, Acabado, Troquel, Poses
   - Siempre visible (no colapsable)

2. ✅ **Prefill de previstos desde despacho** (si `datos_proceso` está vacío)
   - Impresión (1,2): hojas_brutas, hojas_netas, formato, tintas, acabado, horas_entrada/impresión previstas
   - Troquelado (10): troquel, poses, hojas_troquelar, horas prep/tiraje previstas (30%/70%)
   - Engomado (12): estuches_realizar (=cantidad), tiempo_previsto

3. ✅ **Limpieza de campos blancos redundantes**
   - Eliminados de la UI: horas reales, horas entrada/tiraje, horas troquelado/engomado, núm. hojas, cantidad unidades
   - Se mantienen: Maquinista, Incidencia, Acción correctiva, Observaciones

4. ✅ **SYNC a columnas viejas** (compatibilidad analíticas)
   - Función `buildSyncPatch()` extrae valores reales del motor dinámico
   - Al guardar/finalizar, copia a: `horas_reales`, `horas_reales_*`, `num_hojas_producidas`, `cantidad_unidades`
   - Mapeo por proceso: Impresión→horas+hojas, Troquelado→horas_troquelado+hojas, Engomado→horas_engomado+unidades

### Archivos Modificados
- ✅ `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx`
  - Tipo `DespachoInfo` + estado `despachoByOt`
  - Query a `produccion_ot_despachadas` y `prod_ots_general`
  - Cabecera compacta en `ExecutionCard`
  - Prefill calculado en el inicializador de `useState(datosProcesoLocal)`
  - `buildSyncPatch` callback para compatibilidad
  - UI simplificada sin campos redundantes
- ✅ **Fix timing (Opción A)**: la query de despacho se resuelve ANTES de los setters;
  `setRows` + `setDespachoByOt` se ejecutan juntos para que `ExecutionCard` se monte
  ya con `despacho` presente y el prefill se calcule en el primer render.

---

## 🔧 Bloque 2.2: Auto-enriquecimiento Troquelado desde `prod_troqueles` ✅ **BASE IMPLEMENTADA**

**Objetivo**: cuando el campo `troquel` está informado en despacho, autocompletar campos técnicos del proceso de troquelado leyendo la ficha del troquel (y/o maestro de artículos).

**Origen de datos**: tabla `prod_troqueles` (match por `num_troquel`).

**Mapeo implementado** (`prod_troqueles` → `datos_proceso` troquelado):
| Campo destino (config) | Origen `prod_troqueles` |
|---|---|
| `poses` | `num_figuras` / `figuras_hoja` |
| `tamano_corte` | `mides` |
| `pinza` | `pinza` |
| `expulsor` | `expulsion` / `num_expulsion` |
| `codigo_caucho` | `caucho_acrilico` *(preparado en datos; falta decidir si mostrar campo visible en Troquelado)* |

**Estrategia actual**:
- Si `datos_proceso` ya tiene datos, no se pisa nada.
- Si `datos_proceso` está vacío, despacho aporta `troquel`, hojas/horas previstas y `prod_troqueles` completa poses, tamaño, pinza y expulsor.
- Match por `produccion_ot_despachadas.troquel` → `prod_troqueles.num_troquel`.
- Pendiente futuro: combinar con maestro de artículos cuando esté más completo.

---

## 🔗 Bloque 2.5: Encadenado Salida→Entrada + Semáforo de Aviso ✅ **COMPLETADO**

**Objetivo**: Mostrar la salida real del proceso anterior como "entrada prevista" del proceso actual, y proyectar si la cantidad será suficiente para el pedido.

### Implementación

#### Config (`hoja-ruta-campos-config.ts`)
- `outputField` + `outputUnit` añadidos a `ProcesoConfigCampos`
- `inputFromProcessIds` define qué procesos aguas arriba son compatibles

| Proceso | `outputField` | `inputFromProcessIds` |
|---|---|---|
| Offset (1) | `hojas_impresas` | — |
| Digital (2) | `hojas_impresas` | — |
| Troquelado (10) | `hojas_troqueladas` | [1, 2] |
| Engomado (12) | `estuches_engomados` | [10] |
| Guillotina (17) | `hojas_finales` | — |

#### Query (`planificacion-ots-ejecucion-tab.tsx`)
- En `loadData`, tras cargar execRows y despacho, se hace una query a `prod_ot_pasos` filtrando `estado = "finalizado"` para las OTs activas
- Se construye `salidaAnteriorByOtId` (mapa `prod_ot_pasos.ot_id → {procesoAnteriorId, salida, nombre}`)
- El mapa se pasa a `mapRow` que lo proyecta en `MesaEjecucion`
- Fix aplicado: `prod_ot_pasos` no tiene `ot_numero`; el encadenado debe cruzar por `ot_id`

#### UI (`ExecutionCard`)
- Bloque compacto sobre "Datos del proceso" visible cuando `salidaProcesoAnterior != null`
- Muestra: nombre del proceso anterior + valor real de salida + proyección calculada
- Cálculo de proyección por proceso:
  - **Troquelado**: `hojas_impresas × poses` = estuches estimados
  - **Engomado**: `hojas_troqueladas × poses` = estuches estimados

#### Semáforo (margen fijo 5%)
- 🟢 proyección ≥ pedido
- 🟡 proyección entre pedido y −5%
- 🔴 proyección < pedido −5% → DÉFICIT (avisar responsable)

### Archivos Modificados
- ✅ `src/lib/hoja-ruta-campos-config.ts` (`outputField`, `outputUnit`, `inputFromProcessIds`)
- ✅ `src/types/planificacion-mesa.ts` (`procesoAnteriorId`, `salidaProcesoAnterior`, `salidaProcesoAnteriorNombre`)
- ✅ `src/lib/planificacion-analytics-query.ts` (compatibilidad nuevos campos)
- ✅ `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx`
  - Query pasos finalizados + mapa `salidaAnteriorByOtId`
  - Bloque UI + semáforo en `ExecutionCard`
  - Fix UX: `Iniciar` ahora guarda Maquinista/Incidencia/Acción/Observaciones antes de recargar

---

## 🖼️ Bloque 3: Hoja de Ruta Virtual (componente único) ✅ **COMPLETADO**

**Objetivo**: Convertir el actual "modal GPS" del Pipeline en la **Hoja de Ruta Virtual** completa: una vista única, bien maquetada, que muestre TODOS los campos capturados por proceso (`datos_proceso`), reutilizable desde varios puntos de entrada.

### Decisiones de diseño (acordadas)
- **No se mantiene un modal GPS aparte**: se **evoluciona** ese modal hasta ser la hoja de ruta. Un solo concepto, no dos que se desincronizan.
- **Un único componente** `HojaRutaOtDialog` (lectura) con **muchos puntos de entrada**: Pipeline, OTs Despachadas, Planificación, tarjeta de Ejecución.
- **Fuente de datos**: no hay una sola tabla con todo. La hoja se monta juntando:
  - `prod_ots_general` (cabecera: cliente, pedido, cantidad, fecha entrega, estado)
  - `produccion_ot_despachadas` (ficha inicial: material, hojas, tintas, troquel, poses, acabado)
  - `prod_ot_pasos` (itinerario/GPS) + **`prod_ot_pasos.datos_proceso`** (campos completos por proceso)
  - `prod_mesa_ejecuciones` (ejecución real: maquinista, horas, inicio/fin, incidencias)
  - `prod_mesa_ejecuciones_pausas` (pausas y motivos)
  - `prod_seguimiento_externos` (proveedor, envío, recepción)

### Tareas
- [x] Loader `fetchHojaRutaOt(otNumero)` que monta la hoja completa (incluye `datos_proceso`)
- [x] Componente `HojaRutaOtDialog` (lectura, bien maquetado):
  - Cabecera (cliente, trabajo, pedido, cantidad, entrega, estado)
  - Tags de ruta (badges de procesos del itinerario)
  - Zona por proceso con: máquina, fechas, estado, **datos del proceso (`datos_proceso`)**, ejecución real (maquinista/horas/incidencias) y externo si aplica
- [x] Reutiliza `DatosProcesoForm` en modo `readonly` para pintar `datos_proceso`
- [x] Enganchado en Pipeline (sustituye el modal GPS)
- [x] Enganchado en OTs Despachadas, Planificación y tarjeta de Ejecución
- [ ] Comparativa previsto vs real más visual (mejora posterior; parcialmente cubierta por el PDF del Bloque 4)

---

## ✨ Bloque 3.1: Pulido de Captura — Impresión (Offset + Digital) ✅ **COMPLETADO**

**Objetivo**: hacer la captura del operario más rápida, compacta y "enfocada" (que se vea de un golpe DÓNDE tiene que tocar), reduciendo al mínimo el picado de datos.

### Hecho (7 jun 2026)
- **Motor de layout por `width`** (`full` / `half` / `third`) sobre rejilla de 6 columnas en `DatosProcesoForm`. Tarjeta más compacta y responsive (colapsa a ancho completo en móvil/tablet).
- **Reordenado Offset y Digital**: formato + caucho/clear arriba, pareja brutas/netas (plan), pareja **merma / buenas (real, resaltadas en dorado)**, tintas+acabado en una línea, tiempos previsto/real emparejados.
- **Diferenciación previsto vs real**: campos `emphasis: 'real'` resaltados; bloque previsto (gris, solo lectura) vs real (dorado, editable).
- **Captura por excepción / menos picado**:
  - Real se pre-rellena desde Previsto si está vacío.
  - Siembra inicial `hojas_impresas = netas`, `hojas_merma = 0`.
  - **Derivación automática** `buenas ↔ merma` (`buenas = netas − merma` y viceversa) vía `computeDerived` (`computeDerivedDatosProceso`, solo procesos 1 y 2).
- **Densidades de tinta con valor** (nuevo tipo de campo `densidades`):
  - Cada fila = tinta (select) + valor (0–2, `step 0.01`) + nº Pantone (solo si tinta = Pantone).
  - Se guarda como `DensidadTinta[]` (`{ tinta, densidad, ref }`); `normalizeDensidades` migra el formato antiguo (`string[]`).
  - **Guía ISO 12647 orientativa** según `material` (clasificación ligera: estucado / offset / cartoncillo-folding / genérico) → placeholder + rango objetivo por tinta + aviso visual ámbar si está fuera de rango (NO bloquea guardado).
  - Digital NO lleva densidades (es tóner, no tintero).
- Vista de lectura (`HojaRutaOtDialog`) formatea densidades legibles ("Cyan 1.25, Pantone 185C 1.10").
- `tsc --noEmit` y lint en verde.

### Archivos modificados
- ✅ `src/lib/hoja-ruta-campos-config.ts` (tipos `width`/`emphasis`/`densidades`/`DensidadTinta`, reordenado Offset/Digital)
- ✅ `src/components/produccion/hoja-ruta/datos-proceso-form.tsx` (layout, densidades, guía ISO/material, hint)
- ✅ `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx` (`computeDerivedDatosProceso`, siembra, paso de `material`)
- ✅ `src/components/produccion/hoja-ruta/hoja-ruta-ot-dialog.tsx` (formateo de densidades en lectura)

### Estado de los demás procesos (mismo patrón que Impresión)
- [x] **Troquelado** (10) — reordenado compacto (`troquel`/`tamaño corte` arriba; `expulsor`/`arreglos`/`hojas a troquelar` en una línea; `poses`/`pinza` compactos), `hojas_merma`/`hojas_troqueladas` resaltadas, siembra `troqueladas = a troquelar`, `merma = 0`, derivación `troqueladas ↔ merma` (8 jun 2026).
- [x] **Engomado** (12) — reordenado compacto, `estuches_engomados`/`cantidad_total` resaltados, siembra desde plan, derivaciones `cantidad_total = estuches_engomados` y `palets = ceil(estuches / (estuches_por_bulto × bultos_por_palet))` (8 jun 2026). *(Pendiente lógica de "picos", ver Bloque 3.2.)*
- [ ] **Digital** (2) — repasar a fondo más allá de lo ya tocado.
- [ ] **Guillotina** (17) — compactar tamaños/hojas, marcar salida real.

### Robustez de captura ✅ (8 jun 2026)
- Los campos comunes (`maquinista`, `incidencia`, `accion_correctiva`, `observaciones`) y los `datos_proceso` ahora **persisten en TODAS las acciones**: Iniciar, Pausar, Reanudar, Guardar y Finalizar.
- Implementado con helper único `buildCommonFieldsPatch()` en `ExecutionCard` + `pauseExecution`/`resumeExecution` aceptando patch y `datos_proceso`. Al ser componente compartido, aplica a todos los procesos.

---

## 🧮 Bloque 3.2: Engomado — Cálculo de bultos/picos + datos del Maestro ✅ **IMPLEMENTADO** (9 jun 2026)

**Hecho:**
- **Mini-maestro de cajas de embalaje** `prod_cajas_embalaje` (tabla nueva + RLS lectura `authenticated`, escrituras vía API admin):
  - Campos: `codigo` (MN2L…), `descripcion` (incl. medidas), `bultos_por_palet_default` (orientativo de Gabri), `con_logo`, `activo`, `orden`, `notas`.
  - Sembradas **10 cajas** en prod (9 jun 2026) con `bultos_por_palet_default` de Gabri (MN1L 30 … BP3N 9). RULOL no está en catálogo. Seed versionado: migración `20260618143200`.
  - Mantenimiento en **Ajustes → Recursos de Producción → Cajas embalaje** (`RecursosCajasEmbalajePanel` + `/api/admin/prod-cajas-embalaje`).
- **Engomado** ahora usa `codigo_caja_embalaje` como **select dinámico** (lee `prod_cajas_embalaje`). Al elegir caja se propone `bultos_por_palet` por defecto (editable, porque no siempre es fijo).
- **Cálculo de picos** (`computeEngomadoReparto`): `bultos_completos = floor(estuches / estuches_por_bulto)`, `pico = resto`, `bultos_totales = completos + (pico>0?1:0)`. Nuevos campos en config + tipo.
- **Reparto en palets con tolerancia**: `PALET_TOLERANCIA_BULTOS = 1` → no abre palet nuevo si el sobrante es ≤ tolerancia (se apila encima). Constante ajustable.

**Pendiente del usuario:**
- [x] ~~Meter los `bultos_por_palet_default` reales de Gabri~~ ✅ (prod 9 jun + seed repo 18 jun).
- [ ] Rellenar `estuches_por_bulto` en el Maestro / OT del artículo de ejemplo.
- [ ] Confirmar si la tolerancia (1 bulto) es la correcta o subirla a 2-3.

### Diseño original (referencia)

**Objetivo**: que el sistema calcule al operario el reparto en bultos y palets, contemplando el caso habitual de "pico" (bulto incompleto), y nutrir el cálculo desde el Maestro de Artículos.

### Problema actual
- Hoy `palets = ceil(estuches_engomados / (estuches_por_bulto × bultos_por_palet))`, pero **falta el concepto de "pico"** (bulto parcial) y la regla de no abrir un palet extra por pocas cajas.

### Lógica de "Pico" (a implementar)
- Ejemplo: 15.300 estuches ÷ 500 por bulto = 30,6 → **30 bultos de 500 + 1 bulto "pico" de 300**.
- **Nuevo campo `pico`** (cantidad del bulto incompleto) + cálculo derivado para el operario:
  - `bultos_completos = floor(estuches / estuches_por_bulto)`
  - `pico = estuches mod estuches_por_bulto` (si > 0 ⇒ hay un bulto extra parcial)
  - `bultos_totales = bultos_completos + (pico > 0 ? 1 : 0)`
- **Reparto en palets con tolerancia** (regla de negocio): cuando el exceso sobre un palet completo es **muy pequeño (≈ 1–3 cajas / un pico)**, NO abrir un palet nuevo: colocar esas cajas encima de un palet aunque quede "sobrecargado". Es preferible **1 palet cargado** que **2 palets** casi vacíos.
  - ⇒ Sustituir el `ceil` puro por un cálculo con **umbral de tolerancia** (nº de bultos/cajas que se permite "subir" encima sin abrir palet). Definir el umbral (¿configurable? ¿por tipo de caja?).

### Datos desde el Maestro de Artículos
- El usuario rellenará en el Maestro la info de **bultos** y **caja de embalaje** (p. ej. caja MN2L → estuches por bulto, bultos por palet).
- El usuario pasará una **tabla de cajas de embalaje y cantidades por palet** → usarla como fuente para prefill/cálculo (estuches_por_bulto, bultos_por_palet por tipo de caja).

### Pendiente de aportar (usuario)
- [ ] Tabla de cajas de embalaje + cantidades por palet.
- [ ] Datos de bultos y caja de embalaje en el Maestro para el artículo de ejemplo.
- [ ] Confirmar el umbral de tolerancia para "subir picos" sin abrir palet (¿1, 2, 3 cajas?).

---

## 🌳 Bloque 3.3: Maestro de Artículos — Campos FSC ✅ **IMPLEMENTADO** (9 jun 2026)

**Objetivo**: añadir trazabilidad de certificación FSC por artículo en el Maestro.

### Hecho
- [x] `fsc` (boolean, default false) en `prod_referencias`.
- [x] `fsc_fecha_validacion` (date, nullable) en `prod_referencias`.
- [x] Tipo `ProdReferenciaRow` + formulario del Maestro (`ArticuloFormDialog`): checkbox "Artículo certificado FSC" y, si está activo, selector de fecha de validación.
- [x] La importación Excel ignora FSC (no rompe el flujo de import existente).

### Pendiente (futuro)
- [ ] Valorar mostrar el flag FSC en despacho / hoja de ruta cuando aplique.

---

## 📄 Bloque 4: PDF Acompañante ✅ **BETA IMPLEMENTADA** (11 jun 2026)

**Objetivo**: Generar un PDF imprimible de la Hoja de Ruta Virtual, pensado como "shop traveler" / hoja viajera física para acompañar el trabajo y presentar de forma clara el estado de la OT.

### Hecho — Beta "en casa" (11 jun 2026)
- [x] Botón **PDF** en `HojaRutaOtDialog`, generando on-demand `hoja-ruta-{OT}.pdf` en A4 vertical.
- [x] Botón **Recargar** en el modal para refrescar la hoja de ruta viva antes de exportar.
- [x] Cabecera PDF con OT, cliente, trabajo, cantidad, fecha entrega, estado y ficha técnica de despacho (material, gramaje, formato, tintas, troquel, poses, acabado).
- [x] Itinerario visual con badges de procesos y estado.
- [x] Tarjetas por proceso con altura dinámica y color estilo modal (barra lateral + cabecera suave por estado):
  - Datos de proceso (`datos_proceso`) formateados con helpers compartidos.
  - Ejecución real: maquinista, duración real (usa `horas_reales` si existe; si no, deriva de inicio/fin), inicio/fin, incidencias, acciones correctivas y observaciones.
  - Externos: proveedor, estado, fecha envío y fecha prevista.
  - Placeholder **"Pendiente de ejecución"** cuando un paso aún no tiene datos.
- [x] Detalle de pausas:
  - Ampliado `fetchHojaRutaOt` para traer `prod_mesa_ejecuciones_pausas` + `sys_motivos_pausa`.
  - PDF muestra proceso, motivo, duración, pausa/reanudación y observación.
- [x] Bloque **Previsto vs Real por proceso**:
  - Barras por proceso (no suma procesos secuenciales para evitar contar doble las mismas hojas).
  - Muestra previsto, real, % cumplimiento y merma real.
  - Ejemplo validado con OT 99906: Impresión 99,9 %, Troquelado 81,8 %.
- [x] Botones decorativos no operativos en modal:
  - **Recalcular presupuesto** (futuro: FSC + cartelas recepción material + presupuesto).
  - **Ficha técnica** (futuro: generación/archivo/impresión desde datos capturados, densidades, proceso, etc.).
- [x] Helpers compartidos `hoja-ruta-formatters.ts` para reutilizar `buildCamposVista`, densidades, fechas y cantidades en modal + PDF.
- [x] Lints en verde en archivos tocados.

### Archivos
- ✅ `src/lib/hoja-ruta/hoja-ruta-pdf.ts` (nuevo exportador PDF)
- ✅ `src/lib/hoja-ruta/hoja-ruta-formatters.ts` (helpers compartidos)
- ✅ `src/lib/hoja-ruta/hoja-ruta-query.ts` (detalle de pausas)
- ✅ `src/components/produccion/hoja-ruta/hoja-ruta-ot-dialog.tsx` (botones PDF/Recargar + placeholders futuro)

### Pendiente / siguiente iteración
- [ ] Afinar diseño visual tras feedback de Hugo/Gemma.
- [ ] Decidir si guardar PDF generado en Storage o mantener generación on-demand.
- [ ] QR / enlace directo a vista digital cuando haya URL estable y permisos definidos.
- [ ] Integrar FSC, cartelas de recepción de material y ficha técnica automática cuando esos bloques estén completos.

### Hoja de Ruta Simplificada ✅ (30 jun 2026)

PDF compacto para acompañar la OT entre departamentos (sustituto papel de la hoja viajera clásica, una sola tira imprimible).

- [x] Generación al **final del wizard de despacho** (Imprimir / Descargar).
- [x] Título **«HOJA DE RUTA SIMPLIFICADA»** (no «hoja viajera»).
- [x] Formato **DIN A5 vertical** (`hoja-ruta-simplificada-{OT}.pdf`).
- [x] Cabecera: OT, cliente, trabajo, cantidad, entrega, material, formato, tintas, troquel.
- [x] Itinerario: cada proceso con **checkbox vacío** + **línea de firma** a ancho completo.
- [x] Archivo: `src/lib/hoja-ruta/hoja-ruta-cartelita-pdf.ts`.

**Pendiente:** botón reimprimir desde `HojaRutaOtDialog`; feedback tamaño/papel con planta.

---

## 🏷️ Bloque 5: Integración Etiquetas ↔ Hoja de Ruta (Flujo Hugo)

**Objetivo**: Conectar el mundo de etiquetas digital (KONICA / Troqueladora / Numeradora), que tiene su propio flujo independiente, con la hoja de ruta global "que viaja", sin cambiar la forma de trabajar del departamento.

### Contexto
- El departamento de etiquetas ya tiene su sistema dedicado: tabla `prod_etiquetas_hoja_ruta` con calendario I-/T-/N-, muelle, metros Konica, etc.
- Hoy las OTs se introducen **manualmente** (diálogo de entrada express).
- KONICA (id 18), Troq_ETIQUETA (id 19) y Num_ETIQUETA (id 20) quedan FUERA del motor `datos_proceso`; se gestionan en este bloque.

### Flujo objetivo
1. **Despacho** genera la OT con proceso de etiqueta (igual que ahora).
2. La OT cae en el **pool / OTs entrada**.
3. **Hugo selecciona** las OTs a gestionar → se **auto-generan** las filas en su pestaña Hoja de Ruta Etiquetas (en vez de teclearlas).
4. Hugo trabaja **igual que hoy** (flujo independiente: calendario, muelle, metros…).
5. Al **finalizar**, el estado se **sincroniza** con la hoja de ruta global "que viaja".

### Tareas
- [ ] Acción "Enviar a Etiquetas / Generar en hoja de ruta" desde el pool (selección múltiple)
- [ ] Auto-INSERT en `prod_etiquetas_hoja_ruta` copiando cliente / trabajo / cantidad / fecha entrega desde la OT y marcando flags KONICA/troq/num según itinerario
- [ ] Definir el nexo fila etiqueta ↔ paso itinerario:
  - Opción robusta: añadir `ot_paso_id` a `prod_etiquetas_hoja_ruta` (como en `prod_mesa_ejecuciones`)
  - Alternativa: enlazar por `ot_general_id` + tipo de proceso
- [ ] Trigger: al marcar `finalizado = true`, cerrar el paso correspondiente en `prod_ot_pasos` y avanzar el itinerario (mismo patrón que el trigger de mesa)
- [ ] Reflejar el estado de etiquetas en la Vista Global Hoja de Ruta (Bloque 3)

### Notas de diseño
- Mantener la **independencia** del departamento: su pestaña no cambia, solo recibe filas "pre-rellenadas".
- La sincronización es **unidireccional al cierre** (etiquetas → itinerario), evitando acoplar los dos flujos durante la ejecución.
- Más adelante se decidirá si "DIGITAL ETIQUETA" se integra en el mismo motor `datos_proceso` o sigue con tabla dedicada.

---

## 📦 Bloque 6: Producidas / Histórico + Cierre de OT ⏳ **PENDIENTE**

**Objetivo**: Al dar una OT por terminada, congelar TODA su hoja de ruta en un histórico inmutable. Sirve para trazabilidad ("¿qué usamos la última vez?"), promedios para prefill y análisis.

### Tabla `prod_ot_producidas` (diseño híbrido)
- **`snapshot` JSONB**: la hoja completa congelada (pasos, `datos_proceso`, ejecución, pausas, externos). Inmutable.
- **Columnas "planas" indexadas** para consulta/promedios sin hurgar el JSONB:
  - `ot_numero`, `referencia_minerva`, `referencia_cliente`, `cliente`
  - `material`, `troquel`, `tintas`, `acabado`
  - `cantidad_pedida`, `cantidad_producida`, `merma`
  - `horas_total`, `estuches_por_bulto`, `bultos_palet`, `palets`
  - `fecha_fin`, `cerrada_por`, `version`

### Lifecycle de cierre (acordado)
- **Fase 1 — automática**: al finalizar el último paso del itinerario → OT pasa a **`pendiente_revision`** (NO escribe aún en producidas).
- **Fase 2 — manual**: una persona pulsa **"Cerrar y enviar a histórico"** → se escribe el snapshot y la OT pasa a **`producida`/`cerrada`**.
- **Por qué híbrido**: el "último paso finalizado" no garantiza datos bien apuntados; la revisión humana protege la calidad del histórico (y por tanto los promedios del maestro).
- **Reapertura**: si hay error tras cerrar, "Reabrir" vuelve a `pendiente_revision` y al regenerar se **versiona** el snapshot (no se pisa).
- **El albarán NO es el disparador del cierre** (es logística/facturación, puede ir desfasado o ser parcial). Como mucho, señal complementaria.

### Dónde se opera
- **Botón "Cerrar y archivar"** dentro del `HojaRutaOtDialog` (componente único → disponible en todos los puntos de entrada).
- **Cola "Pendientes de revisión"** como filtro/atajo en **Pipeline** (cuadro de mando de planta).

### Dos pestañas (acordado)
- **Pipeline** = EN CURSO. Cuadro de mando en tiempo real (por dónde va cada OT, cuántas en troquel, cuellos de botella, riesgo). No histórico.
- **Producidas/Histórico** = TERMINADAS. Listados, filtros (cliente/artículo/material/troquel), cálculos, medias, export. Las dos abren el **mismo** `HojaRutaOtDialog` (Pipeline en vivo; Producidas desde snapshot).

### Nota — recálculo del Maestro de Artículos
- **Maestro** = "cómo se hace / cómo debería hacerse" (ficha canónica).
- **Producidas** = evidencia real de lo que pasó (fuente de verdad histórica).
- El maestro **recalcula sus valores por defecto** desde producidas para que al despachar dé previstos precisos. Reglas:
  - **Últimas N** (p.ej. 5), no todo el histórico.
  - **Descartar outliers** (una OT con avería de 8h no debe disparar la media).
  - **Override manual**: el maestro propone el promedio, pero se puede fijar un valor "oficial" que mande.
- "¿Qué usamos la última vez?" (queja recurrente de producción) = último valor de material/troquel en producidas para esa referencia, mostrado en despacho y en la hoja de ruta.

---

## 🚚 Bloque 7: Expedición / Albarán ⏳ **PENDIENTE (depende de Bloque 6 + decisión Odoo)**

**Objetivo**: Generar el albarán/preparar expedición a partir de las OTs ya producidas.

### Acordado
- **Ubicación**: opción "Generar albarán" desde la pestaña **Producidas/Terminadas** (los datos ya están congelados ahí).
- **Modelo 1 OT → N albaranes** (prever entregas parciales: "cantidad servida" vs "cantidad producida").

### A decidir antes de implementar
- **Rol de Odoo**: ¿Minerva **emite** el albarán (documento legal, con serie + numeración correlativa) o solo **prepara/exporta** datos y Odoo lo emite? Esto cambia el alcance por completo (no duplicar numeración ni tener dos verdades).
- **Datos logísticos que NO están en la hoja de ruta** y habrá que capturar: dirección/forma de envío, transportista, nº de bultos físicos del envío, peso, fecha de salida.

### Alternativa de ubicación
- Que la expedición/albarán viva cerca de **Muelle** (zona logística ya existente) y que Producidas solo tenga un botón "Preparar albarán" que lleve ahí. Producidas se mantiene como histórico/análisis.

---

## 🚀 Fases Futuras (Post-MVP)

### Fase Extra 1: Inteligencia de Repetición en Hoja de Ruta
- Auto-rellenar campos "previsto" desde histórico de la Referencia Minerva
- Sugerencias contextuales durante captura ("última vez usaste Troquel X con Y poses")

### Fase Extra 2: Análisis y Reportes
- Dashboards de desviación previsto/real por proceso
- Identificación de cuellos de botella recurrentes
- Exportar datos de hoja de ruta a Excel para análisis offline

### Fase Extra 3: Integración con Odoo
- Sincronizar datos de materiales consumidos
- Exportar tiempos reales para facturación/costeo

---

## 📌 Estado Actual

✅ **Bloque 1 COMPLETADO** (3 jun 2026): Motor de campos por proceso implementado
- Migración SQL ejecutada
- Configuración TypeScript con 7 procesos definidos
- Componente de formulario dinámico operativo
- Sin errores de linter

✅ **Bloque 2 COMPLETADO** (5 jun 2026): Captura desde ejecución
✅ **Bloque 2.1 COMPLETADO** (5 jun 2026): Cabecera + Prefill + Limpieza UI + fix timing
✅ **Bloque 2.2 BASE IMPLEMENTADA** (6 jun 2026): Auto-enriquecimiento troquelado desde `prod_troqueles`
✅ **Bloque 2.5 COMPLETADO** (6 jun 2026): Encadenado salida→entrada + semáforo de aviso (margen 5%)
✅ **Motivos de pausa por proceso** (6 jun 2026): `sys_motivos_pausa.tipos_maquina` (NULL = universal) + filtrado por tipo de máquina en ejecución
✅ **Bloque 3 COMPLETADO** (6-13 jun 2026): Hoja de Ruta Virtual (`HojaRutaOtDialog`) + loader `fetchHojaRutaOt`, enganchado en Pipeline, OTs Despachadas, Planificación y tarjeta de Ejecución. Pendiente solo como mejora posterior: comparativa previsto/real más visual.
✅ **Bloque 3.1 COMPLETADO** (7-8 jun 2026): Pulido captura Impresión + **Troquelado + Engomado** (layout `width`, previsto/real, derivaciones, resaltar resultado real). Robustez de captura: campos persisten en iniciar/pausar/reanudar/guardar/finalizar. **Pendiente**: Digital a fondo y Guillotina.
✅ **Bloque 3.2 IMPLEMENTADO** (9 jun 2026): tabla `prod_cajas_embalaje` + RLS + mantenimiento; Engomado con select de caja, prefill bultos/palet, cálculo de picos (`bultos_completos`/`pico`/`bultos_totales`) y reparto en palets con tolerancia (`PALET_TOLERANCIA_BULTOS=1`). Valores Gabri en prod + seed `20260618143200`.
✅ **Bloque 3.3 IMPLEMENTADO** (9 jun 2026): Maestro de Artículos — campos `fsc` (Sí/No) y `fsc_fecha_validacion` (BD + formulario).
✅ **Bloque 3.5 IMPLEMENTADO** (9 jun 2026): Tipo de engomado parametrizado + Homogeneidad pantalla "Despachadas".
✅ **Bloque 3.6 IMPLEMENTADO** (9 jun 2026): Semáforo sobreproducción (🟠) configurable por proceso en Settings + proyección en Impresión.
✅ **Bloque 3.7 IMPLEMENTADO** (9 jun 2026): CTP/Preimpresión + Desbroce + Manipulados con Retractilado + 5ª área de planificación "preimpresion". Ver detalle abajo.
✅ **Bloque 3.8 IMPLEMENTADO** (11 jun 2026, rama `feature/fase0.6-hoja-ruta-virtual`): pruebas de campo del flujo nuevo → CTP fuera del cómputo productivo (0.25h plan), material de soporte en Impresión (flag `soporte_impresion` + heurística + combo), info de Externos (acabado + ojo + datos de retorno por muelle), fix encadenado por paso (1099 vs 900) y máquina Desbroce MNRV. Ver detalle abajo.
✅ **Bloque 4 BETA IMPLEMENTADA** (11 jun 2026): PDF acompañante desde `HojaRutaOtDialog` (A4 vertical) con cabecera, itinerario, tarjetas por proceso, detalle de pausas, gráfico previsto/real por proceso, botones Recargar/PDF y placeholders Recalcular presupuesto/Ficha técnica.
✅ **Maestro troqueles etiquetas simplificado** (13 jun 2026): `prod_etiquetas_troqueles` — eliminadas columnas `cliente`/`trabajo` (migración `20260613142500_drop_etiquetas_troqueles_cliente_trabajo.sql` + UI/tipos/import-export/script). Dimensiones solo `dimensiones_texto` en el modal (sin ancho/alto/diámetro). `necesita_revision` conservado como checkbox. Fix UI: select "Estado" pisaba el campo de fecha (añadido `min-w-0`).
⏳ **Bloque 5 PENDIENTE**: Integración Etiquetas ↔ Hoja de Ruta (flujo Hugo)
⏳ **Bloque 6 PENDIENTE**: Producidas/Histórico (`prod_ot_producidas`, snapshot híbrido) + lifecycle de cierre (pendiente_revision → producida) + recálculo maestro
⏳ **Bloque 7 PENDIENTE**: Expedición/Albarán (depende de Bloque 6 + decisión Odoo)
🔄 **Bloque 8 EN CURSO** (17–18 jun 2026): **Fase FORMATO ✅** + **8.0 ✅** + **8.1 ✅** + **8.1.1 ✅**. Pendiente 8.2–8.4. Fuente de verdad: `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`.
📋 **Bloque 9 EN CURSO** (25 jun 2026): **9.0–9.1b ✅** + **9.4-preview ✅** (enlace documental cierre impresión → hoja de ruta/PDF). Pendiente: 9.2 Stock, 9.3 sobrantes, **9.4 operativo** (movimientos). `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §15.5.

---

**Última actualización**: 25 de junio de 2026 — Bloque 9.4-preview cartela en cierre impresión; smoke OT 35858 + PDF hoja de ruta.

---

---

## 🔎 Bloque 3.5: Tipo de Engomado Parametrizado + Homogeneidad Despachadas ✅ **IMPLEMENTADO** (9 jun 2026)

### Hecho
- Reutilizado `prod_despacho_catalogo` con nuevo tipo `'tipo_engomado'` (check ampliado + seed de 11 tipos: Lineal, Fondo semi/auto, Lineal soporte interior 2p, Pegado 4/6 puntos, 2 solapas, de sobre, cónico, especial, compuesto).
- **Settings** → Catálogos de despacho: gestiona "Tipo de engomado" (alta/edición/baja sin deploy).
- **API** `/api/admin/prod-despacho-catalogo`: admite `tipo_engomado`.
- **Despacho** (`master-ots-page`): campo "Tipo de engomado" como Input+datalist (libre + lista), guardado en `produccion_ot_despachadas.tipo_engomado`, clon de histórico de referencia o habitual del maestro.
- **Maestro de Artículos**: campo `tipo_engomado_habitual` (BD + formulario, sección sugerencias técnicas). Excluido del import Excel.
- **Tarjeta Engomado**: campo `combo` (Input+datalist), alimentado del catálogo, prefill desde despacho.
- **Pantalla "Despachadas"** (`ots-despachadas-page`): campo `tipo_engomado` añadido al dialog de edición junto con sugerencias de catálogo para Material y Acabado PRAL. Homogéneo con el despacho principal.
- `next build` en verde.

### Flujo del dato
Maestro (`tipo_engomado_habitual`) → Despacho (`tipo_engomado`, editable) → Tarjeta Engomado (prerelleno, editable). Histórico de referencia tiene prioridad.

---

## 📊 Bloque 3.6: Semáforo Sobreproducción Configurable ✅ **IMPLEMENTADO** (9 jun 2026)

### Hecho
- **Módulo de parámetros** `src/lib/sys-parametros-sobreproduccion.ts`:
  - 3 claves en `sys_parametros`: `produccion_sobreprod_margen_impresion` (10 %), `produccion_sobreprod_margen_troquelado` (5 %), `produccion_sobreprod_margen_engomado` (5 %).
  - Hook `useSysParametrosSobreproduccion` + helper `margenSobreproduccionPorProceso(procesoId, margenes)`.
- **Settings** → Variables del Sistema: nueva tarjeta "Producción > Avisos de sobreproducción" con input por proceso y guardado independiente.
- **Semáforo (`ExecutionCard`)**:
  - **Impresión** (1/2): proyección desde `despacho.hojasNetas × poses` (antes no aparecía el semáforo).
  - Nuevo estado **🟠 SOBREPRODUCCIÓN**: se activa si `proyección > pedido × (1 + margen%)`.
  - Se suma al rango ya existente: 🟢 OK / 🟡 PRECAUCIÓN / 🔴 DÉFICIT / 🟠 SOBREPRODUCCIÓN.
  - Si no hay `poses`, `proyeccion = null` → semáforo no compara (evita falsos positivos).
- `next build` en verde.

---

## 🏭 Bloque 3.7: Nuevos Procesos — CTP, Desbroce, Manipulados + Retractilado ✅ **IMPLEMENTADO** (9 jun 2026)

### Contexto
El usuario necesitaba tres nuevos procesos en la Hoja de Ruta Digital:
1. **CTP / Preimpresión**: se ejecuta al inicio de casi todas las OTs (verificar troquel, preparar planchas, aprobar colores). Requería una **5ª área de planificación** propia.
2. **Desbroce**: proceso entre Troquelado y Engomado. La troqueladora entrega hojas con múltiples poses; el desbroce las separa en estuches unitarios antes de pasar a la engomadora.
3. **Manipulados Internos** (ID 15): ampliar con funcionalidad de **Retractilado** (empaquetar en paquetes retractilados antes de encajar). Incluye campos condicionales.

### Decisiones de diseño
- **Desbroce** → área `engomado` (máquina ficticia `ENG-DESBROZ`): físicamente está en la zona de engomado; las engomadoras siempre desbrozán antes. Patrón idéntico a Guillotina.
- **Manipulados** → área `engomado` (máquina ficticia `ENG-MANIP`): también zona de engomado.
- **CTP** → nueva área `preimpresion` (máquina `CTP-MNRV`): Marc y Gemma usarán rol **`ctp`** en `profiles` (permisos producción preparados 18 jun); Carlos tiene rol `produccion` (ve todo).

### Hecho
#### Base de datos (migración `20260609180000_procesos_ctp_desbroce_preimpresion.sql`)
| Objeto | Cambio |
|---|---|
| `prod_procesos_cat` constraint | Ampliado: añade `'preimpresion'` |
| `prod_maquinas` constraint | Ampliado: añade `'preimpresion'` + `'digital'` |
| **Proceso ID 16** | `CTP / Preimpresión`, `tipo_planificacion = 'preimpresion'`, orden 5 |
| **Proceso ID 22** | `Desbroce`, `tipo_planificacion = 'engomado'`, orden 122 |
| **Proceso ID 15** | Manipulados/Encajado → `seccion_slug = 'engomado'`, `tipo_planificacion = 'engomado'` |
| **Máquina `CTP-MNRV`** | "CTP MNRV", `tipo_maquina = 'preimpresion'` |
| **Máquina `ENG-DESBROZ`** | "Desbroce MNRV", `tipo_maquina = 'engomado'`, orden 30 |
| **Máquina `ENG-MANIP`** | "Manipulados MNRV", `tipo_maquina = 'engomado'`, orden 40 |

#### TypeScript
- **`planificacion-ambito.ts`**: `"preimpresion"` en tipo, array, orden UI (posición 0 = primera), etiqueta "CTP / Preimpresión", filtro por rol.
- **`prod-procesos-cat/route.ts`**: `TipoPlanificacion` + `normalizeTipoPlanificacion` aceptan `"preimpresion"`.
- **`hoja-ruta-campos-config.ts`**:
  - Constantes `PROCESO_CTP_ID = 16`, `PROCESO_DESBROCE_ID = 22`.
  - **`CTP_PREIMPRESION_CAMPOS`**: operador CTP, horas proceso (real), planchas nuevas (bool), verificación troquel (bool), prueba de color (bool), notas. *(Pendiente ampliar tras reunión con Gemma.)*
  - **`DESBROCE_CAMPOS`**: hojas entrada, poses, estuches desbrozados (real), horas proceso, notas/incidencias.
  - **`MANIPULADOS_INTERNOS_CAMPOS`** ampliado: descripción, unidades (real), tiempo total, **retractilar (bool)** → condicionales: `unidades_por_paquete` (ej. 25), `num_paquetes` (calc), notas.
  - **`PROCESO_CAMPOS_CONFIG`** actualizado: CTP (sin output/encadenado), Desbroce (`outputField: estuches_desbrozados`, `outputUnit: estuches`, `inputFrom: [10]`), Engomado (`inputFrom: [22, 10]` — Desbroce tiene prioridad), Manipulados (`inputFrom: [12, 22, 10]`).
- **`planificacion-ots-ejecucion-tab.tsx`** — semáforo:
  - Nueva rama Desbroce (ID 22): hojas × poses → estuches.
  - Rama Engomado corregida: si el predecesor ya da estuches (Desbroce), **no** multiplica por poses.
- `next build` en verde, 0 errores TypeScript.

### Campos CTP actuales (provisionales — pendiente ampliar con Gemma, 10 jun)
| Campo | Tipo |
|---|---|
| Operador CTP | text |
| Horas proceso | number (real) |
| Planchas nuevas | boolean |
| Verificación troquel | boolean |
| Prueba de color | boolean |
| Notas | textarea |

### Encadenado de proyección
```
Impresión (1/2) → hojas_impresas
  ↓
Troquelado (10) → hojas_troqueladas  [inputFrom: 1,2]
  ↓
Desbroce (22) → estuches_desbrozados [inputFrom: 10]  hojas × poses
  ↓
Engomado (12) → estuches_engomados   [inputFrom: 22,10]  si predecesor=22 no multiplica, ya son estuches
```
CTP (16) está al inicio pero sin salida encadenada (solo captura).

### Pendiente
- [ ] Ampliar campos CTP tras reunión con Gemma (10 jun 2026).
- [ ] Crear usuarios Marc y Gemma con rol **`ctp`** (aún no existen en Supabase; permisos listos en `role_permissions` + `permissions.ts`).
- [x] ~~Añadir Desbroce a plantillas Troq→Eng~~ ✅ (5 plantillas, migración `20260618143000`, 18 jun). CTP ya estaba en plantillas offset.
- [ ] Probar flujo completo con una OT real: CTP → Guillotina → Impresión → Troquelado → Desbroce → Engomado.

---

## 🧪 Bloque 3.8: Pruebas de campo CTP/Desbroce/Externos + Ajustes ✅ **IMPLEMENTADO** (11 jun 2026)

> Rama: `feature/fase0.6-hoja-ruta-virtual`. Sesión de prueba real del flujo nuevo (CTP → Impresión → Troquelado → Desbroce → Engomado) con el usuario reportando incidencias en vivo. Se corrigieron 6 puntos.

### 1. CTP — horas fuera del cómputo productivo
**Problema**: las horas de CTP se estaban sumando como si fueran horas de impresión/troquelado/engomado, distorsionando plan/real de producción.
**Solución**:
- En la tarjeta de ejecución (`ExecutionCard`), para CTP (`PROCESO_CTP_ID`) se **oculta** "Plan: Xh · Real: Yh · Desv. Zh" y se muestra un aviso de que las horas de CTP se registran en `datos_proceso` pero **no computan** en plan/desviación.
- En planificación (`planificacion-mesa-diaria-tab.tsx` y `planificacion-mesa-secuenciacion-tab.tsx`): los procesos `preimpresion` usan un valor fijo `CTP_HORAS_PLANIFICACION_DEFAULT = 0.25h` en `horasPlanificadasFromDespRow` en lugar de heredar las horas totales de la OT. Así CTP pesa "un poquito" para tener control horario futuro, pero no infla la carga.

### 2. Impresión — material de soporte correcto (multi-material)
**Problema**: en OTs con varios materiales, Impresión auto-rellenaba el material de la posición 2 ("MICROCANAL") en vez del soporte real de impresión ("DORSO GRIS 250GRAMOS", posición 1).
**Solución** (flag + heurística + selector manual):
- Nuevo campo `soporte_impresion boolean` en `prod_despacho_materiales_lineas` (migración) y en el tipo `ProdDespachoMaterialLineaRow`.
- Carga de líneas de material por OT (`prod_despacho_materiales_lineas`) → `materialesByOt` → `despacho.materiales` (con `descripcion`, `tipo`, `orden`, `soporteImpresion`).
- `pickMaterialImpresion`: prioriza línea marcada `soporte_impresion`; si no hay, aplica heurística (`isLikelyImpressionSupport`, descarta microcanal/ondulado y similares); fallback a la primera línea.
- Nuevo campo `material_impresion` (tipo `combo`) en Impresión Offset y Digital: combo **editable** con todos los materiales de la OT para corrección manual.

### 3. Externos — más información en la zona de entrada (pool de Ramón)
**Problema**: al llegar un trabajo a Externos, Ramón no veía de un vistazo qué acabado se espera (PP brillo, mate, contracolar…) sin entrar al detalle.
**Solución** (`externos-itinerario-pool-tab.tsx` + `externos-itinerario-queue.ts`):
- La cola enriquece cada fila con `acabado_pral`, `material`, `tamano_hoja`, `num_hojas_netas`, `num_hojas_brutas` desde `produccion_ot_despachadas`.
- Nueva columna "Acabado / pistas": **chip** con el `acabado_pral` + icono **ojo** (👁) que en hover abre popover con resumen de despacho (material, formato, hojas netas/brutas).
- Al generar el seguimiento externo, `hojas_enviadas` se siembra con `num_hojas_netas ?? num_hojas_brutas`.

### 4. Externos — datos de retorno en el modal de Hoja de Ruta
**Problema**: al volver un externo (contracolar, plastificar…) el modal no mostraba cuántas hojas se enviaron/recibieron.
**Solución**:
- Nuevos campos en `prod_seguimiento_externos` (migración): `hojas_enviadas`, `hojas_recibidas_muelle`, `unidades_recibidas_muelle`, `palets_recibidos_muelle`, `fecha_recepcion_muelle`.
- Prioridad informativa: **recibidas por muelle** primero; si no están, cae a enviadas.
- `hoja-ruta-query.ts`: `HojaRutaExterno` extendido + query a `prod_seguimiento_externos` con join `prod_cat_acabados(nombre)`.
- `hoja-ruta-ot-dialog.tsx`: la sección "Externo" muestra acabado, fecha recepción muelle, hojas enviadas/recibidas, unidades y palets.
- `gestion-externos-page.tsx`: sección colapsable "Retorno externo / muelle" en el diálogo de edición para informar estos campos.

### 5. Desbroce — fix encadenado (1099 vs 900) + prefill
**Problema**: Desbroce recibía "1099 del proceso anterior" cuando la troqueladora había hecho 900 buenas. Además `hojas_entrada` y `poses` no venían pre-rellenadas.
**Causa raíz**: `salidaAnteriorByOtId` se indexaba **solo por `otId`**, así que varios pasos de la misma OT se pisaban el "salida anterior" entre sí.
**Solución**:
- Clave compuesta `otId::procesoId` (`salidaAnteriorKey` + `salidaAnteriorByPasoKey`) → cada paso recupera la salida de **su** predecesor real.
- Prefill Desbroce: `hojas_entrada` = salida real del proceso anterior, `poses` = `despacho.poses`, y `estuches_desbrozados` derivado (`computeDerivedDatosProceso`).
- Márgenes: se reutiliza la variable de engomadora (es su zona física), acordado con el usuario.

### 6. Engomadora — OT 99906 no aparecía en el pool
**Causa**: error de asignación de máquina; los pasos de Desbroce (`proceso_id = 22`) no apuntaban a "Desbroce MNRV", lo que descuadraba el pool de engomado.
**Solución**:
- `planificacion-ambito.ts`: `inferPlanificacionTipoFromProceso` prioriza "desbroc" → `engomado` antes que "troquelado".
- `prod-ot-itinerario-client.ts`: `replaceProdOtItinerarioSlots` asigna `maquina_id` de "ENG-DESBROZ" a los pasos de Desbroce.
- Migración: `update prod_ot_pasos set maquina_id = (Desbroce MNRV) where proceso_id = 22`.

### Migraciones
- `20260611152819_ctp_preimpresion_motivos_pausa.sql` — motivos de pausa específicos `preimpresion`.
- `20260611184500_hoja_ruta_material_externos_detalle.sql` — `soporte_impresion` + detalle de retorno de externos + corrección de máquina Desbroce.

### Archivos modificados
- `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx` (clave por paso, prefill material/desbroce, tarjeta CTP, combo material)
- `src/components/produccion/planificacion/planificacion-mesa-diaria-tab.tsx` y `…-secuenciacion-tab.tsx` (CTP 0.25h)
- `src/lib/hoja-ruta-campos-config.ts` (campo `material_impresion`, campos de externos)
- `src/lib/hoja-ruta/hoja-ruta-query.ts` + `src/components/produccion/hoja-ruta/hoja-ruta-ot-dialog.tsx` (datos retorno externo)
- `src/lib/externos-itinerario-queue.ts` + `src/components/produccion/externos/externos-itinerario-pool-tab.tsx` (acabado + ojo)
- `src/components/produccion/externos/gestion-externos-page.tsx` (retorno externo / muelle)
- `src/lib/planificacion-ambito.ts` + `src/lib/prod-ot-itinerario-client.ts` (máquina Desbroce)
- `src/types/prod-referencias.ts` (`soporte_impresion`)

### Validación
- `tsc --noEmit` y `eslint` en verde (corregidos un error de `setState` síncrono en efecto y un warning de dependencia faltante).
- Migración aplicada en BD remota; verificado que existen las nuevas columnas y que los pasos `proceso_id = 22` apuntan a "Desbroce MNRV".

### Pendiente
- [ ] Ampliar campos CTP tras reunión con Gemma.
- [ ] Marcar `soporte_impresion` en las líneas de material desde el maestro/despacho (hoy depende de heurística).
- [ ] Probar flujo completo extremo a extremo con varias OTs reales.

---

**Sesión 9 jun 2026 (tarde)** — Tipo de engomado parametrizado ✅

### Hecho
- **Parametrizado** (no hardcode) reutilizando el catálogo genérico `prod_despacho_catalogo` con nuevo `tipo='tipo_engomado'` (check ampliado + seed de 11 tipos: Lineal, Fondo semi/auto, Lineal soporte interior 2p, Pegado 4/6 puntos, 2 solapas, de sobre, cónico, especial, compuesto).
- **Settings**: panel "Catálogos de despacho" ahora gestiona también "Tipo de engomado" (alta/edición/baja, sin deploy).
- **API** `/api/admin/prod-despacho-catalogo`: admite `tipo_engomado`.
- **Despacho** (`master-ots-page`): nuevo campo "Tipo de engomado" como **Input + datalist** (lista + texto libre), guardado en `produccion_ot_despachadas.tipo_engomado`, se clona del histórico de la referencia y se prerellena desde el habitual del maestro si el histórico no aporta.
- **Maestro de Artículos**: campo `tipo_engomado_habitual` (BD + formulario, en sugerencias técnicas). Excluido de la importación Excel.
- **Tarjeta de Engomado**: nuevo tipo de campo `combo` (Input+datalist) para `tipo_engomado`, alimentado del catálogo; **prefill** desde el despacho. Sustituye al `select` cerrado anterior.
- `next build` en verde.

### Flujo del dato
Maestro (`tipo_engomado_habitual`) → Despacho (`tipo_engomado`, editable, lista+libre) → Tarjeta Engomado (prerelleno, editable). El histórico de la referencia tiene prioridad sobre el habitual.

### Pendiente
- [x] ~~Meter `bultos_por_palet` reales de Gabri~~ ✅ (seed `20260618143200`).
- Pulir Digital a fondo y Guillotina (resto Bloque 3.1).

---

**Sesión 9 jun 2026** — Cajas de embalaje + Bloques 3.2 y 3.3 ✅

### Hecho hoy
- **Tabla `prod_cajas_embalaje`** (mini-maestro) + RLS + seed (11 cajas, bultos/palet vacíos) + pantalla de mantenimiento en Ajustes → Recursos de Producción → "Cajas embalaje".
- **Engomado (Bloque 3.2)**: `codigo_caja_embalaje` como select dinámico, prefill de `bultos_por_palet` desde la caja, cálculo de `bultos_completos`/`pico`/`bultos_totales` y palets con tolerancia (no abre palet por un pico ≤ 1 bulto).
- **Maestro de Artículos (Bloque 3.3)**: campos `fsc` y `fsc_fecha_validacion` (BD + formulario).
- `next build` en verde.

### 🔜 Próxima sesión
- Meter los valores reales de `bultos_por_palet` (Gabri) en cada caja.
- Pulir **Digital** a fondo y **Guillotina** (resto del Bloque 3.1).
- Bloque 6: `prod_ot_producidas` + lifecycle de cierre.


## 📌 Punto de continuación (próxima sesión)

**👉 Retomar aquí:** **Demo pedidos complejos (mañana)** → Fase **8.2** wizard contenedor con caso **OT 36204** (`MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §3 Caso A.2). Ejecución barco: OT **98010**. Piloto CTP Marc/Gemma en paralelo.

**Fase FORMATO** ✅ · **Fase 8.0** ✅ · **Fase 8.1** ✅ · **Fase 8.1.1** ✅ · **Fase 8.1.2** ✅ · **CTP despacho v1** ✅ · **Hoja Ruta Simplificada** ✅ · **Caso ref. 36204** ✅ doc

**Sesión 2 jul 2026** — Documentación caso 36204 para wizard 8.2 / demo contenedor

### Hecho
- **§3 Caso A.2** en `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`: ampollas 4 modelos, 2 formas, troquel 4 poses, validaciones, mock wizard, desbroce, SQL componentes.
- §16 retomar desde casa + guion demo 5 min.
- Prioridad explícita 8.2 antes de cerrar §12 planta.

**Sesión 30 jun 2026** — CTP despacho + ejecución híbrida + PDF simplificado ✅

### Hecho
- Wizard despacho: 9 checkboxes CTP (`requiere_*`), resumen, merge re-despacho, **PDF X OK**.
- Editar despacho → `DespachoWizardDialog` en OTs Despachadas, Pool y Maestro (modal legacy sin uso).
- Ejecución CTP: bloque híbrido — todas las tareas visibles; pedidas en despacho sombreadas; adicionales permitidas.
- Cierre CTP: toast soft si faltan requeridas; planchas/horas en datos del proceso.
- **Hoja de Ruta Simplificada** A5 al despachar (`hoja-ruta-cartelita-pdf.ts`).
- Docs: `docs/despacho-wizard-ctp-pendiente.md` actualizado.
- Commits: `074575b`, `7f292cc`, `2fb50ad` en rama `feature/bloque8.1-pool-mesa-ejecucion-fixes`.
- Prueba manual OT **35989** (mesa CTP + cierre proceso).

**Sesión 18 jun 2026 (noche)** — Prueba OT 98010 + fixes 8.1.1 ✅

### Hecho
- Rama `feature/bloque8.1-pool-mesa-ejecucion-fixes` (commit `2d9d3ab`).
- Pool mesa diaria + secuenciación: filtro lateral por `planificacionTipoPaso` (sin leak `null`).
- Material barco en pool contenedor; progreso por **pasos totales** hijas; merma impresión + prefill troquel.
- Script `scripts/setup-contenedor-test-98010.mjs`; numeración hijas `{padre}-{nn}` documentada.
- Prueba manual: 01 avanzada hasta desbroce; 02 CTP confirmada; 03 pendiente pool CTP.
- Guía demo: `GUIA_MAÑANA.md`.

**Sesión 17 jun 2026 (noche, cont.)** — Usuarios CTP + Fase 8.1 ✅

### Hecho
- Usuarios provisionales: `ctp@minervaglobal.es` (Gemma), `ctp2@minervaglobal.es` (Marc), rol `ctp`. Script: `scripts/create-ctp-users.mjs`.
- Campos CTP: dados por cerrados (checkboxes actuales).
- **8.1**: `planificacion-contenedor-query.ts`; Pool v2 + Pipeline con filtro tipo OT, contenedor expandible, % hijas.

---

### Hecho
- Docs: bultos Gabri ✅, estado Bloque 8.1 como siguiente, rol `ctp` aclarado (no `preimpresion`).
- Migración **`20260618143000`**: Desbroce en 5 plantillas offset (Troq → Desbroce → Eng).
- Migración **`20260618143200`**: seed `bultos_por_palet_default` (10 cajas).
- Migración **`20260618143100`** + `permissions.ts`: rol **`ctp`** con acceso a `produccion` y `produccion_ejecucion`.
- Marc/Gemma: **sin usuario** aún en Supabase (solo cuentas de prueba por departamento).
- **Bloque 9 §3b**: insights albaranes CARPAPSA + Papers Tordera documentados en `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` (stock al recepcionar, kilos→hojas, ID 10.300+, FSC).

---

**Sesión 17 jun 2026 (tarde/noche)** — Fase FORMATO implementada + fix Pool/Pipeline ✅

### Hecho hoy
- **Encadenado de formato de pliego** por orden de itinerario (`prod_ot_pasos.orden`), no solo por tipo de proceso:
  - Módulo `src/lib/hoja-ruta-formato-encadenado.ts`
  - Config `formatInputField` / `formatOutputField` en `hoja-ruta-campos-config.ts` (Guillotina, Impresión 1/2, externos hojas)
  - Prefill + banner en `planificacion-ots-ejecucion-tab.tsx` (`formatoAnterior`, `formatoAnteriorOrigenNombre`)
- **Etiqueta "Formato compra"** en despacho maestro, ejecución, diálogo hoja de ruta y PDF.
- **Estado OT en hoja de ruta/PDF**: `resolveEstadoOtLabel()` — p. ej. "Itinerario completo" cuando todos los pasos están finalizados.
- **Fix Pool + Pipeline (400 Bad Request)**: consultas `.in()` troceadas (`supabase-query-chunks.ts`); cliente Supabase singleton; mejor mensaje de error PostgREST.
- **Prueba de campo OT 98009** (clon 35842): compra 72×102 → guillotina 72×51 → impresión 72×51 → troquelado → engomado (sin desbroce). PDF validado.
- Script auxiliar: `scripts/clone-ot-test.mjs`.

### 🔜 Próxima sesión
- [ ] Fase **8.1** (agrupación UI pool/pipeline).
- [ ] §12 planta antes de wizard 8.2.
- [ ] Usuarios Marc/Gemma (rol `ctp`).
- Pendientes vivos: campos CTP/Gemma, Bloque 6.

---

**Sesión 9 jun 2026 (noche)** — Bloques 3.5, 3.6, 3.7 completados ✅

### Hecho hoy (resumen)
- **Tipo engomado parametrizado** (catálogo, despacho, tarjeta, maestro, despachadas).
- **Semáforo sobreproducción** (🟠) con márgenes configurables en Settings, + proyección en Impresión.
- **CTP/Preimpresión** (ID 16, área `preimpresion`) + **Desbroce** (ID 22, área `engomado`) + **Manipulados ampliado** con retractilado condicional.
- 3 máquinas nuevas: `CTP-MNRV`, `ENG-DESBROZ`, `ENG-MANIP`.
- Migración aplicada en BD. `next build` en verde.

### 🔜 Tareas para la próxima sesión

**Prioridad alta (pendiente del usuario)**
- [ ] **Ampliar campos CTP** tras reunión con Gemma (10 jun). Añadir checkboxes adicionales al `CTP_PREIMPRESION_CAMPOS` en `hoja-ruta-campos-config.ts`.
- [ ] **Usuarios Marc/Gemma** con rol **`ctp`** (Admin → Usuarios; aún no existen en Supabase).
- [x] ~~**`bultos_por_palet_default`** de Gabri~~ ✅ (seed `20260618143200`).
- [x] ~~**Plantillas Desbroce** (Troq→Eng, 5 rutas)~~ ✅ (`20260618143000`).
- [ ] **Probar flujo completo** con una OT real: CTP → (Guillotina) → Impresión → Troquelado → Desbroce → Engomado → Manipulados.

**Prioridad media**
- [ ] Pulir **Digital** a fondo (resto Bloque 3.1).
- [ ] Pulir **Guillotina** (compactar, marcar salida real).
- [ ] Añadir los nuevos procesos (CTP, Desbroce) a las **plantillas de ruta** habituales en Settings.

**Siguiente bloque grande**
- **Bloque 6**: tabla `prod_ot_producidas` + lifecycle de cierre (`pendiente_revision` → `producida`) + snapshot híbrido + recálculo maestro.

---

**Sesión 11 jun 2026** — Bloque 3.8: pruebas de campo + ajustes ✅ (rama `feature/fase0.6-hoja-ruta-virtual`)

### Hecho hoy (resumen)
- **CTP fuera del cómputo productivo**: oculto plan/real/desv. en su tarjeta; 0.25h de peso en planificación (control horario sin inflar carga).
- **Material de soporte en Impresión**: flag `soporte_impresion` (BD + tipo) + heurística + combo editable `material_impresion` para multi-material.
- **Externos**: pool con chip de acabado + icono ojo (resumen despacho); nuevos campos de retorno por muelle (hojas/unidades/palets recibidos, fecha) en BD, modal de hoja de ruta y diálogo de gestión.
- **Fix encadenado (1099 vs 900)**: clave `otId::procesoId` para `salidaAnterior` + prefill Desbroce (`hojas_entrada`/`poses`/`estuches_desbrozados`).
- **Engomadora / OT 99906**: corregida asignación de máquina Desbroce MNRV (inferencia de ámbito + itinerario + migración).
- 2 migraciones aplicadas. `tsc` + `eslint` en verde.

### 🔜 Próxima sesión
- [x] Mergear `feature/fase0.6-hoja-ruta-virtual` a `main` (16 jun 2026).
- [ ] **Bloque 8**: ~~Fase FORMATO~~ ✅ · ~~8.0~~ ✅ → **8.1** agrupación UI — ver `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`
- [ ] Ampliar campos CTP tras reunión con Gemma.
- [ ] Marcar `soporte_impresion` en líneas de material desde maestro/despacho (hoy heurística).
- [ ] Probar flujo completo extremo a extremo con varias OTs reales.
- [ ] Pendientes vivos: usuarios CTP (Marc/Gemma), campos CTP/Gemma, plantillas Manipulados si aplica.
- [ ] **Bloque 8.2+**: wizard despacho contenedor + hijas — ver `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §12 (preguntas planta)
- **Bloque 6**: `prod_ot_producidas` + lifecycle de cierre.

---

**Sesión 16–17 jun 2026** — Bloque 8: diseño fusionado (formatos + formas + componentes) 📋

### Decisiones clave
- **Formato:** cadena compra → guillotina → impresión → troquel (primer código).
- **Pedidos complejos:** OT contenedor + hijas reales en BD; **agrupación UI** (no OTs sueltas en listado).
- **Casos Optimus A/B/C** documentados (blister, folder, penjador).
- **Convergencia variable** según producto (no siempre desbroce).
- **Itinerario por hija** con plantilla común + override (forro/dorso + stamping).
- **Tipos de hija:** forma | componente | preimpresion | acabado.
- JSON solo informativo y tabla `prod_ot_formas` pura **descartados** como enfoque principal.

### Documento
- Fuente de verdad: `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`

### 🔜 Retomar
1. ~~Fase **FORMATO** (encadenado).~~ ✅ 17 jun 2026 (`aadad81`)
2. Fase **8.0** + **8.1** (migración + agrupación pool/pipeline).
3. Responder **§12** con Jordi/Zaida/Abraham antes del wizard 8.2.

---

## 🧪 Bloque 3.9: Smoke test OT 35990 + Cerrar proceso + filtros ✅ **23 jun 2026 (tarde)**

> Rama: `main`. OT simple de referencia para flujo completo sin barco.

### Hecho

| Tema | Detalle |
|------|---------|
| **Cerrar proceso** | Botón sustituye "Finalizar": muestra tiempo mesa (auditoría), precarga horas declaradas, permite ajuste fino (ej. 8h reales vs 3 min de prueba). Módulos: `cerrar-proceso-dialog.tsx`, `planificacion-ejecucion-horas.ts`. |
| **Horas totales HR** | `hoja-ruta-horas.ts` — suma previsto/real/desviación por OT en modal y PDF. |
| **Pool filtro barco** | Contenedores visibles si alguna hija coincide con filtro "Próximo paso". |
| **Pool hijas cerradas** | Todas las hijas al expandir; cerradas en verde sin checkbox. |
| **Filtro próximo paso** | Tipos **Guillotina** y **Desbroce** (`planificacion-ambito.ts` + migración `20260623210000`). |
| **Impresión** | `inputFromProcessIds: [17]` — badge y prefill desde salida guillotina (`hojas_finales`), no hojas compradas. |
| **Manipulados** | Checkbox **Etiquetar** + uds./paquete etiqueta; cálculo `num_paquetes` / `num_paquetes_etiqueta`. |
| **Merma troquel** | Semáforo en paso posterior (475 vs 500 → amarillo AJUSTADO ±5%). |

### Pendiente

- [ ] **Externos:** formato hojas en badge, prefill hojas recibidas, encadenado despacho → recepción (dejado para otra sesión).
- [ ] Afinar campos de horas en PDF HR (algunos procesos aún no mapean todos los campos reales).
- [ ] Filtro **Externo** en pool (requiere tipo `externo` en catálogo).

### OT de prueba 35990

Itinerario validado: CTP → Guillotina → Impresión offset → Plastificado (ext.) → Troquel → Manipulados. Pipeline cerrado con 6 pasos verdes. PDF `hoja-ruta-35990.pdf` generado.

---

## Bloque 9 — Cartelas: cuestionario Ramón ✅ **24 jun 2026**

> Fuente: `MINERVA_CUESTIONARIO_CARTELAS_RAMON.md` · diseño: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §3g, §13c.

| Decisión | Detalle |
|----------|---------|
| Modelo | **1 cartela = 1 palet = 1 ID Stock**; varias OTs referenciadas sin qty por OT |
| Roles | Juan **muelle**; Emma/Ramón **cartelas** |
| Consumo MVP | Maquinista descuenta **tras cada trabajo** (obligatorio en piloto) |
| Prioridad | Stock **libre / no reservado** visible |
| Barco (I1) | Mismo material → 1 cartela multi-hija; distinto → cartela separada |
| Arranque (H3) | **Piloto paralelo:** Optimus + 10–20 OTs en Minerva |

Pendiente: H1/H2 recuento global; lista OTs piloto con Emma/Ramón.

---

## Bloque 9.4-preview — Cartela al cerrar impresión ✅ **25 jun 2026**

> Fuente técnica: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §15.5 · referencia Optimus: `docs/referencias/cartelas-optimus-campo.md`.

### Hecho

- En **Mesa de ejecución → Cerrar proceso**, procesos **Impresión offset (1)** e **Impresión digital (2)** muestran bloque opcional **Cartela / material usado**.
- Campos: **ID Stock** (lookup `prod_stock_palets`), **hojas consumidas** (opcional).
- Persistencia en `prod_ot_pasos.datos_proceso`: `id_stock_cartela`, `material_real_cartela`, `cartela_hojas_consumidas`, `cartela_palet_id`.
- **Hoja de ruta** (diálogo `HojaRutaOtDialog` + PDF `hoja-ruta-pdf.ts`) muestra los tres campos al final de “Datos del proceso”.
- Aviso UI: piloto sin descuento automático de stock.

### Archivos

| Pieza | Ruta |
|-------|------|
| Lógica | `src/lib/cartela-ejecucion.ts` |
| UI cierre | `src/components/produccion/planificacion/cartela-cierre-block.tsx` |
| Diálogo | `cerrar-proceso-dialog.tsx` |
| Vista HR | `src/lib/hoja-ruta/hoja-ruta-formatters.ts` |

### Smoke test

- **OT 35858** — cierre impresión con ID Stock → campos visibles en HR y PDF `hoja-ruta-35858.pdf`.
- Contraste útil demo: material **plan** (despacho) vs **material real** (palet por ID Stock).

### Pendiente (9.4 operativo)

- [ ] Al confirmar cierre: `INSERT prod_stock_movimientos` + actualizar `cantidad_actual`.
- [ ] Restringir a OTs piloto (§13c Bloque 9).
- [ ] Cosmético PDF: línea “Horas OT” con espaciado/comilla errónea (preexistente).
