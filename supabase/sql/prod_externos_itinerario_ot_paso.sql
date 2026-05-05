-- Bootstrap (same as migration 20260503220000_externos_itinerario_ot_paso_recibido.sql).
-- Externos + itinerario: ot_paso_id, RPC cola, trigger Recibido -> itinerario + pool.

alter table public.prod_seguimiento_externos
  add column if not exists ot_paso_id uuid null;

alter table public.prod_seguimiento_externos
  drop constraint if exists prod_seguimiento_externos_ot_paso_id_fkey;

alter table public.prod_seguimiento_externos
  add constraint prod_seguimiento_externos_ot_paso_id_fkey
  foreign key (ot_paso_id) references public.prod_ot_pasos (id) on delete set null;

create index if not exists prod_seguimiento_externos_ot_paso_id_idx
  on public.prod_seguimiento_externos (ot_paso_id)
  where ot_paso_id is not null;

comment on column public.prod_seguimiento_externos.ot_paso_id is
  'Paso de itinerario (prod_ot_pasos) cubierto por este envio externo; al marcar Recibido se finaliza y se abre el siguiente paso.';

create or replace function public.prod_ots_proximo_paso_externo_queue()
returns table (
  ot_numero text,
  ot_id uuid,
  ot_paso_id uuid,
  proceso_nombre text,
  cliente text,
  trabajo_titulo text,
  fecha_entrega date
)
language sql
stable
security invoker
set search_path = public
as $$
  with disp_ranked as (
    select
      p.ot_id,
      p.id as ot_paso_id,
      p.orden,
      c.nombre as proceso_nombre,
      row_number() over (partition by p.ot_id order by p.orden asc) as rn
    from public.prod_ot_pasos p
    inner join public.prod_procesos_cat c on c.id = p.proceso_id
    where p.estado = 'disponible'::public.paso_estado
      and coalesce(c.es_externo, false) = true
  ),
  primero as (
    select *
    from disp_ranked
    where rn = 1
  ),
  excl as (
    select distinct s.ot_paso_id
    from public.prod_seguimiento_externos s
    where s.ot_paso_id is not null
      and s.estado is distinct from 'Recibido'
  )
  select
    btrim(g.num_pedido::text) as ot_numero,
    g.id as ot_id,
    pr.ot_paso_id,
    coalesce(pr.proceso_nombre, '')::text as proceso_nombre,
    coalesce(g.cliente, '')::text as cliente,
    coalesce(g.titulo, '')::text as trabajo_titulo,
    g.fecha_entrega::date as fecha_entrega
  from primero pr
  inner join public.prod_ots_general g on g.id = pr.ot_id
  left join excl e on e.ot_paso_id = pr.ot_paso_id
  where e.ot_paso_id is null
  order by g.fecha_entrega nulls last, pr.orden asc;
$$;

comment on function public.prod_ots_proximo_paso_externo_queue() is
  'OTs whose first disponible itinerary step is marked es_externo in prod_procesos_cat, excluding steps with active seguimiento (not Recibido).';

grant execute on function public.prod_ots_proximo_paso_externo_queue() to authenticated;
grant execute on function public.prod_ots_proximo_paso_externo_queue() to service_role;

create or replace function public.prod_trg_seguimiento_externos_itinerario_recibido()
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

  if new.estado is distinct from 'Recibido' then
    return new;
  end if;

  if old.estado is not distinct from 'Recibido' then
    return new;
  end if;

  if new.ot_paso_id is null then
    return new;
  end if;

  update public.prod_ot_pasos p
  set
    estado = 'finalizado'::public.paso_estado,
    fecha_fin = v_now
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
        closed_at = v_now,
        closed_by = null,
        closed_by_email = null,
        notas = coalesce(nullif(trim(po.notas), ''), 'Cerrada: itinerario completo (externo)')
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

drop trigger if exists trg_prod_seguimiento_externos_itinerario_recibido
  on public.prod_seguimiento_externos;

create trigger trg_prod_seguimiento_externos_itinerario_recibido
  after update
  on public.prod_seguimiento_externos
  for each row
  execute function public.prod_trg_seguimiento_externos_itinerario_recibido();
