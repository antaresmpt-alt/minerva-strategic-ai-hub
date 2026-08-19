-- Bloque 9.8.5 — Revertir consumo de una cartela para una OT.
--
-- Espejo positivo de prod_stock_registrar_consumo (9.4 / 9.8.1c).
-- Uso principal: deshacer un consumo erróneo (corte de guillotina
-- con material equivocado — Caso B) antes de liberar el palet y
-- generar la compra de corrección (9.8.3).
--
-- Orden documentado para STOP Caso B:
--   1. prod_stock_revertir_consumo    → restaurar cantidad + marcar STOP
--   2. (manual si procede) ajustar formato palet vía p_nuevo_formato
--   3. prod_stock_liberar_reserva (9.8.1) ya NO es necesaria si no hay
--      bridge row — la RPC lleva el estado_material a STOP directamente.
--
-- Semántica del movimiento ledger:
--   tipo = 'ajuste', cantidad = positivo (crédito), ot_origen_numero = OT
--   que se revierte (trazabilidad). El ledger es inmutable; nunca se
--   borra la fila de consumo original — solo se añade la corrección.
--
-- Permisos: solo admin / oficina_tecnica / gerencia.
-- Sin p_reponer_reserva: en el flujo STOP el palet queda libre (disponible)
-- y la OT se marca STOP. Si se quisiera reponer reserva el llamador
-- deberá invocar la lógica de asignación (9.8.4) en un paso posterior.

create or replace function public.prod_stock_revertir_consumo(
  p_palet_id       uuid,
  p_cantidad       integer,       -- hojas a revertir (positivo)
  p_ot_numero      text,
  p_autorizado_por text,          -- obligatorio — queda en el ledger
  p_notas          text  default null,
  p_nuevo_formato  text  default null  -- ej. "65x46" si el corte ya se hizo y es formato nuevo
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
begin
  -- ── 0. Validar rol ───────────────────────────────────────────────────────
  select role
  into v_caller_role
  from public.profiles
  where id = auth.uid();

  if coalesce(v_caller_role, '') not in ('admin', 'oficina_tecnica', 'gerencia') then
    raise exception
      'Acción restringida: se requiere rol admin, oficina_tecnica o gerencia (actual: %)',
      coalesce(v_caller_role, 'sin rol');
  end if;

  -- ── 1. Validar parámetros ────────────────────────────────────────────────
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

  -- ── 2. Lock palet ────────────────────────────────────────────────────────
  select cantidad_actual, notas
  into v_actual, v_notas_actuales
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Cartela no encontrada: %', p_palet_id;
  end if;

  -- Comprobar que hay al menos un movimiento de consumo para esta OT
  if not exists (
    select 1 from public.prod_stock_movimientos
    where palet_id = p_palet_id
      and ot_numero = v_ot_clean
      and tipo = 'consumo'
  ) then
    raise exception
      'No hay consumo registrado para la cartela % en OT %. Nada que revertir.',
      p_palet_id, v_ot_clean;
  end if;

  -- ── 3. Ledger — ajuste positivo (reverso de consumo, inmutable) ──────────
  insert into public.prod_stock_movimientos (
    palet_id,
    tipo,
    cantidad,
    ot_numero,
    ot_origen_numero,
    autorizado_por,
    notas,
    created_by
  ) values (
    p_palet_id,
    'ajuste',
    p_cantidad,
    v_ot_clean,
    v_ot_clean,
    btrim(p_autorizado_por),
    coalesce(
      nullif(btrim(p_notas), ''),
      'Reversión de consumo OT ' || v_ot_clean
    ),
    auth.uid()
  );

  -- ── 4. Restaurar cantidad_actual ─────────────────────────────────────────
  update public.prod_stock_palets
  set cantidad_actual = cantidad_actual + p_cantidad
  where id = p_palet_id
  returning cantidad_actual into v_nuevo_actual;

  -- ── 5. Calcular bridge residual (puede que 9.8.1c lo haya limpiado) ─────
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

  -- ── 6. Nota al palet ─────────────────────────────────────────────────────
  v_append := format(
    '[%s] Consumo revertido OT %s (%s h). Autorizado: %s.%s',
    to_char(timezone('utc', now()), 'DD/MM/YYYY HH24:MI'),
    v_ot_clean,
    p_cantidad,
    btrim(p_autorizado_por),
    case
      when nullif(btrim(p_notas), '') is not null
        then ' Motivo: ' || btrim(p_notas)
      else ''
    end
  );

  -- ── 7. Sync legacy: estado, ot_destino_numero, notas, formato ───────────
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

  -- ── 8. Estado_material OT → STOP ────────────────────────────────────────
  -- El palet queda libre (disponible); la OT necesita nueva asignación.
  -- Solo se actualiza si no está ya en un estado STOP (no pisar 9.8.3 activo).
  update public.produccion_ot_despachadas
  set estado_material = 'Sin material asignado (liberado)'
  where ot_numero = v_ot_clean
    and estado_material not in (
      'Sin material asignado (liberado)',
      'Pendiente compra de corrección'
    );

end;
$$;

comment on function public.prod_stock_revertir_consumo(uuid, integer, text, text, text, text) is
  'Bloque 9.8.5 — Revierte un consumo de cartela registrado en error: '
  'añade ajuste positivo en el ledger, restaura cantidad_actual, sincroniza '
  'estado legacy (ATP) y marca la OT como ''Sin material asignado (liberado)''. '
  'No repone la fila de bridge (prod_stock_palet_ots): el palet queda disponible. '
  'Orden STOP Caso B: revertir_consumo → [ajustar formato si procede] → 9.8.3 compra corrección. '
  'Restringido a admin / oficina_tecnica / gerencia. Atómica.';

grant execute on function public.prod_stock_revertir_consumo(uuid, integer, text, text, text, text)
  to authenticated;
