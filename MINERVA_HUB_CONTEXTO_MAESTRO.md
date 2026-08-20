# MINERVA HUB — Contexto Maestro
> **FUENTE DE VERDAD MAESTRA.** Pegar al inicio de cualquier sesión con Claude o Cursor para dar contexto completo del proyecto.
> Si hay contradicción con otros `.md`, este documento manda para visión/estado global. Para detalle fino por bloques, consultar `FASES_HOJA_RUTA_DIGITAL.md`.
> Última actualización: **20 ago 2026** (Bloque 9.8 lab **98020** validado + backlog P0 (7.1, 7.2, 7.3) en `main`; pendiente: 9.8.3 / 9.8.6).

---

## 🧩 Cómo usar este contexto

**Uso recomendado con IA:**
1. **No duplicar en claude.ai Project** (copia muerta). Cursor / Claude Code leen el repo; `CLAUDE.md` ya apunta aquí.
2. Pegar siempre este archivo (`MINERVA_HUB_CONTEXTO_MAESTRO.md`) si el chat no carga `@` del repo.
3. Añadir solo el brief de la fase activa si aplica:
   - `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md`
   - `MINERVA_BLOQUE7_ODOO_ALBARANES.md`
   - `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`
   - `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`
   - `MINERVA_BLOQUE9_REASIGNACION_STOP.md` (9.8: liberar/reasignar/recomprar; OT **98019** + **98020** validadas)
   - `MINERVA_BLOQUE10_PRESUPUESTOS.md` (futuro)
   - `MINERVA_BLOQUE11_CALENDARIO_MAESTRO_LANZAMIENTO.md` (calendario = master planificar/lanzar)
   - `MINERVA_BLOQUE12_ROLES_PERMISOS_NAVEGACION.md` (landing por perfil — sept)
4. Añadir `MINERVA_CONTEXTO_TECNICO.md` solo si la IA necesita detalles técnicos del repo.
5. Si el tema es mesa / externos / itinerario post-despacho: `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md`.
6. Si el tema es Manipulados / Encajar / entrada a Producción: `SESION_14AGO2026_MANIPULADOS_ENCAJAR.md`.
7. Si el tema es cola de mesa / tableta / ejecución: `SESION_14AGO2026_EJECUCION_LISTA.md`.
8. Si el tema es prefill Ruta / muelle / cartela admin / envío Ramón: `SESION_17AGO2026_PREFILL_RUTA_MUELLE_B6.md`.
9. Si el tema es desasignar cartela / STOP formato / recompra / stock libre: `MINERVA_BLOQUE9_REASIGNACION_STOP.md` (+ `SESION_18AGO2026_STOP_MATERIAL.md` · **`SESION_19AGO2026_STOP_MATERIAL_98020.md`** lab 98020 · **`SESION_20AGO2026_BACKLOG_P0_STOP.md`** backlog P0).
10. Al cerrar una fase, actualizar este maestro + `FASES_HOJA_RUTA_DIGITAL.md`.

**Jerarquía documental:**
| Documento | Rol |
|-----------|-----|
| `MINERVA_HUB_CONTEXTO_MAESTRO.md` | Fuente de verdad global: visión, estado, decisiones y mapa del sistema. |
| `FASES_HOJA_RUTA_DIGITAL.md` | Roadmap detallado por bloques de Hoja de Ruta Digital. |
| `MINERVA_CONTEXTO_TECNICO.md` | Detalle técnico: árbol, configs, tipos, migraciones, SQL y módulos clave. |
| `MINERVA_BLOQUE*_*.md` | Brief específico de una fase activa o futura. |
| `MINERVA_ROLES_Y_NAVEGACION.md` | Diseño fino permisos/navegación (complementa Bloque 12). |
| `MINERVA_BLOQUE12_ROLES_PERMISOS_NAVEGACION.md` | Brief implementación: landing operario vs gestor. |
| `MINERVA_BLOQUE10_PRESUPUESTOS.md` | Bloque futuro: presupuestos, formas, versión real al copiar. |
| `MINERVA_BLOQUE11_CALENDARIO_MAESTRO_LANZAMIENTO.md` | Calendario OT como master de planificar + lanzar (con cuidado). |
| `MINERVA_REUNION_HOJA_RUTA_JUEVES.md` | Guía reunión demo 98010 + preguntas §12. |
| `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md` | Sesión 13 ago: imprimir fuera, anular al Pool, ajustar itinerario / reeditar despacho. |
| `SESION_14AGO2026_MANIPULADOS_ENCAJAR.md` | Sesión 14 ago (mañana): Encajar en Manipulados, flags wizard, Pool sin lápiz, `/produccion` → OTs. |
| `SESION_14AGO2026_EJECUCION_LISTA.md` | Sesión 14 ago (tarde): lista gorda ejecución, semáforo, perf, tableta por máquina (Ramón). |
| `SESION_17AGO2026_PREFILL_RUTA_MUELLE_B6.md` | Sesión 17 ago: prefill Ruta, cartela admin, Ramón brutas/netas, muelle, OT 98016 E2E. |
| `MINERVA_BLOQUE9_REASIGNACION_STOP.md` | Bloque 9.8: liberar/reasignar cartela, compra corrección, aviso formato, ledger. OT **98019** + **98020** validadas. Backlog P0 (reset planif, asignar stock, búsqueda) completado. |
| `SESION_18AGO2026_STOP_MATERIAL.md` | Sesión 18 ago: acuerdo spec 9.8 + alta 98019. |
| `SESION_19AGO2026_STOP_MATERIAL_98020.md` | Sesión 19 ago: lab 98020 A+B+C + commits 9.8.2/4/5 + backlog mañana. |
| `SESION_20AGO2026_BACKLOG_P0_STOP.md` | Sesión 20 ago: implementación tareas P0 (7.1, 7.2, 7.3) — reset planif, asignar desde stock, búsqueda cartelas. |
| `MINERVA_BRIEFING.md` | Onboarding narrativo largo; útil, pero secundario frente a este maestro. |

---

## 🧭 Qué es Minerva Hub

Software a medida para la planta de producción gráfica/impresión de la empresa. Sustituye al ERP **Optimus** (rígido, sin APIs útiles). Desarrollado en solitario por **Manel** (oficina técnica, ex-programador) usando vibecoding con Cursor + Claude/Gemini.

**Estado**: Parcialmente en producción. Los jefes (Albert y Jordi) han apostado por Minerva Hub como plataforma principal de producción. Objetivo: prescindir de Optimus en 3-5 meses.

**Visión estratégica**: reemplazar Optimus + la hoja viajera en papel por una plataforma propia que cubra despacho, planificación, ejecución, Hoja de Ruta Digital, histórico de producidas, expedición y futura integración con Odoo.

**Principio UX clave**: captura por excepción. El operario debe picar lo mínimo posible: prefill desde despacho/histórico, derivaciones automáticas, previsto vs real claramente separado y UI compacta usable en tablet.

**Paralelo septiembre 2026 (decisión 11 ago):** Optimus + Minerva a la vez. No hace falta smoke de 10–20 OTs fijas: en cada tanda de despacho se eligen **~3 OTs** para seguimiento E2E en Minerva (compra → llegada → stock/cartela → lanzar → ejecutar → cierre). Ir puliendo; usuarios nuevos → Bloque 12 cuando toque.

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
| **Producidas** | Histórico inmutable de OTs cerradas (Bloque 6 MVP ✅ — ver `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` §0). |

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
| Marc / Gemma | Preimpresión — rol **`ctp`** (`ctp@` / `ctp2@`). **Gemma Gaya (gerencia)** es otra cuenta: `gemma@minervaglobal.es`. |
| Gabri | Referente para datos de cajas de embalaje |

---

## 📦 Módulos existentes (en producción o funcionales)

### ✅ Gestión de Externos (Ramón)
- Módulo para gestionar proveedores externos
- **13 ago:** «Imprimir fuera» (1/2 → 21) desde Pool/mesa/ejecución. OT **98015** validada. Detalle: `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md`.
- **Captura envío/recepción:** modal al Enviado/Recibido. Ramón informa **brutas enviadas** + **netas a recibir** (default = brutas). Prefill brutas desde paso anterior cerrado (Guillotina/impresión), no desde el plan de despacho.
- **Muelle externos:** Juan ve **enviadas** y **netas deseadas**; apunta **recibidas**. Aviso fuerte solo si recibidas < netas. Encadenado al siguiente paso = recibidas.
- Integrado con el módulo de Hoja de Ruta (proceso "Externo" usa este módulo)

### ✅ Etiquetas (Hugo) — módulo más maduro
- Tabla: `prod_etiquetas_hoja_ruta`
- Flujo independiente: calendario I-/T-/N-, muelle, metros Konica; **PDF OK** (ago 2026)
- Procesos: KONICA (18), Troq_ETIQUETA (19), Num_ETIQUETA (20)
- Entrada hoy: manual / express. **Pendiente Bloque 5:** Rita lanza OTs despachadas digital → auto-filas Hugo (no bloquea paralelo)
- Maestro troqueles: `prod_etiquetas_troqueles` (sin cliente/trabajo desde 13 jun)

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
  planificacion-ots-ejecucion-tab.tsx   ← lista gorda + ExecutionCard lazy (14 ago tarde)
```

### Estado de bloques

| Bloque | Descripción | Estado |
|--------|-------------|--------|
| 1–4 | Motor HR, captura, HojaRutaOtDialog, PDF | ✅ **~100%** operativo (pulidos menores Digital/Guillotina/PDF). **14 ago:** Encajar + lista gorda ejecución |
| 5 | Etiquetas digital (Hugo) + puente Rita→Hugo | ✅ **Módulo más maduro** (meses en uso). ⏳ Solo falta lanzar OTs despachadas digital → hoja Hugo (o seguir entrada manual) |
| 6 | Producidas / cierre OT | ✅ MVP + promedios + oficiales + clone. ✅ Cierre **contenedor** 8.4 (snapshot barco) |
| 7 | Expedición / Albarán | ⏸ **Aparcado** hasta decisión Odoo |
| 8 | Contenedor / formas / hijas | 🔄 FORMATO–8.1 ✅ · **8.2 wizard MVP ✅** · 8.3 parcial · **8.4 cierre barco ✅** · **8.5 convergencia 📋 diseño** · 8.6 futuro · **captura envío externos ✅** |
| 9 | Material, cartelas, stock, calendario prod. | ✅ 9.0–9.6d + 9.4 + **§15.6.12** (13 ago). ✅ **9.8.1–2, 9.8.4–5 + stock libre** en `main` (19 ago); lab **98020** A+B+C validado. 📋 9.8.3, 9.8.6, cascade STOP. ⏳ OCR 9.7; fotos 9.10 |
| 10 | Presupuestos | ⏸ Futuro (más miga; tras Minerva estable) |
| 11 | Calendario = master planificar / lanzar | 🔄 **Éxito de uso** (Carlos/Jordi). Ampliar con cuidado: planificar sí; lanzar suave (pool/mesa) + conflictos de máquina. Sin reordenar el menú (convive con Pool/Mesa/Pipeline) |
| 12 | Roles, permisos, landing por perfil | 📋 **Documentado** — operario→ejecución; gestor→home rico. **14 ago:** 1 tableta/máquina (Ramón). Aparcado de código; crítico antes usuarios masivos |

Detalle 1–3.x histórico: ver commits jun / `FASES_HOJA_RUTA_DIGITAL.md`.

---

## 🔜 Tareas pendientes inmediatas

### Retomar aquí (18 ago 2026 — camino a TEST septiembre)
- [x] **Pipeline**: modo **compacto por defecto** (+ preferencia localStorage; `?compact=0` = extendida) (11 ago)
- [x] **Pipeline UX**: «Listo para cerrar» en pendientes de revisión (paso actual + badge) (11 ago)
- [x] **Pipeline perf**: `fetchAllInChunks` concurrencia 5; olas desp→(arch∥ot∥pool∥hijas)→pasos→(ejec∥ext); filtros search/incidencias/externo/estado en cliente; índice `despachado_at` (11 ago)
- [x] **Fase 8.4**: cierre OT contenedor cuando **todas las hijas** terminan → `pendiente_revision` / producida + snapshot barco (11 ago)
- [x] **Fase 8.5 (docs)**: convergencia A/B/C + `modo_sync`/`proceso_join` + override solo Planning — sin implementar (11 ago)
- [x] **Bloque 9 §15.6.12**: derivar OT a impresión externa post-despacho (13 ago — Pool/mesa/ejecución; OT 98015)
- [x] **Anular mesa → Pool** (13 ago): borra hueco; no deja la OT Terminada
- [x] **Ajustar itinerario vivo + reeditar despacho forzado** (13 ago): Ruta = cola pendiente; lápiz = cabecera a cuenta y riesgo (admin/oficina/gerencia). Noche: no wipe + prepend (`325429d`). Campo 14 ago: OT **36286**
- [x] **Captura envío/recepción externos** (modal al Enviado/Recibido; 98015 1600/1400)
- [x] **Manipulados Encajar + flags wizard** (14 ago — OT 36286)
- [x] **Entrada Producción** (14 ago): `/produccion` → `/produccion/ots`; lápiz fuera del Pool
- [x] **OTs en ejecución lista gorda** (14 ago tarde): semáforo, lazy parte, terminadas de hoy; perf query activas (`7ed10a9`, `4a57f03`)
- [x] **Prefill horas** al añadir proceso en Ruta — ✅ validado 98016
- [x] **Bloque 6.x** avisos calidad al cierre + comparar versiones OT — ✅ código; comparar OK en 98009
- [x] **Muelle externos** enviadas + **netas deseadas** + recibidas → encadenado — ✅ 98016 (1850 / 1800)
- [x] **Cartela admin** en paso cerrado (corregir/editar; reabrir admin/gerencia) — ✅ 98016 Guillotina palet 99018
- [x] **Ramón brutas/netas** al Enviado; no usar el 200 del plan — ✅ 98016
- [x] **Troquelado** pisa `hojas_troquelar` con recibidas del anterior — 17 ago tarde
- [x] **Spec 9.8** reasignación/STOP + OT laboratorio **98019** — 18 ago (`MINERVA_BLOQUE9_REASIGNACION_STOP.md`)
- [x] **9.8.1 + 9.8.1b** — 98019-A (18 ago) + 98020-A (19 ago)
- [x] **9.8.2** aviso formato CTP/Guillotina/Impresión — `acca03b` · 98020 A/B
- [x] **9.8.4** asignar stock libre → OT — 98020-C (#10985)
- [x] **9.8.5** revertir consumo + anti-doble — 98020-B (#99021)
- [x] **Compra/cartela sin OT** (entrada stock libre) — `c93205e` · OCM-STOCK + #99022
- [x] **Fix reabrir paso** mesa (`prod_mesa_planificacion_trabajos`) — `14fc084`
- [ ] **9.8.3** compra corrección P2 desde Despachadas
- [ ] **9.8.6** popup redespacho asistido
- [ ] **Reset planificación STOP** (botón + confirmación; brief §19) — P0 mañana
- [ ] **Asignar OT en Stock** + **Cartelas búsqueda server-side** — P0 mañana
- [ ] **Bloque 11** (con cuidado): planificar/mover desde calendario; lanzar ≠ pisar plan de otra máquina — `MINERVA_BLOQUE11_…`
- [ ] **Bloque 12** (cuando toque usuarios): landing operario/gestor; tableta = máquina — `MINERVA_BLOQUE12_…` (no abrir ya; default gestor = maestro OTs)
- [ ] **Bloque 5 puente**: Rita lanza OTs a Hugo (no bloquea paralelo si Hugo sigue a mano)

### Prioridad inmediata (20 ago 2026)

1. **Reset planificación STOP** (botón + confirmación) — brief §19 / sesión 19 ago §7.1
2. **Asignar OT en Stock** + **Cartelas server-side search**
3. **9.8.3** compra corrección · **9.8.6** redespacho popup
4. Polish: observaciones CTP, KPI reservas blandas, `estado_material` sync

### Hecho reciente (jul–ago)
- [x] **19 ago:** lab **98020** A+B+C validado; commits 9.8.2/4/5 + stock libre — `SESION_19AGO2026_STOP_MATERIAL_98020.md`
- [x] **18 ago:** spec Bloque 9.8 + OT **98019** + 98019-A validada — `SESION_18AGO2026_STOP_MATERIAL.md`
- [x] **17 ago:** OT 98016 E2E (Ruta, cartela, Imprimir fuera, Ramón/Juan, plastificado, troquel) — `SESION_17AGO2026_PREFILL_RUTA_MUELLE_B6.md`
- [x] **14 ago tarde:** lista gorda OTs en ejecución + perf tableta — `SESION_14AGO2026_EJECUCION_LISTA.md`
- [x] **14 ago:** Encajar en Manipulados, flags Retractilar/Etiquetar/Encajar en wizard, Pool sin lápiz, portada → OTs — `SESION_14AGO2026_MANIPULADOS_ENCAJAR.md`
- [x] **13 ago:** imprimir fuera (1/2→21), anular mesa→Pool, ajustar itinerario vivo, wizard despacho forzado (sin wipe) — `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md`
- [x] Bloque 6 MVP + engomado prep/tiraje + promedios A–D + oficiales + decimales `.`/, + clone overwrite (horas/caja/CTP) + 3 OTs en resumen
- [x] PDF OK etiquetas digital (Hugo)
- [x] Bloque 8.2 wizard contenedor MVP; 8.1 agrupación Pool/Pipeline; FORMATO encadenado
- [x] Bloque 9 cartelas/stock/calendario producción
- [x] Usuarios CTP / gerencia / OT (jun–jul)

### Prioridad media
- [ ] Pulir Digital / Guillotina; PDF acompañante — **aparcado** hasta TEST con Rita + Patricia/Paula (OK v1 primera tanda; ver sesión 17 ago)
- [ ] 8.6 / engomado por ref. solo si barcos multi-ref diarios lo exigen
- [ ] **8.5** convergencia B/C cuando un barco real lo pida (docs listos en Bloque 8)
- [ ] 9.7 OCR albarán (baja); sobrantes al cierre (B6+B9)
- [ ] Preguntas §12 planta (CTP hija) si hace falta antes de 8.4 fino

### Siguiente foco (orden sugerido 20 ago)
1. **Reset planificación STOP** + **Asignar OT en Stock** — brief §19
2. **9.8.3** compra corrección · **9.8.6** redespacho popup
3. Polish 9.8 (observaciones CTP, KPI reservas, `estado_material`)
4. **Bloque 11** (con cuidado) · **Bloque 12** (sept) · **B5** Rita→Hugo
5. Digital/Guillotina/PDF — feedback planta en TEST

---

## 🧠 Decisiones de diseño importantes (contexto para no repetirlas)

1. **JSONB para datos_proceso**: elegido sobre columnas fijas para evitar migraciones continuas al añadir procesos. Índice GIN para búsquedas eficientes.

2. **Config-driven**: `hoja-ruta-campos-config.ts` define la estructura → formularios generados automáticamente. Añadir un proceso = añadir una entrada en el config, no tocar componentes.

3. **Un solo componente HojaRutaOtDialog**: no mantener modal GPS aparte. Un concepto, muchos puntos de entrada.

4. **Fuente de datos de la hoja** es un ensamblado de varias tablas: `prod_ots_general` + `produccion_ot_despachadas` + `prod_ot_pasos` + `prod_mesa_ejecuciones` + `prod_mesa_ejecuciones_pausas` + `sys_motivos_pausa` + `prod_seguimiento_externos`.

5. **Etiquetas: flujo independiente** (no integrar en motor datos_proceso). Solo sincronización unidireccional al cierre.

6. **Bloque 6 lifecycle de cierre (MVP 23 jul ✅; engomado prep/tiraje 27 jul ✅)**: estado `pendiente_revision` **derivado** (no columna OT) → revisión humana → INSERT `prod_ot_producidas`. Reapertura versiona. Engomado captura prep + tiraje (como impresión/troquel); guillotina/CTP/desbroce = un solo campo horas. Recálculo maestro = bajo demanda (aún pendiente UI). Detalle: briefing B6 §0.

7. **Odoo en el horizonte**: cuando llegue, la integración vía API/JSON será limpia. Minerva Hub captura datos de producción; Odoo para gestión/contabilidad. Albarán (Bloque 7) depende de esta decisión.

8. **Desbroce en área engomado** (no área propia): físicamente está en zona de engomado, las engomadoras siempre desbrozán antes. Máquina ficticia `ENG-DESBROZ`.

9. **PDF acompañante**: existe beta desde `HojaRutaOtDialog`. No sustituye la vista digital; sirve como hoja física de apoyo/presentación y debe mantenerse derivado de la misma fuente de datos.

10. **Bloque 8 — OT contenedor + hijas (17 jun 2026)**: Optimus modela sub-unidades con PRE+TIR; Minerva adoptará **hijas como OTs reales en BD** agrupadas en UI (no listado plano). Formato = cadena por proceso. Convergencia variable según producto (no siempre desbroce). Itinerario por hija con override. Tipos: forma | componente | preimpresion | acabado. Briefing: `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`.

11. **Encadenado formato de pliego (17 jun 2026, Fase FORMATO ✅)**: por **orden de itinerario** (`prod_ot_pasos.orden`), no por tipo de proceso global. `tamano_hoja` en despacho = **Formato compra** (solo referencia de compra). Guillotina: `tamano_inicial` ← anterior, `tamano_final` → siguiente. Impresión/externos hojas: `formato_hojas`. Troquelado: `tamano_corte` es el troquel (independiente); banner muestra pliego de entrada. Módulo: `hoja-ruta-formato-encadenado.ts`. Probado OT 98009 (commit `aadad81`).

12. **Bloque 9 — Cartelas y stock (18 jul 2026)**: **9.0–9.6d + 9.4 A/B/C** en `main`. Consumo cartela guillotina/impresión/troquel/imp. externa. **Sesión 18 jul:** Calendario Producción UX (pastillas, progreso HR, mini-modal, PDF grid + listado papel), impresión cartela **1 copia**, fix crash menú PDF. Briefing §15.10–15.12: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`. **§15.6.12 ✅ 13 ago:** «Imprimir fuera» Pool/mesa/ejecución (1/2 → 21). Detalle: `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md`. **9.8 📋 18 ago:** reasignar/STOP — ledger manda, no anular OC, 9.8.1b allowlist en el mismo PR que liberar. Brief: `MINERVA_BLOQUE9_REASIGNACION_STOP.md`. OT lab **98019**.

13. **Higiene operativa (18 jun 2026)**: `bultos_por_palet_default` de Gabri versionado en migración seed (`20260618143200`). Plantillas offset: **Desbroce** insertado entre Troquelado y Engomado en 5 rutas (`20260618143000`). Rol usuario CTP = **`ctp`** (no `preimpresion`); permisos `produccion` + `produccion_ejecucion` en BD y `permissions.ts`. Marc/Gemma: usuarios aún no creados en Supabase.

14. **Bloque 8.1.1 — contenedor en campo (18 jun 2026)**: compra conjunta en padre; hijas heredan material en pool. Progreso barco = **pasos finalizados / pasos totales** (todas las hijas). Pool lateral mesa filtra por `planificacionTipoPaso` del itinerario (sin OTs con paso distinto ni `null`). Merma impresión: `brutas − merma = netas`. Troquel: prefill desde salida impresión. OT demo: **98010** (3 hijas). Rama: `feature/bloque8.1-pool-mesa-ejecucion-fixes`.

15. **Roles, permisos y navegación → Bloque 12 (23 jun diseño · 11 ago formalizado · 14 ago tabletas)**: capa transversal. Sistema actual híbrido (`permissions.ts` + `role_permissions`). MVP sept: landing operario→ejecución / gestor→home / Hugo→etiquetas; menú que oculta. **Campo Ramón 14 ago:** una tableta **por máquina** (impresión/troquel/engomado); turnos distintos, no concurrentes (Abraham/David). Multi-rol y permiso por máquina = después. **Implementación aparcada.** Brief: `MINERVA_BLOQUE12_…` · diseño: `MINERVA_ROLES_Y_NAVEGACION.md`.

16. **Bloque 8.1.2 — agrupación maestro y despachadas (23 jun 2026)**: misma UX barco que Pool/Pipeline en **Maestro OTs** y **OTs despachadas** (`ots-contenedor-display.ts`, expandir hijas lazy). Filtro vista: agrupado | solo simples | solo contenedores | todas planas. Maestro paginado excluye hijas en servidor cuando no es vista plana.

17. **Bloque 10 — Presupuestos (23 jun 2026, diseño)**: **después** de cartelas (9) y Minerva estable. Hoy las hijas se parten en **despacho** (8.2); futuro: formas en presupuesto + **versión real** al copiar. Briefing: `MINERVA_BLOQUE10_PRESUPUESTOS.md`.

18. **Calendario Producción (17–18 jul + multi-ámbito 24 jul + marca hecho 30 jul)**: planificador manual OTs. **Ámbitos** Impresión/Digital/Troquelado/Engomado. Semáforo pastilla = estado HR del ámbito. **Marca manual «hecho»** (`marcado_hecho`). Tabla `prod_calendario_produccion_ot`. Detalle §15.11–15.13 Bloque 9. **Éxito de adopción** (Carlos/Jordi, ago 2026).

19. **Cartelas impresión (18 jul 2026)**: **1 copia** por palet (antes 2). Confirmado Emma/Ramón.

20. **Bloque 11 — Calendario como master (28 jul idea · 11 ago matiz)**: quieren planificar **y** desplazar desde calendario; visión Albert de home ≠ Pipeline sino calendario. **Lanzar con cuidado:** preferible a pool/mesa sin pisar slots ajenos; o provisional + confirmar plan. **Conflictos de máquina/día** (Carlos día 9 vs Antonio ya tiene día 8) → bloquear o avisar fuerte. **No reordenar el menú** mientras se amplía: calendario convive con Pool/Mesa/Pipeline. Brief: `MINERVA_BLOQUE11_…`.

21. **Paralelo septiembre (11 ago 2026)**: no smoke fijo 10–20; por tanda de despacho elegir **~3 OTs** y seguir E2E en Minerva. Cierre contenedor MVP: **barco listo cuando todas las hijas terminan** (8.4) ✅. Convergencia física = 8.5 documentada, sin código aún.

22. **Itinerario y mesa flexibles (13 ago 2026)**: (a) **Imprimir fuera** sustituye Offset/Digital disponible por proceso 21; no inserta un 21 extra. (b) **Anular mesa borra el hueco** y devuelve al Pool (`en_transito`); no deja `estado_mesa = finalizada`. (c) **Ruta** en OTs Despachadas ajusta solo la cola `pendiente`/`disponible`; pasos en marcha/finalizados van con candado. (d) **Lápiz** puede forzar cabecera/material aunque haya compra: roles `admin` / `oficina_tecnica` / `gerencia`, con aviso. Compra **no** es el candado del itinerario. Wizard con pasos bloqueados **no** hace delete+insert del itinerario.

23. **Manipulados y entrada (14 ago 2026)**: Encajar vive en proceso 15 (no en Engomado) con `estuches_por_bulto` distinto de retractilar. Redespacho solo en OTs Despachadas (Pool sin lápiz). `/produccion` redirige al maestro de OTs hasta Bloque 12.

24. **Cola de ejecución táctil (14 ago 2026 tarde)**: lista gorda + semáforo; parte completo lazy al expandir; terminadas ocultas (filtro «de hoy» readonly). Query solo activas + catálogos cacheados; pestañas Planificación lazy. Tableta de planta = **máquina**, no persona. Detalle: `SESION_14AGO2026_EJECUCION_LISTA.md`.

25. **Bloque 9.8 — Reasignación / STOP (18–19 ago 2026)**: ledger ATP manda; tres casos A/B/C. **Código en `main`:** 9.8.1–2, 9.8.4–5, compra sin OT. **Lab validado:** 98019-A (18 ago), **98020 A+B+C** (19 ago). Pendiente cascade planificación + 9.8.3/9.8.6. Brief §18 · sesión `SESION_19AGO2026_STOP_MATERIAL_98020.md`.

## 📁 Estructura de carpetas relevante

```
src/
  app/                    ← Next.js App Router
  components/
    produccion/
      hoja-ruta/          ← DatosProcesoForm, HojaRutaOtDialog
      planificacion/      ← ejecución lista gorda, pipeline (pestañas lazy 14 ago)
  lib/
    hoja-ruta-campos-config.ts
    hoja-ruta-formato-encadenado.ts   ← encadenado formato pliego (Bloque 8 Fase FORMATO)
    derivar-impresion-externa.ts      ← imprimir fuera + anular mesa→Pool (13 ago)
    prod-ot-itinerario-client.ts      ← replace total + insertarPasosEnColaViva
    despacho-wizard-shared.ts         ← seed flags Manipulados (14 ago)
    supabase-query-chunks.ts          ← .in() troceados + concurrencia 5 (Pool/Pipeline/ejecución)
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
| `prod_ot_producidas` | ✅ Bloque 6 MVP: snapshot + planas; reapertura versionada; trigger inmutabilidad |

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
