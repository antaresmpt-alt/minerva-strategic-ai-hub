-- Notas libres por día para Calendario Producción (Jordi/Carlos).

create table if not exists public.prod_calendario_produccion_nota (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  texto text not null,
  orden integer not null default 0,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_calendario_produccion_nota_texto_nonempty_chk
    check (char_length(trim(texto)) > 0)
);

create index if not exists idx_prod_calendario_produccion_nota_fecha
  on public.prod_calendario_produccion_nota (fecha, orden, created_at);

comment on table public.prod_calendario_produccion_nota is
  'Notas libres por día para el planificador de producción.';

create or replace function public.prod_calendario_produccion_nota_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_calendario_produccion_nota_set_updated_at
  on public.prod_calendario_produccion_nota;

create trigger prod_calendario_produccion_nota_set_updated_at
  before update on public.prod_calendario_produccion_nota
  for each row
  execute function public.prod_calendario_produccion_nota_set_updated_at();

alter table public.prod_calendario_produccion_nota enable row level security;

grant select, insert, update, delete on public.prod_calendario_produccion_nota to authenticated;

drop policy if exists prod_calendario_produccion_nota_select on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_select
  on public.prod_calendario_produccion_nota for select
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
            'produccion_ejecucion',
            'almacen',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_calendario_produccion_nota_insert on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_insert
  on public.prod_calendario_produccion_nota for insert
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
            'produccion_ejecucion',
            'almacen',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_calendario_produccion_nota_update on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_update
  on public.prod_calendario_produccion_nota for update
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
            'produccion_ejecucion',
            'almacen',
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
            'produccion_ejecucion',
            'almacen',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_calendario_produccion_nota_delete on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_delete
  on public.prod_calendario_produccion_nota for delete
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
            'produccion_ejecucion',
            'almacen',
            'logistica'
          ]
        )
    )
  );
