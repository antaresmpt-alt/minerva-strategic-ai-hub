-- Configuración clave/valor (plantillas de correo producción, etc.).
-- Ejecutar en Supabase SQL Editor si la tabla no existe.

create table if not exists public.prod_configuracion (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  valor text not null default '',
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists prod_configuracion_clave_idx on public.prod_configuracion (clave);

comment on table public.prod_configuracion is
  'Pares clave/valor de configuración (p. ej. plantillas Gmail Externos/Materiales).';

alter table public.prod_configuracion enable row level security;

-- Lectura y escritura para usuarios autenticados (ajustar si la política del proyecto es más restrictiva).
create policy prod_configuracion_select_authenticated
  on public.prod_configuracion for select
  to authenticated
  using (true);

create policy prod_configuracion_insert_authenticated
  on public.prod_configuracion for insert
  to authenticated
  with check (true);

create policy prod_configuracion_update_authenticated
  on public.prod_configuracion for update
  to authenticated
  using (true)
  with check (true);
