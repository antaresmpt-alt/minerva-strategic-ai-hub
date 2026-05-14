-- DDL de `public.prod_etiquetas_hoja_ruta` + RLS (idempotente razonable).
-- La migración canónica del repo es:
--   supabase/migrations/20260514180000_prod_etiquetas_hoja_ruta.sql

-- Hoja de ruta del departamento de etiquetas digital (una fila por OT en curso).
-- RLS: admin, gerencia, produccion, digital, logistica (CRUD); delete solo admin/gerencia.

create table if not exists public.prod_etiquetas_hoja_ruta (
  id uuid primary key default gen_random_uuid(),
  ot_numero text not null,
  ot_general_id uuid null references public.prod_ots_general (id) on delete set null,
  cliente text null,
  trabajo text null,
  papel text null,
  cantidad numeric null,
  fecha_entrega_ot date null,
  fecha_entrada_depto date null,
  urgencia text not null default 'normal',
  observacion text null,
  konica boolean not null default false,
  troqueladora boolean not null default false,
  numeradora boolean not null default false,
  troquel_utillaje text null,
  fecha_inicio_produccion date null,
  fecha_fin_produccion date null,
  cajas integer null,
  bobinas integer null,
  etiquetas integer null,
  cajas_restantes text null,
  finalizado boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_hoja_ruta_urgencia_chk
    check (urgencia in ('normal', 'urgente')),
  constraint prod_etiquetas_hoja_ruta_cantidad_nonneg_chk
    check (cantidad is null or cantidad >= 0)
);

create index if not exists idx_prod_etiquetas_hoja_ruta_ot_numero
  on public.prod_etiquetas_hoja_ruta (ot_numero);

create index if not exists idx_prod_etiquetas_hoja_ruta_ot_general_id
  on public.prod_etiquetas_hoja_ruta (ot_general_id)
  where ot_general_id is not null;

create index if not exists idx_prod_etiquetas_hoja_ruta_finalizado_entrega
  on public.prod_etiquetas_hoja_ruta (finalizado, fecha_entrega_ot);

create index if not exists idx_prod_etiquetas_hoja_ruta_entrada
  on public.prod_etiquetas_hoja_ruta (fecha_entrada_depto desc nulls last);

comment on table public.prod_etiquetas_hoja_ruta is
  'Seguimiento tipo hoja de ruta del departamento de etiquetas digital.';

create or replace function public.prod_etiquetas_hoja_ruta_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_hoja_ruta_set_updated_at on public.prod_etiquetas_hoja_ruta;

create trigger prod_etiquetas_hoja_ruta_set_updated_at
  before update on public.prod_etiquetas_hoja_ruta
  for each row
  execute function public.prod_etiquetas_hoja_ruta_set_updated_at();

alter table public.prod_etiquetas_hoja_ruta enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_hoja_ruta to authenticated;

drop policy if exists prod_etiquetas_hoja_ruta_select on public.prod_etiquetas_hoja_ruta;
create policy prod_etiquetas_hoja_ruta_select
  on public.prod_etiquetas_hoja_ruta for select
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

drop policy if exists prod_etiquetas_hoja_ruta_insert on public.prod_etiquetas_hoja_ruta;
create policy prod_etiquetas_hoja_ruta_insert
  on public.prod_etiquetas_hoja_ruta for insert
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

drop policy if exists prod_etiquetas_hoja_ruta_update on public.prod_etiquetas_hoja_ruta;
create policy prod_etiquetas_hoja_ruta_update
  on public.prod_etiquetas_hoja_ruta for update
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

drop policy if exists prod_etiquetas_hoja_ruta_delete on public.prod_etiquetas_hoja_ruta;
create policy prod_etiquetas_hoja_ruta_delete
  on public.prod_etiquetas_hoja_ruta for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );
