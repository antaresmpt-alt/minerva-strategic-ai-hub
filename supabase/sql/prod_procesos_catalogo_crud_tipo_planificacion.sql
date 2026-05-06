-- Catálogo de procesos editable desde Settings:
-- - añade mapeo explícito de planificación
-- - deja seed de proceso Guillotina (troquelado)
-- - deja seed de máquina Guillotina

alter table public.prod_procesos_cat
  add column if not exists tipo_planificacion text;

alter table public.prod_procesos_cat
  drop constraint if exists prod_procesos_cat_tipo_planificacion_check;

alter table public.prod_procesos_cat
  add constraint prod_procesos_cat_tipo_planificacion_check
  check (
    tipo_planificacion is null
    or tipo_planificacion in ('impresion', 'digital', 'troquelado', 'engomado')
  );

update public.prod_procesos_cat
set tipo_planificacion = case
  when lower(coalesce(nombre, '')) like '%digital%'
    or lower(coalesce(seccion_slug, '')) like '%digital%'
    then 'digital'
  when lower(coalesce(nombre, '')) like '%troquel%'
    or lower(coalesce(seccion_slug, '')) like '%troquel%'
    then 'troquelado'
  when lower(coalesce(nombre, '')) like '%engom%'
    or lower(coalesce(seccion_slug, '')) like '%engom%'
    then 'engomado'
  else 'impresion'
end
where tipo_planificacion is null;

insert into public.prod_procesos_cat
  (nombre, seccion_slug, tipo_planificacion, es_externo, orden_sugerido, activo)
select
  'Guillotina',
  'troquelado',
  'troquelado',
  false,
  115,
  true
where not exists (
  select 1
  from public.prod_procesos_cat
  where lower(btrim(nombre)) = 'guillotina'
);

update public.prod_procesos_cat
set
  seccion_slug = 'troquelado',
  tipo_planificacion = 'troquelado',
  es_externo = false,
  activo = true
where lower(btrim(nombre)) = 'guillotina';

insert into public.prod_maquinas
  (codigo, nombre, tipo_maquina, activa, orden_visual, capacidad_horas_default_manana, capacidad_horas_default_tarde, notas)
select
  'TR-GUILLO',
  'Guillotina',
  'troquelado',
  true,
  95,
  8,
  8,
  'Alta automática desde Recursos de Producción'
where not exists (
  select 1
  from public.prod_maquinas
  where lower(btrim(codigo)) = 'tr-guillo'
);
