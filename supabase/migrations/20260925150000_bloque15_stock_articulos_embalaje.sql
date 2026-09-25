-- Bloque 15.1c — embalaje opcional en lote + RPC alta ampliada.
-- Seguro en horario: ADD COLUMN nullable + DROP/CREATE views + replace function.

alter table public.prod_stock_articulos
  add column if not exists unidades_por_bulto integer
    check (unidades_por_bulto is null or unidades_por_bulto > 0);

alter table public.prod_stock_articulos
  add column if not exists pico integer
    check (pico is null or pico >= 0);

alter table public.prod_stock_articulos
  add column if not exists caja_embalaje text;

comment on column public.prod_stock_articulos.unidades_por_bulto is
  'Uds por bulto/caja (opcional). MVP: no desglose por palet.';
comment on column public.prod_stock_articulos.pico is
  'Unidades sueltas / pico fuera de bultos completos (opcional).';
comment on column public.prod_stock_articulos.caja_embalaje is
  'Código tipo embalaje (MN2L, BP1N…). Opcional.';
comment on column public.prod_stock_articulos.palets is
  'Nº de palets del lote en general (no desglose palet a palet).';

-- Postgres no permite insertar columnas en medio con CREATE OR REPLACE VIEW.
drop view if exists public.stock_articulos_critico_por_ref;
drop view if exists public.stock_articulos_atp;

create view public.stock_articulos_atp
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
  end as estado_derivado,
  s.unidades_por_bulto,
  s.pico,
  s.caja_embalaje
from public.prod_stock_articulos s
left join reservas r on r.stock_articulo_id = s.id;

comment on view public.stock_articulos_atp is
  'ATP stock artículos: libre = físico − Σ(reservada−consumida) activa|parcial.';

grant select on public.stock_articulos_atp to authenticated;

create view public.stock_articulos_critico_por_ref
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

-- DROP firma anterior (create or replace no sustituye si cambia la lista de args).
drop function if exists public.prod_stock_articulos_alta_lote(
  uuid, integer, text, text, text, text, numeric, integer, numeric, text, text, text
);

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
  p_unidades_por_bulto integer default null,
  p_pico integer default null,
  p_caja_embalaje text default null,
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
  if p_unidades_por_bulto is not null and p_unidades_por_bulto <= 0 then
    raise exception 'p_unidades_por_bulto debe ser > 0';
  end if;
  if p_pico is not null and p_pico < 0 then
    raise exception 'p_pico debe ser >= 0';
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
    bultos, palets, unidades_por_bulto, pico, caja_embalaje,
    ubicacion_fisica, notas, condicion, created_by
  ) values (
    v_ref.id, v_ref.codigo, v_ref.descripcion, v_ref.referencia_cliente,
    v_cliente, p_cantidad, p_unidad, p_poses,
    coalesce(nullif(btrim(p_estado_proceso), ''), 'terminado'),
    nullif(btrim(p_ot_origen), ''),
    p_bultos, p_palets, p_unidades_por_bulto, p_pico,
    nullif(btrim(p_caja_embalaje), ''),
    nullif(btrim(p_ubicacion_fisica), ''),
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

revoke all on function public.prod_stock_articulos_alta_lote(
  uuid, integer, text, text, text, text, numeric, integer, numeric,
  integer, integer, text, text, text, text
) from public, anon;
grant execute on function public.prod_stock_articulos_alta_lote(
  uuid, integer, text, text, text, text, numeric, integer, numeric,
  integer, integer, text, text, text, text
) to authenticated;
