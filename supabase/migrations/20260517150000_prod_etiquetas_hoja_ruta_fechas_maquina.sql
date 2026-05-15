-- Fechas de fin por máquina (calendario mensual I-/T-/N-) en hoja de ruta etiquetas digital.

alter table public.prod_etiquetas_hoja_ruta
  add column if not exists fecha_fin_konica date null,
  add column if not exists fecha_fin_troqueladora date null,
  add column if not exists fecha_fin_numeradora date null;

comment on column public.prod_etiquetas_hoja_ruta.fecha_fin_konica is
  'Día en que se completó impresión Konica (calendario: I-{ot_numero}).';
comment on column public.prod_etiquetas_hoja_ruta.fecha_fin_troqueladora is
  'Día en que se completó troquelado (calendario: T-{ot_numero}).';
comment on column public.prod_etiquetas_hoja_ruta.fecha_fin_numeradora is
  'Día en que se completó numeración (calendario: N-{ot_numero}).';
