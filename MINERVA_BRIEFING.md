# MINERVA — Briefing Estratégico (Contexto para Brainstorming)

> **Para qué sirve este documento**
> Es un *briefing* pensado para poner en contexto a un modelo de IA (p. ej. Claude) antes de
> una sesión de brainstorming / diseño de producto, sin necesidad de leer el código.
> **Documento secundario**: la fuente de verdad maestra es `MINERVA_HUB_CONTEXTO_MAESTRO.md`.
> Usar este archivo como onboarding narrativo largo cuando haga falta más explicación.
> Si se necesita bajar al detalle técnico (estructura de carpetas, configs, tipos, migraciones),
> ver el documento complementario **`MINERVA_CONTEXTO_TECNICO.md`**.
>
> Fecha: 13 de junio de 2026.

---

## 0. Resumen en 60 segundos

**Minerva** es un *hub* web interno de una **empresa de artes gráficas / packaging** (impresión de
estuches y cajas de cartón, etiquetas, etc.). Empezó como herramienta de marketing/estrategia con IA,
pero su **uso real y prioritario hoy es el módulo de Producción**.

**El objetivo estratégico actual**: convertir Minerva en la **plataforma central de gestión de
producción de planta**, capaz de **sustituir a "Optimus"** (el software legacy actual) en un
horizonte de **3-5 meses**, con una transición por fases.

La pieza **CORE** de esa visión es la **Hoja de Ruta Digital** (la "hoja viajera" virtual): el
documento vivo que acompaña a cada Orden de Trabajo (OT) por todos los procesos de la planta,
capturando datos reales en tiempo real (previsto vs real), generando histórico reutilizable y
alimentando una planificación más precisa.

---

## 1. Contexto de negocio

### 1.1. La empresa y el problema
- Empresa de **artes gráficas / packaging**: produce estuches, cajas y etiquetas de cartón.
- Hoy la planta funciona con **Optimus** (legacy) + una **"hoja viajera" en papel** que acompaña
  físicamente cada trabajo y donde cada departamento (impresión, troquelado, engomado, etc.) apunta
  a mano lo que hace.
- Problemas del modelo actual: datos en papel que se pierden, sin histórico explotable, planificación
  imprecisa, dependencia de un software legacy, "¿qué material/troquel usamos la última vez?" sin
  respuesta fiable.

### 1.2. La visión
Sustituir Optimus + papel por Minerva, ofreciendo:
1. **Gestión de producción personalizable** y adaptada a *su* forma de trabajar.
2. **Retención de datos** (histórico inmutable de lo producido).
3. **Seguimiento de proceso** ("Traveling Routing Sheet" / Hoja de Ruta Virtual).
4. **Planificación mejorada** (mesa de secuenciación por máquina/turno, con IA opcional).
5. **Integración con Odoo** (ERP — decisión de alcance aún abierta).
6. **Transición por fases**, sin parar la operación.

### 1.3. Personas / roles reales (aparecen en el dominio)
- **Carlos**: rol `produccion` (lo ve todo).
- **Marc y Gemma**: preimpresión (CTP).
- **Hugo**: departamento de **etiquetas digital** (flujo propio independiente: KONICA, troqueladora,
  numeradora).
- **Gabri**: aporta datos de embalaje (bultos por palet por tipo de caja).
- El **usuario** que dirige el proyecto hace de product owner + valida en planta.

### 1.4. Preocupación explícita del usuario (importante para el brainstorming)
> *"Tengo la mosca detrás de la oreja de que la app, tal como la diseñamos, sea bonita pero poco ágil
> en el día a día. Generamos muchas líneas de datos... ¿aguantará el ritmo de planta? ¿cómo lo hacen
> los mejores software de planificación y captura de datos en planta (MES/APS)?"*

Esto marca un principio de diseño transversal: **captura por excepción**, mínimo picado de datos,
prefill desde histórico/plan, derivaciones automáticas y UI compacta apta para **tablet en planta**.

---

## 2. Glosario de dominio (imprescindible)

| Término | Significado |
|---|---|
| **OT** | Orden de Trabajo. Unidad de producción (un pedido/trabajo). Clave de negocio: nº OT / `num_pedido`. |
| **Despacho** | Acto de "fichar" técnicamente una OT: material, gramaje, hojas, tintas, troquel, poses, acabado, horas previstas. Es el snapshot técnico inicial. |
| **Referencia Minerva** | Código canónico de artículo `M-NNNNN` (maestro de artículos). Se enlaza al **código del cliente** (`referencia_cliente`, ej. `EU858`). |
| **Maestro de Artículos** | Ficha canónica "cómo se hace / cómo debería hacerse" un artículo (`prod_referencias`). |
| **Itinerario / Ruta / GPS** | Secuencia ordenada de **pasos** (procesos) que recorre una OT. Vive en `prod_ot_pasos`. Es la **fuente de verdad** del progreso. |
| **Paso** | Una etapa del itinerario de una OT (un proceso concreto en un orden concreto). |
| **Proceso** | Tipo de operación (Impresión Offset, Troquelado, Engomado, CTP, Desbroce, Externos...). Catálogo `prod_procesos_cat`. |
| **Pool de OTs** | Bandeja de OTs despachadas a la espera de planificarse. |
| **Mesa (de secuenciación)** | Tablero de planificación drag & drop por **máquina × día × turno** (mañana/tarde). |
| **Ejecución** | Registro operativo real cuando una OT se trabaja en máquina (`prod_mesa_ejecuciones`): maquinista, inicio/fin, horas reales, pausas, incidencias. |
| **Hoja de Ruta (Virtual)** | Vista única que **junta** cabecera + despacho + itinerario + `datos_proceso` + ejecución + pausas + externos. Reemplaza la hoja viajera de papel. |
| **`datos_proceso`** | Campo **JSONB** en cada paso (`prod_ot_pasos.datos_proceso`) donde se guardan los campos específicos de ese proceso (flexible, sin migraciones por cada campo nuevo). |
| **Previsto vs Real** | Cada proceso captura valores planificados (previsto) y lo que realmente pasó (real). Base de la mejora de planificación. |
| **Merma** | Hojas/unidades desechadas en un proceso. |
| **Poses** | Nº de estuches/figuras por hoja (clave para encadenar hojas → estuches). |
| **Bulto / Pico / Palet** | Embalaje: estuches → bultos (cajas) → palets. "Pico" = bulto incompleto (resto). |
| **Externos** | Procesos subcontratados (plastificado, stamping, ventana, forrado...). Tienen su propia trazabilidad (proveedor, envío, recepción). |
| **Producidas / Histórico** | OTs terminadas, congeladas en snapshot inmutable (futuro, Bloque 6). |
| **Optimus** | Software legacy actual que Minerva pretende sustituir. |
| **Odoo** | ERP externo. Pendiente decidir si Minerva emite albaranes o solo exporta a Odoo. |

---

## 3. Flujo de producción end-to-end

```
   MAESTRO DE ARTÍCULOS (prod_referencias)         OPTIMUS (legacy, import)
            │  (prefill técnico)                          │
            ▼                                             ▼
   1) DESPACHO ──────────────────────────────► OT fichada técnicamente
      (produccion_ot_despachadas)               (material, tintas, troquel,
            │                                     poses, hojas, horas previstas)
            ▼
   2) POOL DE OTs  (prod_planificacion_pool)
      (bandeja de espera para planificar)
            │
            ▼
   3) MESA / PLANIFICACIÓN  (prod_mesa_planificacion_trabajos)
      drag&drop por máquina × día × turno (+IA opcional de reordenado)
            │   5 áreas: preimpresión · impresión · troquelado · engomado · (digital)
            ▼
   4) EJECUCIÓN  (prod_mesa_ejecuciones + _pausas)
      el maquinista inicia/pausa/reanuda/finaliza; captura datos reales
      por proceso en prod_ot_pasos.datos_proceso (formulario dinámico)
            │   encadenado salida→entrada + semáforos (déficit/sobreproducción)
            ▼
   5) HOJA DE RUTA VIRTUAL  (HojaRutaOtDialog)  ◄── vista única transversal
      junta todo lo anterior + externos + pausas; exporta PDF "hoja viajera"
            │
            ▼
   6) PRODUCIDAS / HISTÓRICO  (prod_ot_producidas)  [PENDIENTE - Bloque 6]
      snapshot inmutable al cerrar; alimenta medias del maestro
            │
            ▼
   7) EXPEDICIÓN / ALBARÁN  [PENDIENTE - Bloque 7, depende de Odoo]
```

### Encadenado de cantidades (salida de un proceso = entrada del siguiente)
```
Impresión (1/2) → hojas_impresas
   ↓
Troquelado (10) → hojas_troqueladas         [entra de 1,2]
   ↓
Desbroce (22)   → estuches_desbrozados       [entra de 10]   (hojas × poses)
   ↓
Engomado (12)   → estuches_engomados         [entra de 22 o 10]
```
Sobre este encadenado se calculan **semáforos** comparando la proyección con el pedido:
🟢 OK · 🟡 precaución · 🔴 déficit (proyección < pedido − margen) · 🟠 sobreproducción (proyección > pedido + margen). Márgenes configurables por proceso.

---

## 4. Arquitectura técnica (resumen)

- **Frontend / framework**: **Next.js 16 (App Router) + React 19 + TypeScript**, Tailwind v4, shadcn,
  Zustand. (Nota: esta versión de Next tiene cambios disruptivos respecto a versiones conocidas.)
- **Backend / datos**: **Supabase** (Postgres + Auth + **RLS**). Sin backend propio: la lógica vive en
  el frontend + funciones/políticas en Supabase. Hay un **MCP de Supabase** disponible.
- **IA**: Vercel AI SDK + Google Gemini (histórico) + Anthropic + OpenAI (multi-proveedor vía
  `llm-router`). Usos: análisis, generación de activos, import desde Optimus, reordenado de
  planificación.
- **PDF / Export**: jsPDF + autotable (hoja de ruta, planificación), xlsx (Excel).
- **Drag & drop**: dnd-kit (mesa de planificación).

### Decisiones de arquitectura clave (y su porqué)
1. **`datos_proceso` en JSONB + config-driven (TypeScript)**: cada proceso define sus campos en
   `src/lib/hoja-ruta-campos-config.ts` y el formulario se genera solo. Permite añadir campos sin
   migraciones continuas. *Trade-off*: el filtrado/consulta sobre JSONB es menos eficiente → se prevé
   "aplanar" a columnas indexadas en el histórico (Bloque 6).
2. **Hoja de Ruta = un único componente** (`HojaRutaOtDialog`) con **muchos puntos de entrada**
   (Pipeline, Despachadas, Planificación, tarjeta de Ejecución). Evita tener dos vistas que se
   desincronizan.
3. **La hoja no es una tabla única**: se **monta juntando** 6 fuentes (cabecera, despacho, itinerario
   + `datos_proceso`, ejecución, pausas, externos) mediante un loader (`fetchHojaRutaOt`).
4. **Snapshots autocontenidos en la mesa**: la tarjeta de planificación guarda copias (cliente, papel,
   tintas...) para pintarse sin joins. *Trade-off*: duplicación controlada por rendimiento de UI.
5. **Cambios aditivos / no destructivos**: columnas nuevas siempre `nullable`; los imports no borran
   datos existentes; el clonado nunca pisa lo que ya hay.
6. **Captura por excepción**: prefill desde despacho/plan, siembra de valores, derivaciones
   automáticas (`buenas = netas − merma`, `palets = f(estuches, caja)`...). Objetivo: minimizar el
   picado del operario en tablet.

> Para auditoría real de tablas/campos del pipeline ver `DATA_MAPPING_PIPELINE_MVP.md`.

---

## 5. Modelo de datos (tablas núcleo)

| Tabla | Rol |
|---|---|
| `prod_ots_general` | Cabecera de OT (cliente, título, cantidad, prioridad, fecha entrega, estado). |
| `produccion_ot_despachadas` | Snapshot técnico del despacho (material, hojas, tintas, troquel, poses, horas previstas...). |
| `prod_referencias` | Maestro de Artículos (`M-NNNNN`), datos técnicos canónicos + FSC. |
| `prod_ot_pasos` | **Itinerario**: pasos por OT (orden, proceso, máquina, estado) + **`datos_proceso` JSONB**. Fuente de verdad del progreso. |
| `prod_procesos_cat` | Catálogo de procesos (id, nombre, sección, es_externo, tipo planificación). |
| `prod_maquinas` | Catálogo de máquinas/recursos (tipo: impresión/digital/troquelado/engomado/preimpresión). |
| `prod_planificacion_pool` | Pool/bandeja de OTs (lifecycle: pendiente/enviada_mesa/en_transito/cerrada). |
| `prod_mesa_planificacion_trabajos` | Plan en calendario (máquina × día × turno) con snapshots. |
| `prod_mesa_ejecuciones` | Ejecución real (maquinista, inicio/fin, horas reales, incidencias). |
| `prod_mesa_ejecuciones_pausas` | Pausas con motivo (`sys_motivos_pausa`, parametrizable por tipo de máquina). |
| `prod_seguimiento_externos` | Trazabilidad de procesos subcontratados (proveedor, envío, recepción). |
| `prod_cajas_embalaje` | Mini-maestro de cajas (estuches/bulto, bultos/palet) para cálculo de embalaje. |
| `prod_etiquetas_hoja_ruta` | Flujo **independiente** del depto. etiquetas (Hugo): calendario, muelle, metros Konica. |
| `prod_despacho_catalogo` | Catálogos parametrizables de despacho (p. ej. tipos de engomado). |
| `sys_parametros` | Parámetros del sistema (p. ej. márgenes de sobreproducción por proceso). |

**Procesos conocidos** (ids en `prod_procesos_cat`): 1 Offset · 2 Digital plano · 10 Troquelado ·
12 Engomado · 15 Manipulados internos · 16 CTP/Preimpresión · 17 Guillotina · 22 Desbroce ·
18/19/20 Etiquetas (KONICA/Troq/Num — fuera del motor `datos_proceso`) · 3-9, 11, 13, 14, 21 Externos.

---

## 6. Estado actual (qué está hecho y qué falta)

> Roadmap completo y detallado en **`FASES_HOJA_RUTA_DIGITAL.md`**. Resumen:

### ✅ Hecho
- **Bloque 1** — Motor de campos por proceso (JSONB + config TypeScript + formulario dinámico).
- **Bloque 2 / 2.1** — Captura desde ejecución + cabecera de despacho + prefill + limpieza UI + sync a
  columnas legacy para analíticas.
- **Bloque 2.2** — Auto-enriquecimiento de troquelado desde `prod_troqueles`.
- **Bloque 2.5** — Encadenado salida→entrada + semáforo de déficit.
- **Bloque 3** — **Hoja de Ruta Virtual** (`HojaRutaOtDialog` + `fetchHojaRutaOt`), enganchada en
  Pipeline, Despachadas, Planificación y tarjeta de Ejecución.
- **Bloque 3.1** — Pulido de captura (layout compacto por `width`, previsto vs real resaltado,
  derivaciones, densidades de tinta con guía ISO 12647). Persistencia robusta en todas las acciones.
- **Bloque 3.2** — Engomado: cajas de embalaje + cálculo de bultos/picos/palets con tolerancia.
- **Bloque 3.3** — Maestro: campos FSC (sí/no + fecha validación).
- **Bloque 3.5/3.6/3.7** — Tipo de engomado parametrizado; semáforo de sobreproducción configurable;
  nuevos procesos **CTP/Preimpresión**, **Desbroce** y **Manipulados con retractilado** (+ 5ª área de
  planificación "preimpresión").
- **Bloque 4 (beta)** — **PDF de la Hoja de Ruta** (A4 vertical): cabecera, itinerario, tarjetas por
  proceso con altura dinámica y color por estado, detalle de pausas, gráfico previsto/real por
  proceso, botones placeholder (recalcular presupuesto / ficha técnica).

### ⏳ Pendiente (los grandes bloques por diseñar/decidir — material rico para brainstorming)
- **Bloque 5 — Integración Etiquetas ↔ Hoja de Ruta (flujo Hugo)**: que las OTs de etiqueta se
  auto-generen en la pestaña de Hugo desde el pool, manteniendo su flujo independiente, y se
  sincronicen al cierre (unidireccional).
- **Bloque 6 — Producidas / Histórico + Cierre de OT**: tabla `prod_ot_producidas` con **snapshot
  JSONB inmutable + columnas planas indexadas**. Lifecycle: último paso finaliza → `pendiente_revision`
  → revisión humana → `producida`. Reapertura versiona el snapshot. El histórico **recalcula** los
  valores por defecto del maestro (últimas N OTs, descartando outliers, con override manual).
- **Bloque 7 — Expedición / Albarán**: depende del Bloque 6 y de la **decisión sobre Odoo** (¿Minerva
  emite albarán legal con numeración, o solo prepara/exporta y Odoo emite?). Modelo 1 OT → N albaranes
  (entregas parciales). Faltan datos logísticos no presentes en la hoja de ruta.
- **Bloque 8 — Formatos de hoja + formas + componentes** (fuente de verdad, 17 jun 2026): el modelo
  1 OT = 1 referencia no cubre formatos por proceso ni pedidos complejos (casos Optimus A/B/C).
  Dirección: **OT contenedor + hijas reales en BD**, agrupadas en UI (no listado plano), itinerario
  por hija con override, convergencia variable según producto. Primer código: encadenado de formato.
  Briefing: `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md`.
- **Bloque 9 — Material, cartelas y stock** (18 jun): **Fase A** 9.0–9.4 (cartelas, stock real, recepción Emma) primero;
  **Fase B** 9.5+ después (puente muelle+fotos, IA desde albarán). `prod_recepciones_material` ya existe en muelle.
  Briefing: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`.
- **Fases futuras**: inteligencia de repetición (auto-prefill desde histórico), dashboards de
  desviación previsto/real, integración Odoo (materiales consumidos, tiempos para costeo).

---

## 7. Preguntas abiertas / decisiones a discutir (agenda de brainstorming)

Estas son las cuestiones jugosas donde un brainstorming con Claude aporta más valor:

1. **Agilidad en planta (la "mosca detrás de la oreja")**: ¿el modelo pool → mesa → ejecución →
   hoja de ruta es lo bastante ágil para el día a día? ¿Qué hacen los MES/APS líderes y qué deberíamos
   copiar/evitar? ¿Dónde está el riesgo real de lentitud (carga cliente, JSONB, fricción de captura)?
2. **Estrategia de sustitución de Optimus**: ¿qué orden de migración por fases minimiza riesgo? ¿Qué
   se queda en Optimus hasta el final? ¿Convivencia o corte limpio?
3. **Rol de Odoo**: ¿fuente de verdad de qué (clientes, albaranes, facturación, stock)? ¿Minerva
   empuja o tira datos? Esto condiciona los Bloques 6 y 7.
4. **Histórico (Bloque 6)**: ¿snapshot JSONB + columnas planas es el diseño correcto? ¿Qué columnas
   planas indexar? ¿Reglas de recálculo del maestro (N, outliers, override)?
5. **Captura por excepción**: ¿hasta dónde llevar el prefill/derivación sin que el operario pierda
   control ni se acumulen errores silenciosos?
6. **Rendimiento JSONB vs aplanado**: ¿cuándo y cómo aplanar `datos_proceso` para consulta/analítica?
7. **Modelo multi-referencia por OT** (hoy 1 OT ≈ 1 referencia; futuro `prod_ot_referencias`).
8. **Ficha técnica automática**: ¿en qué proceso se genera, qué incluye (densidades, ISO...), dónde se
   archiva e imprime?
9. **Trazabilidad de material**: cartelas por palet (ID Stock, proveedor, albarán). Albaranes reales
   confirman stock libre al recepcionar, conversión kilos→hojas y certificados FSC/PEFC en entrada.
   Briefing: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §3b.

---

## 8. Restricciones y convenciones del proyecto

- **Cambios aditivos**: columnas nuevas siempre `nullable`; imports no borran datos; clonado no
  destructivo.
- **Códigos de artículo**: `M-NNNNN` (5 dígitos con padding).
- **RLS activa** en Supabase (políticas por rol/sección).
- **Una sola BD real** (no hay staging todavía — pendiente crearlo).
- **Entorno Windows / PowerShell** (encadenar con `;`, no `&&`).
- **Next.js 16**: versión con breaking changes; consultar la doc incluida antes de asumir APIs.
- **Tablet en planta**: la UI de captura debe ser compacta y usable a dedo.
- **ISO 12647** (norma de artes gráficas) como referencia para lógicas de impresión (densidades de
  tinta por tipo de soporte).

---

## 9. Cómo usar este briefing con Claude (sugerencia)

Plantilla de prompt para arrancar una sesión de brainstorming:

```
Eres mi compañero de diseño de producto y arquitectura para "Minerva", una plataforma de
gestión de producción para una imprenta de packaging que debe sustituir al software legacy
"Optimus" en 3-5 meses.

Te paso un briefing completo del proyecto (dominio, flujo, estado actual y decisiones).
Léelo y, antes de proponer nada, hazme las preguntas que necesites para no dar ideas genéricas.

Hoy quiero centrarme en: <TEMA, p. ej. "el Bloque 6: histórico de producidas y cierre de OT">.

Objetivos de la sesión:
- Cuestionar mis supuestos.
- Proponer 2-3 enfoques con trade-offs (no solo uno).
- Tener en cuenta agilidad en planta y rendimiento (es mi mayor preocupación).

--- BRIEFING ---
<pegar el contenido de MINERVA_BRIEFING.md>
```

Luego, lo que decidáis, vuélcalo a `FASES_HOJA_RUTA_DIGITAL.md` para que Cursor lo ejecute con el
mismo contexto.

---

## 10. Índice de documentación del proyecto

| Documento | Contenido |
|---|---|
| `MINERVA_BRIEFING.md` | **Este documento.** Contexto estratégico/producto para brainstorming. |
| `MINERVA_CONTEXTO_TECNICO.md` | Árbol del proyecto, `package.json`, configs clave, tipos, migraciones, reglas. |
| `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` | Brief específico para diseñar Producidas, histórico, cierre/reapertura de OT y recálculo del Maestro. |
| `MINERVA_BLOQUE7_ODOO_ALBARANES.md` | Brief específico para decidir Odoo, expedición, pre-albaranes, entregas parciales e integración futura. |
| `FASES_HOJA_RUTA_DIGITAL.md` | Roadmap detallado por bloques de la Hoja de Ruta Digital (estado y pendientes). |
| `FASES_MAESTRO_ARTICULOS.md` | Plan de fases del Maestro de Artículos. |
| `DATA_MAPPING_PIPELINE_MVP.md` | Auditoría real de tablas/campos y contrato de datos del Pipeline. |
| `GUIA_MAÑANA.md` | Notas operativas de continuación (Fase 0). |
| `README.md` | Setup, despliegue (Vercel), stack. |
