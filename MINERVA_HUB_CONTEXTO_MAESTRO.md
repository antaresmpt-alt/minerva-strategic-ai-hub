# MINERVA HUB — Contexto Maestro
> **FUENTE DE VERDAD MAESTRA.** Pegar al inicio de cualquier sesión con Claude o Cursor para dar contexto completo del proyecto.
> Si hay contradicción con otros `.md`, este documento manda para visión/estado global. Para detalle fino por bloques, consultar `FASES_HOJA_RUTA_DIGITAL.md`.
> Última actualización: 23 jun 2026 (Bloque 9 cartelas: Juan, movimientos almacén, ID 10.310)

---

## 🧩 Cómo usar este contexto

**Uso recomendado con IA:**
1. Pegar siempre este archivo (`MINERVA_HUB_CONTEXTO_MAESTRO.md`).
2. Añadir solo el brief de la fase activa si aplica:
   - `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md`
   - `MINERVA_BLOQUE7_ODOO_ALBARANES.md`
   - `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`
   - `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`
3. Añadir `MINERVA_CONTEXTO_TECNICO.md` solo si la IA necesita detalles técnicos del repo.
4. Al cerrar una fase, actualizar este maestro + `FASES_HOJA_RUTA_DIGITAL.md`.

**Jerarquía documental:**
| Documento | Rol |
|-----------|-----|
| `MINERVA_HUB_CONTEXTO_MAESTRO.md` | Fuente de verdad global: visión, estado, decisiones y mapa del sistema. |
| `FASES_HOJA_RUTA_DIGITAL.md` | Roadmap detallado por bloques de Hoja de Ruta Digital. |
| `MINERVA_CONTEXTO_TECNICO.md` | Detalle técnico: árbol, configs, tipos, migraciones, SQL y módulos clave. |
| `MINERVA_BLOQUE*_*.md` | Brief específico de una fase activa o futura. |
| `MINERVA_BRIEFING.md` | Onboarding narrativo largo; útil, pero secundario frente a este maestro. |

---

## 🧭 Qué es Minerva Hub

Software a medida para la planta de producción gráfica/impresión de la empresa. Sustituye al ERP **Optimus** (rígido, sin APIs útiles). Desarrollado en solitario por **Manel** (oficina técnica, ex-programador) usando vibecoding con Cursor + Claude/Gemini.

**Estado**: Parcialmente en producción. Los jefes (Albert y Jordi) han apostado por Minerva Hub como plataforma principal de producción. Objetivo: prescindir de Optimus en 3-5 meses.

**Visión estratégica**: reemplazar Optimus + la hoja viajera en papel por una plataforma propia que cubra despacho, planificación, ejecución, Hoja de Ruta Digital, histórico de producidas, expedición y futura integración con Odoo.

**Principio UX clave**: captura por excepción. El operario debe picar lo mínimo posible: prefill desde despacho/histórico, derivaciones automáticas, previsto vs real claramente separado y UI compacta usable en tablet.

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

## 📚 Glosario rápido

| Término | Significado |
|---------|-------------|
| **OT** | Orden de Trabajo. Unidad de producción. Clave de negocio: nº OT / `num_pedido`. |
| **Despacho** | Ficha técnica inicial de la OT: material, hojas, tintas, troquel, poses, acabado y horas previstas. |
| **Referencia Minerva** | Código canónico de artículo `M-NNNNN`, enlazado a `referencia_cliente`. |
| **Itinerario / GPS** | Secuencia de pasos de una OT. Vive en `prod_ot_pasos`; es la fuente de verdad del progreso. |
| **Paso** | Etapa concreta del itinerario: proceso + orden + estado + máquina. |
| **Mesa** | Planificación drag & drop por máquina, día y turno. |
| **Ejecución** | Trabajo real en máquina: inicio/fin, maquinista, pausas, incidencias, datos reales. |
| **Hoja de Ruta Virtual** | Vista única que junta cabecera, despacho, itinerario, datos de proceso, ejecución, pausas y externos. |
| **`datos_proceso`** | JSONB en `prod_ot_pasos` con campos específicos por proceso. |
| **Previsto vs real** | Separación entre dato planificado y dato real capturado en planta. |
| **Poses** | Figuras/estuches por hoja; clave para pasar de hojas a estuches. |
| **Pico** | Bulto incompleto en engomado/embalaje. |
| **Producidas** | Futuro histórico inmutable de OTs cerradas (Bloque 6). |

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
| Marc / Gemma | Preimpresión — rol **`ctp`** en `profiles` (usuarios aún no creados en Supabase, jun 2026) |
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
- **Maestro de troqueles de etiquetas**: tabla `prod_etiquetas_troqueles` (pestaña "Troqueles etiq."). Simplificado para Hugo (13 jun): eliminadas columnas `cliente`/`trabajo` (BD + UI); dimensiones solo como `dimensiones_texto` (sin ancho/alto/diámetro en el modal); se mantiene `necesita_revision` como checkbox interno.

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
- **Limitación actual (16 jun 2026):** modelo 1:1 — una OT, una referencia, un `tamano_hoja`, un `poses`. No modela formas de impresión ni formatos distintos por proceso. Ver Bloque 8.

### ✅ Hoja de Ruta Digital (módulo principal EN PROGRESO)
Ver sección detallada abajo.

---

## 🔁 Flujo end-to-end de producción

```text
Maestro de Artículos / histórico / Optimus
  ↓
Despacho técnico de OT
  ↓
Pool de OTs
  ↓
Mesa de planificación por máquina, día y turno
  ↓
Ejecución en planta
  ↓
Hoja de Ruta Virtual + PDF acompañante
  ↓
Producidas / Histórico (Bloque 6)
  ↓
Expedición / Albarán / Odoo (Bloque 7)
```

**Encadenado productivo principal:**
```text
CTP / Preimpresión
  ↓
Guillotina (si aplica)
  ↓
Impresión Offset/Digital → hojas_impresas
  ↓
Troquelado → hojas_troqueladas
  ↓
Desbroce → estuches_desbrozados
  ↓
Engomado → estuches_engomados
  ↓
Manipulados / Encajado (si aplica)
```

---

## 🗺️ Hoja de Ruta Digital — Estado detallado

### Arquitectura elegida: Opción C (Virtual + PDF acompañante)
- Vista digital completa por departamento
- PDF A4 vertical beta con cabecera, itinerario, tarjetas por proceso, pausas y gráfico previsto/real
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
src/lib/hoja-ruta/
  hoja-ruta-query.ts                    ← loader fetchHojaRutaOt()
  hoja-ruta-formatters.ts               ← helpers compartidos modal/PDF
  hoja-ruta-pdf.ts                      ← exportador PDF acompañante
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
| 3 | HojaRutaOtDialog componente único | ✅ Completado (enganchado en Pipeline, Despachadas, Planificación y Ejecución) |
| 3.1 | Pulido Offset, Troquelado, Engomado | ✅ Completado (7-8 jun) |
| 3.2 | Engomado: cajas embalaje + picos | ✅ Implementado (9 jun) |
| 3.3 | Maestro: campos FSC | ✅ Implementado (9 jun) |
| 3.5 | Tipo engomado parametrizado | ✅ Implementado (9 jun) |
| 3.6 | Semáforo sobreproducción configurable | ✅ Implementado (9 jun) |
| 3.7 | CTP + Desbroce + Manipulados+Retractilado | ✅ Implementado (9 jun) |
| 3.8 | Pruebas campo CTP/externos/desbroce | ✅ Implementado (11 jun, merge main 16 jun) |
| 4 | PDF acompañante desde HojaRutaOtDialog | ✅ Beta implementada (11 jun) |
| 5 | Integración Etiquetas ↔ Hoja de Ruta | ⏳ Pendiente |
| 6 | Producidas/Histórico + cierre OT | ⏳ Pendiente (PRÓXIMO GRANDE) |
| 7 | Expedición/Albarán | ⏳ Pendiente (depende B6 + Odoo) |
| 8 | Formatos de hoja + formas + componentes (OT contenedor/hijas) | 🔄 En curso — **FORMATO ✅** + **8.0 ✅** + **8.1 ✅** + **8.1.1 ✅**; 8.2–8.4 pendiente — ver `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` |
| 9 | Material, cartelas de palet y stock libre | 📋 Diseño — **Fase A** 9.0–9.4 (core) · **Fase B** 9.5+ (muelle/foto) — ver `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` |

---

## 🔜 Tareas pendientes inmediatas

### Retomar aquí (18 jun 2026 noche)
- [x] **Fase FORMATO**: encadenado formato de hoja — commit `aadad81`, probado OT 98009
- [x] **Fase 8.0**: migración `ot_tipo` / `ot_padre_numero` + campos hija (`aedb353`)
- [x] **Fase 8.1**: agrupación UI Pool/Pipeline (contenedor + hijas expandibles, filtro tipo OT)
- [x] **Fase 8.1.1**: pool mesa lateral, material barco, merma impresión, prefill troquel, % pasos — rama `feature/bloque8.1-pool-mesa-ejecucion-fixes`
- [x] **OT prueba 98010**: 01 avanzada; 02 CTP confirmada; 03 pendiente pool — script `setup-contenedor-test-98010.mjs`
- [x] **Usuarios CTP**: `ctp@minervaglobal.es` (Gemma), `ctp2@minervaglobal.es` (Marc) — rol `ctp`
- [x] **Campos CTP**: cerrados de momento (checkboxes actuales suficientes)
- [ ] **Demo planta** (Albert/Jordi): guía en `GUIA_MAÑANA.md`
- [ ] **Fase 8.2**: wizard despacho contenedor + hijas (responder §12 planta antes)
- [ ] Preguntas a planta — ver §12 de `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`
- [x] **`bultos_por_palet_default`** de Gabri en `prod_cajas_embalaje` (cargado en prod 9 jun; seed en repo `20260618143200`)
- [x] **Plantillas de ruta**: Desbroce entre Troquelado y Engomado en 5 plantillas offset (`20260618143000`)
- [x] Probar flujo contenedor parcial: 98010-01 CTP → Impresión → Troquel → Desbroce disponible

### Prioridad media (desarrollo)
- [ ] Pulir Digital (Bloque 3.1 pendiente)
- [ ] Pulir Guillotina (compactar, salida real)
- [ ] Añadir CTP y Desbroce a plantillas de ruta en Settings
- [ ] Afinar diseño del PDF acompañante tras feedback real de planta/dirección

### Siguiente bloque grande
- **Bloque 6**: `prod_ot_producidas` + lifecycle de cierre (`pendiente_revision` → `producida`) + snapshot JSONB híbrido + recálculo maestro desde últimas N OTs

---

## 🧠 Decisiones de diseño importantes (contexto para no repetirlas)

1. **JSONB para datos_proceso**: elegido sobre columnas fijas para evitar migraciones continuas al añadir procesos. Índice GIN para búsquedas eficientes.

2. **Config-driven**: `hoja-ruta-campos-config.ts` define la estructura → formularios generados automáticamente. Añadir un proceso = añadir una entrada en el config, no tocar componentes.

3. **Un solo componente HojaRutaOtDialog**: no mantener modal GPS aparte. Un concepto, muchos puntos de entrada.

4. **Fuente de datos de la hoja** es un ensamblado de varias tablas: `prod_ots_general` + `produccion_ot_despachadas` + `prod_ot_pasos` + `prod_mesa_ejecuciones` + `prod_mesa_ejecuciones_pausas` + `sys_motivos_pausa` + `prod_seguimiento_externos`.

5. **Etiquetas: flujo independiente** (no integrar en motor datos_proceso). Solo sincronización unidireccional al cierre.

6. **Bloque 6 lifecycle de cierre**: automático a `pendiente_revision` al finalizar último paso → manual a `producida` (revisión humana protege calidad del histórico).

7. **Odoo en el horizonte**: cuando llegue, la integración vía API/JSON será limpia. Minerva Hub captura datos de producción; Odoo para gestión/contabilidad. Albarán (Bloque 7) depende de esta decisión.

8. **Desbroce en área engomado** (no área propia): físicamente está en zona de engomado, las engomadoras siempre desbrozán antes. Máquina ficticia `ENG-DESBROZ`.

9. **PDF acompañante**: existe beta desde `HojaRutaOtDialog`. No sustituye la vista digital; sirve como hoja física de apoyo/presentación y debe mantenerse derivado de la misma fuente de datos.

10. **Bloque 8 — OT contenedor + hijas (17 jun 2026)**: Optimus modela sub-unidades con PRE+TIR; Minerva adoptará **hijas como OTs reales en BD** agrupadas en UI (no listado plano). Formato = cadena por proceso. Convergencia variable según producto (no siempre desbroce). Itinerario por hija con override. Tipos: forma | componente | preimpresion | acabado. Briefing: `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`.

11. **Encadenado formato de pliego (17 jun 2026, Fase FORMATO ✅)**: por **orden de itinerario** (`prod_ot_pasos.orden`), no por tipo de proceso global. `tamano_hoja` en despacho = **Formato compra** (solo referencia de compra). Guillotina: `tamano_inicial` ← anterior, `tamano_final` → siguiente. Impresión/externos hojas: `formato_hojas`. Troquelado: `tamano_corte` es el troquel (independiente); banner muestra pliego de entrada. Módulo: `hoja-ruta-formato-encadenado.ts`. Probado OT 98009 (commit `aadad81`).

12. **Bloque 9 — Cartelas y stock (23 jun 2026, diseño)**: **Fase A** (9.0–9.4): `prod_stock_palets` + movimientos; **Juan** usuario principal (muelle + cartelas + entregas desde almacén). Cartela ≠ palet físico; sobrante = cartela que muta. ID Stock desde **10.310**. Déficit en vista Stock (MVP); `material_status` post-9.4. **Fase B** (9.5+): puente muelle/foto, IA. Briefing: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`.

13. **Higiene operativa (18 jun 2026)**: `bultos_por_palet_default` de Gabri versionado en migración seed (`20260618143200`). Plantillas offset: **Desbroce** insertado entre Troquelado y Engomado en 5 rutas (`20260618143000`). Rol usuario CTP = **`ctp`** (no `preimpresion`); permisos `produccion` + `produccion_ejecucion` en BD y `permissions.ts`. Marc/Gemma: usuarios aún no creados en Supabase.

14. **Bloque 8.1.1 — contenedor en campo (18 jun 2026)**: compra conjunta en padre; hijas heredan material en pool. Progreso barco = **pasos finalizados / pasos totales** (todas las hijas). Pool lateral mesa filtra por `planificacionTipoPaso` del itinerario (sin OTs con paso distinto ni `null`). Merma impresión: `brutas − merma = netas`. Troquel: prefill desde salida impresión. OT demo: **98010** (3 hijas). Rama: `feature/bloque8.1-pool-mesa-ejecucion-fixes`.

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
    hoja-ruta-formato-encadenado.ts   ← encadenado formato pliego (Bloque 8 Fase FORMATO)
    supabase-query-chunks.ts          ← consultas .in() troceadas (Pool/Pipeline)
    planificacion-analytics-query.ts
    sys-parametros-sobreproduccion.ts
  types/
    planificacion-mesa.ts
supabase/
  migrations/             ← historial de migraciones SQL
scripts/                  ← utilidades (p. ej. clone-ot-test.mjs)
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
| `prod_etiquetas_troqueles` | Maestro de troqueles de etiquetas (sin `cliente`/`trabajo` desde 13 jun) |
| `prod_seguimiento_externos` | Externos por OT |
| `prod_cajas_embalaje` | Mini-maestro cajas embalaje (Bloque 3.2) |
| `prod_despacho_catalogo` | Catálogos genéricos (tipo engomado, etc.) |
| `sys_parametros` | Parámetros del sistema (márgenes semáforo, etc.) |
| `sys_motivos_pausa` | Motivos de pausa por tipo de máquina |
| `prod_ot_producidas` | ⏳ PENDIENTE (Bloque 6): snapshot histórico de OTs cerradas |

---

## 🤖 Prompt recomendado para Claude / brainstorming

```text
Eres mi compañero de diseño de producto y arquitectura para Minerva Hub,
una plataforma de gestión de producción para una empresa de artes gráficas/packaging
que debe sustituir a Optimus en 3-5 meses.

Te paso el contexto maestro del proyecto. Léelo y, antes de proponer soluciones,
hazme las preguntas necesarias para no dar ideas genéricas.

Hoy quiero centrarme en: <TEMA o BLOQUE>.

Objetivos de la sesión:
- Cuestionar supuestos.
- Proponer 2-3 enfoques con trade-offs.
- Priorizar agilidad real en planta, no solo una UI bonita.
- Mantener coherencia con el modelo actual de Minerva.

--- CONTEXTO MAESTRO ---
<pegar MINERVA_HUB_CONTEXTO_MAESTRO.md>

--- BRIEF ESPECÍFICO (opcional) ---
<pegar MINERVA_BLOQUE6_... o MINERVA_BLOQUE7_... o MINERVA_BLOQUE8_... o MINERVA_BLOQUE9_... si aplica>
```
