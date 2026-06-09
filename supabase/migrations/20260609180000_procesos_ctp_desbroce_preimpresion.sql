-- ============================================================================
-- Tres nuevos procesos: CTP/Preimpresión (área preimpresion), Desbroce (área
-- engomado) y ajuste de Manipulados (área engomado).
-- + 5ª área de planificación "preimpresion" en ambas tablas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) prod_procesos_cat: ampliar tipo_planificacion → añadir 'preimpresion'
-- ---------------------------------------------------------------------------
alter table public.prod_procesos_cat
  drop constraint if exists prod_procesos_cat_tipo_planificacion_check;

alter table public.prod_procesos_cat
  add constraint prod_procesos_cat_tipo_planificacion_check
  check (
    tipo_planificacion is null
    or tipo_planificacion in ('impresion', 'digital', 'troquelado', 'engomado', 'preimpresion')
  );

-- ---------------------------------------------------------------------------
-- 2) prod_maquinas: ampliar tipo_maquina → añadir 'preimpresion' y 'digital'
--    (DROP + ADD por si el constraint fue creado sin nombre explícito)
-- ---------------------------------------------------------------------------
alter table public.prod_maquinas
  drop constraint if exists prod_maquinas_tipo_maquina_check;

alter table public.prod_maquinas
  add constraint prod_maquinas_tipo_maquina_check
  check (
    tipo_maquina in ('impresion', 'digital', 'troquelado', 'engomado', 'preimpresion')
  );

-- ---------------------------------------------------------------------------
-- 3) Proceso CTP / Preimpresión  (id 16 — hueco libre entre 15 y 17)
-- ---------------------------------------------------------------------------
insert into public.prod_procesos_cat
  (id, nombre, seccion_slug, tipo_planificacion, es_externo, orden_sugerido, activo)
select
  16,
  'CTP / Preimpresión',
  'preimpresion',
  'preimpresion',
  false,
  5,
  true
where not exists (
  select 1 from public.prod_procesos_cat where id = 16
);

update public.prod_procesos_cat
set
  nombre             = 'CTP / Preimpresión',
  seccion_slug       = 'preimpresion',
  tipo_planificacion = 'preimpresion',
  es_externo         = false,
  orden_sugerido     = 5,
  activo             = true
where id = 16;

-- ---------------------------------------------------------------------------
-- 4) Proceso Desbroce  (id 22 — después de Guillotina 17 + etiquetas 18-21)
-- ---------------------------------------------------------------------------
insert into public.prod_procesos_cat
  (id, nombre, seccion_slug, tipo_planificacion, es_externo, orden_sugerido, activo)
select
  22,
  'Desbroce',
  'engomado',
  'engomado',
  false,
  122,
  true
where not exists (
  select 1 from public.prod_procesos_cat where id = 22
);

update public.prod_procesos_cat
set
  nombre             = 'Desbroce',
  seccion_slug       = 'engomado',
  tipo_planificacion = 'engomado',
  es_externo         = false,
  orden_sugerido     = 122,
  activo             = true
where id = 22;

-- ---------------------------------------------------------------------------
-- 5) Proceso Manipulados (id 15): mover a área engomado
-- ---------------------------------------------------------------------------
update public.prod_procesos_cat
set
  seccion_slug       = 'engomado',
  tipo_planificacion = 'engomado'
where id = 15;

-- ---------------------------------------------------------------------------
-- 6) Sincronizar secuencia (evita colisión futura al insertar desde Settings)
-- ---------------------------------------------------------------------------
do $$
declare
  v_max_id integer;
  v_seq    text;
begin
  select max(id) into v_max_id from public.prod_procesos_cat;
  select pg_get_serial_sequence('prod_procesos_cat', 'id') into v_seq;
  if v_seq is not null and v_max_id is not null then
    perform setval(v_seq, greatest(v_max_id, 100));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Máquinas nuevas
-- ---------------------------------------------------------------------------
insert into public.prod_maquinas
  (codigo, nombre, tipo_maquina, activa, orden_visual,
   capacidad_horas_default_manana, capacidad_horas_default_tarde, notas)
select
  'CTP-MNRV', 'CTP MNRV', 'preimpresion', true, 10, 8, 8,
  'Área de CTP / Preimpresión. Alta automática.'
where not exists (
  select 1 from public.prod_maquinas where lower(btrim(codigo)) = 'ctp-mnrv'
);

insert into public.prod_maquinas
  (codigo, nombre, tipo_maquina, activa, orden_visual,
   capacidad_horas_default_manana, capacidad_horas_default_tarde, notas)
select
  'ENG-DESBROZ', 'Desbroce MNRV', 'engomado', true, 30, 8, 8,
  'Mesa de desbroce (paso previo a engomado). Alta automática.'
where not exists (
  select 1 from public.prod_maquinas where lower(btrim(codigo)) = 'eng-desbroz'
);

insert into public.prod_maquinas
  (codigo, nombre, tipo_maquina, activa, orden_visual,
   capacidad_horas_default_manana, capacidad_horas_default_tarde, notas)
select
  'ENG-MANIP', 'Manipulados MNRV', 'engomado', true, 40, 8, 8,
  'Mesa de manipulados varios internos (incluye retractilado). Alta automática.'
where not exists (
  select 1 from public.prod_maquinas where lower(btrim(codigo)) = 'eng-manip'
);
