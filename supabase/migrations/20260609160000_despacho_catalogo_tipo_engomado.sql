-- Añadir 'tipo_engomado' como nuevo tipo del catálogo de despacho.
-- Reutiliza la tabla genérica prod_despacho_catalogo (material, acabado_pral)
-- para parametrizar también los tipos de engomado (lista + texto libre en UI).

alter table public.prod_despacho_catalogo
  drop constraint if exists prod_despacho_catalogo_tipo_check;

alter table public.prod_despacho_catalogo
  add constraint prod_despacho_catalogo_tipo_check
  check (tipo in ('material', 'acabado_pral', 'tipo_engomado'));

-- Seed de tipos de engomado (basado en Optimus + extras).
insert into public.prod_despacho_catalogo (tipo, label, orden, activo)
values
  ('tipo_engomado', 'Lineal', 10, true),
  ('tipo_engomado', 'Fondo semiautomático', 20, true),
  ('tipo_engomado', 'Fondo automático', 30, true),
  ('tipo_engomado', 'Lineal con soporte interior 2p', 40, true),
  ('tipo_engomado', 'Pegado 4 puntos', 50, true),
  ('tipo_engomado', 'Pegado 6 puntos', 60, true),
  ('tipo_engomado', 'Pegado 2 solapas', 70, true),
  ('tipo_engomado', 'Pegado de sobre', 80, true),
  ('tipo_engomado', 'Pegado cónico', 90, true),
  ('tipo_engomado', 'Pegado especial', 100, true),
  ('tipo_engomado', 'Pegado compuesto', 110, true)
on conflict (tipo, lower(label)) do nothing;
