-- Hoja de Ruta Virtual: soporte de impresion y detalle util de externos.

alter table public.prod_despacho_materiales_lineas
  add column if not exists soporte_impresion boolean not null default false;

comment on column public.prod_despacho_materiales_lineas.soporte_impresion is
  'Marca la linea de material que debe usarse como soporte principal en impresion. Si no hay ninguna marcada, la UI aplica heuristica.';

alter table public.prod_seguimiento_externos
  add column if not exists hojas_enviadas integer null,
  add column if not exists hojas_recibidas_muelle integer null,
  add column if not exists unidades_recibidas_muelle integer null,
  add column if not exists palets_recibidos_muelle integer null,
  add column if not exists fecha_recepcion_muelle timestamptz null;

comment on column public.prod_seguimiento_externos.hojas_enviadas is
  'Hojas enviadas al proveedor externo (plastificado, contracolado, stamping, etc.).';
comment on column public.prod_seguimiento_externos.hojas_recibidas_muelle is
  'Hojas recibidas de vuelta por muelle. Tiene prioridad informativa sobre la cantidad enviada.';
comment on column public.prod_seguimiento_externos.unidades_recibidas_muelle is
  'Unidades recibidas de vuelta por muelle cuando el externo no se controla por hojas.';
comment on column public.prod_seguimiento_externos.palets_recibidos_muelle is
  'Palets recibidos de vuelta por muelle desde el proveedor externo.';
comment on column public.prod_seguimiento_externos.fecha_recepcion_muelle is
  'Fecha/hora de recepcion fisica en muelle del trabajo externo.';

update public.prod_ot_pasos p
set maquina_id = m.id
from public.prod_maquinas m
where p.proceso_id = 22
  and lower(btrim(m.codigo)) = 'eng-desbroz'
  and p.maquina_id is distinct from m.id;
