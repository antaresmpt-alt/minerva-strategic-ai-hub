-- Stock de bobinas (sustrato) — departamento etiquetas digital.

create table if not exists public.prod_etiquetas_stock_bobinas (
  id uuid primary key default gen_random_uuid(),
  papel text not null,
  fabricante text not null default '',
  codigo text not null default '',
  unidades_stock integer not null default 0,
  fecha_pedido date null,
  fecha_recepcion date null,
  ancho_mm numeric null,
  ubicacion text null,
  notas text null,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_stock_bobinas_unidades_nonneg_chk
    check (unidades_stock >= 0),
  constraint prod_etiquetas_stock_bobinas_ancho_nonneg_chk
    check (ancho_mm is null or ancho_mm > 0)
);

create unique index if not exists idx_prod_etiquetas_stock_bobinas_unique_item
  on public.prod_etiquetas_stock_bobinas (
    lower(trim(papel)),
    lower(trim(fabricante)),
    lower(trim(codigo))
  );

create index if not exists idx_prod_etiquetas_stock_bobinas_activo_stock
  on public.prod_etiquetas_stock_bobinas (activo, unidades_stock);

comment on table public.prod_etiquetas_stock_bobinas is
  'Inventario simple de bobinas de sustrato (etiquetas digital). Unidad = rollos.';

create or replace function public.prod_etiquetas_stock_bobinas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_stock_bobinas_set_updated_at on public.prod_etiquetas_stock_bobinas;

create trigger prod_etiquetas_stock_bobinas_set_updated_at
  before update on public.prod_etiquetas_stock_bobinas
  for each row
  execute function public.prod_etiquetas_stock_bobinas_set_updated_at();

alter table public.prod_etiquetas_stock_bobinas enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_stock_bobinas to authenticated;

drop policy if exists prod_etiquetas_stock_bobinas_select on public.prod_etiquetas_stock_bobinas;
create policy prod_etiquetas_stock_bobinas_select
  on public.prod_etiquetas_stock_bobinas for select
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

drop policy if exists prod_etiquetas_stock_bobinas_insert on public.prod_etiquetas_stock_bobinas;
create policy prod_etiquetas_stock_bobinas_insert
  on public.prod_etiquetas_stock_bobinas for insert
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

drop policy if exists prod_etiquetas_stock_bobinas_update on public.prod_etiquetas_stock_bobinas;
create policy prod_etiquetas_stock_bobinas_update
  on public.prod_etiquetas_stock_bobinas for update
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

drop policy if exists prod_etiquetas_stock_bobinas_delete on public.prod_etiquetas_stock_bobinas;
create policy prod_etiquetas_stock_bobinas_delete
  on public.prod_etiquetas_stock_bobinas for delete
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
