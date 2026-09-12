-- Conciliación factura por albarán (Emma): importe prorrateado por línea de recepción.

alter table public.prod_recepciones_material
  add column if not exists importe_factura_eur numeric(10, 2) null,
  add column if not exists importe_factura_at timestamptz null,
  add column if not exists importe_factura_por_email text null;

alter table public.prod_recepciones_material
  drop constraint if exists prod_recepciones_material_importe_factura_nonneg_chk;

alter table public.prod_recepciones_material
  add constraint prod_recepciones_material_importe_factura_nonneg_chk
  check (importe_factura_eur is null or importe_factura_eur >= 0);

comment on column public.prod_recepciones_material.importe_factura_eur is
  'Importe de factura prorrateado a esta línea de recepción (conciliación albarán).';

comment on column public.prod_recepciones_material.importe_factura_at is
  'Momento en que se registró o actualizó la conciliación de factura.';

comment on column public.prod_recepciones_material.importe_factura_por_email is
  'Usuario que registró la conciliación (p. ej. Emma).';
