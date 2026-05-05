-- Pool: estado en_transito (entre fases del itinerario). cerrada = itinerario completo.
-- Sincronización en prod_trg_mesa_ejecucion_itinerario_finaliza al finalizar ejecución.

alter table public.prod_planificacion_pool
  drop constraint if exists prod_planificacion_pool_estado_pool_check;

alter table public.prod_planificacion_pool
  add constraint prod_planificacion_pool_estado_pool_check
  check (estado_pool in ('pendiente', 'enviada_mesa', 'en_transito', 'cerrada'));

comment on column public.prod_planificacion_pool.estado_pool is
  'pendiente: inicio; enviada_mesa: en tablero; en_transito: fase impresa/hecha, pendiente siguiente paso del itinerario; cerrada: todos los pasos prod_ot_pasos en finalizado';

-- Resucitar pool cerrado por error cuando el itinerario aún tiene pasos no finalizados.
update public.prod_planificacion_pool p
set
  estado_pool = 'en_transito',
  closed_at = null,
  closed_by = null,
  closed_by_email = null
where p.estado_pool = 'cerrada'
  and exists (
    select 1
    from public.prod_ots_general g
    join public.prod_ot_pasos s on s.ot_id = g.id
    where btrim(g.num_pedido::text) = btrim(p.ot_numero)
      and s.estado is distinct from 'finalizado'::public.paso_estado
  );

create or replace function public.prod_trg_mesa_ejecucion_itinerario_finaliza()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ot_id uuid;
  v_orden integer;
  v_next_id uuid;
  v_now timestamptz := timezone('utc'::text, now());
  v_ot_num text;
  v_pending bigint;
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;

  if new.estado_ejecucion is distinct from 'finalizada' then
    return new;
  end if;

  if old.estado_ejecucion is not distinct from 'finalizada' then
    return new;
  end if;

  -- Sin paso de itinerario: cierre operativo clásico (pool a cerrada).
  if new.ot_paso_id is null then
    update public.prod_planificacion_pool po
    set
      estado_pool = 'cerrada',
      closed_at = coalesce(new.fin_real_at, v_now),
      closed_by = new.updated_by,
      closed_by_email = new.updated_by_email,
      notas = coalesce(nullif(trim(po.notas), ''), 'Cerrada al finalizar ejecución')
    where btrim(po.ot_numero) = btrim(new.ot_numero)
      and po.estado_pool in ('pendiente', 'enviada_mesa', 'en_transito');
    return new;
  end if;

  update public.prod_ot_pasos p
  set
    estado = 'finalizado'::public.paso_estado,
    fecha_fin = coalesce(new.fin_real_at, v_now)
  where p.id = new.ot_paso_id
    and p.estado is distinct from 'finalizado'::public.paso_estado
  returning p.ot_id, p.orden into v_ot_id, v_orden;

  if v_ot_id is null then
    return new;
  end if;

  select p.id into v_next_id
  from public.prod_ot_pasos p
  where p.ot_id = v_ot_id
    and p.estado = 'pendiente'::public.paso_estado
    and p.orden > v_orden
  order by p.orden asc
  limit 1;

  if v_next_id is not null then
    update public.prod_ot_pasos
    set
      estado = 'disponible'::public.paso_estado,
      fecha_disponible = v_now
    where id = v_next_id;
  end if;

  -- Sincronizar pool: en_transito si queda algún paso sin finalizar; cerrada solo con itinerario completo.
  select btrim(g.num_pedido::text) into v_ot_num
  from public.prod_ots_general g
  where g.id = v_ot_id;

  if v_ot_num is not null and length(v_ot_num) > 0 then
    select count(*)::bigint into v_pending
    from public.prod_ot_pasos p
    where p.ot_id = v_ot_id
      and p.estado is distinct from 'finalizado'::public.paso_estado;

    if v_pending = 0 then
      update public.prod_planificacion_pool po
      set
        estado_pool = 'cerrada',
        closed_at = coalesce(new.fin_real_at, v_now),
        closed_by = new.updated_by,
        closed_by_email = new.updated_by_email,
        notas = coalesce(nullif(trim(po.notas), ''), 'Cerrada: itinerario completo')
      where btrim(po.ot_numero) = v_ot_num
        and po.estado_pool in ('pendiente', 'enviada_mesa', 'en_transito');
    else
      update public.prod_planificacion_pool po
      set
        estado_pool = 'en_transito',
        closed_at = null,
        closed_by = null,
        closed_by_email = null
      where btrim(po.ot_numero) = v_ot_num
        and po.estado_pool in ('pendiente', 'enviada_mesa', 'en_transito');
    end if;
  end if;

  return new;
end;
$$;
