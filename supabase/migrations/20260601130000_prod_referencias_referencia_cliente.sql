-- =====================================================================
-- Migración: referencia_cliente en Referencias Minerva
-- Descripción: Código de artículo/referencia del cliente (ej: EU858, EU1079)
--              asociado a una referencia Minerva.
-- =====================================================================

alter table public.prod_referencias
  add column if not exists referencia_cliente text null;

create index if not exists prod_referencias_referencia_cliente_idx
  on public.prod_referencias(referencia_cliente);

comment on column public.prod_referencias.referencia_cliente is
  'Código de artículo/referencia del cliente asociado a la referencia Minerva (ej: EU858, EU1079). Nullable porque no todos los clientes o pedidos lo informan.';
