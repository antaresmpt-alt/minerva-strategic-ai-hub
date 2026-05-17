-- Festivos configurables (nacional, autonómico, local, empresa) para calendarios de producción.

create table if not exists public.prod_calendario_festivo (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nombre text not null,
  ambito text not null default 'nacional',
  codigo_ambito text,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_calendario_festivo_ambito_chk
    check (ambito = any (array['nacional', 'autonomico', 'local', 'empresa']::text[])),
  constraint prod_calendario_festivo_nombre_nonempty_chk
    check (char_length(trim(nombre)) > 0)
);

create index if not exists idx_prod_calendario_festivo_fecha
  on public.prod_calendario_festivo (fecha, ambito, activo);

comment on table public.prod_calendario_festivo is
  'Días festivos por ámbito (ES, CCAA, localidad, empresa) para rejillas de calendario.';

create or replace function public.prod_calendario_festivo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_calendario_festivo_set_updated_at on public.prod_calendario_festivo;

create trigger prod_calendario_festivo_set_updated_at
  before update on public.prod_calendario_festivo
  for each row
  execute function public.prod_calendario_festivo_set_updated_at();

alter table public.prod_calendario_festivo enable row level security;

grant select, insert, update, delete on public.prod_calendario_festivo to authenticated;

drop policy if exists prod_calendario_festivo_select on public.prod_calendario_festivo;
create policy prod_calendario_festivo_select
  on public.prod_calendario_festivo for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_calendario_festivo_insert on public.prod_calendario_festivo;
create policy prod_calendario_festivo_insert
  on public.prod_calendario_festivo for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  );

drop policy if exists prod_calendario_festivo_update on public.prod_calendario_festivo;
create policy prod_calendario_festivo_update
  on public.prod_calendario_festivo for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  );

drop policy if exists prod_calendario_festivo_delete on public.prod_calendario_festivo;
create policy prod_calendario_festivo_delete
  on public.prod_calendario_festivo for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia', 'digital'])
    )
  );

-- Seed: España (nacional) + Cataluña (autonomico CT) 2025–2026
insert into public.prod_calendario_festivo (fecha, nombre, ambito, codigo_ambito)
select v.fecha, v.nombre, v.ambito, v.codigo_ambito
from (
  values
    ('2025-01-01'::date, 'Año Nuevo', 'nacional', 'ES'),
    ('2025-01-06', 'Epifanía del Señor', 'nacional', 'ES'),
    ('2025-04-18', 'Viernes Santo', 'nacional', 'ES'),
    ('2025-05-01', 'Fiesta del Trabajo', 'nacional', 'ES'),
    ('2025-08-15', 'Asunción de la Virgen', 'nacional', 'ES'),
    ('2025-10-12', 'Fiesta Nacional de España', 'nacional', 'ES'),
    ('2025-11-01', 'Todos los Santos', 'nacional', 'ES'),
    ('2025-12-06', 'Día de la Constitución', 'nacional', 'ES'),
    ('2025-12-08', 'Inmaculada Concepción', 'nacional', 'ES'),
    ('2025-12-25', 'Navidad', 'nacional', 'ES'),
    ('2025-04-21', 'Lunes de Pascua', 'autonomico', 'CT'),
    ('2025-06-24', 'San Juan', 'autonomico', 'CT'),
    ('2025-09-11', 'Diada de Catalunya', 'autonomico', 'CT'),
    ('2025-12-26', 'San Esteban', 'autonomico', 'CT'),
    ('2026-01-01', 'Año Nuevo', 'nacional', 'ES'),
    ('2026-01-06', 'Epifanía del Señor', 'nacional', 'ES'),
    ('2026-04-03', 'Viernes Santo', 'nacional', 'ES'),
    ('2026-05-01', 'Fiesta del Trabajo', 'nacional', 'ES'),
    ('2026-08-15', 'Asunción de la Virgen', 'nacional', 'ES'),
    ('2026-10-12', 'Fiesta Nacional de España', 'nacional', 'ES'),
    ('2026-11-01', 'Todos los Santos', 'nacional', 'ES'),
    ('2026-12-06', 'Día de la Constitución', 'nacional', 'ES'),
    ('2026-12-08', 'Inmaculada Concepción', 'nacional', 'ES'),
    ('2026-12-25', 'Navidad', 'nacional', 'ES'),
    ('2026-04-06', 'Lunes de Pascua', 'autonomico', 'CT'),
    ('2026-06-24', 'San Juan', 'autonomico', 'CT'),
    ('2026-09-11', 'Diada de Catalunya', 'autonomico', 'CT'),
    ('2026-12-26', 'San Esteban', 'autonomico', 'CT')
) as v(fecha, nombre, ambito, codigo_ambito)
where not exists (
  select 1
  from public.prod_calendario_festivo f
  where f.fecha = v.fecha
    and f.ambito = v.ambito
    and coalesce(f.codigo_ambito, '') = coalesce(v.codigo_ambito, '')
);
