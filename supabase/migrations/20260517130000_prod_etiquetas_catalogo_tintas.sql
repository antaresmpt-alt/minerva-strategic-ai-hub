-- Catálogo etiquetas digital: categoría «tintas» (colores) para compras + seeds.

alter table public.prod_etiquetas_catalogo
  drop constraint if exists prod_etiquetas_catalogo_categoria_chk;

alter table public.prod_etiquetas_catalogo
  add constraint prod_etiquetas_catalogo_categoria_chk
  check (
    categoria in (
      'producto',
      'equipo',
      'marca',
      'propietario',
      'prioridad',
      'tipo_linea',
      'tintas'
    )
  );

insert into public.prod_etiquetas_catalogo (categoria, grupo, label, orden, activo)
select v.categoria, v.grupo, v.label, v.orden, v.activo
from (
  values
    ('tintas'::text, null::text, 'CYAN'::text, 10, true),
    ('tintas', null, 'MAGENTA', 20, true),
    ('tintas', null, 'YELLOW', 30, true),
    ('tintas', null, 'BLACK', 40, true),
    ('tintas', null, 'WHITE', 50, true)
) as v(categoria, grupo, label, orden, activo)
where not exists (
  select 1
  from public.prod_etiquetas_catalogo e
  where e.categoria = v.categoria
    and coalesce(e.grupo, '') = coalesce(v.grupo, '')
    and lower(e.label) = lower(v.label)
);
