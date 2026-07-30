-- =====================================================================
-- Promedios guillotina / desbroce en prod_referencias
-- Mediana de horas absolutas (no millar): procesos que no escalan
-- linealmente con la tirada como el tiraje de impresión.
-- =====================================================================

alter table public.prod_referencias
  add column if not exists horas_guillotina_promedio numeric null,
  add column if not exists horas_guillotina_oficial numeric null,
  add column if not exists horas_guillotina_muestra_n integer null,
  add column if not exists horas_desbroce_promedio numeric null,
  add column if not exists horas_desbroce_oficial numeric null,
  add column if not exists horas_desbroce_muestra_n integer null;

comment on column public.prod_referencias.horas_guillotina_promedio is
  'Mediana de horas_guillotina_reales desde prod_ot_producidas.';
comment on column public.prod_referencias.horas_desbroce_promedio is
  'Mediana de horas_desbroce_reales desde prod_ot_producidas.';
