-- Bloque 9.0 — Stock de material en palets (cartelas) + movimientos.
-- Crea prod_stock_palets, prod_stock_palet_ots (bridge), prod_stock_movimientos.
-- Amplía prod_recepciones_material con campos de peso.
--
-- DECISIÓN: tabla puente prod_stock_palet_ots vs ots_referencia text[]
--   → Elegida tabla puente porque:
--     (1) Repo usa ot_numero text en todas las tablas prod_; no hay precedente de text[].
--     (2) Permite índice sobre ot_numero → queries "palets de OT X" rápidas (necesario en 9.2).
--     (3) UNIQUE (palet_id, ot_numero) previene duplicados sin validación app.
--     (4) JOIN semántico más claro; Supabase/PostgREST lo expone bien.
--   ot_destino_numero en prod_stock_palets se mantiene como campo de conveniencia "OT única
--   al cartelar" para el caso simple; para multi-OT usar prod_stock_palet_ots.
--
-- CAMPOS tipo_stock y unidad usan TEXT + CHECK (no ENUM) para poder añadir valores
-- sin ALTER TYPE. Patrón del repo (ver prod_ots_general_ot_tipo_check).
--
-- Secuencia id_stock arranca en 10310 (Optimus en ~10.307 a 22 jun 2026; margen de 3).

-- ──────────────────────────────────────────
-- 1. Ampliar prod_recepciones_material
-- ──────────────────────────────────────────
-- Añade peso del albarán proveedor (Papers Tordera usa kg, PROEMBASA usa Tn).
-- Campos nullables porque la mayoría de albaranes CARPAPSA no indican peso.

alter table public.prod_recepciones_material
  add column if not exists cantidad_peso      numeric        null,
  add column if not exists cantidad_peso_unidad text         null;

alter table public.prod_recepciones_material
  drop constraint if exists prod_recepciones_material_peso_unidad_chk;

alter table public.prod_recepciones_material
  add constraint prod_recepciones_material_peso_unidad_chk
  check (cantidad_peso_unidad is null or cantidad_peso_unidad in ('kg', 'tn'));

comment on column public.prod_recepciones_material.cantidad_peso is
  'Peso recibido según albarán proveedor (opcional). Ej: 35 kg, 0.185 Tn.';
comment on column public.prod_recepciones_material.cantidad_peso_unidad is
  'Unidad del peso: kg (Papers Tordera) o tn (PROEMBASA). Null si el albarán no indica peso.';

-- ──────────────────────────────────────────
-- 2. Secuencia para id_stock
-- ──────────────────────────────────────────
-- Continúa la numeración de Optimus. Verificar valor justo antes del deploy de 9.0.
-- El id_stock más alto conocido en Optimus era 10.307 (Ramón, 22 jun 2026).

create sequence if not exists public.prod_stock_id_stock_seq
  start with 10310
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

-- ──────────────────────────────────────────
-- 3. Tabla prod_stock_palets (corazón del Bloque 9)
-- ──────────────────────────────────────────
-- Una fila = 1 cartela = 1 palet físico = 1 id_stock.
-- cantidad_actual se descuenta con movimientos (prod_stock_movimientos).
-- Para varias OTs, usar prod_stock_palet_ots.

create table if not exists public.prod_stock_palets (
  id                         uuid        primary key default gen_random_uuid(),

  -- Identificador único del palet (cartela). Continúa la numeración de Optimus.
  id_stock                   integer     not null default nextval('public.prod_stock_id_stock_seq'),

  -- Tipo y unidad: extensible sin rehacer SQL (§13 — motor de stock multi-capa).
  -- MVP usa solo materia_prima + hojas.
  tipo_stock                 text        not null default 'materia_prima',
  unidad                     text        not null default 'hojas',

  -- Origen: recepción muelle y/o compra
  recepcion_id               uuid        null references public.prod_recepciones_material(id) on delete set null,
  compra_id                  uuid        null references public.prod_compra_material(id) on delete set null,

  -- Descripción del material (snapshot legible — no depende del maestro de artículos)
  codigo_articulo            text        null,
  descripcion_material       text        null,
  material_nombre            text        null,
  gramaje                    integer     null,
  formato                    text        null,  -- Editable al recepcionar; puede diferir del maestro (material a corte)
  marca                      text        null,

  -- Peso recibido según albarán proveedor (redundante con recepcion, pero útil en cartela)
  cantidad_peso              numeric     null,
  cantidad_peso_unidad       text        null,

  -- Cantidades
  cantidad_inicial           integer     not null default 0,
  cantidad_actual            integer     not null default 0,

  -- OT de destino (campo de conveniencia para caso simple de 1 OT al cartelar).
  -- Para multi-OT, usar prod_stock_palet_ots.
  ot_destino_numero          text        null,

  -- Estado del palet
  estado                     text        not null default 'disponible',

  -- Ubicación física en almacén (filas por familia de material — §3g C3)
  ubicacion_fila             text        null,

  -- Identificación del albarán (nexo con la recepción muelle)
  nota_entrega               text        null,

  -- Lote del proveedor (por palet, puede diferir entre palets del mismo albarán — Comart §3d)
  ref_lote_proveedor         text        null,
  -- Campo legacy Optimus (OT + nombre trabajo, ej: "36016 - TEIKIT")
  ref_lote                   text        null,

  -- Certificaciones FSC/PEFC (se heredan del maestro de artículos al cartelar; editables)
  es_fsc                     boolean     not null default false,
  es_pefc                    boolean     not null default false,
  fsc_certificado_proveedor  text        null,
  pefc_certificado_proveedor text        null,

  notas                      text        null,
  created_by                 uuid        null references auth.users(id) on delete set null,
  created_at                 timestamptz not null default timezone('utc', now()),
  updated_at                 timestamptz not null default timezone('utc', now()),

  constraint prod_stock_palets_id_stock_unique unique (id_stock),
  constraint prod_stock_palets_tipo_stock_chk
    check (tipo_stock in ('materia_prima', 'semielaborado', 'producto_terminado', 'consumible')),
  constraint prod_stock_palets_unidad_chk
    check (unidad in ('hojas', 'uds', 'kg', 'm')),
  constraint prod_stock_palets_estado_chk
    check (estado in ('disponible', 'reservado', 'parcial', 'consumido')),
  constraint prod_stock_palets_peso_unidad_chk
    check (cantidad_peso_unidad is null or cantidad_peso_unidad in ('kg', 'tn')),
  constraint prod_stock_palets_cantidad_inicial_nonneg_chk
    check (cantidad_inicial >= 0),
  constraint prod_stock_palets_cantidad_actual_nonneg_chk
    check (cantidad_actual >= 0)
);

comment on table public.prod_stock_palets is
  'Cartelas de palet: 1 fila = 1 palet físico = 1 ID Stock. Corazón del Bloque 9.';
comment on column public.prod_stock_palets.id_stock is
  'Número de cartela visible en almacén. Continúa numeración Optimus desde 10.310.';
comment on column public.prod_stock_palets.tipo_stock is
  'Capa de stock: materia_prima (MVP), semielaborado, producto_terminado, consumible (§13).';
comment on column public.prod_stock_palets.ot_destino_numero is
  'OT prevista al cartelar (caso simple 1 OT). Multi-OT: usar prod_stock_palet_ots.';
comment on column public.prod_stock_palets.nota_entrega is
  'Número de albarán proveedor — nexo con recepción muelle y antiduplicado (A5).';

-- Trigger updated_at
create or replace function public.prod_stock_palets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_prod_stock_palets_updated_at on public.prod_stock_palets;
create trigger trg_prod_stock_palets_updated_at
  before update on public.prod_stock_palets
  for each row execute function public.prod_stock_palets_set_updated_at();

-- Índices
create index if not exists idx_prod_stock_palets_id_stock
  on public.prod_stock_palets (id_stock);

create index if not exists idx_prod_stock_palets_estado
  on public.prod_stock_palets (estado);

create index if not exists idx_prod_stock_palets_recepcion_id
  on public.prod_stock_palets (recepcion_id)
  where recepcion_id is not null;

create index if not exists idx_prod_stock_palets_compra_id
  on public.prod_stock_palets (compra_id)
  where compra_id is not null;

create index if not exists idx_prod_stock_palets_nota_entrega
  on public.prod_stock_palets (nota_entrega)
  where nota_entrega is not null;

create index if not exists idx_prod_stock_palets_ot_destino
  on public.prod_stock_palets (ot_destino_numero)
  where ot_destino_numero is not null;

create index if not exists idx_prod_stock_palets_created_at
  on public.prod_stock_palets (created_at desc);

-- ──────────────────────────────────────────
-- 4. Tabla puente prod_stock_palet_ots
-- ──────────────────────────────────────────
-- Una fila por (palet, OT). Sin cantidad por OT en la cartela (Ramón D1, §3g).
-- Si el palet está para stock libre sin OT, no hay filas aquí (ot_destino_numero null en palets).

create table if not exists public.prod_stock_palet_ots (
  id         uuid  primary key default gen_random_uuid(),
  palet_id   uuid  not null references public.prod_stock_palets(id) on delete cascade,
  ot_numero  text  not null,
  created_at timestamptz not null default timezone('utc', now()),

  constraint prod_stock_palet_ots_unique unique (palet_id, ot_numero)
);

comment on table public.prod_stock_palet_ots is
  'OTs referenciadas en una cartela, sin cantidad por OT (§3g D1). '
  '1 fila por (palet, OT). Stock libre = sin filas aquí.';

create index if not exists idx_prod_stock_palet_ots_palet_id
  on public.prod_stock_palet_ots (palet_id);

create index if not exists idx_prod_stock_palet_ots_ot_numero
  on public.prod_stock_palet_ots (ot_numero);

-- ──────────────────────────────────────────
-- 5. Tabla prod_stock_movimientos
-- ──────────────────────────────────────────
-- Log inmutable de consumos, ajustes y traspasos.
-- No se borran filas; la historia es la fuente de verdad de cantidad_actual.

create table if not exists public.prod_stock_movimientos (
  id                   uuid        primary key default gen_random_uuid(),
  palet_id             uuid        not null references public.prod_stock_palets(id) on delete restrict,

  -- Tipo de movimiento
  tipo                 text        not null,

  -- Hojas afectadas (siempre positivo; la semántica de +/- la da el tipo)
  cantidad             integer     not null,

  -- OT principal del movimiento
  ot_numero            text        null,

  -- Solo para tipo = 'traspaso': OT de la que sale y OT urgente que recibe
  ot_origen_numero     text        null,
  ot_destino_numero    text        null,

  -- Obligatorio en traspaso (auditoría vocal — §7.6)
  autorizado_por       text        null,

  -- Paso de itinerario (si viene de cerrar proceso — enlace futuro 9.4)
  paso_id              uuid        null,

  notas                text        null,
  created_by           uuid        null references auth.users(id) on delete set null,
  created_at           timestamptz not null default timezone('utc', now()),

  constraint prod_stock_movimientos_tipo_chk
    check (tipo in ('consumo', 'ajuste', 'sobrante', 'traspaso', 'entrada')),
  constraint prod_stock_movimientos_cantidad_pos_chk
    check (cantidad > 0),
  constraint prod_stock_movimientos_traspaso_requiere_origen_chk
    check (
      tipo <> 'traspaso'
      or (ot_origen_numero is not null and ot_destino_numero is not null)
    ),
  constraint prod_stock_movimientos_traspaso_requiere_autorizado_chk
    check (
      tipo <> 'traspaso'
      or (autorizado_por is not null and btrim(autorizado_por) <> '')
    )
);

comment on table public.prod_stock_movimientos is
  'Log de consumos, ajustes y traspasos de material. Inmutable — no borrar filas.';
comment on column public.prod_stock_movimientos.cantidad is
  'Siempre positivo. La semántica de suma/resta la da el tipo de movimiento.';
comment on column public.prod_stock_movimientos.autorizado_por is
  'Obligatorio en traspaso (Ramón lo autoriza de viva voz — §7.6).';

create index if not exists idx_prod_stock_movimientos_palet_id
  on public.prod_stock_movimientos (palet_id);

create index if not exists idx_prod_stock_movimientos_ot_numero
  on public.prod_stock_movimientos (ot_numero)
  where ot_numero is not null;

create index if not exists idx_prod_stock_movimientos_created_at
  on public.prod_stock_movimientos (created_at desc);

-- ──────────────────────────────────────────
-- 6. RLS — prod_stock_palets
-- ──────────────────────────────────────────
alter table public.prod_stock_palets enable row level security;

grant select, insert, update, delete on public.prod_stock_palets to authenticated;

-- SELECT: almacen, admin, gerencia, administracion, produccion
drop policy if exists prod_stock_palets_select on public.prod_stock_palets;
create policy prod_stock_palets_select
  on public.prod_stock_palets for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'produccion', 'almacen', 'impresion', 'logistica'
        ])
    )
  );

-- INSERT: almacen, admin, gerencia, administracion (Juan no cartela; Emma/Ramón sí — roles almacen+)
drop policy if exists prod_stock_palets_insert on public.prod_stock_palets;
create policy prod_stock_palets_insert
  on public.prod_stock_palets for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen'
        ])
    )
  );

-- UPDATE: mismos que insert
drop policy if exists prod_stock_palets_update on public.prod_stock_palets;
create policy prod_stock_palets_update
  on public.prod_stock_palets for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen'
        ])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen'
        ])
    )
  );

-- DELETE: solo admin/gerencia
drop policy if exists prod_stock_palets_delete on public.prod_stock_palets;
create policy prod_stock_palets_delete
  on public.prod_stock_palets for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );

-- ──────────────────────────────────────────
-- 7. RLS — prod_stock_palet_ots
-- ──────────────────────────────────────────
alter table public.prod_stock_palet_ots enable row level security;

grant select, insert, update, delete on public.prod_stock_palet_ots to authenticated;

drop policy if exists prod_stock_palet_ots_select on public.prod_stock_palet_ots;
create policy prod_stock_palet_ots_select
  on public.prod_stock_palet_ots for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'produccion', 'almacen', 'impresion', 'logistica'
        ])
    )
  );

drop policy if exists prod_stock_palet_ots_insert on public.prod_stock_palet_ots;
create policy prod_stock_palet_ots_insert
  on public.prod_stock_palet_ots for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen'
        ])
    )
  );

drop policy if exists prod_stock_palet_ots_update on public.prod_stock_palet_ots;
create policy prod_stock_palet_ots_update
  on public.prod_stock_palet_ots for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen'
        ])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen'
        ])
    )
  );

drop policy if exists prod_stock_palet_ots_delete on public.prod_stock_palet_ots;
create policy prod_stock_palet_ots_delete
  on public.prod_stock_palet_ots for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia', 'administracion', 'almacen'])
    )
  );

-- ──────────────────────────────────────────
-- 8. RLS — prod_stock_movimientos
-- ──────────────────────────────────────────
alter table public.prod_stock_movimientos enable row level security;

grant select, insert on public.prod_stock_movimientos to authenticated;
-- No UPDATE/DELETE: el log es inmutable

drop policy if exists prod_stock_movimientos_select on public.prod_stock_movimientos;
create policy prod_stock_movimientos_select
  on public.prod_stock_movimientos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'produccion', 'almacen', 'impresion', 'logistica'
        ])
    )
  );

-- INSERT: maquinistas también pueden registrar consumos (9.4 piloto)
drop policy if exists prod_stock_movimientos_insert on public.prod_stock_movimientos;
create policy prod_stock_movimientos_insert
  on public.prod_stock_movimientos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'almacen', 'impresion', 'troquelado', 'engomado', 'produccion'
        ])
    )
  );

-- ──────────────────────────────────────────
-- 9. Secuencia: grant para authenticated
-- ──────────────────────────────────────────
grant usage on sequence public.prod_stock_id_stock_seq to authenticated;
