-- Bloque 9.8.3 — Salida automática de estado STOP al consumir material
-- Modifica prod_stock_registrar_consumo para limpiar estado_material
-- cuando una OT en STOP consume material (salida simétrica a 9.8.4 asignación).

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

  -- 9.8.3: Salir de estado STOP al consumir material (hueco #5 / línea 340-343 brief).
  -- Simétrico a 9.8.4 (prod_stock_asignar_palet_ot): limpiar estados STOP tras consumo.
  -- Solo actualiza si la OT está en STOP; preserva otros estados válidos.
  if v_ot_clean is not null then
    update public.produccion_ot_despachadas
    set estado_material = 'Material en stock asignado'
    where ot_numero = v_ot_clean
      and btrim(estado_material) in (
        'Sin material asignado (liberado)',
        'Pendiente compra de corrección'
      );
  end if;
end;
$$;

comment on function public.prod_stock_registrar_consumo(uuid, integer, text, uuid, text) is
  'Registra consumo de material (9.4 + 9.8.1c + 9.8.3): movimiento, descuento físico, '
  'ajuste reserva OT, sync estado legacy, limpieza bridge si agotado, y salida automática '
  'de estado STOP en produccion_ot_despachadas si la OT estaba bloqueada.';
