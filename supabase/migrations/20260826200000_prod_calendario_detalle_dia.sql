-- Bloque 11 §6.5 — Detalle del día (orden fino por máquina/turno).
-- Opción B: tabla ligera NUEVA. No reutiliza prod_mesa_planificacion_trabajos.
-- Spike 26 ago 2026: SESION_26AGO2026_BLOQUE11_SPIKE_DETALLE_DIA.md
-- Aplicar en fase 3 (OK Manel); no forma parte del camino LEGACY Pool/Mesa.

create table if not exists public.prod_calendario_detalle_dia (
  id uuid primary key default gen_random_uuid(),
  calendario_ot_id uuid not null
    references public.prod_calendario_produccion_ot (id) on delete cascade,
  fecha date not null,
  ambito text not null,
  ot_numero text not null,
  maquina_id uuid null
    references public.prod_maquinas (id) on delete set null,
  turno text null,
  slot_orden integer not null default 1,
  horas_planificadas_snapshot numeric null,
  notas text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_calendario_detalle_dia_ot_nonempty_chk
    check (char_length(trim(ot_numero)) > 0),
  constraint prod_calendario_detalle_dia_ambito_chk
    check (ambito = any (array['impresion'::text, 'digital'::text, 'troquelado'::text, 'engomado'::text])),
  constraint prod_calendario_detalle_dia_turno_chk
    check (turno is null or turno = any (array['manana'::text, 'tarde'::text])),
  constraint prod_calendario_detalle_dia_slot_chk
    check (slot_orden > 0),
  constraint prod_calendario_detalle_dia_calendario_uq
    unique (calendario_ot_id)
);

comment on table public.prod_calendario_detalle_dia is
  'Orden fino del día (máquina/turno/slot/horas) para pastillas del calendario. No ejecuta. CASCADE al borrar pastilla.';

comment on column public.prod_calendario_detalle_dia.calendario_ot_id is
  'Pastilla origen. ON DELETE CASCADE = sin filas huérfanas al quitar del calendario.';

create index if not exists idx_prod_calendario_detalle_dia_fecha_ambito
  on public.prod_calendario_detalle_dia (fecha, ambito, maquina_id, turno, slot_orden);

create index if not exists idx_prod_calendario_detalle_dia_ot
  on public.prod_calendario_detalle_dia (ot_numero);

create or replace function public.prod_calendario_detalle_dia_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_calendario_detalle_dia_set_updated_at
  on public.prod_calendario_detalle_dia;

create trigger prod_calendario_detalle_dia_set_updated_at
  before update on public.prod_calendario_detalle_dia
  for each row
  execute function public.prod_calendario_detalle_dia_set_updated_at();

alter table public.prod_calendario_detalle_dia enable row level security;

grant select, insert, update, delete on public.prod_calendario_detalle_dia to authenticated;

-- Misma política amplia que el calendario (planta autenticada).
-- Afinar por rol en Bloque 12 si hace falta.

drop policy if exists prod_calendario_detalle_dia_select on public.prod_calendario_detalle_dia;
create policy prod_calendario_detalle_dia_select
  on public.prod_calendario_detalle_dia for select
  to authenticated
  using (true);

drop policy if exists prod_calendario_detalle_dia_insert on public.prod_calendario_detalle_dia;
create policy prod_calendario_detalle_dia_insert
  on public.prod_calendario_detalle_dia for insert
  to authenticated
  with check (true);

drop policy if exists prod_calendario_detalle_dia_update on public.prod_calendario_detalle_dia;
create policy prod_calendario_detalle_dia_update
  on public.prod_calendario_detalle_dia for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists prod_calendario_detalle_dia_delete on public.prod_calendario_detalle_dia;
create policy prod_calendario_detalle_dia_delete
  on public.prod_calendario_detalle_dia for delete
  to authenticated
  using (true);
