-- Bloque 15.0 — Stock de artículos (producto terminado / WIP)
-- Tablas propias (≠ prod_stock_palets material B9).
-- Reservas en tabla aparte; libre + estado_derivado calculados en vista ATP.
-- Brief: .MANUALES/BLOQUES/MINERVA_BLOQUE15_STOCK_ARTICULOS.md

-- ──────────────────────────────────────────
-- 1. Lotes: prod_stock_articulos
-- ──────────────────────────────────────────

create table if not exists public.prod_stock_articulos (
  id uuid primary key default gen_random_uuid(),

  referencia_id uuid not null references public.prod_referencias (id) on delete restrict,
  referencia_codigo text not null,
  referencia_descripcion text,
  referencia_cliente text,
  -- Texto cliente Optimus (como en la OT). null = usable por cualquier cliente.
  cliente text,

  cantidad_actual integer not null default 0
    check (cantidad_actual >= 0),
  unidad text not null default 'uds'
    check (unidad in ('uds', 'hojas')),
  -- Poses / factor para convertir hojas → estuches en avisos ATP (opcional).
  poses numeric(12, 4),

  estado_proceso text not null default 'terminado'
    check (estado_proceso in (
      'terminado', 'impreso', 'troquelado', 'semielaborado', 'otro'
    )),

  ot_origen text,
  bultos integer check (bultos is null or bultos >= 0),
  palets numeric(12, 3) check (palets is null or palets >= 0),
  ubicacion_fisica text,
  cantidad_minima_alerta integer check (
    cantidad_minima_alerta is null or cantidad_minima_alerta >= 0
  ),
  notas text,
  condicion text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.prod_stock_articulos is
  'Bloque 15: lotes de producto terminado / WIP. No material (B9). '
  'Reservas en prod_stock_articulos_reservas; libre/estado en vista stock_articulos_atp.';

comment on column public.prod_stock_articulos.cliente is
  'Texto cliente Optimus. null = stock libre para cualquier cliente; '
  'con valor = solo usable para ese cliente (Takeit / stock suyo).';

comment on column public.prod_stock_articulos.referencia_cliente is
  'Denorm para búsqueda UI (Gabri/oficina). Puede ser null.';

create or replace function public.prod_stock_articulos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_prod_stock_articulos_updated_at
  on public.prod_stock_articulos;
create trigger trg_prod_stock_articulos_updated_at
  before update on public.prod_stock_articulos
  for each row execute function public.prod_stock_articulos_set_updated_at();

create index if not exists idx_prod_stock_articulos_referencia_id
  on public.prod_stock_articulos (referencia_id);

create index if not exists idx_prod_stock_articulos_referencia_codigo
  on public.prod_stock_articulos (referencia_codigo);

create index if not exists idx_prod_stock_articulos_referencia_cliente
  on public.prod_stock_articulos (referencia_cliente)
  where referencia_cliente is not null;

create index if not exists idx_prod_stock_articulos_cliente
  on public.prod_stock_articulos (cliente)
  where cliente is not null;

create index if not exists idx_prod_stock_articulos_estado_proceso
  on public.prod_stock_articulos (estado_proceso);

create index if not exists idx_prod_stock_articulos_ot_origen
  on public.prod_stock_articulos (ot_origen)
  where ot_origen is not null;

create index if not exists idx_prod_stock_articulos_created_at
  on public.prod_stock_articulos (created_at desc);

-- ──────────────────────────────────────────
-- 2. Reservas: prod_stock_articulos_reservas
-- ──────────────────────────────────────────

create table if not exists public.prod_stock_articulos_reservas (
  id uuid primary key default gen_random_uuid(),
  stock_articulo_id uuid not null
    references public.prod_stock_articulos (id) on delete cascade,
  ot_numero text not null,
  num_pedido text,
  cantidad_reservada integer not null check (cantidad_reservada > 0),
  bultos_reservados integer check (
    bultos_reservados is null or bultos_reservados >= 0
  ),
  notas text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),

  constraint prod_stock_articulos_reservas_ot_unique
    unique (stock_articulo_id, ot_numero)
);

comment on table public.prod_stock_articulos_reservas is
  'Bloque 15: reservas duras por OT (y opcional nº pedido). '
  'Misma idea que prod_stock_palet_ots con cantidad (B9). '
  'Libre = físico − sum(cantidad_reservada).';

create index if not exists idx_prod_stock_articulos_reservas_stock
  on public.prod_stock_articulos_reservas (stock_articulo_id);

create index if not exists idx_prod_stock_articulos_reservas_ot
  on public.prod_stock_articulos_reservas (ot_numero);

create index if not exists idx_prod_stock_articulos_reservas_pedido
  on public.prod_stock_articulos_reservas (num_pedido)
  where num_pedido is not null;

-- ──────────────────────────────────────────
-- 3. Movimientos (ledger inmutable)
-- ──────────────────────────────────────────

create table if not exists public.prod_stock_articulos_movimientos (
  id uuid primary key default gen_random_uuid(),
  stock_articulo_id uuid not null
    references public.prod_stock_articulos (id) on delete restrict,

  tipo text not null
    check (tipo in (
      'entrada', 'reserva', 'liberacion', 'consumo', 'ajuste', 'transformacion'
    )),
  -- Siempre > 0; el signo lo da el tipo.
  cantidad integer not null check (cantidad > 0),
  bultos integer check (bultos is null or bultos >= 0),

  ot_numero text,
  num_pedido text,

  -- Solo transformacion: lote destino (entra) y opcional merma en notas/cantidad aparte.
  stock_articulo_destino_id uuid
    references public.prod_stock_articulos (id) on delete restrict,

  notas text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),

  constraint prod_stock_articulos_movimientos_transform_chk
    check (
      tipo <> 'transformacion'
      or stock_articulo_destino_id is not null
    )
);

comment on table public.prod_stock_articulos_movimientos is
  'Bloque 15: ledger inmutable de producto/WIP. No borrar filas.';

create index if not exists idx_prod_stock_articulos_movimientos_stock
  on public.prod_stock_articulos_movimientos (stock_articulo_id);

create index if not exists idx_prod_stock_articulos_movimientos_ot
  on public.prod_stock_articulos_movimientos (ot_numero)
  where ot_numero is not null;

create index if not exists idx_prod_stock_articulos_movimientos_created
  on public.prod_stock_articulos_movimientos (created_at desc);

-- ──────────────────────────────────────────
-- 4. Vista ATP (libre + estado calculados)
-- ──────────────────────────────────────────

create or replace view public.stock_articulos_atp
with (security_invoker = on)
as
with reservas as (
  select
    stock_articulo_id,
    coalesce(sum(cantidad_reservada), 0) as reservada_total,
    count(*) as reservas_count
  from public.prod_stock_articulos_reservas
  group by stock_articulo_id
)
select
  s.id,
  s.referencia_id,
  s.referencia_codigo,
  s.referencia_descripcion,
  s.referencia_cliente,
  s.cliente,
  s.unidad,
  s.poses,
  s.estado_proceso,
  s.ot_origen,
  s.bultos,
  s.palets,
  s.ubicacion_fisica,
  s.cantidad_minima_alerta,
  s.notas,
  s.condicion,
  s.created_at,
  s.updated_at,
  s.cantidad_actual as cantidad_fisica,
  coalesce(r.reservada_total, 0) as cantidad_reservada_total,
  greatest(s.cantidad_actual - coalesce(r.reservada_total, 0), 0) as cantidad_libre,
  coalesce(r.reservas_count, 0) as reservas_count,
  (coalesce(r.reservada_total, 0) > s.cantidad_actual) as sobre_reservado,
  case
    when s.cantidad_actual <= 0 then 'agotado'
    when coalesce(r.reservada_total, 0) <= 0 then 'disponible'
    when s.cantidad_actual - coalesce(r.reservada_total, 0) <= 0 then 'reservado'
    else 'parcial'
  end as estado_derivado,
  (
    s.cantidad_minima_alerta is not null
    and greatest(s.cantidad_actual - coalesce(r.reservada_total, 0), 0)
      <= s.cantidad_minima_alerta
  ) as es_critico
from public.prod_stock_articulos s
left join reservas r on r.stock_articulo_id = s.id;

comment on view public.stock_articulos_atp is
  'Bloque 15 ATP: cantidad_libre y estado_derivado siempre calculados. '
  'security_invoker=on respeta RLS de prod_stock_articulos.';

grant select on public.stock_articulos_atp to authenticated;

-- ──────────────────────────────────────────
-- 5. RLS
-- Roles lectura: como stock material + oficina_tecnica (despacho / OT).
-- Escritura: admin, gerencia, administracion, almacen, oficina_tecnica.
-- ──────────────────────────────────────────

alter table public.prod_stock_articulos enable row level security;
alter table public.prod_stock_articulos_reservas enable row level security;
alter table public.prod_stock_articulos_movimientos enable row level security;

grant select, insert, update, delete on public.prod_stock_articulos to authenticated;
grant select, insert, update, delete on public.prod_stock_articulos_reservas to authenticated;
grant select, insert on public.prod_stock_articulos_movimientos to authenticated;

-- Lotes
drop policy if exists prod_stock_articulos_select on public.prod_stock_articulos;
create policy prod_stock_articulos_select
  on public.prod_stock_articulos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'produccion', 'almacen', 'impresion', 'logistica',
          'oficina_tecnica', 'comercial'
        ])
    )
  );

drop policy if exists prod_stock_articulos_insert on public.prod_stock_articulos;
create policy prod_stock_articulos_insert
  on public.prod_stock_articulos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen', 'oficina_tecnica'
        ])
    )
  );

drop policy if exists prod_stock_articulos_update on public.prod_stock_articulos;
create policy prod_stock_articulos_update
  on public.prod_stock_articulos for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen', 'oficina_tecnica'
        ])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen', 'oficina_tecnica'
        ])
    )
  );

drop policy if exists prod_stock_articulos_delete on public.prod_stock_articulos;
create policy prod_stock_articulos_delete
  on public.prod_stock_articulos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );

-- Reservas
drop policy if exists prod_stock_articulos_reservas_select
  on public.prod_stock_articulos_reservas;
create policy prod_stock_articulos_reservas_select
  on public.prod_stock_articulos_reservas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'produccion', 'almacen', 'impresion', 'logistica',
          'oficina_tecnica', 'comercial'
        ])
    )
  );

drop policy if exists prod_stock_articulos_reservas_write
  on public.prod_stock_articulos_reservas;
create policy prod_stock_articulos_reservas_write
  on public.prod_stock_articulos_reservas for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen', 'oficina_tecnica'
        ])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen', 'oficina_tecnica'
        ])
    )
  );

-- Movimientos: select amplio; insert escritura; no update/delete (inmutable)
drop policy if exists prod_stock_articulos_movimientos_select
  on public.prod_stock_articulos_movimientos;
create policy prod_stock_articulos_movimientos_select
  on public.prod_stock_articulos_movimientos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'produccion', 'almacen', 'impresion', 'logistica',
          'oficina_tecnica', 'comercial'
        ])
    )
  );

drop policy if exists prod_stock_articulos_movimientos_insert
  on public.prod_stock_articulos_movimientos;
create policy prod_stock_articulos_movimientos_insert
  on public.prod_stock_articulos_movimientos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion', 'almacen', 'oficina_tecnica'
        ])
    )
  );
