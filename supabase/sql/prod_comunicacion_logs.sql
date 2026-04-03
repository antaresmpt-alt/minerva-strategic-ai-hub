-- Historial de envíos por email (Comunicación Pro · Externos).
-- Ejecutar en Supabase SQL Editor. Ajusta políticas RLS al mismo criterio que el resto de tablas prod_*.

create table if not exists public.prod_comunicacion_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  proveedor_id uuid references public.prod_proveedores (id) on delete set null,
  cuerpo text not null,
  id_pedidos integer[] not null
);

create index if not exists prod_comunicacion_logs_created_at_idx
  on public.prod_comunicacion_logs (created_at desc);

create index if not exists prod_comunicacion_logs_id_pedidos_gin
  on public.prod_comunicacion_logs using gin (id_pedidos);

comment on table public.prod_comunicacion_logs is
  'Registro de cuerpos de email enviados a proveedores (Comunicación Pro); id_pedidos lista las OT afectadas.';
