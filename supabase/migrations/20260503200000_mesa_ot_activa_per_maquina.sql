-- Replaces ux_mesa_ot_activa: was unique per OT including finalizada (blocked multi-phase).
-- Now: at most one active row per (OT, machine). Trigger also finalizes mesa row on execution end.

drop index if exists public.ux_mesa_ot_activa;

create unique index ux_mesa_ot_activa
on public.prod_mesa_planificacion_trabajos (ot_numero, coalesce(maquina_id::text, ''))
where estado_mesa in ('borrador', 'confirmado', 'en_ejecucion');

comment on index public.ux_mesa_ot_activa is
  'One active mesa row per OT and machine (offset then troquel then engom).';

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

  if new.mesa_trabajo_id is not null then
    update public.prod_mesa_planificacion_trabajos m
    set
      estado_mesa = 'finalizada',
      updated_at = v_now
    where m.id = new.mesa_trabajo_id
      and m.estado_mesa is distinct from 'finalizada';
  end if;

  if new.ot_paso_id is null then
    update public.prod_planificacion_pool po
    set
      estado_pool = 'cerrada',
      closed_at = coalesce(new.fin_real_at, v_now),
      closed_by = new.updated_by,
      closed_by_email = new.updated_by_email,
      notas = coalesce(nullif(trim(po.notas), ''), 'Cerrada al finalizar ejecucion')
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
