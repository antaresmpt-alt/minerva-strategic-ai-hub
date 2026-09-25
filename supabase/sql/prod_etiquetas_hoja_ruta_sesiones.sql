-- DDL espejo de public.prod_etiquetas_hoja_ruta_sesiones.
-- Migración canónica:
--   supabase/migrations/20260925120000_prod_etiquetas_hoja_ruta_sesiones.sql

create table if not exists public.prod_etiquetas_hoja_ruta_sesiones (
  id uuid primary key default gen_random_uuid(),
  hoja_ruta_id uuid not null
    references public.prod_etiquetas_hoja_ruta (id) on delete cascade,
  proceso text not null,
  fecha date not null,
  nota text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_hoja_ruta_sesiones_proceso_chk
    check (proceso in ('I', 'T', 'N')),
  constraint prod_etiquetas_hoja_ruta_sesiones_unique
    unique (hoja_ruta_id, proceso, fecha)
);

create index if not exists idx_prod_etiquetas_hr_sesiones_fecha
  on public.prod_etiquetas_hoja_ruta_sesiones (fecha desc);

create index if not exists idx_prod_etiquetas_hr_sesiones_hoja
  on public.prod_etiquetas_hoja_ruta_sesiones (hoja_ruta_id);

comment on table public.prod_etiquetas_hoja_ruta_sesiones is
  'Días en que Hugo trabajó un proceso I/T/N sin cerrarlo (calendario multi-día).';

alter table public.prod_etiquetas_hoja_ruta_sesiones enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_hoja_ruta_sesiones
  to authenticated;
