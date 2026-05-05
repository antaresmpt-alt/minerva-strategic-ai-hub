alter table public.produccion_ot_despachadas
  add column if not exists horas_estimadas_troquelado numeric,
  add column if not exists horas_estimadas_engomado numeric;

alter table public.prod_mesa_ejecuciones
  add column if not exists horas_reales_troquelado numeric,
  add column if not exists horas_reales_engomado numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'produccion_ot_despachadas_horas_estimadas_troquelado_chk'
  ) then
    alter table public.produccion_ot_despachadas
      add constraint produccion_ot_despachadas_horas_estimadas_troquelado_chk
      check (
        horas_estimadas_troquelado is null
        or horas_estimadas_troquelado >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'produccion_ot_despachadas_horas_estimadas_engomado_chk'
  ) then
    alter table public.produccion_ot_despachadas
      add constraint produccion_ot_despachadas_horas_estimadas_engomado_chk
      check (
        horas_estimadas_engomado is null
        or horas_estimadas_engomado >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_mesa_ejecuciones_horas_reales_troquelado_chk'
  ) then
    alter table public.prod_mesa_ejecuciones
      add constraint prod_mesa_ejecuciones_horas_reales_troquelado_chk
      check (
        horas_reales_troquelado is null
        or horas_reales_troquelado >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_mesa_ejecuciones_horas_reales_engomado_chk'
  ) then
    alter table public.prod_mesa_ejecuciones
      add constraint prod_mesa_ejecuciones_horas_reales_engomado_chk
      check (
        horas_reales_engomado is null
        or horas_reales_engomado >= 0
      );
  end if;
end $$;
