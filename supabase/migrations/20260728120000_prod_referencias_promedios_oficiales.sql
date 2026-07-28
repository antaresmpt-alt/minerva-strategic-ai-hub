-- =====================================================================
-- Bloque 6.x — Paso A: columnas de promedios / oficial en prod_referencias
--
-- Fuente de verdad del cálculo (Paso B/C): prod_ot_producidas
-- (excluido_de_promedios = false, MAX(version) por ot_numero).
--
-- Capas (§7.1.3):
--   *_promedio  → solo el botón «Actualizar promedios»
--   *_oficial   → solo humano; el botón NUNCA la pisa
-- Prefill futuro: oficial ?? promedio (y habitual como bootstrap Fase 2).
--
-- Horas (§7.1.10): prep absoluta + tiraje como horas/millar.
-- Guillotina / CTP / desbroce: fuera de este split (no columnas aquí).
-- =====================================================================

alter table public.prod_referencias
  -- Metadatos del último recálculo
  add column if not exists promedios_actualizados_at timestamptz null,
  add column if not exists promedios_basados_en_n_ots integer null,

  -- Categóricos (moda → text)
  add column if not exists material_promedio text null,
  add column if not exists material_oficial text null,
  add column if not exists troquel_promedio text null,
  add column if not exists troquel_oficial text null,
  add column if not exists tintas_promedio text null,
  add column if not exists tintas_oficial text null,
  add column if not exists acabado_promedio text null,
  add column if not exists acabado_oficial text null,
  add column if not exists tipo_engomado_promedio text null,
  add column if not exists tipo_engomado_oficial text null,
  add column if not exists caja_embalaje_promedio text null,
  add column if not exists caja_embalaje_oficial text null,

  -- Numéricos (mediana)
  add column if not exists poses_promedio numeric null,
  add column if not exists poses_oficial numeric null,
  add column if not exists poses_muestra_n integer null,
  add column if not exists gramaje_promedio numeric null,
  add column if not exists gramaje_oficial numeric null,
  add column if not exists gramaje_muestra_n integer null,
  add column if not exists unidades_por_embalaje_promedio numeric null,
  add column if not exists unidades_por_embalaje_oficial numeric null,
  add column if not exists unidades_por_embalaje_muestra_n integer null,
  add column if not exists merma_promedio numeric null,
  add column if not exists merma_oficial numeric null,
  add column if not exists merma_muestra_n integer null,

  -- Horas prep (absolutas, mediana)
  add column if not exists horas_prep_impresion_promedio numeric null,
  add column if not exists horas_prep_impresion_oficial numeric null,
  add column if not exists horas_prep_impresion_muestra_n integer null,
  add column if not exists horas_prep_troquelado_promedio numeric null,
  add column if not exists horas_prep_troquelado_oficial numeric null,
  add column if not exists horas_prep_troquelado_muestra_n integer null,
  add column if not exists horas_prep_engomado_promedio numeric null,
  add column if not exists horas_prep_engomado_oficial numeric null,
  add column if not exists horas_prep_engomado_muestra_n integer null,

  -- Horas tiraje normalizadas a millar de pedido (mediana de H×1000/Q)
  add column if not exists horas_millar_impresion_promedio numeric null,
  add column if not exists horas_millar_impresion_oficial numeric null,
  add column if not exists horas_millar_impresion_muestra_n integer null,
  add column if not exists horas_millar_troquelado_promedio numeric null,
  add column if not exists horas_millar_troquelado_oficial numeric null,
  add column if not exists horas_millar_troquelado_muestra_n integer null,
  add column if not exists horas_millar_engomado_promedio numeric null,
  add column if not exists horas_millar_engomado_oficial numeric null,
  add column if not exists horas_millar_engomado_muestra_n integer null;

-- Checks: muestra_n >= 0; horas/números >= 0 cuando informados
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prod_referencias_promedios_basados_en_n_ots_chk'
  ) then
    alter table public.prod_referencias
      add constraint prod_referencias_promedios_basados_en_n_ots_chk
      check (promedios_basados_en_n_ots is null or promedios_basados_en_n_ots >= 0);
  end if;
end $$;

comment on column public.prod_referencias.promedios_actualizados_at is
  'Bloque 6.x: última vez que se ejecutó «Actualizar promedios» para esta referencia.';
comment on column public.prod_referencias.promedios_basados_en_n_ots is
  'Bloque 6.x: nº de OTs del histórico usadas en el último recálculo (tras filtros).';

comment on column public.prod_referencias.material_promedio is
  'Moda de material desde prod_ot_producidas. No pisa material_oficial ni material_habitual.';
comment on column public.prod_referencias.material_oficial is
  'Valor oficial fijado a mano. Prefill = oficial ?? promedio ?? habitual.';
comment on column public.prod_referencias.horas_prep_impresion_promedio is
  'Mediana absoluta de horas_prep_impresion_reales (§7.1.10).';
comment on column public.prod_referencias.horas_millar_impresion_promedio is
  'Mediana de (horas_tiraje_impresion_reales × 1000 / cantidad_pedida).';
comment on column public.prod_referencias.horas_prep_troquelado_promedio is
  'Mediana absoluta de horas_prep_troquelado_reales.';
comment on column public.prod_referencias.horas_millar_troquelado_promedio is
  'Mediana de (horas_tiraje_troquelado_reales × 1000 / cantidad_pedida).';
comment on column public.prod_referencias.horas_prep_engomado_promedio is
  'Mediana absoluta de horas_prep_engomado_reales.';
comment on column public.prod_referencias.horas_millar_engomado_promedio is
  'Mediana de (horas_tiraje_engomado_reales × 1000 / cantidad_pedida).';
