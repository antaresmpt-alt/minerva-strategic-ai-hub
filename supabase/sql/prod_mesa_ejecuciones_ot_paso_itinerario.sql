-- ============================================================================
-- prod_mesa_ejecuciones.ot_paso_id + avance de itinerario (prod_ot_pasos)
-- ----------------------------------------------------------------------------
-- Idempotente: IF NOT EXISTS / OR REPLACE.
-- 1) Columna nullable FK a prod_ot_pasos
-- 2) Al pasar ejecución a en_curso (desde pendiente_inicio): paso -> en_marcha
-- 3) Al pasar ejecución a finalizada: cerrar paso (finalizado) y abrir el
--    siguiente pendiente como disponible (si existe).
-- Las funciones son SECURITY DEFINER y SET row_security = off para que los UPDATE
-- a prod_ot_pasos no queden en 0 filas por RLS al ejecutarse desde el trigger
-- (PostgREST / roles). Sin SET row_security = off el itinerario puede no moverse.
-- Los triggers son AFTER UPDATE sin lista de columnas: PostgREST solo pone en el SET
-- las columnas del PATCH; un trigger "UPDATE OF col" puede no dispararse nunca.
-- TG_OP en PL/pgSQL es 'INSERT' | 'UPDATE' | 'DELETE' en MAYÚSCULAS (no usar 'update').
-- ============================================================================

alter table public.prod_mesa_ejecuciones
  add column if not exists ot_paso_id uuid null;

alter table public.prod_mesa_ejecuciones
  drop constraint if exists prod_mesa_ejecuciones_ot_paso_id_fkey;

alter table public.prod_mesa_ejecuciones
  add constraint prod_mesa_ejecuciones_ot_paso_id_fkey
  foreign key (ot_paso_id) references public.prod_ot_pasos(id) on delete set null;

create index if not exists prod_mesa_ejecuciones_ot_paso_id_idx
  on public.prod_mesa_ejecuciones (ot_paso_id)
  where ot_paso_id is not null;

-- ---------------------------------------------------------------------------
-- Al iniciar en máquina: marcar paso del itinerario como en_marcha
-- ---------------------------------------------------------------------------
create or replace function public.prod_trg_mesa_ejecucion_itinerario_en_curso()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;

  if new.estado_ejecucion is distinct from 'en_curso' then
    return new;
  end if;

  if old.estado_ejecucion is not distinct from 'en_curso' then
    return new;
  end if;

  if old.estado_ejecucion is distinct from 'pendiente_inicio' then
    return new;
  end if;

  if new.ot_paso_id is null then
    return new;
  end if;

  update public.prod_ot_pasos p
  set
    estado = 'en_marcha'::public.paso_estado,
    fecha_inicio = coalesce(new.inicio_real_at, v_now)
  where p.id = new.ot_paso_id
    and p.estado = 'disponible'::public.paso_estado;

  return new;
end;
$$;

drop trigger if exists trg_prod_mesa_ejecuciones_itinerario_en_curso
  on public.prod_mesa_ejecuciones;

-- Sin UPDATE OF: PostgREST puede omitir columnas no enviadas en el PATCH; así el
-- trigger corre en todo UPDATE y la función filtra en microsegundos.
create trigger trg_prod_mesa_ejecuciones_itinerario_en_curso
  after update
  on public.prod_mesa_ejecuciones
  for each row
  execute function public.prod_trg_mesa_ejecucion_itinerario_en_curso();

-- ---------------------------------------------------------------------------
-- Al finalizar ejecución: cerrar paso y desbloquear siguiente pendiente
-- ---------------------------------------------------------------------------
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

  if new.ot_paso_id is null then
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

  return new;
end;
$$;

drop trigger if exists trg_prod_mesa_ejecuciones_itinerario_finaliza
  on public.prod_mesa_ejecuciones;

create trigger trg_prod_mesa_ejecuciones_itinerario_finaliza
  after update
  on public.prod_mesa_ejecuciones
  for each row
  execute function public.prod_trg_mesa_ejecucion_itinerario_finaliza();

comment on column public.prod_mesa_ejecuciones.ot_paso_id is
  'Paso de itinerario (prod_ot_pasos) vinculado a esta ejecución; usado para avanzar el GPS de la OT al finalizar.';
