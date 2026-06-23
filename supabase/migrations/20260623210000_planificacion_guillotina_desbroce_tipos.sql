-- Áreas de planificación dedicadas: Guillotina y Desbroce (filtro Pool "Próximo paso").

alter table public.prod_procesos_cat
  drop constraint if exists prod_procesos_cat_tipo_planificacion_check;

alter table public.prod_procesos_cat
  add constraint prod_procesos_cat_tipo_planificacion_check
  check (
    tipo_planificacion is null
    or tipo_planificacion in (
      'impresion',
      'digital',
      'troquelado',
      'engomado',
      'preimpresion',
      'guillotina',
      'desbroce'
    )
  );

alter table public.prod_maquinas
  drop constraint if exists prod_maquinas_tipo_maquina_check;

alter table public.prod_maquinas
  add constraint prod_maquinas_tipo_maquina_check
  check (
    tipo_maquina in (
      'impresion',
      'digital',
      'troquelado',
      'engomado',
      'preimpresion',
      'guillotina',
      'desbroce'
    )
  );

update public.prod_procesos_cat
set tipo_planificacion = 'guillotina'
where lower(btrim(nombre)) = 'guillotina';

update public.prod_procesos_cat
set tipo_planificacion = 'desbroce'
where lower(btrim(nombre)) in ('desbroce', 'desbrozar');

update public.prod_maquinas
set tipo_maquina = 'guillotina'
where lower(btrim(codigo)) = 'tr-guillo'
   or lower(btrim(nombre)) like '%guillotina%';

update public.prod_maquinas
set tipo_maquina = 'desbroce'
where lower(btrim(codigo)) in ('eng-desbroz', 'desbroce-mnrv')
   or lower(btrim(nombre)) like '%desbroz%';
