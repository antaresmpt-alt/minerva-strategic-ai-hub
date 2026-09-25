-- Bloque 15.0 — smoke test EN TRANSACCIÓN (siempre ROLLBACK).
-- Uso: pegar en SQL Editor de Supabase FUERA de horas de planta.
-- 1) Primero aplica (o pega) la migración 20260925140000 dentro del mismo BEGIN,
--    O aplica la migración en un entorno de prueba y aquí solo el smoke.
--
-- Si la migración YA está aplicada en este proyecto, usa solo el bloque SMOKE.
-- Si NO está aplicada: descomenta la nota al final — mejor aplicar migración
-- en una sesión y smoke+rollback en otra NO funciona para DDL ya committed.
--
-- Recomendado para remoto aún sin aplicar:
--   begin;
--   -- pegar migración entera
--   -- luego pegar desde "=== SMOKE ===" hasta rollback
--
-- Datos reales (minerva-rag, sep 2026):
--   ref M-01632 = 8232bd98-9a54-4447-a520-1dbd1e150a95 (CHMLAB)
--   OT num_pedido = 35519 (CHMLAB)

begin;

-- === SMOKE ===
-- Impersonar a Gabri (auth.uid())
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id::text from auth.users where lower(email) = 'gabri@minervaglobal.es'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

-- Asegurar capacidad (idempotente; la migración también lo hace)
insert into public.profiles_capacidades (user_id, capacidad)
select u.id, 'stock_articulos_write'
from auth.users u
where lower(u.email) = 'gabri@minervaglobal.es'
on conflict do nothing;

-- 1) Alta lote TERMINADO (uds)
do $$
declare
  v_ref uuid := '8232bd98-9a54-4447-a520-1dbd1e150a95';
  v_ot text := '35519';
  v_lote uuid;
  v_lote_wip uuid;
  v_lote_pt uuid;
  v_libre integer;
begin
  v_lote := public.prod_stock_articulos_alta_lote(
    p_referencia_id := v_ref,
    p_cantidad := 1000,
    p_unidad := 'uds',
    p_estado_proceso := 'terminado',
    p_notas := 'smoke alta'
  );
  raise notice 'alta terminado → %', v_lote;

  -- 2) Reservar 400
  perform public.prod_stock_articulos_reservar(
    p_stock_id := v_lote,
    p_ot_numero := v_ot,
    p_cantidad := 400,
    p_notas := 'smoke reserva'
  );

  select cantidad_libre into v_libre
  from public.stock_articulos_atp where id = v_lote;
  if v_libre <> 600 then
    raise exception 'Tras reserva esperaba libre=600, hay %', v_libre;
  end if;

  -- 3) Consumir parcial 150
  perform public.prod_stock_articulos_consumir(
    p_stock_id := v_lote,
    p_ot_numero := v_ot,
    p_cantidad := 150,
    p_notas := 'smoke consumo parcial'
  );

  -- 4) Consumir resto reserva 250
  perform public.prod_stock_articulos_consumir(
    p_stock_id := v_lote,
    p_ot_numero := v_ot,
    p_cantidad := 250,
    p_notas := 'smoke consumo resto'
  );

  select cantidad_libre into v_libre
  from public.stock_articulos_atp where id = v_lote;
  if v_libre <> 600 then
    raise exception 'Tras consumos esperaba libre=600, hay %', v_libre;
  end if;
  raise notice 'tras consumos libre=% lote=%', v_libre, v_lote;

  -- 5) Nueva reserva + liberar
  perform public.prod_stock_articulos_reservar(
    p_stock_id := v_lote,
    p_ot_numero := v_ot,
    p_cantidad := 100,
    p_notas := 'smoke reserva para liberar'
  );
  perform public.prod_stock_articulos_liberar(
    p_stock_id := v_lote,
    p_ot_numero := v_ot,
    p_notas := 'smoke liberar'
  );

  -- 6) Ajuste a 580
  perform public.prod_stock_articulos_ajustar(
    p_stock_id := v_lote,
    p_cantidad_nueva := 580,
    p_notas := 'smoke ajuste inventario'
  );

  -- 7) Transformar hojas → uds (lote WIP nuevo)
  v_lote_wip := public.prod_stock_articulos_alta_lote(
    p_referencia_id := v_ref,
    p_cantidad := 2000,
    p_unidad := 'hojas',
    p_estado_proceso := 'impreso',
    p_poses := 2,
    p_notas := 'smoke WIP impreso'
  );

  v_lote_pt := public.prod_stock_articulos_transformar(
    p_stock_origen_id := v_lote_wip,
    p_cantidad_salida := 1000,       -- hojas
    p_cantidad_destino := 1900,      -- uds (poses=2 → equiv 950 hojas; merma 50)
    p_estado_proceso_destino := 'terminado',
    p_stock_destino_id := null,
    p_cantidad_merma := null,        -- deriva con poses
    p_unidad_destino := 'uds',
    p_notas := 'smoke transform hojas→uds'
  );
  raise notice 'transform → PT %', v_lote_pt;

  -- 8) Negativo esperado: consumir sin reserva por encima de libre
  begin
    perform public.prod_stock_articulos_reservar(
      p_stock_id := v_lote,
      p_ot_numero := v_ot,
      p_cantidad := 500,
      p_notas := 'bloquear libre'
    );
    perform public.prod_stock_articulos_consumir(
      p_stock_id := v_lote,
      p_ot_numero := '36034',  -- otra OT CHMLAB
      p_cantidad := 100,
      p_motivo_sin_reserva := 'intento robar reservado'
    );
    raise exception 'FAIL: consumo sin reserva debería haber rechazado';
  exception
    when others then
      if sqlerrm like '%supera libre%' or sqlerrm like '%Sin reserva%' then
        raise notice 'OK rechazo consumo sobre reservado: %', sqlerrm;
      else
        raise;
      end if;
  end;

  raise notice 'SMOKE OK';
end $$;

select id, referencia_codigo, unidad, estado_proceso, cantidad_fisica, cantidad_libre, estado_derivado
from public.stock_articulos_atp
order by created_at desc
limit 10;

-- IMPORTANTE: no dejar rastro
rollback;

-- Verificación post-rollback (fuera de la tx, en otra query):
-- select to_regclass('public.prod_stock_articulos');
-- Si hiciste begin+migración+smoke+rollback, debe devolver NULL.
-- Si la migración ya estaba aplicada fuera de la tx, las tablas siguen (correcto)
-- y solo se deshacen los datos del smoke.
