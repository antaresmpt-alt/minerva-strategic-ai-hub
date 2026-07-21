-- Ola 1 Fase 2 Maestro de Artículos (21 jul 2026)
-- Añade campos de embalaje habitual y gramaje habitual a prod_referencias.
-- Todo nullable → cambio aditivo, sin romper nada.

alter table public.prod_referencias
  add column if not exists caja_embalaje_habitual        text    null,
  add column if not exists unidades_por_embalaje_habitual integer null,
  add column if not exists gramaje_habitual               numeric null;

comment on column public.prod_referencias.caja_embalaje_habitual is
  'Código de caja de embalaje habitual (ej: MN2L). Pre-rellena el despacho al guardar en maestro.';
comment on column public.prod_referencias.unidades_por_embalaje_habitual is
  'Unidades (estuches) por caja de embalaje habitual. Pre-rellena el despacho al guardar en maestro.';
comment on column public.prod_referencias.gramaje_habitual is
  'Gramaje habitual del material (g/m²). Pre-rellena el despacho al guardar en maestro.';
