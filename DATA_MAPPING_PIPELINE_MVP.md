# Data Mapping Pipeline MVP

## 1) Auditoria de esquema y fuentes reales

Base auditada en proyecto Supabase `jrwwuqplilbydxptsbqz` (tablas reales + tipos) y contrastada con consumo en frontend (`planificacion-pool-ots-tab-v2`, `planificacion-ots-ejecucion-tab`, `ots-despachadas-page`).

### Tablas nucleo para pipeline

- `prod_ots_general` (cabecera OT)
  - Claves: `id`, `num_pedido`.
  - Contexto negocio: `cliente`, `titulo`, `cantidad`, `prioridad`, `fecha_entrega`, `estado_desc`.
- `produccion_ot_despachadas` (snapshot tecnico despacho)
  - `ot_numero`, `material`, `gramaje`, `tamano_hoja`, `num_hojas_brutas`, `num_hojas_netas`, `horas_entrada`, `horas_tiraje`, `tintas`, `troquel`, `poses`, `acabado_pral`, `notas`, `despachado_at`, `estado_material`.
- `prod_ot_pasos` (fuente de verdad de itinerario por OT)
  - `id`, `ot_id`, `orden`, `proceso_id`, `maquina_id`, `estado` (`pendiente|disponible|en_marcha|pausado|finalizado`), `proveedor_nombre`, `notas_instrucciones`, `fecha_disponible`, `fecha_inicio`, `fecha_fin`.
- `prod_procesos_cat` (catalogo de proceso)
  - `id`, `nombre`, `seccion_slug`, `es_externo`, `orden_sugerido`, `activo`.
- `prod_maquinas` (catalogo recurso)
  - `id`, `codigo`, `nombre`, `tipo_maquina` (`impresion|digital|troquelado|engomado`), `activa`.
- `prod_mesa_planificacion_trabajos` (plan en calendario)
  - `ot_numero`, `maquina_id`, `estado_mesa` (`borrador|confirmado|en_ejecucion|finalizada`), `fecha_planificada`, `turno`, `slot_orden`, snapshots (`cliente_snapshot`, `papel_snapshot`, `tintas_snapshot`, `barniz_snapshot`, `horas_planificadas_snapshot`, etc).
- `prod_mesa_ejecuciones` (ejecucion real)
  - `ot_numero`, `ot_paso_id`, `maquina_id`, `estado_ejecucion` (`pendiente_inicio|en_curso|pausada|finalizada|cancelada`), `liberada_at`, `inicio_real_at`, `fin_real_at`, `horas_reales`, `incidencia`, `accion_correctiva`, `maquinista`, `observaciones`.
- `prod_seguimiento_externos` (trazabilidad externos)
  - `ot_paso_id`, `estado`, `proveedor_id`, `acabado_id`, `fecha_envio`, `fecha_prevista`, `f_entrega_ot`, `observaciones`, `notas_logistica`.

### Tablas de soporte utiles para badges/estado

- `prod_planificacion_pool`: `estado_pool` (`pendiente|enviada_mesa|en_transito|cerrada`) para capa de lifecycle en panel.
- `prod_compra_material` / `prod_recepciones_material`: para semaforo material (ya calculado en pool actual).
- `prod_mesa_ejecuciones_pausas` + `sys_motivos_pausa`: detalle de pausas/motivos para tooltip de paso en ejecucion.

## 2) Campos utiles para contexto operativo por paso

### Ya existe hoy (se puede mostrar en MVP)

- Identidad paso: `orden`, `proceso.nombre`, `proceso.seccion_slug`, `proceso.es_externo`, `estado`.
- Fechas de ciclo paso: `fecha_disponible`, `fecha_inicio`, `fecha_fin`.
- Recurso: `maquina_id` -> `prod_maquinas.nombre`/`tipo_maquina`.
- Contexto de despacho (cuando aplique): `material`, `gramaje`, `tamano_hoja`, `tintas`, `troquel`, `poses`, `horas_*`.
- Ejecucion activa/ultima del paso: desde `prod_mesa_ejecuciones` por `ot_paso_id` (`estado_ejecucion`, `inicio/fin`, `maquinista`, `incidencia`, `accion_correctiva`, `observaciones`, `horas_reales`).
- Externos: desde `prod_seguimiento_externos` por `ot_paso_id` (`estado externo`, proveedor, fechas, observaciones).

### Gaps reales (no inventar en MVP)

- No hay campo estructurado de "avance de produccion" tipo `hojas_producidas` por paso.
- No hay metrica de calidad por paso salvo texto libre (`incidencia`, `accion_correctiva`, `observaciones`) y densidades JSON en ejecucion.
- No hay tabla historica de transiciones de `prod_ot_pasos` (solo timestamps actuales por estado principal).
- Para tooltip "imprimiendo X hojas" hoy no hay `X` real de avance; se puede usar `num_hojas_brutas` como objetivo, no progreso.

## 3) Contrato de datos UI Pipeline (TS)

```ts
type PipelineBadge = "sin_itinerario" | "externo_activo" | "bloqueado" | "en_riesgo" | "cerrada";

type OTRowBase = {
  otNumero: string;
  otId: string | null;
  cliente: string | null;
  trabajo: string | null;
  prioridad: number | null;
  fechaCompromiso: string | null; // prod_ots_general.fecha_entrega
  estadoOt: string | null;        // prod_ots_general.estado_desc
  despachadoAt: string | null;
};

type PipelineStepView = {
  pasoId: string;
  orden: number;
  estadoPaso: "pendiente" | "disponible" | "en_marcha" | "pausado" | "finalizado";
  procesoId: number | null;
  procesoNombre: string | null;
  seccionSlug: string | null;
  esExterno: boolean;

  maquinaId: string | null;
  maquinaNombre: string | null;
  tipoMaquina: "impresion" | "digital" | "troquelado" | "engomado" | null;

  fechaDisponible: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;

  // resumen operativo corto para chip/tooltip
  resumenCorto: string | null;

  // joins operativos opcionales
  ejecucion: {
    estado: "pendiente_inicio" | "en_curso" | "pausada" | "finalizada" | "cancelada";
    inicioRealAt: string | null;
    finRealAt: string | null;
    horasReales: number | null;
    maquinista: string | null;
    incidencia: string | null;
    accionCorrectiva: string | null;
    observaciones: string | null;
  } | null;

  externo: {
    estado: string | null;
    proveedorNombre: string | null;
    fechaEnvio: string | null;
    fechaPrevista: string | null;
    observaciones: string | null;
  } | null;
};

type PipelineRowView = OTRowBase & {
  pasoActual: PipelineStepView | null;
  siguientePaso: PipelineStepView | null;
  pasos: PipelineStepView[];
  riesgo: "ok" | "warning" | "overdue";
  badges: PipelineBadge[];
};
```

## 4) Reglas de negocio para calculo

- **Paso actual**:
  - Prioridad 1: primer paso en `en_marcha` o `pausado` (orden asc).
  - Prioridad 2: si no hay activos, primer paso en `disponible`.
  - Prioridad 3: si todos `finalizado`, OT cerrada operativamente.
- **Siguiente paso**:
  - Primer paso con estado `pendiente` y `orden` mayor al paso actual.
  - Si no hay actual, usar primer `disponible` o `pendiente`.
- **Sin itinerario**:
  - OT sin `ot_id` resoluble en `prod_ots_general`, o con 0 filas en `prod_ot_pasos`.
- **Externo**:
  - Paso con `prod_procesos_cat.es_externo = true`.
  - `externo_activo` badge si existe seguimiento no recibido para `ot_paso_id`.
- **Bloqueado** (MVP pragmatica):
  - Hay paso `disponible` pero no tiene ni ejecucion activa ni seguimiento externo activo durante ventana configurable.
  - O paso en `pausado` con pausa abierta > umbral.
- **Retraso (riesgo)**:
  - `overdue` si `fecha_compromiso < hoy` y OT no cerrada.
  - `warning` si compromiso en <= N dias y quedan pasos no finalizados.
  - `ok` resto.

## 5) Estrategia de consulta y rendimiento

### Recomendacion MVP (rapida y mantenible)

- Construir una **vista SQL de lectura** (`v_prod_pipeline_ot`) con:
  - Base OT (`prod_ots_general`) + despacho (`produccion_ot_despachadas`).
  - Agregado JSON de pasos (`prod_ot_pasos` + `prod_procesos_cat` + `prod_maquinas`).
  - Flags de apoyo (`has_itinerario`, `has_externo_abierto`, `has_ejecucion_activa`, `pool_estado`).
- Consumir la vista paginada por frontend con filtros server-side (OT, cliente, seccion, riesgo, externo).

### Alternativa sin vista (mas deuda en frontend)

- 3-5 queries por lotes (OT base, pasos, ejecuciones, externos, maquinas) + merge cliente.
- Valida para MVP pequeno, pero peor para escalar y mas compleja de mantener.

### Indices recomendados (si faltan)

- `prod_ot_pasos (ot_id, orden)` y parcial por estado:
  - `create index ... on prod_ot_pasos (ot_id, estado, orden);`
- `prod_mesa_ejecuciones (ot_paso_id, estado_ejecucion, updated_at desc)` (parcial `ot_paso_id is not null`).
- `prod_seguimiento_externos (ot_paso_id, estado, updated_at desc)` (parcial `ot_paso_id is not null`).
- `prod_ots_general (num_pedido)` ya unico; opcional `fecha_entrega` para ordenes por riesgo.

## 6) Lista exacta de campos para MVP

### Columnas fila pipeline

- `otNumero`, `cliente`, `trabajo`, `prioridad`, `fechaCompromiso`.
- `pasoActual.procesoNombre`, `pasoActual.estadoPaso`, `pasoActual.maquinaNombre`.
- `siguientePaso.procesoNombre`.
- `riesgo`, `badges`.

### Tooltip de paso (MVP)

- `procesoNombre`, `estadoPaso`, `maquinaNombre/tipoMaquina`.
- `fechaDisponible`, `fechaInicio`, `fechaFin`.
- `resumenCorto`:
  - interno: combinar `material/tintas/troquel/poses` segun disponibilidad.
  - externo: `proveedor + estado externo + fecha prevista`.
- si hay ejecucion: `maquinista`, `horasReales`, `incidencia` breve.

## 7) Plan de implementacion (2-3 PRs pequenos)

### PR1 - Data contract + motor de lectura

- Crear `src/lib/pipeline/pipeline-data.ts`:
  - mappers `OTRowBase`, `PipelineStepView`, `PipelineRowView`.
  - helpers puros para `pasoActual`, `siguientePaso`, `riesgo`, `badges`.
- Añadir capa de lectura (vista SQL o query batch encapsulada).
- Tests unitarios de reglas de estado.

### PR2 - UI MVP Produccion > Pipeline

- Nueva pestaña/pagina `Pipeline` en Produccion.
- Tabla virtualizada + filtros minimos (busqueda, estado paso, externo, incidencias).
- Timeline compacto por OT y tooltip operativo.
- Accion rapida "ver OT" (enlace a despachadas/mesa).

### PR3 - Afinado operativo

- Drawer lateral de detalle OT con timeline completo.
- Ajuste de semaforos/umbral de bloqueo.
- Telemetria de rendimiento (tiempo de carga, filas render).
- Pulido UX para alta densidad de OTs.

## 8) Decisiones clave para no bloquear MVP

- Mantener `prod_ot_pasos` como unica fuente de verdad de progresion.
- No introducir nuevas tablas de eventos en MVP.
- Mostrar "resumen operativo" con datos reales disponibles y etiquetar claramente lo estimado.
- Dejar trazabilidad avanzada de transiciones para V2.
