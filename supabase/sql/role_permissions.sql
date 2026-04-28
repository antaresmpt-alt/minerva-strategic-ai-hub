-- Tabla de permisos dinámicos por rol (Hub + middleware).
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  module_name text not null,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (role, module_name)
);

create index if not exists role_permissions_role_idx on public.role_permissions (role);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select" on public.role_permissions;
drop policy if exists "role_permissions_write" on public.role_permissions;

create policy "role_permissions_select"
  on public.role_permissions
  for select
  to authenticated
  using (
    role = (select p.role::text from public.profiles p where p.id = (select auth.uid()))
    or exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role::text in ('admin', 'gerencia')
    )
  );

create policy "role_permissions_write"
  on public.role_permissions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role::text in ('admin', 'gerencia')
    )
  );

create policy "role_permissions_update"
  on public.role_permissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role::text in ('admin', 'gerencia')
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role::text in ('admin', 'gerencia')
    )
  );

create policy "role_permissions_delete"
  on public.role_permissions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role::text in ('admin', 'gerencia')
    )
  );

insert into public.role_permissions (role, module_name, is_enabled) values
  ('admin', 'sales', true), ('admin', 'sem', true), ('admin', 'seo', true), ('admin', 'muelle', true), ('admin', 'produccion', true), ('admin', 'produccion_ejecucion', true), ('admin', 'chat', true), ('admin', 'settings', true),
  ('gerencia', 'sales', true), ('gerencia', 'sem', true), ('gerencia', 'seo', true), ('gerencia', 'muelle', true), ('gerencia', 'produccion', true), ('gerencia', 'produccion_ejecucion', true), ('gerencia', 'chat', true), ('gerencia', 'settings', true),
  ('comercial', 'sales', true), ('comercial', 'sem', true), ('comercial', 'seo', true), ('comercial', 'muelle', false), ('comercial', 'produccion', false), ('comercial', 'produccion_ejecucion', false), ('comercial', 'chat', true), ('comercial', 'settings', false),
  ('produccion', 'sales', false), ('produccion', 'sem', false), ('produccion', 'seo', false), ('produccion', 'muelle', false), ('produccion', 'produccion', true), ('produccion', 'produccion_ejecucion', true), ('produccion', 'chat', true), ('produccion', 'settings', false),
  ('logistica', 'sales', false), ('logistica', 'sem', false), ('logistica', 'seo', false), ('logistica', 'muelle', false), ('logistica', 'produccion', true), ('logistica', 'produccion_ejecucion', false), ('logistica', 'chat', true), ('logistica', 'settings', false),
  ('ctp', 'sales', false), ('ctp', 'sem', false), ('ctp', 'seo', false), ('ctp', 'muelle', false), ('ctp', 'produccion', false), ('ctp', 'produccion_ejecucion', false), ('ctp', 'chat', true), ('ctp', 'settings', false),
  ('administracion', 'sales', false), ('administracion', 'sem', false), ('administracion', 'seo', false), ('administracion', 'muelle', false), ('administracion', 'produccion', false), ('administracion', 'produccion_ejecucion', false), ('administracion', 'chat', true), ('administracion', 'settings', false),
  ('oficina_tecnica', 'sales', false), ('oficina_tecnica', 'sem', false), ('oficina_tecnica', 'seo', false), ('oficina_tecnica', 'muelle', false), ('oficina_tecnica', 'produccion', false), ('oficina_tecnica', 'produccion_ejecucion', false), ('oficina_tecnica', 'chat', true), ('oficina_tecnica', 'settings', false),
  ('almacen', 'sales', false), ('almacen', 'sem', false), ('almacen', 'seo', false), ('almacen', 'muelle', true), ('almacen', 'produccion', false), ('almacen', 'produccion_ejecucion', false), ('almacen', 'chat', true), ('almacen', 'settings', false),
  ('impresion', 'sales', false), ('impresion', 'sem', false), ('impresion', 'seo', false), ('impresion', 'muelle', false), ('impresion', 'produccion', false), ('impresion', 'produccion_ejecucion', true), ('impresion', 'chat', false), ('impresion', 'settings', false)
on conflict (role, module_name) do update set
  is_enabled = excluded.is_enabled,
  updated_at = timezone('utc'::text, now());
