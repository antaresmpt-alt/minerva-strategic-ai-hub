# MINERVA HUB — Contexto Maestro
> Pegar al inicio de cualquier sesión con Claude o Cursor para dar contexto completo del proyecto.
> Última actualización: 13 jun 2026

---

## 🧭 Qué es Minerva Hub

Software a medida para la planta de producción gráfica/impresión de la empresa. Sustituye al ERP **Optimus** (rígido, sin APIs útiles). Desarrollado en solitario por **Manel** (oficina técnica, ex-programador) usando vibecoding con Cursor + Claude/Gemini.

**Estado**: Parcialmente en producción. Los jefes (Albert y Jordi) han apostado por Minerva Hub como plataforma principal de producción. Objetivo: prescindir de Optimus en 3-5 meses.

**Repo GitHub**: https://github.com/antaresmpt-alt/minerva-strategic-ai-hub  
**Deploy**: Vercel (rama `main`)

---

## 🏗️ Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js (App Router), React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Estado | Zustand |
| Backend/DB | Supabase (PostgreSQL + RLS + migraciones SQL) |
| Automatizaciones | Make / n8n (en exploración) |
| Deploy | Vercel |
| Librerías extra | jsPDF, react-markdown |

**Nota importante (AGENTS.md)**: Esta versión de Next.js tiene breaking changes respecto a versiones anteriores. Consultar `node_modules/next/dist/docs/` antes de escribir código nuevo.

---

## 👥 Personas clave

| Persona | Rol |
|---------|-----|
| Manel | Desarrollador + oficina técnica |
| Zaida | Compañera oficina técnica, mentora |
| Albert / Jordi | Jefes / dirección |
| Ramón | Hermano de Manel, gestión de externos y compras |
| Hugo | Encargado de etiquetas |
| Carlos | Responsable de producción |
| Marc / Gemma | Preimpresión (rol `preimpresion` pendiente asignar) |
| Gabri | Referente para datos de cajas de embalaje |

---

## 📦 Módulos existentes (en producción o funcionales)

### ✅ Gestión de Externos (Ramón)
- Módulo para gestionar proveedores externos
- Integrado con el módulo de Hoja de Ruta (proceso "Externo" usa este módulo)

### ✅ Etiquetas (Hugo)
- Tabla: `prod_etiquetas_hoja_ruta`
- Flujo independiente: calendario I-/T-/N-, muelle, metros Konica
- Procesos: KONICA (id 18), Troq_ETIQUETA (id 19), Num_ETIQUETA (id 20)
- Entrada manual por diálogo express (pendiente auto-generación desde despacho)

### ✅ Maestro de Artículos / Referencias
- Tabla: `prod_referencias`
- Importación desde Excel
- Campos: referencia Minerva, cliente, material, troquel, tintas, acabado, poses, `tipo_engomado_habitual`, `fsc` (bool), `fsc_fecha_validacion`
- Pendiente: completar datos de bultos/caja embalaje, recálculo desde histórico

### ✅ Órdenes de Producción (OTs)
- Tabla principal: `prod_ots_general`
- Despacho: `produccion_ot_despachadas`
- Itinerario/pasos: `prod_ot_pasos` (con campo `datos_proceso JSONB` + índice GIN)
- Ejecuciones: `prod_mesa_ejecuciones` + `prod_mesa_ejecuciones_pausas`
- Externos vinculados: `prod_seguimiento_externos`

### ✅ Hoja de Ruta Digital (módulo principal EN PROGRESO)
Ver sección detallada abajo.

---

## 🗺️ Hoja de Ruta Digital — Estado detallado

### Arquitectura elegida: Opción C (Virtual + PDF token mínimo)
- Vista digital completa por departamento
- PDF ultra-simple (cabecera + checkboxes) que viaja físicamente
- Datos en `prod_ot_pasos.datos_proceso` (JSONB, flexibilidad sin migraciones)
- Config-driven: `src/lib/hoja-ruta-campos-config.ts` define campos → formularios se generan automáticamente

### Procesos configurados (IDs y áreas)

| ID | Proceso | Área planificación | Output encadenado |
|----|---------|-------------------|-------------------|
| 16 | CTP / Preimpresión | `preimpresion` | — (sin encadenado) |
| 17 | Guillotina | — | `hojas_finales` |
| 1 | Impresión Offset | — | `hojas_impresas` |
| 2 | Impresión Digital Plana | — | `hojas_impresas` |
| 10 | Troquelado | — | `hojas_troqueladas` |
| 22 | Desbroce | `engomado` (máq: ENG-DESBROZ) | `estuches_desbrozados` |
| 12 | Engomado | `engomado` | `estuches_engomados` |
| 15 | Manipulados/Encajado | `engomado` (máq: ENG-MANIP) | — |
| 18/19/20 | Etiquetas (KONICA/Troq/Num) | Flujo independiente Hugo | — |

**Encadenado de salidas:**
```
Impresión (1/2) → hojas_impresas
  ↓
Troquelado (10) → hojas_troqueladas  [inputFrom: 1,2]
  ↓
Desbroce (22) → estuches_desbrozados [inputFrom: 10]
  ↓
Engomado (12) → estuches_engomados   [inputFrom: 22,10]
  ↓
Manipulados (15)                     [inputFrom: 12,22,10]
```

### Semáforo de proyección
- 🟢 OK: proyección ≥ pedido
- 🟡 PRECAUCIÓN: entre pedido y −5%
- 🔴 DÉFICIT: < pedido −5%
- 🟠 SOBREPRODUCCIÓN: > pedido × (1 + margen%) — configurable en Settings por proceso

### Archivos clave del módulo
```
src/lib/hoja-ruta-campos-config.ts       ← configuración campos por proceso
src/lib/sys-parametros-sobreproduccion.ts ← márgenes configurables
src/components/produccion/hoja-ruta/
  datos-proceso-form.tsx                 ← formulario dinámico (layout width, emphasis real)
  hoja-ruta-ot-dialog.tsx               ← vista única HojaRutaOtDialog (lectura)
src/components/produccion/planificacion/
  planificacion-ots-ejecucion-tab.tsx   ← ejecución en mesa + semáforo
```

### Estado de bloques

| Bloque | Descripción | Estado |
|--------|-------------|--------|
| 1 | Motor de campos por proceso | ✅ Completado (3 jun) |
| 2 | Captura desde ejecución | ✅ Completado (5 jun) |
| 2.1 | Cabecera + Prefill + Limpieza UI | ✅ Completado (5 jun) |
| 2.2 | Auto-enriquecimiento troquelado | ✅ Base implementada (6 jun) |
| 2.5 | Encadenado salida→entrada + semáforo | ✅ Completado (6 jun) |
| 3 | HojaRutaOtDialog componente único | ⏳ En progreso |
| 3.1 | Pulido Offset, Troquelado, Engomado | ✅ Completado (7-8 jun) |
| 3.2 | Engomado: cajas embalaje + picos | ✅ Implementado (9 jun) |
| 3.3 | Maestro: campos FSC | ✅ Implementado (9 jun) |
| 3.5 | Tipo engomado parametrizado | ✅ Implementado (9 jun) |
| 3.6 | Semáforo sobreproducción configurable | ✅ Implementado (9 jun) |
| 3.7 | CTP + Desbroce + Manipulados+Retractilado | ✅ Implementado (9 jun) |
| 4 | PDF token imprimible | ⏳ Pendiente |
| 5 | Integración Etiquetas ↔ Hoja de Ruta | ⏳ Pendiente |
| 6 | Producidas/Histórico + cierre OT | ⏳ Pendiente (PRÓXIMO GRANDE) |
| 7 | Expedición/Albarán | ⏳ Pendiente (depende B6 + Odoo) |

---

## 🔜 Tareas pendientes inmediatas

### Alta prioridad (usuario)
- [ ] Ampliar campos CTP tras reunión con Gemma
- [ ] Crear roles `preimpresion` en profiles para Marc y Gemma
- [ ] Meter `bultos_por_palet_default` reales de Gabri en `prod_cajas_embalaje`
- [ ] Probar flujo completo: CTP → Guillotina → Impresión → Troquelado → Desbroce → Engomado

### Prioridad media (desarrollo)
- [ ] Pulir Digital (Bloque 3.1 pendiente)
- [ ] Pulir Guillotina (compactar, salida real)
- [ ] Añadir CTP y Desbroce a plantillas de ruta en Settings
- [ ] Enganchar HojaRutaOtDialog en OTs Despachadas, Planificación y tarjeta Ejecución

### Siguiente bloque grande
- **Bloque 6**: `prod_ot_producidas` + lifecycle de cierre (`pendiente_revision` → `producida`) + snapshot JSONB híbrido + recálculo maestro desde últimas N OTs

---

## 🧠 Decisiones de diseño importantes (contexto para no repetirlas)

1. **JSONB para datos_proceso**: elegido sobre columnas fijas para evitar migraciones continuas al añadir procesos. Índice GIN para búsquedas eficientes.

2. **Config-driven**: `hoja-ruta-campos-config.ts` define la estructura → formularios generados automáticamente. Añadir un proceso = añadir una entrada en el config, no tocar componentes.

3. **Un solo componente HojaRutaOtDialog**: no mantener modal GPS aparte. Un concepto, muchos puntos de entrada.

4. **Fuente de datos de la hoja** es un join de 5 tablas: `prod_ots_general` + `produccion_ot_despachadas` + `prod_ot_pasos` + `prod_mesa_ejecuciones` + `prod_seguimiento_externos`.

5. **Etiquetas: flujo independiente** (no integrar en motor datos_proceso). Solo sincronización unidireccional al cierre.

6. **Bloque 6 lifecycle de cierre**: automático a `pendiente_revision` al finalizar último paso → manual a `producida` (revisión humana protege calidad del histórico).

7. **Odoo en el horizonte**: cuando llegue, la integración vía API/JSON será limpia. Minerva Hub captura datos de producción; Odoo para gestión/contabilidad. Albarán (Bloque 7) depende de esta decisión.

8. **Desbroce en área engomado** (no área propia): físicamente está en zona de engomado, las engomadoras siempre desbrozán antes. Máquina ficticia `ENG-DESBROZ`.

---

## 📁 Estructura de carpetas relevante

```
src/
  app/                    ← Next.js App Router
  components/
    produccion/
      hoja-ruta/          ← DatosProcesoForm, HojaRutaOtDialog
      planificacion/      ← ejecución en mesa, pipeline
  lib/
    hoja-ruta-campos-config.ts
    planificacion-analytics-query.ts
    sys-parametros-sobreproduccion.ts
  types/
    planificacion-mesa.ts
supabase/
  migrations/             ← historial de migraciones SQL
scripts/                  ← utilidades
repositorio/              ← documentación adicional
```

---

## 📋 Tablas Supabase principales

| Tabla | Descripción |
|-------|-------------|
| `prod_ots_general` | Cabecera de OTs |
| `produccion_ot_despachadas` | Ficha de despacho (material, tintas, troquel...) |
| `prod_ot_pasos` | Itinerario: pasos con `datos_proceso JSONB` |
| `prod_mesa_ejecuciones` | Ejecuciones reales por paso |
| `prod_mesa_ejecuciones_pausas` | Pausas y motivos |
| `prod_referencias` | Maestro de artículos |
| `prod_troqueles` | Ficha técnica de troqueles |
| `prod_procesos_cat` | Catálogo de procesos |
| `prod_maquinas` | Máquinas (incluye ficticias: ENG-DESBROZ, ENG-MANIP, CTP-MNRV) |
| `prod_etiquetas_hoja_ruta` | Hoja de ruta de etiquetas (flujo Hugo) |
| `prod_seguimiento_externos` | Externos por OT |
| `prod_cajas_embalaje` | Mini-maestro cajas embalaje (Bloque 3.2) |
| `prod_despacho_catalogo` | Catálogos genéricos (tipo engomado, etc.) |
| `sys_parametros` | Parámetros del sistema (márgenes semáforo, etc.) |
| `sys_motivos_pausa` | Motivos de pausa por tipo de máquina |
| `prod_ot_producidas` | ⏳ PENDIENTE (Bloque 6): snapshot histórico de OTs cerradas |
