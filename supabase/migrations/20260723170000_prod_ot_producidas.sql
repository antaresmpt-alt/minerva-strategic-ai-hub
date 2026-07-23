-- =====================================================================
-- Bloque 6 — Esqueleto tabla histórico de OTs producidas
-- prod_ot_producidas: snapshot inmutable + columnas planas indexadas.
--
-- Decisiones de diseño documentadas (ver MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md):
--
-- VERSIONADO: la clave de negocio es (ot_numero, version), NO solo ot_numero.
-- Cada reapertura + recierre genera una fila nueva (version incremental).
-- Los promedios futuros (Bloque 6.x) deben tomar MAX(version) agrupado por
-- ot_numero, filtrado por excluido_de_promedios = false.
-- NO añadir un flag "vigente" separado — se resuelve por query, no por columna
-- denormalizada.
--
-- ENGOMADO: horas_prep_engomado_reales / horas_tiraje_engomado_reales quedan
-- nullable. La captura de ejecución de Engomado hoy NO separa preparación de
-- tiraje (un único campo "Tiempo"). NO mapear ese campo a horas_tiraje_engomado_reales
-- — sería guardar un dato mezclado (prep+tiraje) como si fuera tiraje puro,
-- sesgando cualquier futuro cálculo de horas/millar. NULL es la opción correcta:
-- ausencia de dato, no dato incorrecto. Pendiente: rediseñar tarjeta Engomado
-- en una sesión posterior para separar preparación y tiraje.
--
-- INMUTABILIDAD: sin updated_at; el histórico no se modifica, se versiona.
-- =====================================================================

create table if not exists public.prod_ot_producidas (

  -- ─── Identidad ──────────────────────────────────────────────────────────
  id                     uuid primary key default gen_random_uuid(),
  ot_numero              text not null,
  ot_id                  uuid references public.prod_ots_general(id)
                           on delete set null,
  referencia_id          uuid references public.prod_referencias(id)
                           on delete set null,
  referencia_minerva     text,
  referencia_cliente     text,
  cliente                text,
  trabajo                text,
  cantidad_pedida        numeric,
  cantidad_producida     numeric,

  -- ─── Técnico ────────────────────────────────────────────────────────────
  material               text,
  gramaje                numeric,
  formato                text,
  tintas                 text,
  troquel                text,
  poses                  integer,
  acabado_pral           text,
  tipo_engomado          text,
  codigo_caja_embalaje   text,
  estuches_por_bulto     integer,
  fsc                    boolean,

  -- ─── Producción real ────────────────────────────────────────────────────
  fecha_inicio_real              timestamptz,
  fecha_fin_real                 timestamptz,
  fecha_cierre                   timestamptz,

  -- Impresión (offset o digital — misma pareja de columnas; tecnología en snapshot)
  horas_prep_impresion_reales    numeric,
  horas_tiraje_impresion_reales  numeric,

  -- Troquelado
  horas_prep_troquelado_reales   numeric,
  horas_tiraje_troquelado_reales numeric,

  -- Engomado: nullable hasta que la tarjeta de ejecución separe prep/tiraje.
  -- NO mapear el campo "Tiempo" actual a tiraje — sería dato mezclado que sesgaría horas/millar.
  horas_prep_engomado_reales     numeric,
  horas_tiraje_engomado_reales   numeric,

  -- Procesos simples (sin split prep/tiraje — fuera del alcance de §7.1.10)
  horas_guillotina_reales        numeric,
  horas_ctp_reales               numeric,
  horas_desbroce_reales          numeric,

  horas_total_reales             numeric,
  merma_total                    numeric,

  -- ─── Control / trazabilidad ─────────────────────────────────────────────
  snapshot               jsonb    not null,
  snapshot_version       integer  not null default 1,
  version                integer  not null default 1,
  cerrada_por            uuid     references auth.users(id) on delete set null,
  cerrada_at             timestamptz not null default now(),
  observaciones_revision text,
  excluido_de_promedios  boolean  not null default false,
  motivo_exclusion       text,
  -- Self-referencia: fila anterior cuando esta es una reapertura versionada.
  reabierta_desde_id     uuid     references public.prod_ot_producidas(id)
                           on delete set null,
  created_at             timestamptz not null default now()
);

-- ─── Constraints ──────────────────────────────────────────────────────────
-- Clave de unicidad: (ot_numero, version) — ver nota de versionado arriba.
alter table public.prod_ot_producidas
  add constraint prod_ot_producidas_ot_numero_version_unique
  unique (ot_numero, version);

-- ─── Índices ──────────────────────────────────────────────────────────────
create index if not exists prod_ot_producidas_ot_numero_idx
  on public.prod_ot_producidas (ot_numero);

create index if not exists prod_ot_producidas_referencia_id_idx
  on public.prod_ot_producidas (referencia_id);

create index if not exists prod_ot_producidas_cliente_idx
  on public.prod_ot_producidas (cliente);

create index if not exists prod_ot_producidas_troquel_idx
  on public.prod_ot_producidas (troquel);

create index if not exists prod_ot_producidas_material_idx
  on public.prod_ot_producidas (material);

-- ─── Comentarios ──────────────────────────────────────────────────────────
comment on table public.prod_ot_producidas is
  'Histórico inmutable de OTs cerradas (Bloque 6). Cada fila es un snapshot de una OT producida. '
  'Las reaperturas generan versiones nuevas (version incremental) en lugar de pisar la fila anterior. '
  'Fuente de verdad para promedios por referencia (horas/millar, merma, etc.).';

comment on column public.prod_ot_producidas.snapshot is
  'Copia completa de la Hoja de Ruta en el momento del cierre (cabecera, itinerario, '
  'datos_proceso por paso, ejecuciones, pausas, externos, métricas calculadas). '
  'Inmutable: si la OT se reabre, se crea una fila nueva con version + 1.';

comment on column public.prod_ot_producidas.version is
  'Número de versión de esta fila para la misma ot_numero (empieza en 1). '
  'Para promedios: usar MAX(version) agrupado por ot_numero + excluido_de_promedios = false. '
  'No añadir flag "vigente" — se resuelve por query, no por columna denormalizada.';

comment on column public.prod_ot_producidas.excluido_de_promedios is
  'Si true, esta fila se excluye de cualquier cálculo de promedios (Bloque 6.x). '
  'Distinto de tiene_incidencias: puede haber incidencia menor que no invalide los promedios, '
  'o cantidad atípica sin incidencia que sí deba excluirse. Marcado por un humano al cerrar/revisar.';

comment on column public.prod_ot_producidas.motivo_exclusion is
  'Texto libre opcional que explica por qué excluido_de_promedios = true '
  '(ej: avería grave, cantidad atípica, reproceso, error de captura).';

comment on column public.prod_ot_producidas.horas_prep_engomado_reales is
  'NULLABLE hasta que la tarjeta de ejecución de Engomado separe preparación de tiraje. '
  'Hoy Engomado captura un único campo "Tiempo" (prep+tiraje mezclados). '
  'No mapear ese campo aquí — sería dato incorrecto que sesgaría horas/millar de tiraje.';

comment on column public.prod_ot_producidas.horas_tiraje_engomado_reales is
  'NULLABLE hasta que la tarjeta de ejecución de Engomado separe preparación de tiraje. '
  'Ver nota en horas_prep_engomado_reales.';

comment on column public.prod_ot_producidas.horas_prep_impresion_reales is
  'Horas de preparación/entrada de impresión (equivalente a horas_entrada en datos_proceso). '
  'Aplica a Offset (proceso 1) y Digital (proceso 2) indistintamente — la tecnología '
  'se puede recuperar del snapshot si se necesita comparar.';

comment on column public.prod_ot_producidas.horas_tiraje_impresion_reales is
  'Horas de tiraje real de impresión (horas_impresion en datos_proceso). '
  'Base para calcular horas/millar de impresión en Bloque 6.x.';

comment on column public.prod_ot_producidas.horas_prep_troquelado_reales is
  'Horas de preparación/arreglo de troquelado (horas_preparacion en datos_proceso).';

comment on column public.prod_ot_producidas.horas_tiraje_troquelado_reales is
  'Horas de tiraje real de troquelado (horas_tiraje en datos_proceso). '
  'Base para calcular horas/millar de troquelado en Bloque 6.x.';

comment on column public.prod_ot_producidas.reabierta_desde_id is
  'FK a la fila anterior de esta misma OT cuando version > 1. '
  'Permite reconstruir la cadena completa de reaperturas/cierres.';

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Mismo patrón que prod_referencias: authenticated para todas las operaciones.
-- Se endurecerá cuando exista el botón de cierre y los roles de revisión.
alter table public.prod_ot_producidas enable row level security;

create policy "prod_ot_producidas_select_policy"
  on public.prod_ot_producidas
  for select
  using (auth.role() = 'authenticated');

create policy "prod_ot_producidas_insert_policy"
  on public.prod_ot_producidas
  for insert
  with check (auth.role() = 'authenticated');

create policy "prod_ot_producidas_update_policy"
  on public.prod_ot_producidas
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "prod_ot_producidas_delete_policy"
  on public.prod_ot_producidas
  for delete
  using (auth.role() = 'authenticated');
