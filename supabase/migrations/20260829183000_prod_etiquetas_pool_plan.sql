-- Pool entrada etiquetas (Bloque 5 v1): lista ordenada que Rita prepara para Hugo.

create table if not exists public.prod_etiquetas_pool_plan (
  id uuid primary key default gen_random_uuid(),
  ot_numero text not null,
  orden integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_pool_plan_ot_numero_uniq unique (ot_numero)
);

create index if not exists idx_prod_etiquetas_pool_plan_orden
  on public.prod_etiquetas_pool_plan (orden asc, created_at asc);

comment on table public.prod_etiquetas_pool_plan is
  'OTs de etiqueta digital en cola del día (Rita ordena; Hugo inicia → prod_etiquetas_hoja_ruta).';

create or replace function public.prod_etiquetas_pool_plan_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_pool_plan_set_updated_at
  on public.prod_etiquetas_pool_plan;

create trigger prod_etiquetas_pool_plan_set_updated_at
  before update on public.prod_etiquetas_pool_plan
  for each row
  execute function public.prod_etiquetas_pool_plan_set_updated_at();

alter table public.prod_etiquetas_pool_plan enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_pool_plan to authenticated;

drop policy if exists prod_etiquetas_pool_plan_select on public.prod_etiquetas_pool_plan;
create policy prod_etiquetas_pool_plan_select
  on public.prod_etiquetas_pool_plan for select
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

drop policy if exists prod_etiquetas_pool_plan_insert on public.prod_etiquetas_pool_plan;
create policy prod_etiquetas_pool_plan_insert
  on public.prod_etiquetas_pool_plan for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_pool_plan_update on public.prod_etiquetas_pool_plan;
create policy prod_etiquetas_pool_plan_update
  on public.prod_etiquetas_pool_plan for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_pool_plan_delete on public.prod_etiquetas_pool_plan;
create policy prod_etiquetas_pool_plan_delete
  on public.prod_etiquetas_pool_plan for delete
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
