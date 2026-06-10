-- ============================================================================
-- Etiquetas digital - troqueles:
-- - Solo el código es obligatorio al crear troqueles manualmente.
-- - Nueva fecha de última reparación/actualización del troquel.
-- ============================================================================

alter table public.prod_etiquetas_troqueles
  alter column carpeta_original drop not null,
  add column if not exists fecha_ult_reparacion date null;

comment on column public.prod_etiquetas_troqueles.carpeta_original is
  'Nombre original de la carpeta de donde se extrajo el troquel. Opcional: Hugo puede crear primero el código y completar la carpeta más adelante.';

comment on column public.prod_etiquetas_troqueles.fecha_ult_reparacion is
  'Fecha de última reparación o actualización conocida del troquel de etiquetas.';
