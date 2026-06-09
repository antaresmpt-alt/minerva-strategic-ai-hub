-- Trazabilidad FSC por artículo en el Maestro de Artículos.
-- Cambio aditivo (nullable / default), no rompe nada existente.

alter table public.prod_referencias
  add column if not exists fsc                  boolean not null default false,
  add column if not exists fsc_fecha_validacion date null;

comment on column public.prod_referencias.fsc is
  'true = artículo certificado FSC.';
comment on column public.prod_referencias.fsc_fecha_validacion is
  'Fecha de validación del FSC para este artículo ("fecha corta").';
