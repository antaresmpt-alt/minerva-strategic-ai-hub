-- DDL: `prod_etiquetas_catalogo`, `prod_etiquetas_compras`, parámetro correo.
-- Migración canónica: supabase/migrations/20260515120000_prod_etiquetas_compras_catalogo.sql

-- Catálogo y compras del departamento etiquetas digital + parámetro correo peticiones.

-- ---------------------------------------------------------------------------
-- sys_parametros.valor_text (si no existe)
-- ---------------------------------------------------------------------------
alter table public.sys_parametros
  add column if not exists valor_text text;

insert into public.sys_parametros (seccion, clave, valor_text, descripcion)
values (
  'Etiquetas digital',
  'etiquetas_digital_compras_email_destinatarios',
  'digital@minervaglobal.es,jordi@minervaglobal.es,gemma@minervaglobal.es',
  'Destinatarios del correo de petición de compras (separados por coma o punto y coma).'
)
on conflict (clave) do update set
  seccion = excluded.seccion,
  descripcion = excluded.descripcion,
  valor_text = coalesce(
    nullif(trim(public.sys_parametros.valor_text), ''),
    excluded.valor_text
  ),
  updated_at = timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- prod_etiquetas_catalogo
-- ---------------------------------------------------------------------------
create table if not exists public.prod_etiquetas_catalogo (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  grupo text null,
  label text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_catalogo_categoria_chk
    check (
      categoria in (
        'producto',
        'equipo',
        'marca',
        'propietario',
        'prioridad',
        'tipo_linea'
      )
    ),
  constraint prod_etiquetas_catalogo_grupo_chk
    check (
      (categoria = 'marca' and grupo is not null)
      or (categoria <> 'marca' and grupo is null)
    )
);

create unique index if not exists idx_prod_etiquetas_catalogo_unique_label
  on public.prod_etiquetas_catalogo (categoria, coalesce(grupo, ''), lower(label));

create index if not exists idx_prod_etiquetas_catalogo_cat_grupo_activo
  on public.prod_etiquetas_catalogo (categoria, grupo, activo, orden, label);

comment on table public.prod_etiquetas_catalogo is
  'Valores sugeridos para compras y formularios de etiquetas digital (producto, equipo, tipo/marca, etc.).';

create or replace function public.prod_etiquetas_catalogo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_catalogo_set_updated_at on public.prod_etiquetas_catalogo;

create trigger prod_etiquetas_catalogo_set_updated_at
  before update on public.prod_etiquetas_catalogo
  for each row
  execute function public.prod_etiquetas_catalogo_set_updated_at();

alter table public.prod_etiquetas_catalogo enable row level security;

grant select on public.prod_etiquetas_catalogo to authenticated;

drop policy if exists prod_etiquetas_catalogo_select on public.prod_etiquetas_catalogo;
create policy prod_etiquetas_catalogo_select
  on public.prod_etiquetas_catalogo for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- prod_etiquetas_compras
-- ---------------------------------------------------------------------------
create table if not exists public.prod_etiquetas_compras (
  id uuid primary key default gen_random_uuid(),
  producto text not null,
  unidad integer not null default 1,
  recibido boolean not null default false,
  propietario text not null,
  fecha_pedido date not null default (timezone('utc'::text, now()))::date,
  fecha_llegada date null,
  equipo text not null default '',
  tipo_linea text not null,
  marca text not null,
  prioridad text not null default 'MEDIA',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_compras_unidad_chk
    check (unidad >= 1),
  constraint prod_etiquetas_compras_propietario_chk
    check (propietario in ('RITA', 'HUGO')),
  constraint prod_etiquetas_compras_prioridad_chk
    check (prioridad in ('ALTA', 'MEDIA', 'BAJA')),
  constraint prod_etiquetas_compras_tipo_linea_chk
    check (
      tipo_linea in (
        'ETIQUETAS',
        'ASISTENCIA',
        'TINTAS',
        'TROQUEL',
        'MANDRIL'
      )
    )
);

create index if not exists idx_prod_etiquetas_compras_pedido
  on public.prod_etiquetas_compras (fecha_pedido desc nulls last);

create index if not exists idx_prod_etiquetas_compras_recibido
  on public.prod_etiquetas_compras (recibido, fecha_pedido desc);

comment on table public.prod_etiquetas_compras is
  'Seguimiento de compras del departamento de etiquetas digital.';

create or replace function public.prod_etiquetas_compras_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_compras_set_updated_at on public.prod_etiquetas_compras;

create trigger prod_etiquetas_compras_set_updated_at
  before update on public.prod_etiquetas_compras
  for each row
  execute function public.prod_etiquetas_compras_set_updated_at();

alter table public.prod_etiquetas_compras enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_compras to authenticated;

drop policy if exists prod_etiquetas_compras_select on public.prod_etiquetas_compras;
create policy prod_etiquetas_compras_select
  on public.prod_etiquetas_compras for select
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

drop policy if exists prod_etiquetas_compras_insert on public.prod_etiquetas_compras;
create policy prod_etiquetas_compras_insert
  on public.prod_etiquetas_compras for insert
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

drop policy if exists prod_etiquetas_compras_update on public.prod_etiquetas_compras;
create policy prod_etiquetas_compras_update
  on public.prod_etiquetas_compras for update
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

drop policy if exists prod_etiquetas_compras_delete on public.prod_etiquetas_compras;
create policy prod_etiquetas_compras_delete
  on public.prod_etiquetas_compras for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );

-- ---------------------------------------------------------------------------
-- Seeds catálogo (idempotente)
-- ---------------------------------------------------------------------------
insert into public.prod_etiquetas_catalogo (categoria, grupo, label, orden, activo)
select v.categoria, v.grupo, v.label, v.orden, v.activo
from (
  values
    ('tipo_linea'::text, null::text, 'ETIQUETAS'::text, 10, true),
    ('tipo_linea', null, 'ASISTENCIA', 20, true),
    ('tipo_linea', null, 'TINTAS', 30, true),
    ('tipo_linea', null, 'TROQUEL', 40, true),
    ('tipo_linea', null, 'MANDRIL', 50, true),
    ('producto', null, 'COUCHE BRILLO', 10, true),
    ('producto', null, 'ALTO BRILLO', 20, true),
    ('producto', null, 'WATERPROOF', 30, true),
    ('producto', null, 'SUPERMATTE', 40, true),
    ('producto', null, 'REMOVIBLE', 50, true),
    ('producto', null, 'PERMANENTE ST-500', 60, true),
    ('producto', null, 'POLIPROPILENO BLANCO BRILLO', 70, true),
    ('producto', null, 'POLIPROPILENO MATE BRILLO', 80, true),
    ('producto', null, 'POLIPROPILENO TRANSPARENTE', 90, true),
    ('equipo', null, 'K01 KONICA', 10, true),
    ('equipo', null, 'N01 NUMERADORA', 20, true),
    ('equipo', null, 'T01 TROQUELADORA', 30, true),
    ('marca', 'ETIQUETAS', 'FEDRIGONI', 10, true),
    ('marca', 'ETIQUETAS', 'ADESTOR', 20, true),
    ('marca', 'ASISTENCIA', 'COPYSERVICE', 10, true),
    ('marca', 'TINTAS', 'COPYSERVICE', 10, true),
    ('marca', 'TROQUEL', 'RUBIO', 10, true),
    ('marca', 'TROQUEL', 'EGARA', 20, true),
    ('marca', 'MANDRIL', 'ALPESA', 10, true),
    ('propietario', null, 'RITA', 10, true),
    ('propietario', null, 'HUGO', 20, true),
    ('prioridad', null, 'ALTA', 10, true),
    ('prioridad', null, 'MEDIA', 20, true),
    ('prioridad', null, 'BAJA', 30, true)
) as v(categoria, grupo, label, orden, activo)
where not exists (
  select 1
  from public.prod_etiquetas_catalogo e
  where e.categoria = v.categoria
    and coalesce(e.grupo, '') = coalesce(v.grupo, '')
    and lower(e.label) = lower(v.label)
);
