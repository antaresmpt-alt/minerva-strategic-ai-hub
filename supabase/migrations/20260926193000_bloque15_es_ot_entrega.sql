-- OT de entrega: marca en el maestro, un solo paso Entrega (no es proceso de planta)
-- y Consumir, al agotar la reserva, cierra ese paso y archiva la OT.
-- No pide horas ni pasa por «Cerrar y enviar a histórico».

alter table public.prod_ots_general
  add column if not exists es_ot_entrega boolean not null default false;

comment on column public.prod_ots_general.es_ot_entrega is
  'Entrega de stock: no se fabrica. Fuera de no despachadas. Un paso Entrega. Consumir la cierra.';

insert into public.prod_procesos_cat (
  id, nombre, seccion_slug, tipo_planificacion, es_externo, activo, orden_sugerido
)
select 23, 'Entrega', 'entrega', null, false, true, 90
where not exists (
  select 1 from public.prod_procesos_cat where id = 23 or nombre = 'Entrega'
);

do $$
declare
  s text;
begin
  s := pg_get_serial_sequence('public.prod_procesos_cat', 'id');
  if s is not null then
    perform setval(s, (select max(id) from public.prod_procesos_cat));
  end if;
end $$;

create or replace function public.prod_ot_entrega_proceso_id()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select id from public.prod_procesos_cat where nombre = 'Entrega' order by id limit 1;
$$;

revoke all on function public.prod_ot_entrega_proceso_id() from public, anon, authenticated;

create or replace function public.prod_ot_entrega_marcar(
  p_num_pedido text,
  p_marcar boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_id uuid;
  v_proceso integer;
  v_cerrada boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión obligatoria';
  end if;

  v_ot := nullif(btrim(p_num_pedido), '');
  if v_ot is null then
    raise exception 'p_num_pedido obligatorio';
  end if;

  v_proceso := public.prod_ot_entrega_proceso_id();
  if v_proceso is null then
    raise exception 'Falta el proceso Entrega en el catálogo';
  end if;

  select id into v_id
  from public.prod_ots_general
  where num_pedido = v_ot
  for update;

  if not found then
    raise exception 'No existe la OT % en el maestro. Impórtala desde Optimus.', v_ot;
  end if;

  select exists (
    select 1
    from public.prod_ot_producidas
    where ot_numero = v_ot
      and reabierta_at is null
  ) into v_cerrada;

  if coalesce(p_marcar, false) then
    if exists (
      select 1
      from public.prod_ot_pasos
      where ot_id = v_id
        and proceso_id is distinct from v_proceso
    ) then
      raise exception
        'La OT % ya tiene itinerario de planta. No se marca como entrega.', v_ot;
    end if;

    update public.prod_ots_general
    set es_ot_entrega = true, updated_at = now()
    where id = v_id;

    if not v_cerrada and not exists (
      select 1
      from public.prod_ot_pasos
      where ot_id = v_id
        and proceso_id = v_proceso
    ) then
      insert into public.prod_ot_pasos (ot_id, orden, estado, proceso_id, notas_instrucciones)
      values (
        v_id,
        1,
        'disponible',
        v_proceso,
        'Pendiente de salir. María José cierra con Consumir en Stock artículos.'
      );
    end if;
  else
    if v_cerrada then
      raise exception 'La OT % ya está en histórico. No se puede quitar la marca.', v_ot;
    end if;

    update public.prod_ots_general
    set es_ot_entrega = false, updated_at = now()
    where id = v_id;

    delete from public.prod_ot_pasos
    where ot_id = v_id
      and proceso_id = v_proceso
      and estado in ('pendiente', 'disponible');
  end if;
end;
$$;

revoke all on function public.prod_ot_entrega_marcar(text, boolean) from public, anon;
grant execute on function public.prod_ot_entrega_marcar(text, boolean) to authenticated;

-- true si esta consumición ha archivado la OT de entrega.
create or replace function public.prod_ot_entrega_cerrar_si_consumida(p_ot_numero text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_id uuid;
  v_cliente text;
  v_titulo text;
  v_cantidad numeric;
  v_proceso integer;
  v_paso_id uuid;
  v_producida numeric;
  v_version integer;
  v_now timestamptz := now();
begin
  v_ot := nullif(btrim(p_ot_numero), '');
  if v_ot is null then
    return false;
  end if;

  if exists (
    select 1
    from public.prod_stock_articulos_reservas
    where ot_numero = v_ot
      and estado in ('activa', 'parcial')
  ) then
    return false;
  end if;

  select id, cliente, titulo, cantidad
  into v_id, v_cliente, v_titulo, v_cantidad
  from public.prod_ots_general
  where num_pedido = v_ot
    and es_ot_entrega
  for update;

  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.prod_ot_producidas
    where ot_numero = v_ot
      and reabierta_at is null
  ) then
    return false;
  end if;

  v_proceso := public.prod_ot_entrega_proceso_id();
  if v_proceso is null then
    raise exception 'Falta el proceso Entrega en el catálogo';
  end if;

  select id into v_paso_id
  from public.prod_ot_pasos
  where ot_id = v_id
    and proceso_id = v_proceso
  order by orden
  limit 1
  for update;

  if v_paso_id is null then
    insert into public.prod_ot_pasos (ot_id, orden, estado, proceso_id, fecha_fin, notas_instrucciones)
    values (
      v_id, 1, 'finalizado', v_proceso, v_now,
      'Cerrada al consumir el stock.'
    )
    returning id into v_paso_id;
  else
    update public.prod_ot_pasos
    set estado = 'finalizado', fecha_fin = v_now
    where id = v_paso_id;
  end if;

  select coalesce(sum(cantidad_consumida), 0)
  into v_producida
  from public.prod_stock_articulos_reservas
  where ot_numero = v_ot
    and estado = 'consumida';

  select coalesce(max(version), 0) + 1
  into v_version
  from public.prod_ot_producidas
  where ot_numero = v_ot;

  insert into public.prod_ot_producidas (
    ot_numero, ot_id, cliente, trabajo,
    cantidad_pedida, cantidad_producida,
    fecha_fin_real, fecha_cierre,
    snapshot, snapshot_version, version,
    cerrada_por, observaciones_revision,
    excluido_de_promedios, motivo_exclusion
  ) values (
    v_ot, v_id, v_cliente, v_titulo,
    v_cantidad, v_producida,
    v_now, v_now,
    jsonb_build_object(
      'otNumero', v_ot,
      'otId', v_id,
      'otTipo', 'simple',
      'cliente', v_cliente,
      'trabajo', v_titulo,
      'cantidad', v_cantidad,
      'fechaEntrega', null,
      'estadoOt', null,
      'despacho', null,
      'pasos', jsonb_build_array(
        jsonb_build_object(
          'pasoId', v_paso_id,
          'orden', 1,
          'estado', 'finalizado',
          'procesoId', v_proceso,
          'procesoNombre', 'Entrega',
          'esExterno', false,
          'maquinaNombre', null,
          'tipoMaquina', null,
          'fechaDisponible', null,
          'fechaInicio', null,
          'fechaFin', v_now,
          'datosProceso', null,
          'ejecucion', null,
          'externo', null
        )
      )
    ),
    1, v_version,
    auth.uid(),
    'Cierre automático al consumir el stock. Sin horas de planta.',
    true,
    'OT de entrega: cierre por Consumir, sin horas de planta.'
  );

  return true;
end;
$$;

revoke all on function public.prod_ot_entrega_cerrar_si_consumida(text) from public, anon, authenticated;

drop function if exists public.prod_stock_articulos_consumir(uuid, text, integer, integer, text, text);

create or replace function public.prod_stock_articulos_consumir(
  p_stock_id uuid,
  p_ot_numero text,
  p_cantidad integer,
  p_bultos integer default null,
  p_notas text default null,
  p_motivo_sin_reserva text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_fisico integer;
  v_despues integer;
  v_res public.prod_stock_articulos_reservas%rowtype;
  v_pendiente integer;
  v_nueva_consumida integer;
  v_comprometida integer;
  v_libre integer;
  v_found boolean := false;
  v_cerro boolean := false;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;

  v_ot := nullif(btrim(p_ot_numero), '');
  if v_ot is null then
    raise exception 'p_ot_numero obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'p_cantidad debe ser > 0';
  end if;

  select cantidad_actual into v_fisico
  from public.prod_stock_articulos
  where id = p_stock_id
  for update;

  if not found then
    raise exception 'Lote no encontrado: %', p_stock_id;
  end if;

  if p_cantidad > v_fisico then
    raise exception 'Físico insuficiente: físico=%, consumo=%', v_fisico, p_cantidad;
  end if;

  select * into v_res
  from public.prod_stock_articulos_reservas
  where stock_articulo_id = p_stock_id
    and ot_numero = v_ot
    and estado in ('activa', 'parcial')
  for update;

  v_found := found;

  if not v_found then
    if nullif(btrim(p_motivo_sin_reserva), '') is null then
      raise exception
        'No hay reserva viva para OT %. Pasa p_motivo_sin_reserva para forzar consumo.',
        v_ot;
    end if;
    select coalesce(sum(cantidad_reservada - cantidad_consumida), 0)
    into v_comprometida
    from public.prod_stock_articulos_reservas
    where stock_articulo_id = p_stock_id
      and estado in ('activa', 'parcial');
    v_libre := greatest(v_fisico - v_comprometida, 0);
    if p_cantidad > v_libre then
      raise exception
        'Sin reserva: consumo % supera libre % (hay % comprometidos a otras OTs)',
        p_cantidad, v_libre, v_comprometida;
    end if;
  else
    v_pendiente := v_res.cantidad_reservada - v_res.cantidad_consumida;
    if p_cantidad > v_pendiente then
      raise exception
        'Consumo % supera pendiente de reserva % (OT %)',
        p_cantidad, v_pendiente, v_ot;
    end if;
    v_nueva_consumida := v_res.cantidad_consumida + p_cantidad;
    update public.prod_stock_articulos_reservas
    set
      cantidad_consumida = v_nueva_consumida,
      estado = case
        when v_nueva_consumida >= cantidad_reservada then 'consumida'
        else 'parcial'
      end
    where id = v_res.id;
  end if;

  v_despues := v_fisico - p_cantidad;
  update public.prod_stock_articulos
  set
    cantidad_actual = v_despues,
    bultos = case
      when p_bultos is null then bultos
      when bultos is null then null
      else greatest(bultos - p_bultos, 0)
    end
  where id = p_stock_id;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    ot_numero, num_pedido, bultos, notas, created_by
  ) values (
    p_stock_id, 'consumo', p_cantidad, v_fisico, v_despues,
    v_ot, case when v_found then v_res.num_pedido else null end, p_bultos,
    coalesce(
      nullif(btrim(p_notas), ''),
      nullif(btrim(p_motivo_sin_reserva), ''),
      'Consumo OT ' || v_ot
    ),
    auth.uid()
  );

  if v_found and v_nueva_consumida >= v_res.cantidad_reservada then
    v_cerro := public.prod_ot_entrega_cerrar_si_consumida(v_ot);
  end if;

  return coalesce(v_cerro, false);
end;
$$;

revoke all on function public.prod_stock_articulos_consumir(
  uuid, text, integer, integer, text, text
) from public, anon;
grant execute on function public.prod_stock_articulos_consumir(
  uuid, text, integer, integer, text, text
) to authenticated;
