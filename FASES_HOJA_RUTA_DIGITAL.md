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

## 🖼️ Bloque 3: Hoja de Ruta Virtual (componente único) ⏳ **EN PROGRESO**

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
- [ ] Enganchar también en OTs Despachadas, Planificación y tarjeta de Ejecución (siguientes pasadas)
- [ ] Comparativa previsto vs real más visual (fase posterior)

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

### 🔜 PENDIENTE (próxima sesión): aplicar el mismo pulido a los demás procesos
Replicar el patrón de Impresión (compactar con `width`, enfocar el dato real con `emphasis`, captura por excepción/derivaciones, info más útil) en:
- [ ] **Troquelado** (10) — revisar orden, derivar troqueladas/merma, resaltar resultado real.
- [ ] **Digital** (2) — repasar a fondo más allá de lo ya tocado.
- [ ] **Engomado** (12) — compactar y enfocar estuches/bultos/palets reales.
- [ ] **Guillotina** (17) — compactar tamaños/hojas, marcar salida real.

> Nota: con un repaso similar al de Impresión se espera ganar bastante en agilidad y utilidad en estos procesos.

---

## 📄 Bloque 4: PDF Acompañante

**Objetivo**: Generar un PDF imprimible ultra-simple como "token físico".

### Tareas
- [ ] Plantilla PDF con:
  - Cabecera de OT (cliente, cantidad, descripción, pedido, fecha)
  - Checkboxes de procesos de la ruta
  - Código QR con enlace a vista digital (opcional)
- [ ] Botón "Imprimir Hoja de Ruta" desde modal de despacho
- [ ] Almacenar PDF generado (opcional) o generar on-demand

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
⏳ **Bloque 3 EN PROGRESO** (6 jun 2026): Hoja de Ruta Virtual (`HojaRutaOtDialog`) + loader `fetchHojaRutaOt`, enganchado en Pipeline, OTs Despachadas, Planificación y tarjeta de Ejecución
✅ **Bloque 3.1 COMPLETADO** (7 jun 2026): Pulido captura Impresión (Offset+Digital): layout `width`, previsto/real, derivación buenas/merma, densidades con valor + guía ISO 12647 por material. **Pendiente**: replicar en Troquelado/Digital/Engomado/Guillotina.
⏳ **Bloque 4 PENDIENTE**: PDF token
⏳ **Bloque 5 PENDIENTE**: Integración Etiquetas ↔ Hoja de Ruta (flujo Hugo)
⏳ **Bloque 6 PENDIENTE**: Producidas/Histórico (`prod_ot_producidas`, snapshot híbrido) + lifecycle de cierre (pendiente_revision → producida) + recálculo maestro
⏳ **Bloque 7 PENDIENTE**: Expedición/Albarán (depende de Bloque 6 + decisión Odoo)

---

**Última actualización**: 7 de junio de 2026 - 18:42


## 📌 Punto de continuación (próxima sesión)

**Sesión 6-7 jun 2026** — Bloque 3 (Hoja de Ruta Virtual): **base funcionando en Pipeline** ✅

### Hecho hoy
- Loader `fetchHojaRutaOt(otNumero)` en `src/lib/hoja-ruta/hoja-ruta-query.ts`
  (cabecera + despacho + pasos con `datos_proceso` + ejecución + pausas + externos).
- Componente `HojaRutaOtDialog` en `src/components/produccion/hoja-ruta/hoja-ruta-ot-dialog.tsx`
  (lectura, autocarga por `otNumero`, renderizador compacto de `datos_proceso`).
- Sustituido el "modal GPS" inline del Pipeline por `<HojaRutaOtDialog />`.
- Verificado en Pipeline: maqueta bien. `tsc --noEmit` y lint en verde.

### Pendiente de pulir (mañana)
- [ ] Enganchar `HojaRutaOtDialog` en **OTs Despachadas**, **Planificación** y **tarjeta de Ejecución**
      (el componente ya solo necesita `otNumero`).
- [ ] Pulir maquetación / detalles visuales de la hoja (queda fino, pero hay cosas a afinar).
- [ ] Mostrar comparativa previsto vs real más visual.
- [ ] (Opcional) recuperar en la hoja los "atajos" útiles del modal antiguo si se echan en falta.

### Siguiente bloque grande
- Bloque 6: tabla `prod_ot_producidas` + lifecycle de cierre (`pendiente_revision` → `producida`).

---

**Sesión 7 jun 2026 (tarde)** — Bloque 3.1: pulido de captura de **Impresión (Offset + Digital)** ✅

### Hecho hoy
- Layout compacto por `width`, diferenciación previsto/real, derivación automática buenas↔merma.
- Densidades de tinta con valor (0–2) + nº Pantone, guía ISO 12647 orientativa según `material` (no bloqueante).
- Fix: el botón "+" de densidades creaba fila vacía que el normalizador descartaba → ahora nace con `CYAN`.
- `tsc --noEmit` y lint en verde.

### 🔜 Próxima sesión (apuntado)
- **Revisar y pulir los procesos restantes con el mismo criterio que Impresión**: Troquelado, Digital (a fondo), Engomado y Guillotina. Compactar (`width`), enfocar el dato real (`emphasis`), captura por excepción/derivaciones e info más útil. Se espera mejorar bastante agilidad y utilidad.

---

**Nota de cierre**: la captura de Impresión queda más compacta, con info más útil y enfocando dónde debe tocar el operario. Próxima sesión: replicar el patrón en Troquelado/Digital/Engomado/Guillotina.