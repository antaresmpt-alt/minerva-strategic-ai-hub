-- Bloque 9.4 operativo: consumo atómico al cerrar impresión.

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
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser un entero positivo';
  end if;

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
    nullif(btrim(p_ot_numero), ''),
    p_paso_id,
    p_notas,
    auth.uid()
  );

  update public.prod_stock_palets
  set
    cantidad_actual = cantidad_actual - p_cantidad,
    updated_at = timezone('utc', now())
  where id = p_palet_id;

  -- Reduce reservas duras de la OT en este palet (ATP).
  update public.prod_stock_palet_ots
  set cantidad_reservada = greatest(coalesce(cantidad_reservada, 0) - p_cantidad, 0)
  where palet_id = p_palet_id
    and ot_numero = nullif(btrim(p_ot_numero), '')
    and cantidad_reservada is not null
    and cantidad_reservada > 0;
end;
$$;

comment on function public.prod_stock_registrar_consumo(uuid, integer, text, uuid, text) is
  'Registra consumo de material (9.4): movimiento + descuento cantidad_actual + ajuste reserva OT.';

grant execute on function public.prod_stock_registrar_consumo(uuid, integer, text, uuid, text)
  to authenticated;
