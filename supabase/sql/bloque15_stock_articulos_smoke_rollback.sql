-- Bloque 15.0 — smoke test EN TRANSACCIÓN (siempre ROLLBACK).
--
-- Prerrequisito: migración 20260925140000 YA aplicada en remoto (tablas + RPCs).
-- No hace falta fuera de horas: el smoke no altera el esquema; solo DML en tx
-- que se deshace con ROLLBACK. lock_timeout evita colgarse si hay locks.
--
-- Uso:
--   begin;
--   set local lock_timeout = '3s';
--   -- pegar desde "=== SMOKE ===" (o ejecutar este archivo entero)
--   rollback;
--
-- Tras CUALQUIER error en el editor:
--   1) rollback;
--   2) select pid, state, query from pg_stat_activity
--      where datname = current_database() and state like 'idle in transaction%';
--
-- Datos reales (minerva-rag):
--   ref M-01632 = 8232bd98-9a54-4447-a520-1dbd1e150a95 (CHMLAB)
--   OT 35519 / 36034 (CHMLAB) · engomado@ = tableta sin capacidad write

begin;
set local lock_timeout = '3s';

-- === SMOKE ===
-- (La migración ya insertó stock_articulos_write para gabri@ — no repetir como authenticated)

-- Resolver users ANTES de set role authenticated (auth.users no es readable por authenticated)
select set_config(
  'app.smoke_gabri_id',
  (select id::text from auth.users where lower(email) = 'gabri@minervaglobal.es'),
  true
);
select set_config(
  'app.smoke_engomado_id',
  (select id::text from auth.users where lower(email) = 'engomado@minervaglobal.es'),
  true
);

-- Impersonar Gabri
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('app.smoke_gabri_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  v_ref uuid := '8232bd98-9a54-4447-a520-1dbd1e150a95';
  v_ot text := '35519';
  v_lote uuid;
  v_lote_wip uuid;
  v_lote_pt uuid;
  v_libre integer;
  v_fisico integer;
  v_merma integer;
  v_engomado_id uuid;
  v_gabri_id uuid := current_setting('app.smoke_gabri_id')::uuid;
begin
  -- ── Happy path ──────────────────────────────────────────
  v_lote := public.prod_stock_articulos_alta_lote(
    p_referencia_id := v_ref,
    p_cantidad := 1000,
    p_unidad := 'uds',
    p_estado_proceso := 'terminado',
    p_notas := 'smoke alta'
  );

  perform public.prod_stock_articulos_reservar(
    p_stock_id := v_lote, p_ot_numero := v_ot, p_cantidad := 400, p_notas := 'smoke reserva'
  );
  select cantidad_libre into v_libre from public.stock_articulos_atp where id = v_lote;
  if v_libre <> 600 then
    raise exception 'Tras reserva esperaba libre=600, hay %', v_libre;
  end if;

  perform public.prod_stock_articulos_consumir(
    p_stock_id := v_lote, p_ot_numero := v_ot, p_cantidad := 150, p_notas := 'parcial'
  );
  perform public.prod_stock_articulos_consumir(
    p_stock_id := v_lote, p_ot_numero := v_ot, p_cantidad := 250, p_notas := 'resto'
  );
  select cantidad_libre into v_libre from public.stock_articulos_atp where id = v_lote;
  if v_libre <> 600 then
    raise exception 'Tras consumos esperaba libre=600, hay %', v_libre;
  end if;

  perform public.prod_stock_articulos_reservar(
    p_stock_id := v_lote, p_ot_numero := v_ot, p_cantidad := 100, p_notas := 'para liberar'
  );
  perform public.prod_stock_articulos_liberar(
    p_stock_id := v_lote, p_ot_numero := v_ot, p_notas := 'liberar'
  );

  perform public.prod_stock_articulos_ajustar(
    p_stock_id := v_lote, p_cantidad_nueva := 580, p_notas := 'ajuste inventario'
  );

  -- Transform hojas → uds (poses=2 → 1900 uds ≡ 950 hojas; merma 50)
  v_lote_wip := public.prod_stock_articulos_alta_lote(
    p_referencia_id := v_ref,
    p_cantidad := 2000,
    p_unidad := 'hojas',
    p_estado_proceso := 'impreso',
    p_poses := 2,
    p_notas := 'smoke WIP'
  );
  v_lote_pt := public.prod_stock_articulos_transformar(
    p_stock_origen_id := v_lote_wip,
    p_cantidad_salida := 1000,
    p_cantidad_destino := 1900,
    p_estado_proceso_destino := 'terminado',
    p_unidad_destino := 'uds',
    p_notas := 'smoke transform'
  );

  select cantidad_actual into v_fisico
  from public.prod_stock_articulos where id = v_lote_wip;
  if v_fisico <> 1000 then
    raise exception 'WIP tras transform: esperaba 1000 hojas, hay %', v_fisico;
  end if;

  select cantidad_actual into v_fisico
  from public.prod_stock_articulos where id = v_lote_pt;
  if v_fisico <> 1900 then
    raise exception 'PT tras transform: esperaba 1900 uds, hay %', v_fisico;
  end if;
  if (select unidad from public.prod_stock_articulos where id = v_lote_pt) <> 'uds' then
    raise exception 'PT debe ser unidad uds';
  end if;

  select cantidad_merma into v_merma
  from public.prod_stock_articulos_movimientos
  where stock_articulo_id = v_lote_wip and tipo = 'transformacion'
  order by created_at desc limit 1;
  if v_merma is distinct from 50 then
    raise exception 'Merma esperada 50, hay %', v_merma;
  end if;
  raise notice 'OK transform: WIP=1000 hojas, PT=1900 uds, merma=50';

  -- Consumo sin reserva sobre stock comprometido (debe fallar).
  -- La reserva 500 VA FUERA del begin/exception: si va dentro, el ROLLBACK
  -- del subbloque la deshace y S3 no tiene comprometido.
  perform public.prod_stock_articulos_reservar(
    p_stock_id := v_lote, p_ot_numero := v_ot, p_cantidad := 500, p_notas := 'bloquear'
  );
  begin
    perform public.prod_stock_articulos_consumir(
      p_stock_id := v_lote, p_ot_numero := '36034', p_cantidad := 100,
      p_motivo_sin_reserva := 'robar reservado'
    );
    raise exception 'FAIL: debía rechazar consumo sobre reservado';
  exception
    when others then
      if sqlerrm like '%supera libre%' then
        raise notice 'OK rechazo consumo sobre reservado';
      else
        raise;
      end if;
  end;

  -- ── Seguridad ───────────────────────────────────────────

  -- S1) UPDATE directo a la tabla (debe fallar por RLS)
  begin
    update public.prod_stock_articulos set cantidad_actual = 99999 where id = v_lote;
    if found then
      raise exception 'FAIL: UPDATE directo no debería afectar filas';
    end if;
    -- Si RLS silencia (0 rows) también OK; si lanza error, OK
    raise notice 'OK UPDATE directo sin efecto (RLS)';
  exception
    when insufficient_privilege then
      raise notice 'OK UPDATE directo: insufficient_privilege';
    when others then
      if sqlerrm ilike '%policy%' or sqlerrm ilike '%permission%' then
        raise notice 'OK UPDATE directo bloqueado: %', sqlerrm;
      else
        raise;
      end if;
  end;

  -- S2) Tableta engomado@ sin capacidad → alta_lote debe fallar
  v_engomado_id := nullif(current_setting('app.smoke_engomado_id', true), '')::uuid;
  if v_engomado_id is null then
    raise exception 'No existe engomado@ para probar tableta';
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_engomado_id::text, 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.prod_stock_articulos_alta_lote(
      p_referencia_id := v_ref,
      p_cantidad := 10,
      p_unidad := 'uds',
      p_estado_proceso := 'terminado',
      p_notas := 'tableta no debe'
    );
    raise exception 'FAIL: engomado@ no debería poder alta_lote';
  exception
    when others then
      if sqlerrm like '%Sin permiso%' then
        raise notice 'OK tableta sin permiso';
      else
        raise;
      end if;
  end;

  -- Volver a Gabri
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_gabri_id::text,
      'role', 'authenticated'
    )::text,
    true
  );

  -- S3) Ajustar bajo lo reservado sin p_forzar
  -- v_lote tiene 500 reservados del test anterior (bloqueo); físico 580
  begin
    perform public.prod_stock_articulos_ajustar(
      p_stock_id := v_lote,
      p_cantidad_nueva := 100,
      p_notas := 'bajar bajo reserva',
      p_forzar := false
    );
    raise exception 'FAIL: ajustar bajo reservado debía rechazar';
  exception
    when others then
      if sqlerrm like '%comprometido%' or sqlerrm like '%p_forzar%' then
        raise notice 'OK rechazo ajustar bajo reservado';
      else
        raise;
      end if;
  end;

  -- S4) Reservar OT inexistente
  begin
    perform public.prod_stock_articulos_reservar(
      p_stock_id := v_lote,
      p_ot_numero := '99999999',
      p_cantidad := 1,
      p_notas := 'ot fantasma'
    );
    raise exception 'FAIL: reservar OT inexistente debía rechazar';
  exception
    when others then
      if sqlerrm like '%no está en Minerva%' or sqlerrm like '%99999999%' then
        raise notice 'OK rechazo OT inexistente';
      else
        raise;
      end if;
  end;

  raise notice 'SMOKE OK (happy path + seguridad)';
end $$;

select id, referencia_codigo, unidad, estado_proceso,
       cantidad_fisica, cantidad_libre, estado_derivado
from public.stock_articulos_atp
order by created_at desc
limit 10;

rollback;

-- Post-check (nueva query, fuera de la tx):
-- select to_regclass('public.prod_stock_articulos');
-- select pid, state, left(query,80) from pg_stat_activity
--   where datname = current_database() and state like 'idle in transaction%';
