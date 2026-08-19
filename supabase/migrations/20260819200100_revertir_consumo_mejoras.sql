-- Bloque 9.8.5 — Mejoras revertir consumo:
--   • Anti doble-reversión (consumo neto palet+OT)
--   • Cantidad resultante tras corte (p_nueva_cantidad)
--   • Trazabilidad paso_id en el ajuste

create or replace function public.prod_stock_revertir_consumo(
  p_palet_id       uuid,
  p_cantidad       integer,
  p_ot_numero      text,
  p_autorizado_por text,
  p_notas          text  default null,
  p_nuevo_formato  text  default null,
  p_paso_id        uuid  default null,
  p_nueva_cantidad integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role     text;
  v_actual          integer;
  v_nuevo_actual    integer;
  v_notas_actuales  text;
  v_append          text;
  v_ot_clean        text;
  v_reservada_total integer;
  v_ot_destino      text;
  v_consumo_neto    integer;
begin
  select role
  into v_caller_role
  from public.profiles
  where id = auth.uid();

  if coalesce(v_caller_role, '') not in ('admin', 'oficina_tecnica', 'gerencia') then
    raise exception
      'Acción restringida: se requiere rol admin, oficina_tecnica o gerencia (actual: %)',
      coalesce(v_caller_role, 'sin rol');
  end if;

  if p_palet_id is null then
    raise exception 'p_palet_id es obligatorio';
  end if;

  v_ot_clean := nullif(btrim(p_ot_numero), '');
  if v_ot_clean is null then
    raise exception 'p_ot_numero es obligatorio';
  end if;

  if nullif(btrim(p_autorizado_por), '') is null then
    raise exception 'p_autorizado_por es obligatorio (queda registrado en el ledger)';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'p_cantidad debe ser un entero positivo; recibido: %', p_cantidad;
  end if;

  if p_nueva_cantidad is not null and p_nueva_cantidad < 0 then
    raise exception 'p_nueva_cantidad no puede ser negativa; recibido: %', p_nueva_cantidad;
  end if;

  select cantidad_actual, notas
  into v_actual, v_notas_actuales
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Cartela no encontrada: %', p_palet_id;
  end if;

  select coalesce(sum(case when tipo = 'consumo' then cantidad else 0 end), 0)
       - coalesce(sum(case when tipo = 'ajuste' then cantidad else 0 end), 0)
  into v_consumo_neto
  from public.prod_stock_movimientos
  where palet_id = p_palet_id
    and ot_numero = v_ot_clean;

  if v_consumo_neto <= 0 then
    raise exception
      'No hay consumo neto pendiente de revertir para cartela % en OT %.',
      p_palet_id, v_ot_clean;
  end if;

  if p_cantidad > v_consumo_neto then
    raise exception
      'Cantidad a revertir (%) supera el consumo neto pendiente (%) para OT %.',
      p_cantidad, v_consumo_neto, v_ot_clean;
  end if;

  insert into public.prod_stock_movimientos (
    palet_id,
    tipo,
    cantidad,
    ot_numero,
    ot_origen_numero,
    paso_id,
    autorizado_por,
    notas,
    created_by
  ) values (
    p_palet_id,
    'ajuste',
    p_cantidad,
    v_ot_clean,
    v_ot_clean,
    p_paso_id,
    btrim(p_autorizado_por),
    coalesce(
      nullif(btrim(p_notas), ''),
      'Reversión de consumo OT ' || v_ot_clean
    ),
    auth.uid()
  );

  if p_nueva_cantidad is not null then
    v_nuevo_actual := p_nueva_cantidad;
    update public.prod_stock_palets
    set cantidad_actual = p_nueva_cantidad
    where id = p_palet_id;
  else
    update public.prod_stock_palets
    set cantidad_actual = cantidad_actual + p_cantidad
    where id = p_palet_id
    returning cantidad_actual into v_nuevo_actual;
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

  v_append := format(
    '[%s] Consumo revertido OT %s (%s h devueltas%s). Autorizado: %s.%s',
    to_char(timezone('utc', now()), 'DD/MM/YYYY HH24:MI'),
    v_ot_clean,
    p_cantidad,
    case
      when p_nueva_cantidad is not null
        then format('; stock resultante: %s h', p_nueva_cantidad)
      else ''
    end,
    btrim(p_autorizado_por),
    case
      when nullif(btrim(p_notas), '') is not null
        then ' Motivo: ' || btrim(p_notas)
      else ''
    end
  );

  update public.prod_stock_palets
  set
    estado = case
      when v_nuevo_actual <= 0 then 'consumido'
      when v_reservada_total <= 0 then 'disponible'
      when v_nuevo_actual - v_reservada_total <= 0 then 'reservado'
      else 'parcial'
    end,
    ot_destino_numero = v_ot_destino,
    notas = case
      when notas is null or btrim(notas) = ''
        then v_append
      else notas || E'\n' || v_append
    end,
    formato = coalesce(nullif(btrim(p_nuevo_formato), ''), formato),
    updated_at = timezone('utc', now())
  where id = p_palet_id;

  update public.produccion_ot_despachadas
  set estado_material = 'Sin material asignado (liberado)'
  where ot_numero = v_ot_clean
    and estado_material not in (
      'Sin material asignado (liberado)',
      'Pendiente compra de corrección'
    );

end;
$$;

comment on function public.prod_stock_revertir_consumo(uuid, integer, text, text, text, text, uuid, integer) is
  'Bloque 9.8.5 — Revierte consumo erróneo. p_nueva_cantidad fija el stock real tras corte (Caso B). '
  'Impide doble reversión si el consumo neto palet+OT ya es cero.';

-- Sustituir firma anterior (6 params) por la nueva (8 params)
drop function if exists public.prod_stock_revertir_consumo(uuid, integer, text, text, text, text);

grant execute on function public.prod_stock_revertir_consumo(uuid, integer, text, text, text, text, uuid, integer)
  to authenticated;
