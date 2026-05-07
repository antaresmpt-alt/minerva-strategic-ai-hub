alter table public.prod_mesa_ejecuciones
  add column if not exists horas_reales_entrada numeric,
  add column if not exists horas_reales_tiraje numeric,
  add column if not exists num_hojas_producidas numeric,
  add column if not exists cantidad_unidades numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prod_mesa_ejecuciones_horas_reales_entrada_chk'
  ) then
    alter table public.prod_mesa_ejecuciones
      add constraint prod_mesa_ejecuciones_horas_reales_entrada_chk
      check (horas_reales_entrada is null or horas_reales_entrada >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'prod_mesa_ejecuciones_horas_reales_tiraje_chk'
  ) then
    alter table public.prod_mesa_ejecuciones
      add constraint prod_mesa_ejecuciones_horas_reales_tiraje_chk
      check (horas_reales_tiraje is null or horas_reales_tiraje >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'prod_mesa_ejecuciones_num_hojas_producidas_chk'
  ) then
    alter table public.prod_mesa_ejecuciones
      add constraint prod_mesa_ejecuciones_num_hojas_producidas_chk
      check (num_hojas_producidas is null or num_hojas_producidas >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'prod_mesa_ejecuciones_cantidad_unidades_chk'
  ) then
    alter table public.prod_mesa_ejecuciones
      add constraint prod_mesa_ejecuciones_cantidad_unidades_chk
      check (cantidad_unidades is null or cantidad_unidades >= 0);
  end if;
end $$;

insert into public.sys_parametros (seccion, clave, valor_num, descripcion)
select
  'planificacion',
  'planificacion_ots_ejecucion_enabled',
  0,
  'Controla visibilidad de la pestaña OTs en ejecución (1 visible para todos, 0 solo admin).'
where not exists (
  select 1
  from public.sys_parametros
  where clave = 'planificacion_ots_ejecucion_enabled'
);
