-- Compras de stock genérico (sin OT) — Caso C Bloque 9.8.
-- Permite filas en prod_compra_material con ot_numero NULL (p. ej. OCM-STOCK-…).

alter table public.prod_compra_material
  alter column ot_numero drop not null;

comment on column public.prod_compra_material.ot_numero is
  'OT destino. NULL = compra de stock libre (sin OT); cartelar y asignar después (9.8.4).';
