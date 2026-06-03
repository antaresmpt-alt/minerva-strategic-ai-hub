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

## 🎯 Bloque 2: Captura de Datos por Proceso desde Ejecución

**Objetivo**: Integrar el formulario dinámico en el flujo de ejecución existente (`prod_mesa_ejecuciones`).

### Tareas
- [ ] Detectar el proceso del paso actual en mesa de trabajo
- [ ] Renderizar formulario dinámico según configuración del proceso
- [ ] Guardar/actualizar `prod_ot_pasos.datos_proceso` al finalizar o pausar ejecución
- [ ] Validaciones básicas (campos requeridos, rangos numéricos)
- [ ] Mostrar campos "previsto" al iniciar + "real" al finalizar

---

## 🖼️ Bloque 3: Vista Global Hoja de Ruta

**Objetivo**: Crear la interfaz visual completa que muestra toda la hoja de ruta de una OT.

### Tareas
- [ ] Modal o página dedicada "Ver Hoja de Ruta" para una OT
- [ ] Renderizar zonas dinámicas según itinerario de la OT:
  - Cabecera (cliente, cantidad, descripción, pedido, fecha entrega)
  - Tags de ruta (badges visuales de los procesos)
  - Zona por cada proceso del itinerario con sus datos capturados
- [ ] Indicadores de estado por proceso (pendiente / en marcha / finalizado)
- [ ] Vista histórica: comparar datos previsto vs real
- [ ] Acceso desde múltiples puntos (OTs Despachadas, Planificación Mesa, ejecución activa)

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

⏳ **Bloque 2 PENDIENTE**: Captura desde ejecución
⏳ **Bloque 3 PENDIENTE**: Vista global
⏳ **Bloque 4 PENDIENTE**: PDF token
⏳ **Bloque 5 PENDIENTE**: Integración Etiquetas ↔ Hoja de Ruta (flujo Hugo)

---

**Última actualización**: 3 de junio de 2026 - 19:55
