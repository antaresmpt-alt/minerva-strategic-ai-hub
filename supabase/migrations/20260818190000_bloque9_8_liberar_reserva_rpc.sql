-- Bloque 9.8.1 — Liberar reserva de una cartela para una OT.
--
-- Atómica: unlink prod_stock_palet_ots + ledger ajuste + append notas palet
-- + estado_material OT → STOP. Una sola transacción; sin media-liberación.
--
-- Semántica de cantidad en el movimiento:
--   reserva dura (cantidad_reservada > 0) → registrar las hojas liberadas.
--   reserva blanda (NULL)                 → registrar cantidad_actual del palet
--                                           (toda la cartela estaba soft-pillada).
--   En ambos casos GREATEST(..., 1) garantiza la constraint cantidad > 0.
--
-- Tipo de movimiento: 'ajuste' (no 'traspaso': traspaso exige ot_destino_numero,
-- y aquí el palet queda libre, sin OT destino aún). ot_origen_numero registra
-- la OT que se libera para traceabilidad.
--
-- Permisos: solo admin / oficina_tecnica / gerencia (validado en la función).
-- Los operarios de planta usan la gestión normal de compras.

create or replace function public.prod_stock_liberar_reserva(
  p_palet_id       uuid,
  p_ot_numero      text,
  p_autorizado_por text,
  p_notas          text   default null,
  p_nuevo_formato  text   default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role        text;
  v_cantidad_actual    integer;
  v_cantidad_reservada integer;
  v_cantidad_mov       integer;
  v_notas_actuales     text;
  v_append             text;
  v_ot_clean           text;
begin
  -- ── 0. Validar rol del llamador ──────────────────────────────────────────
  select role
  into v_caller_role
  from public.profiles
  where id = auth.uid();

  if coalesce(v_caller_role, '') not in ('admin', 'oficina_tecnica', 'gerencia') then
    raise exception
      'Acción restringida: se requiere rol admin, oficina_tecnica o gerencia (actual: %)',
      coalesce(v_caller_role, 'sin rol');
  end if;

  -- ── 1. Validar parámetros de entrada ─────────────────────────────────────
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

  -- ── 2. Lock palet (evita concurrencia con consumo u otra liberación) ──────
  select cantidad_actual, notas
  into v_cantidad_actual, v_notas_actuales
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Cartela no encontrada: %', p_palet_id;
  end if;

  -- ── 3. Obtener reserva existente y eliminarla ─────────────────────────────
  select cantidad_reservada
  into v_cantidad_reservada
  from public.prod_stock_palet_ots
  where palet_id = p_palet_id
    and ot_numero = v_ot_clean;

  if not found then
    raise exception
      'La cartela % no tiene reserva para OT %. Nada que liberar.',
      p_palet_id, v_ot_clean;
  end if;

  delete from public.prod_stock_palet_ots
  where palet_id = p_palet_id
    and ot_numero = v_ot_clean;

  -- ── 4. Calcular cantidad para el movimiento ledger ────────────────────────
  -- Reserva dura → las hojas que estaban comprometidas.
  -- Reserva blanda (NULL) → cantidad_actual (toda la cartela estaba pillada).
  v_cantidad_mov := greatest(coalesce(v_cantidad_reservada, v_cantidad_actual), 1);

  -- ── 5. Registrar en el ledger (inmutable — nunca borrar) ──────────────────
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
    v_cantidad_mov,
    v_ot_clean,
    v_ot_clean,              -- ot_origen = la OT liberada (traceabilidad)
    btrim(p_autorizado_por),
    coalesce(btrim(p_notas), 'Liberación de reserva OT ' || v_ot_clean),
    auth.uid()
  );

  -- ── 6. Append a notas del palet ──────────────────────────────────────────
  v_append := format(
    '[%s] Liberado de OT %s. Autorizado: %s.%s',
    to_char(timezone('utc', now()), 'DD/MM/YYYY HH24:MI'),
    v_ot_clean,
    btrim(p_autorizado_por),
    case
      when nullif(btrim(p_notas), '') is not null
        then ' Motivo: ' || btrim(p_notas)
      else ''
    end
  );

  -- Si no quedan otras OTs en el puente, limpiar el legado ot_destino_numero
  -- y el estado persistido (la UI 9.2+ usa ATP; Cartelas aún lee estado).
  if not exists (
    select 1 from public.prod_stock_palet_ots where palet_id = p_palet_id
  ) then
    update public.prod_stock_palets
    set
      ot_destino_numero = null,
      estado            = 'disponible',
      notas             = case
                            when notas is null or btrim(notas) = ''
                              then v_append
                            else notas || E'\n' || v_append
                          end,
      formato           = coalesce(nullif(btrim(p_nuevo_formato), ''), formato),
      updated_at        = timezone('utc', now())
    where id = p_palet_id;
  else
    update public.prod_stock_palets
    set
      ot_destino_numero = case
                            when ot_destino_numero = v_ot_clean then null
                            else ot_destino_numero
                          end,
      notas             = case
                            when notas is null or btrim(notas) = ''
                              then v_append
                            else notas || E'\n' || v_append
                          end,
      formato           = coalesce(nullif(btrim(p_nuevo_formato), ''), formato),
      updated_at        = timezone('utc', now())
    where id = p_palet_id;
  end if;

  -- ── 7. Actualizar estado_material de la OT → STOP ────────────────────────
  -- Solo si no está ya en un estado STOP (no pisar una corrección activa).
  update public.produccion_ot_despachadas
  set estado_material = 'Sin material asignado (liberado)'
  where ot_numero = v_ot_clean
    and estado_material not in (
      'Sin material asignado (liberado)',
      'Pendiente compra de corrección'
    );

end;
$$;

comment on function public.prod_stock_liberar_reserva(uuid, text, text, text, text) is
  'Bloque 9.8.1 — Libera la reserva de una cartela para una OT: elimina la fila '
  'de prod_stock_palet_ots, registra un ajuste en el ledger, añade nota al palet '
  'y actualiza estado_material de la OT a ''Sin material asignado (liberado)''. '
  'Restringido a admin / oficina_tecnica / gerencia. Atómica.';

grant execute on function public.prod_stock_liberar_reserva(uuid, text, text, text, text)
  to authenticated;
