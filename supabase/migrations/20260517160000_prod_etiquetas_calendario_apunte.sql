-- Apuntes manuales del calendario mensual (etiquetas digital).

create table if not exists public.prod_etiquetas_calendario_apunte (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  texto text not null,
  orden integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_calendario_apunte_texto_nonempty_chk
    check (char_length(trim(texto)) > 0)
);

create index if not exists idx_prod_etiquetas_calendario_apunte_fecha
  on public.prod_etiquetas_calendario_apunte (fecha, orden, created_at);

comment on table public.prod_etiquetas_calendario_apunte is
  'Notas libres por día en el calendario mensual de etiquetas digital (fiestas, servicio técnico, etc.).';

create or replace function public.prod_etiquetas_calendario_apunte_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_calendario_apunte_set_updated_at on public.prod_etiquetas_calendario_apunte;

create trigger prod_etiquetas_calendario_apunte_set_updated_at
  before update on public.prod_etiquetas_calendario_apunte
  for each row
  execute function public.prod_etiquetas_calendario_apunte_set_updated_at();

alter table public.prod_etiquetas_calendario_apunte enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_calendario_apunte to authenticated;

drop policy if exists prod_etiquetas_calendario_apunte_select on public.prod_etiquetas_calendario_apunte;
create policy prod_etiquetas_calendario_apunte_select
  on public.prod_etiquetas_calendario_apunte for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_etiquetas_calendario_apunte_insert on public.prod_etiquetas_calendario_apunte;
create policy prod_etiquetas_calendario_apunte_insert
  on public.prod_etiquetas_calendario_apunte for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_etiquetas_calendario_apunte_update on public.prod_etiquetas_calendario_apunte;
create policy prod_etiquetas_calendario_apunte_update
  on public.prod_etiquetas_calendario_apunte for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_etiquetas_calendario_apunte_delete on public.prod_etiquetas_calendario_apunte;
create policy prod_etiquetas_calendario_apunte_delete
  on public.prod_etiquetas_calendario_apunte for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  );
