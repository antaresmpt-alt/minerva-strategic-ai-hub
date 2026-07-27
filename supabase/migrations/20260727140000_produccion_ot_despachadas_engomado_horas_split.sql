-- Despacho: horas engomado prep/tiraje (total legacy en horas_estimadas_engomado).

alter table public.produccion_ot_despachadas
  add column if not exists horas_engomado_preparacion numeric,
  add column if not exists horas_engomado_tiraje numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'produccion_ot_despachadas_horas_engomado_preparacion_chk'
  ) then
    alter table public.produccion_ot_despachadas
      add constraint produccion_ot_despachadas_horas_engomado_preparacion_chk
      check (horas_engomado_preparacion is null or horas_engomado_preparacion >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'produccion_ot_despachadas_horas_engomado_tiraje_chk'
  ) then
    alter table public.produccion_ot_despachadas
      add constraint produccion_ot_despachadas_horas_engomado_tiraje_chk
      check (horas_engomado_tiraje is null or horas_engomado_tiraje >= 0);
  end if;
end $$;

comment on column public.produccion_ot_despachadas.horas_engomado_preparacion is
  'Horas estimadas de preparación/arreglo en engomado (despacho).';
comment on column public.produccion_ot_despachadas.horas_engomado_tiraje is
  'Horas estimadas de tiraje en engomado (despacho). horas_estimadas_engomado = prep + tiraje cuando ambos informados.';
