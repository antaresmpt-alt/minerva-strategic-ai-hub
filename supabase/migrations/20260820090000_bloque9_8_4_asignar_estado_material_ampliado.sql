-- §18.11 — Ampliar WHERE de prod_stock_asignar_palet_ot para cubrir OTs
-- que nunca pasaron por STOP (estado_material típico: "Sin orden compra",
-- "Sin orden de compra", vacío/null, "Pendiente de pedir", "Compra cancelada").
-- Anteriormente el RPC solo actualizaba si el estado era 'Sin material asignado (liberado)'
-- o 'Pendiente compra de corrección'. Ahora cubre el espectro completo de estados
-- que indican que el material aún no ha sido provisto.

create or replace function public.prod_stock_asignar_palet_ot(
  p_palet_id           uuid,
  p_ot_numero          text,
  p_cantidad_reservada integer  default null,  -- null = blanda (toda la cartela)
  p_notas              text     default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual  integer;
  v_ot_clean text;
begin
  if p_palet_id is null then
    raise exception 'p_palet_id es obligatorio';
  end if;

  v_ot_clean := nullif(btrim(p_ot_numero), '');
  if v_ot_clean is null then
    raise exception 'p_ot_numero es obligatorio';
  end if;

  if p_cantidad_reservada is not null and p_cantidad_reservada <= 0 then
    raise exception 'p_cantidad_reservada debe ser nulo (blanda) o un entero positivo';
  end if;

  -- Lock palet
  select cantidad_actual into v_actual
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Cartela no encontrada: %', p_palet_id;
  end if;

  if v_actual <= 0 then
    raise exception 'La cartela está agotada (0 h). No se puede asignar a una OT.';
  end if;

  if exists (
    select 1 from public.prod_stock_palet_ots
    where palet_id = p_palet_id and ot_numero = v_ot_clean
  ) then
    raise exception
      'La cartela ya tiene reserva para OT %. Usa Liberar primero si quieres reasignar.',
      v_ot_clean;
  end if;

  -- Registro en ledger (traceabilidad, sin cambiar cantidad_actual)
  insert into public.prod_stock_movimientos (
    palet_id, tipo, cantidad, ot_numero, ot_destino_numero, notas, created_by
  ) values (
    p_palet_id,
    'ajuste',
    greatest(coalesce(p_cantidad_reservada, v_actual), 1),
    v_ot_clean,
    v_ot_clean,
    coalesce(nullif(btrim(p_notas), ''), 'Asignación de stock libre a OT ' || v_ot_clean),
    auth.uid()
  );

  -- Crear fila bridge
  insert into public.prod_stock_palet_ots (palet_id, ot_numero, cantidad_reservada)
  values (p_palet_id, v_ot_clean, p_cantidad_reservada);

  -- Sync legacy estado + ot_destino_numero
  update public.prod_stock_palets
  set
    estado = case
      when p_cantidad_reservada is null then 'reservado'
      when v_actual <= p_cantidad_reservada then 'reservado'
      else 'parcial'
    end,
    ot_destino_numero = v_ot_clean,
    updated_at = timezone('utc', now())
  where id = p_palet_id;

  -- §18.11 — Salir del estado STOP si la OT lo tenía.
  -- Cubre tanto OTs que pasaron por STOP (estados 'liberado'/'corrección')
  -- como OTs que nunca pasaron por STOP pero tienen estado pendiente de material.
  update public.produccion_ot_despachadas
  set estado_material = 'Material en stock asignado'
  where ot_numero = v_ot_clean
    and (
      estado_material is null
      or btrim(estado_material) = ''
      or btrim(estado_material) in (
        'Sin material asignado (liberado)',
        'Pendiente compra de corrección',
        'Sin orden compra',
        'Sin orden de compra',
        '"Sin orden compra"',
        'Pendiente de pedir',
        'Compra cancelada'
      )
    );
end;
$$;

comment on function public.prod_stock_asignar_palet_ot(uuid, text, integer, text) is
  'Bloque 9.8.4 / §18.11 — Asigna un palet disponible a una OT: crea bridge row '
  'en prod_stock_palet_ots, registra ajuste en ledger, actualiza estado legacy '
  'y sincroniza estado_material a ''Material en stock asignado'' para cualquier '
  'OT con estado de material pendiente (incluyendo OTs que nunca pasaron por STOP). '
  'Sin restricción de rol — Juan almacén puede ejecutarlo.';

grant execute on function public.prod_stock_asignar_palet_ot(uuid, text, integer, text)
  to authenticated;
