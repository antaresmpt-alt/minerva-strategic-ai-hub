-- Bloque 15.0 — Stock de artículos (producto / WIP)
-- Tablas propias (≠ B9 material). Escritura SOLO vía RPC security definer.
-- Brief: .MANUALES/BLOQUES/MINERVA_BLOQUE15_STOCK_ARTICULOS.md
-- NO aplicar en remoto hasta revisión Claude.

-- ══════════════════════════════════════════
-- 0. Capacidades por usuario (puente B12)
-- ══════════════════════════════════════════

create table if not exists public.profiles_capacidades (
  user_id uuid not null references auth.users (id) on delete cascade,
  capacidad text not null
    check (capacidad in ('stock_articulos_write')),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null,
  primary key (user_id, capacidad)
);

comment on table public.profiles_capacidades is
  'Permisos extra por usuario (no por rol). '
  'stock_articulos_write: alta/ajuste/reserva/consumo producto (Gabri). '
  'Solo admin/gerencia pueden conceder; el usuario no puede autoasignarse.';

alter table public.profiles_capacidades enable row level security;

grant select on public.profiles_capacidades to authenticated;

drop policy if exists profiles_capacidades_select on public.profiles_capacidades;
create policy profiles_capacidades_select
  on public.profiles_capacidades for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text in ('admin', 'gerencia')
    )
  );

-- Sin políticas insert/update/delete para authenticated → solo service_role / security definer admin.
revoke insert, update, delete on public.profiles_capacidades from authenticated;
grant insert, update, delete on public.profiles_capacidades to service_role;

create or replace function public.minerva_grant_capacidad(
  p_user_id uuid,
  p_capacidad text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role::text in ('admin', 'gerencia')
  ) then
    raise exception 'Solo admin/gerencia pueden conceder capacidades';
  end if;

  insert into public.profiles_capacidades (user_id, capacidad, created_by)
  values (p_user_id, p_capacidad, auth.uid())
  on conflict (user_id, capacidad) do nothing;
end;
$$;

create or replace function public.minerva_revoke_capacidad(
  p_user_id uuid,
  p_capacidad text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role::text in ('admin', 'gerencia')
  ) then
    raise exception 'Solo admin/gerencia pueden revocar capacidades';
  end if;

  delete from public.profiles_capacidades
  where user_id = p_user_id and capacidad = p_capacidad;
end;
$$;

revoke all on function public.minerva_grant_capacidad(uuid, text) from public;
revoke all on function public.minerva_revoke_capacidad(uuid, text) from public;
grant execute on function public.minerva_grant_capacidad(uuid, text) to authenticated;
grant execute on function public.minerva_revoke_capacidad(uuid, text) to authenticated;

create or replace function public.minerva_can_write_stock_articulos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role::text = any (array[
          'admin', 'gerencia', 'administracion',
          'almacen', 'oficina_tecnica', 'logistica'
        ])
    )
    or exists (
      select 1 from public.profiles_capacidades c
      where c.user_id = auth.uid()
        and c.capacidad = 'stock_articulos_write'
    );
$$;

revoke all on function public.minerva_can_write_stock_articulos() from public;
grant execute on function public.minerva_can_write_stock_articulos() to authenticated;

-- Mínimo de stock a nivel artículo (no por lote)
alter table public.prod_referencias
  add column if not exists stock_cantidad_minima integer
    check (stock_cantidad_minima is null or stock_cantidad_minima >= 0);

comment on column public.prod_referencias.stock_cantidad_minima is
  'Bloque 15: umbral crítico agregado (suma libres de lotes). Null = sin alerta.';

-- ══════════════════════════════════════════
-- 1. Lotes
-- ══════════════════════════════════════════

create table if not exists public.prod_stock_articulos (
  id uuid primary key default gen_random_uuid(),

  referencia_id uuid not null references public.prod_referencias (id) on delete restrict,
  referencia_codigo text not null,
  referencia_descripcion text,
  referencia_cliente text,
  cliente text,
  cliente_norm text generated always as (
    case when cliente is null then null else lower(btrim(cliente)) end
  ) stored,

  cantidad_actual integer not null default 0
    check (cantidad_actual >= 0),
  unidad text not null default 'uds'
    check (unidad in ('uds', 'hojas')),
  poses numeric(12, 4),

  estado_proceso text not null default 'terminado'
    check (estado_proceso in (
      'terminado', 'impreso', 'troquelado', 'otro'
    )),

  ot_origen text,
  bultos integer check (bultos is null or bultos >= 0),
  palets numeric(12, 3) check (palets is null or palets >= 0),
  ubicacion_fisica text,
  notas text,
  condicion text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.prod_stock_articulos is
  'Bloque 15: lotes producto/WIP. No borrar: ajustar a 0. Escritura solo RPC.';

comment on column public.prod_stock_articulos.cliente is
  'Texto Optimus. null = libre cualquier cliente; con valor = solo ese cliente.';

create or replace function public.prod_stock_articulos_set_updated_at()
returns trigger
language plpgsql
set search_path = public
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
create index if not exists idx_prod_stock_articulos_cliente_norm
  on public.prod_stock_articulos (cliente_norm)
  where cliente_norm is not null;
create index if not exists idx_prod_stock_articulos_estado_proceso
  on public.prod_stock_articulos (estado_proceso);
create index if not exists idx_prod_stock_articulos_ot_origen
  on public.prod_stock_articulos (ot_origen)
  where ot_origen is not null;
create index if not exists idx_prod_stock_articulos_created_at
  on public.prod_stock_articulos (created_at desc);

-- ══════════════════════════════════════════
-- 2. Reservas (con consumo parcial)
-- ══════════════════════════════════════════

create table if not exists public.prod_stock_articulos_reservas (
  id uuid primary key default gen_random_uuid(),
  stock_articulo_id uuid not null
    references public.prod_stock_articulos (id) on delete restrict,
  ot_numero text not null,
  num_pedido text,
  cantidad_reservada integer not null check (cantidad_reservada > 0),
  cantidad_consumida integer not null default 0
    check (cantidad_consumida >= 0),
  estado text not null default 'activa'
    check (estado in ('activa', 'parcial', 'consumida', 'liberada')),
  bultos_reservados integer check (
    bultos_reservados is null or bultos_reservados >= 0
  ),
  notas text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint prod_stock_articulos_reservas_consumida_chk
    check (cantidad_consumida <= cantidad_reservada)
);

comment on table public.prod_stock_articulos_reservas is
  'Reservas duras por OT. Libre ATP = físico − Σ(reservada−consumida) activa/parcial. '
  'No borrar al consumir: estado consumida/parcial/liberada.';

-- Una sola reserva viva (activa/parcial) por lote+OT
create unique index if not exists idx_prod_stock_articulos_reservas_viva
  on public.prod_stock_articulos_reservas (stock_articulo_id, ot_numero)
  where estado in ('activa', 'parcial');

create index if not exists idx_prod_stock_articulos_reservas_stock
  on public.prod_stock_articulos_reservas (stock_articulo_id);
create index if not exists idx_prod_stock_articulos_reservas_ot
  on public.prod_stock_articulos_reservas (ot_numero);

create or replace function public.prod_stock_articulos_reservas_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_prod_stock_articulos_reservas_updated_at
  on public.prod_stock_articulos_reservas;
create trigger trg_prod_stock_articulos_reservas_updated_at
  before update on public.prod_stock_articulos_reservas
  for each row execute function public.prod_stock_articulos_reservas_set_updated_at();

-- ══════════════════════════════════════════
-- 3. Movimientos (ledger inmutable)
-- ══════════════════════════════════════════

create table if not exists public.prod_stock_articulos_movimientos (
  id uuid primary key default gen_random_uuid(),
  stock_articulo_id uuid not null
    references public.prod_stock_articulos (id) on delete restrict,

  tipo text not null
    check (tipo in (
      'entrada', 'reserva', 'liberacion', 'consumo', 'ajuste', 'transformacion'
    )),
  -- Magnitud >= 0 (0 permitido p.ej. ajuste solo bultos / liberación ya consumida).
  cantidad integer not null check (cantidad >= 0),
  cantidad_antes integer,
  cantidad_despues integer,
  cantidad_destino integer check (
    cantidad_destino is null or cantidad_destino >= 0
  ),
  cantidad_merma integer check (
    cantidad_merma is null or cantidad_merma >= 0
  ),
  bultos integer check (bultos is null or bultos >= 0),

  ot_numero text,
  num_pedido text,
  stock_articulo_destino_id uuid
    references public.prod_stock_articulos (id) on delete restrict,

  notas text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),

  constraint prod_stock_articulos_movimientos_transform_chk
    check (
      tipo <> 'transformacion'
      or (
        stock_articulo_destino_id is not null
        and cantidad_destino is not null
      )
    )
);

comment on table public.prod_stock_articulos_movimientos is
  'Ledger inmutable. cantidad_antes/despues para auditoría (sobre todo ajuste). '
  'transformacion: cantidad=salida A, cantidad_destino=entrada B, cantidad_merma.';

create index if not exists idx_prod_stock_articulos_movimientos_stock
  on public.prod_stock_articulos_movimientos (stock_articulo_id);
create index if not exists idx_prod_stock_articulos_movimientos_ot
  on public.prod_stock_articulos_movimientos (ot_numero)
  where ot_numero is not null;
create index if not exists idx_prod_stock_articulos_movimientos_created
  on public.prod_stock_articulos_movimientos (created_at desc);

create or replace function public.prod_stock_articulos_movimientos_no_mutate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'prod_stock_articulos_movimientos es inmutable (no UPDATE/DELETE)';
end;
$$;

drop trigger if exists trg_prod_stock_articulos_movimientos_no_update
  on public.prod_stock_articulos_movimientos;
create trigger trg_prod_stock_articulos_movimientos_no_update
  before update on public.prod_stock_articulos_movimientos
  for each row execute function public.prod_stock_articulos_movimientos_no_mutate();

drop trigger if exists trg_prod_stock_articulos_movimientos_no_delete
  on public.prod_stock_articulos_movimientos;
create trigger trg_prod_stock_articulos_movimientos_no_delete
  before delete on public.prod_stock_articulos_movimientos
  for each row execute function public.prod_stock_articulos_movimientos_no_mutate();

-- ══════════════════════════════════════════
-- 4. Vistas ATP
-- ══════════════════════════════════════════

create or replace view public.stock_articulos_atp
with (security_invoker = on)
as
with reservas as (
  select
    stock_articulo_id,
    coalesce(sum(cantidad_reservada - cantidad_consumida), 0) as comprometida_total,
    count(*) as reservas_vivas
  from public.prod_stock_articulos_reservas
  where estado in ('activa', 'parcial')
  group by stock_articulo_id
)
select
  s.id,
  s.referencia_id,
  s.referencia_codigo,
  s.referencia_descripcion,
  s.referencia_cliente,
  s.cliente,
  s.cliente_norm,
  s.unidad,
  s.poses,
  s.estado_proceso,
  s.ot_origen,
  s.bultos,
  s.palets,
  s.ubicacion_fisica,
  s.notas,
  s.condicion,
  s.created_at,
  s.updated_at,
  s.cantidad_actual as cantidad_fisica,
  coalesce(r.comprometida_total, 0) as cantidad_reservada_total,
  greatest(s.cantidad_actual - coalesce(r.comprometida_total, 0), 0) as cantidad_libre,
  coalesce(r.reservas_vivas, 0) as reservas_count,
  (coalesce(r.comprometida_total, 0) > s.cantidad_actual) as sobre_reservado,
  case
    when s.cantidad_actual <= 0 then 'agotado'
    when coalesce(r.comprometida_total, 0) <= 0 then 'disponible'
    when s.cantidad_actual - coalesce(r.comprometida_total, 0) <= 0 then 'reservado'
    else 'parcial'
  end as estado_derivado
from public.prod_stock_articulos s
left join reservas r on r.stock_articulo_id = s.id;

comment on view public.stock_articulos_atp is
  'ATP por lote. Libre = físico − Σ(reservada−consumida) solo activa/parcial. '
  'estado_derivado siempre calculado. cliente_norm para filtros.';

grant select on public.stock_articulos_atp to authenticated;

-- Crítico agregado: solo PT en uds; agrupa por referencia_id (+ cliente_norm).
-- referencia_cliente sale del maestro, no del lote.
create or replace view public.stock_articulos_critico_por_ref
with (security_invoker = on)
as
select
  a.referencia_id,
  ref.codigo as referencia_codigo,
  ref.referencia_cliente,
  a.cliente_norm,
  ref.stock_cantidad_minima,
  sum(a.cantidad_fisica) as cantidad_fisica_total,
  sum(a.cantidad_libre) as cantidad_libre_total,
  (ref.stock_cantidad_minima is not null
    and sum(a.cantidad_libre) <= ref.stock_cantidad_minima) as es_critico
from public.stock_articulos_atp a
join public.prod_referencias ref on ref.id = a.referencia_id
where a.unidad = 'uds'
  and a.estado_proceso = 'terminado'
group by
  a.referencia_id,
  ref.codigo,
  ref.referencia_cliente,
  a.cliente_norm,
  ref.stock_cantidad_minima;

comment on view public.stock_articulos_critico_por_ref is
  'Alerta mínima por artículo (suma libres uds terminado). '
  'No mezcla hojas/WIP. referencia_cliente del maestro.';

grant select on public.stock_articulos_critico_por_ref to authenticated;

-- ══════════════════════════════════════════
-- 5. RLS: app solo SELECT; escritura vía RPC
-- ══════════════════════════════════════════

alter table public.prod_stock_articulos enable row level security;
alter table public.prod_stock_articulos_reservas enable row level security;
alter table public.prod_stock_articulos_movimientos enable row level security;

revoke all on public.prod_stock_articulos from authenticated;
revoke all on public.prod_stock_articulos_reservas from authenticated;
revoke all on public.prod_stock_articulos_movimientos from authenticated;
revoke all on public.prod_stock_articulos from anon;
revoke all on public.prod_stock_articulos_reservas from anon;
revoke all on public.prod_stock_articulos_movimientos from anon;
revoke all on public.profiles_capacidades from anon;
grant select on public.prod_stock_articulos to authenticated;
grant select on public.prod_stock_articulos_reservas to authenticated;
grant select on public.prod_stock_articulos_movimientos to authenticated;

drop policy if exists prod_stock_articulos_select on public.prod_stock_articulos;
drop policy if exists prod_stock_articulos_insert on public.prod_stock_articulos;
drop policy if exists prod_stock_articulos_update on public.prod_stock_articulos;
drop policy if exists prod_stock_articulos_delete on public.prod_stock_articulos;
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
          'oficina_tecnica', 'comercial', 'engomado', 'troquelado', 'digital'
        ])
    )
  );

drop policy if exists prod_stock_articulos_reservas_select
  on public.prod_stock_articulos_reservas;
drop policy if exists prod_stock_articulos_reservas_write
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
          'oficina_tecnica', 'comercial', 'engomado', 'troquelado', 'digital'
        ])
    )
  );

drop policy if exists prod_stock_articulos_movimientos_select
  on public.prod_stock_articulos_movimientos;
drop policy if exists prod_stock_articulos_movimientos_insert
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
          'oficina_tecnica', 'comercial', 'engomado', 'troquelado', 'digital'
        ])
    )
  );

-- ══════════════════════════════════════════
-- 6. RPCs
-- ══════════════════════════════════════════

create or replace function public.prod_stock_articulos_alta_lote(
  p_referencia_id uuid,
  p_cantidad integer,
  p_unidad text default 'uds',
  p_estado_proceso text default 'terminado',
  p_cliente text default null,
  p_ot_origen text default null,
  p_poses numeric default null,
  p_bultos integer default null,
  p_palets numeric default null,
  p_ubicacion_fisica text default null,
  p_notas text default null,
  p_condicion text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.prod_referencias%rowtype;
  v_id uuid;
  v_cliente text;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;
  if p_referencia_id is null then
    raise exception 'p_referencia_id obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'p_cantidad debe ser > 0';
  end if;
  if p_unidad is null or p_unidad not in ('uds', 'hojas') then
    raise exception 'p_unidad debe ser uds u hojas';
  end if;

  select * into v_ref
  from public.prod_referencias
  where id = p_referencia_id
  for share;

  if not found then
    raise exception 'Referencia no encontrada: %', p_referencia_id;
  end if;

  v_cliente := nullif(btrim(coalesce(p_cliente, v_ref.cliente)), '');

  insert into public.prod_stock_articulos (
    referencia_id, referencia_codigo, referencia_descripcion, referencia_cliente,
    cliente, cantidad_actual, unidad, poses, estado_proceso, ot_origen,
    bultos, palets, ubicacion_fisica, notas, condicion, created_by
  ) values (
    v_ref.id, v_ref.codigo, v_ref.descripcion, v_ref.referencia_cliente,
    v_cliente, p_cantidad, p_unidad, p_poses,
    coalesce(nullif(btrim(p_estado_proceso), ''), 'terminado'),
    nullif(btrim(p_ot_origen), ''),
    p_bultos, p_palets, nullif(btrim(p_ubicacion_fisica), ''),
    nullif(btrim(p_notas), ''), nullif(btrim(p_condicion), ''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    ot_numero, notas, created_by
  ) values (
    v_id, 'entrada', p_cantidad, 0, p_cantidad,
    nullif(btrim(p_ot_origen), ''),
    coalesce(nullif(btrim(p_notas), ''), 'Alta de lote'),
    auth.uid()
  );

  return v_id;
end;
$$;

create or replace function public.prod_stock_articulos_ajustar(
  p_stock_id uuid,
  p_cantidad_nueva integer,
  p_notas text default null,
  p_bultos integer default null,
  p_forzar boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes integer;
  v_delta integer;
  v_comprometida integer;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;
  if p_cantidad_nueva is null or p_cantidad_nueva < 0 then
    raise exception 'p_cantidad_nueva debe ser >= 0';
  end if;
  if nullif(btrim(p_notas), '') is null then
    raise exception 'p_notas obligatorio en ajuste (auditoría)';
  end if;

  select cantidad_actual into v_antes
  from public.prod_stock_articulos
  where id = p_stock_id
  for update;

  if not found then
    raise exception 'Lote no encontrado: %', p_stock_id;
  end if;

  select coalesce(sum(cantidad_reservada - cantidad_consumida), 0)
  into v_comprometida
  from public.prod_stock_articulos_reservas
  where stock_articulo_id = p_stock_id
    and estado in ('activa', 'parcial');

  if p_cantidad_nueva < v_comprometida and not coalesce(p_forzar, false) then
    raise exception
      'Ajuste dejaría físico (%) bajo lo comprometido (%). Libera reservas o usa p_forzar=true con nota.',
      p_cantidad_nueva, v_comprometida;
  end if;

  v_delta := abs(p_cantidad_nueva - v_antes);
  if v_delta = 0 and p_bultos is null then
    return;
  end if;

  update public.prod_stock_articulos
  set
    cantidad_actual = p_cantidad_nueva,
    bultos = coalesce(p_bultos, bultos)
  where id = p_stock_id;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    bultos, notas, created_by
  ) values (
    p_stock_id, 'ajuste', v_delta, v_antes, p_cantidad_nueva,
    p_bultos, btrim(p_notas), auth.uid()
  );
end;
$$;

create or replace function public.prod_stock_articulos_reservar(
  p_stock_id uuid,
  p_ot_numero text,
  p_cantidad integer,
  p_num_pedido text default null,
  p_bultos integer default null,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_fisico integer;
  v_comprometida integer;
  v_libre integer;
  v_res_id uuid;
  v_res_reservada integer;
  v_res_consumida integer;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;

  v_ot := nullif(btrim(p_ot_numero), '');
  if v_ot is null then
    raise exception 'p_ot_numero obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'p_cantidad debe ser > 0';
  end if;

  -- nº OT de planta = prod_ots_general.num_pedido (id es uuid)
  if not exists (
    select 1 from public.prod_ots_general where num_pedido = v_ot
  ) then
    raise exception
      'OT % no está en Minerva (prod_ots_general.num_pedido). Impórtala desde Optimus antes de reservar.',
      v_ot;
  end if;

  select cantidad_actual into v_fisico
  from public.prod_stock_articulos
  where id = p_stock_id
  for update;

  if not found then
    raise exception 'Lote no encontrado: %', p_stock_id;
  end if;

  select coalesce(sum(cantidad_reservada - cantidad_consumida), 0)
  into v_comprometida
  from public.prod_stock_articulos_reservas
  where stock_articulo_id = p_stock_id
    and estado in ('activa', 'parcial');

  v_libre := greatest(v_fisico - v_comprometida, 0);
  if p_cantidad > v_libre then
    raise exception
      'No hay libre suficiente: libre=%, pedido=%', v_libre, p_cantidad;
  end if;

  select id, cantidad_reservada, cantidad_consumida
  into v_res_id, v_res_reservada, v_res_consumida
  from public.prod_stock_articulos_reservas
  where stock_articulo_id = p_stock_id
    and ot_numero = v_ot
    and estado in ('activa', 'parcial')
  for update;

  if v_res_id is not null then
    update public.prod_stock_articulos_reservas
    set
      cantidad_reservada = v_res_reservada + p_cantidad,
      bultos_reservados = coalesce(p_bultos, bultos_reservados),
      num_pedido = coalesce(nullif(btrim(p_num_pedido), ''), num_pedido),
      notas = coalesce(nullif(btrim(p_notas), ''), notas),
      estado = case
        when v_res_consumida > 0 then 'parcial'
        else 'activa'
      end
    where id = v_res_id;
  else
    insert into public.prod_stock_articulos_reservas (
      stock_articulo_id, ot_numero, num_pedido, cantidad_reservada,
      cantidad_consumida, estado, bultos_reservados, notas, created_by
    ) values (
      p_stock_id, v_ot, nullif(btrim(p_num_pedido), ''), p_cantidad,
      0, 'activa', p_bultos, nullif(btrim(p_notas), ''), auth.uid()
    )
    returning id into v_res_id;
  end if;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    ot_numero, num_pedido, bultos, notas, created_by
  ) values (
    p_stock_id, 'reserva', p_cantidad, v_fisico, v_fisico,
    v_ot, nullif(btrim(p_num_pedido), ''), p_bultos,
    coalesce(nullif(btrim(p_notas), ''), 'Reserva OT ' || v_ot),
    auth.uid()
  );

  return v_res_id;
end;
$$;

create or replace function public.prod_stock_articulos_liberar(
  p_stock_id uuid,
  p_ot_numero text,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_fisico integer;
  v_res public.prod_stock_articulos_reservas%rowtype;
  v_pendiente integer;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;

  v_ot := nullif(btrim(p_ot_numero), '');
  if v_ot is null then
    raise exception 'p_ot_numero obligatorio';
  end if;

  select cantidad_actual into v_fisico
  from public.prod_stock_articulos
  where id = p_stock_id
  for update;

  if not found then
    raise exception 'Lote no encontrado: %', p_stock_id;
  end if;

  select * into v_res
  from public.prod_stock_articulos_reservas
  where stock_articulo_id = p_stock_id
    and ot_numero = v_ot
    and estado in ('activa', 'parcial')
  for update;

  if not found then
    raise exception 'No hay reserva viva para OT % en este lote', v_ot;
  end if;

  v_pendiente := v_res.cantidad_reservada - v_res.cantidad_consumida;

  update public.prod_stock_articulos_reservas
  set estado = 'liberada'
  where id = v_res.id;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    ot_numero, num_pedido, notas, created_by
  ) values (
    p_stock_id, 'liberacion', v_pendiente, v_fisico, v_fisico,
    v_ot, v_res.num_pedido,
    coalesce(nullif(btrim(p_notas), ''), 'Liberación reserva OT ' || v_ot),
    auth.uid()
  );
end;
$$;

create or replace function public.prod_stock_articulos_consumir(
  p_stock_id uuid,
  p_ot_numero text,
  p_cantidad integer,
  p_bultos integer default null,
  p_notas text default null,
  p_motivo_sin_reserva text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_fisico integer;
  v_despues integer;
  v_res public.prod_stock_articulos_reservas%rowtype;
  v_pendiente integer;
  v_nueva_consumida integer;
  v_comprometida integer;
  v_libre integer;
  v_found boolean := false;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;

  v_ot := nullif(btrim(p_ot_numero), '');
  if v_ot is null then
    raise exception 'p_ot_numero obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'p_cantidad debe ser > 0';
  end if;

  select cantidad_actual into v_fisico
  from public.prod_stock_articulos
  where id = p_stock_id
  for update;

  if not found then
    raise exception 'Lote no encontrado: %', p_stock_id;
  end if;

  if p_cantidad > v_fisico then
    raise exception 'Físico insuficiente: físico=%, consumo=%', v_fisico, p_cantidad;
  end if;

  select * into v_res
  from public.prod_stock_articulos_reservas
  where stock_articulo_id = p_stock_id
    and ot_numero = v_ot
    and estado in ('activa', 'parcial')
  for update;

  v_found := found;

  if not v_found then
    if nullif(btrim(p_motivo_sin_reserva), '') is null then
      raise exception
        'No hay reserva viva para OT %. Pasa p_motivo_sin_reserva para forzar consumo.',
        v_ot;
    end if;
    -- Sin reserva: solo se puede gastar lo LIBRE (no lo comprometido a otras OTs)
    select coalesce(sum(cantidad_reservada - cantidad_consumida), 0)
    into v_comprometida
    from public.prod_stock_articulos_reservas
    where stock_articulo_id = p_stock_id
      and estado in ('activa', 'parcial');
    v_libre := greatest(v_fisico - v_comprometida, 0);
    if p_cantidad > v_libre then
      raise exception
        'Sin reserva: consumo % supera libre % (hay % comprometidos a otras OTs)',
        p_cantidad, v_libre, v_comprometida;
    end if;
  else
    v_pendiente := v_res.cantidad_reservada - v_res.cantidad_consumida;
    if p_cantidad > v_pendiente then
      raise exception
        'Consumo % supera pendiente de reserva % (OT %)',
        p_cantidad, v_pendiente, v_ot;
    end if;
    v_nueva_consumida := v_res.cantidad_consumida + p_cantidad;
    update public.prod_stock_articulos_reservas
    set
      cantidad_consumida = v_nueva_consumida,
      estado = case
        when v_nueva_consumida >= cantidad_reservada then 'consumida'
        else 'parcial'
      end
    where id = v_res.id;
  end if;

  v_despues := v_fisico - p_cantidad;
  update public.prod_stock_articulos
  set
    cantidad_actual = v_despues,
    bultos = case
      when p_bultos is null then bultos
      when bultos is null then null
      else greatest(bultos - p_bultos, 0)
    end
  where id = p_stock_id;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    ot_numero, num_pedido, bultos, notas, created_by
  ) values (
    p_stock_id, 'consumo', p_cantidad, v_fisico, v_despues,
    v_ot, case when v_found then v_res.num_pedido else null end, p_bultos,
    coalesce(
      nullif(btrim(p_notas), ''),
      nullif(btrim(p_motivo_sin_reserva), ''),
      'Consumo OT ' || v_ot
    ),
    auth.uid()
  );
end;
$$;

create or replace function public.prod_stock_articulos_transformar(
  p_stock_origen_id uuid,
  p_cantidad_salida integer,
  p_cantidad_destino integer,
  p_estado_proceso_destino text,
  p_stock_destino_id uuid default null,
  p_cantidad_merma integer default null,
  p_unidad_destino text default null,
  p_ot_numero text default null,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen public.prod_stock_articulos%rowtype;
  v_destino public.prod_stock_articulos%rowtype;
  v_destino_id uuid;
  v_despues_origen integer;
  v_merma integer;
  v_antes_destino integer;
  v_despues_destino integer;
  v_unidad_dest text;
  v_id_a uuid;
  v_id_b uuid;
  v_equiv_hojas numeric;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;
  if p_cantidad_salida is null or p_cantidad_salida <= 0 then
    raise exception 'p_cantidad_salida debe ser > 0';
  end if;
  if p_cantidad_destino is null or p_cantidad_destino < 0 then
    raise exception 'p_cantidad_destino debe ser >= 0';
  end if;
  if nullif(btrim(p_estado_proceso_destino), '') is null then
    raise exception 'p_estado_proceso_destino obligatorio';
  end if;
  if p_stock_destino_id is not null and p_stock_destino_id = p_stock_origen_id then
    raise exception 'Origen y destino no pueden ser el mismo lote';
  end if;

  -- Lock en orden de id (evita deadlock A→B / B→A)
  if p_stock_destino_id is not null then
    if p_stock_origen_id < p_stock_destino_id then
      v_id_a := p_stock_origen_id;
      v_id_b := p_stock_destino_id;
    else
      v_id_a := p_stock_destino_id;
      v_id_b := p_stock_origen_id;
    end if;
    perform 1 from public.prod_stock_articulos where id = v_id_a for update;
    perform 1 from public.prod_stock_articulos where id = v_id_b for update;
  end if;

  select * into v_origen
  from public.prod_stock_articulos
  where id = p_stock_origen_id
  for update;

  if not found then
    raise exception 'Lote origen no encontrado';
  end if;
  if p_cantidad_salida > v_origen.cantidad_actual then
    raise exception 'Físico origen insuficiente';
  end if;

  v_unidad_dest := coalesce(nullif(btrim(p_unidad_destino), ''), v_origen.unidad);
  if v_unidad_dest not in ('uds', 'hojas') then
    raise exception 'p_unidad_destino debe ser uds u hojas';
  end if;

  if v_unidad_dest = v_origen.unidad then
    if p_cantidad_destino > p_cantidad_salida then
      raise exception 'Misma unidad: destino no puede superar salida';
    end if;
    v_merma := coalesce(p_cantidad_merma, p_cantidad_salida - p_cantidad_destino);
    if v_merma <> (p_cantidad_salida - p_cantidad_destino) then
      raise exception 'cantidad_merma debe ser salida − destino (misma unidad)';
    end if;
  else
    -- Cambio de unidad (p.ej. hojas → uds): merma en unidad de origen
    if p_cantidad_merma is not null then
      v_merma := p_cantidad_merma;
    elsif v_origen.unidad = 'hojas'
      and v_unidad_dest = 'uds'
      and v_origen.poses is not null
      and v_origen.poses > 0
    then
      v_equiv_hojas := ceil(p_cantidad_destino::numeric / v_origen.poses);
      v_merma := p_cantidad_salida - v_equiv_hojas::integer;
    else
      raise exception
        'Cambio de unidad (%)→(%) requiere p_cantidad_merma (o poses en hojas→uds)',
        v_origen.unidad, v_unidad_dest;
    end if;
    if v_merma < 0 then
      raise exception 'Merma negativa: salida insuficiente para el destino indicado';
    end if;
  end if;

  if exists (
    select 1 from public.prod_stock_articulos_reservas
    where stock_articulo_id = p_stock_origen_id
      and estado in ('activa', 'parcial')
      and (cantidad_reservada - cantidad_consumida) > 0
  ) then
    raise exception 'Libera o consume reservas vivas antes de transformar';
  end if;

  v_despues_origen := v_origen.cantidad_actual - p_cantidad_salida;
  update public.prod_stock_articulos
  set cantidad_actual = v_despues_origen
  where id = p_stock_origen_id;

  if p_stock_destino_id is not null then
    select * into v_destino
    from public.prod_stock_articulos
    where id = p_stock_destino_id
    for update;
    if not found then
      raise exception 'Lote destino no encontrado';
    end if;
    if v_destino.referencia_id <> v_origen.referencia_id then
      raise exception 'Destino debe ser misma referencia';
    end if;
    if coalesce(v_destino.cliente_norm, '') <> coalesce(v_origen.cliente_norm, '') then
      raise exception 'Destino debe ser mismo cliente_norm';
    end if;
    if v_destino.unidad <> v_unidad_dest then
      raise exception 'Destino tiene unidad %, se pidió %', v_destino.unidad, v_unidad_dest;
    end if;
    if v_destino.estado_proceso <> p_estado_proceso_destino then
      raise exception
        'Destino ya es estado_proceso=%; no se cambia. Debe coincidir con %',
        v_destino.estado_proceso, p_estado_proceso_destino;
    end if;
    v_destino_id := v_destino.id;
    v_antes_destino := v_destino.cantidad_actual;
    v_despues_destino := v_antes_destino + p_cantidad_destino;
    update public.prod_stock_articulos
    set cantidad_actual = v_despues_destino
    where id = v_destino_id;
  else
    v_antes_destino := 0;
    insert into public.prod_stock_articulos (
      referencia_id, referencia_codigo, referencia_descripcion, referencia_cliente,
      cliente, cantidad_actual, unidad, poses, estado_proceso, ot_origen,
      ubicacion_fisica, notas, created_by
    ) values (
      v_origen.referencia_id, v_origen.referencia_codigo,
      v_origen.referencia_descripcion, v_origen.referencia_cliente,
      v_origen.cliente, p_cantidad_destino, v_unidad_dest, v_origen.poses,
      p_estado_proceso_destino, v_origen.ot_origen,
      v_origen.ubicacion_fisica,
      coalesce(nullif(btrim(p_notas), ''), 'Transformación desde lote ' || p_stock_origen_id::text),
      auth.uid()
    )
    returning id into v_destino_id;
    v_despues_destino := p_cantidad_destino;
  end if;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    cantidad_destino, cantidad_merma, stock_articulo_destino_id,
    ot_numero, notas, created_by
  ) values (
    p_stock_origen_id, 'transformacion', p_cantidad_salida,
    v_origen.cantidad_actual, v_despues_origen,
    p_cantidad_destino, v_merma, v_destino_id,
    nullif(btrim(p_ot_numero), ''),
    coalesce(nullif(btrim(p_notas), ''), 'Transformación WIP'),
    auth.uid()
  );

  if p_cantidad_destino > 0 then
    insert into public.prod_stock_articulos_movimientos (
      stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
      ot_numero, notas, created_by
    ) values (
      v_destino_id, 'entrada', p_cantidad_destino,
      v_antes_destino, v_despues_destino,
      nullif(btrim(p_ot_numero), ''),
      case
        when p_stock_destino_id is null then 'Alta lote destino por transformación'
        else 'Entrada por transformación desde ' || p_stock_origen_id::text
      end,
      auth.uid()
    );
  end if;

  return v_destino_id;
end;
$$;

-- Revoke firmas antiguas por si se recrea en entornos con la versión previa
drop function if exists public.prod_stock_articulos_ajustar(uuid, integer, text, integer);
drop function if exists public.prod_stock_articulos_reservar(uuid, text, integer, text, integer, text, boolean);
drop function if exists public.prod_stock_articulos_transformar(uuid, integer, integer, text, uuid, integer, text, text);

revoke all on function public.prod_stock_articulos_alta_lote(
  uuid, integer, text, text, text, text, numeric, integer, numeric, text, text, text
) from public;
revoke all on function public.prod_stock_articulos_alta_lote(
  uuid, integer, text, text, text, text, numeric, integer, numeric, text, text, text
) from anon;
revoke all on function public.prod_stock_articulos_ajustar(uuid, integer, text, integer, boolean) from public;
revoke all on function public.prod_stock_articulos_ajustar(uuid, integer, text, integer, boolean) from anon;
revoke all on function public.prod_stock_articulos_reservar(
  uuid, text, integer, text, integer, text
) from public;
revoke all on function public.prod_stock_articulos_reservar(
  uuid, text, integer, text, integer, text
) from anon;
revoke all on function public.prod_stock_articulos_liberar(uuid, text, text) from public;
revoke all on function public.prod_stock_articulos_liberar(uuid, text, text) from anon;
revoke all on function public.prod_stock_articulos_consumir(
  uuid, text, integer, integer, text, text
) from public;
revoke all on function public.prod_stock_articulos_consumir(
  uuid, text, integer, integer, text, text
) from anon;
revoke all on function public.prod_stock_articulos_transformar(
  uuid, integer, integer, text, uuid, integer, text, text, text
) from public;
revoke all on function public.prod_stock_articulos_transformar(
  uuid, integer, integer, text, uuid, integer, text, text, text
) from anon;
revoke all on function public.minerva_can_write_stock_articulos() from anon;
revoke all on function public.minerva_grant_capacidad(uuid, text) from anon;
revoke all on function public.minerva_revoke_capacidad(uuid, text) from anon;

grant execute on function public.prod_stock_articulos_alta_lote(
  uuid, integer, text, text, text, text, numeric, integer, numeric, text, text, text
) to authenticated;
grant execute on function public.prod_stock_articulos_ajustar(uuid, integer, text, integer, boolean)
  to authenticated;
grant execute on function public.prod_stock_articulos_reservar(
  uuid, text, integer, text, integer, text
) to authenticated;
grant execute on function public.prod_stock_articulos_liberar(uuid, text, text)
  to authenticated;
grant execute on function public.prod_stock_articulos_consumir(
  uuid, text, integer, integer, text, text
) to authenticated;
grant execute on function public.prod_stock_articulos_transformar(
  uuid, integer, integer, text, uuid, integer, text, text, text
) to authenticated;

-- Seed capacidad Gabri si el usuario ya existe (idempotente)
insert into public.profiles_capacidades (user_id, capacidad)
select u.id, 'stock_articulos_write'
from auth.users u
where lower(u.email) = 'gabri@minervaglobal.es'
on conflict (user_id, capacidad) do nothing;
