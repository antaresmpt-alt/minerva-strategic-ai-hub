-- Bloque 9.8.1c: sincronizar legacy `prod_stock_palets.estado` / bridge tras consumo 9.4.
-- Paridad con `stock_palets_atp.estado_derivado` (P1: el ledger manda).

create or replace function public.prod_stock_registrar_consumo(
  p_palet_id uuid,
  p_cantidad integer,
  p_ot_numero text,
  p_paso_id uuid default null,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual integer;
  v_nuevo_actual integer;
  v_reservada_total integer;
  v_ot_clean text;
  v_ot_destino text;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser un entero positivo';
  end if;

  v_ot_clean := nullif(btrim(p_ot_numero), '');

  select cantidad_actual
  into v_actual
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Palet no encontrado';
  end if;

  if v_actual < p_cantidad then
    raise exception 'Stock insuficiente: quedan % h, se solicitaron % h', v_actual, p_cantidad;
  end if;

  insert into public.prod_stock_movimientos (
    palet_id,
    tipo,
    cantidad,
    ot_numero,
    paso_id,
    notas,
    created_by
  ) values (
    p_palet_id,
    'consumo',
    p_cantidad,
    v_ot_clean,
    p_paso_id,
    p_notas,
    auth.uid()
  );

  update public.prod_stock_palets
  set cantidad_actual = cantidad_actual - p_cantidad
  where id = p_palet_id
  returning cantidad_actual into v_nuevo_actual;

  -- Reduce reservas duras de la OT en este palet (ATP).
  if v_ot_clean is not null then
    update public.prod_stock_palet_ots
    set cantidad_reservada = greatest(coalesce(cantidad_reservada, 0) - p_cantidad, 0)
    where palet_id = p_palet_id
      and ot_numero = v_ot_clean
      and cantidad_reservada is not null
      and cantidad_reservada > 0;
  end if;

  -- 9.8.1c: palet agotado → quitar referencias OT sin reserva dura (evita «reservado» fantasma).
  if v_nuevo_actual <= 0 then
    delete from public.prod_stock_palet_ots
    where palet_id = p_palet_id
      and coalesce(cantidad_reservada, 0) = 0;
  end if;

  select coalesce(
    sum(cantidad_reservada) filter (where cantidad_reservada is not null),
    0
  )
  into v_reservada_total
  from public.prod_stock_palet_ots
  where palet_id = p_palet_id;

  select case
    when count(*) = 1 then max(ot_numero)
    else null
  end
  into v_ot_destino
  from public.prod_stock_palet_ots
  where palet_id = p_palet_id;

  update public.prod_stock_palets
  set
    estado = case
      when v_nuevo_actual <= 0 then 'consumido'
      when v_reservada_total <= 0 then 'disponible'
      when v_nuevo_actual - v_reservada_total <= 0 then 'reservado'
      else 'parcial'
    end,
    ot_destino_numero = v_ot_destino,
    updated_at = timezone('utc', now())
  where id = p_palet_id;
end;
$$;

comment on function public.prod_stock_registrar_consumo(uuid, integer, text, uuid, text) is
  'Registra consumo de material (9.4 + 9.8.1c): movimiento, descuento físico, ajuste reserva OT, sync estado legacy y limpieza bridge si agotado.';

-- Reparación one-shot: palets ya consumidos con legacy desincronizado (p. ej. #10984 tras 98019-A).
delete from public.prod_stock_palet_ots po
using public.prod_stock_palets p
where po.palet_id = p.id
  and p.cantidad_actual <= 0
  and coalesce(po.cantidad_reservada, 0) = 0;

update public.prod_stock_palets p
set
  estado = 'consumido',
  ot_destino_numero = sub.single_ot,
  updated_at = timezone('utc', now())
from (
  select
    p2.id,
    case when count(po.*) = 1 then max(po.ot_numero) else null end as single_ot
  from public.prod_stock_palets p2
  left join public.prod_stock_palet_ots po on po.palet_id = p2.id
  where p2.cantidad_actual <= 0
    and p2.estado is distinct from 'consumido'
  group by p2.id
) sub
where p.id = sub.id;

update public.prod_stock_palets p
set
  estado = case
    when p.cantidad_actual <= 0 then 'consumido'
    when coalesce(r.reservada_total, 0) <= 0 then 'disponible'
    when p.cantidad_actual - coalesce(r.reservada_total, 0) <= 0 then 'reservado'
    else 'parcial'
  end,
  ot_destino_numero = case
    when coalesce(r.cnt, 0) = 1 then r.single_ot
    when coalesce(r.cnt, 0) = 0 then null
    else p.ot_destino_numero
  end,
  updated_at = timezone('utc', now())
from (
  select
    palet_id,
    coalesce(sum(cantidad_reservada) filter (where cantidad_reservada is not null), 0) as reservada_total,
    count(*) as cnt,
    case when count(*) = 1 then max(ot_numero) else null end as single_ot
  from public.prod_stock_palet_ots
  group by palet_id
) r
where p.id = r.palet_id
  and p.cantidad_actual > 0
  and p.estado is distinct from case
    when coalesce(r.reservada_total, 0) <= 0 then 'disponible'
    when p.cantidad_actual - coalesce(r.reservada_total, 0) <= 0 then 'reservado'
    else 'parcial'
  end;
