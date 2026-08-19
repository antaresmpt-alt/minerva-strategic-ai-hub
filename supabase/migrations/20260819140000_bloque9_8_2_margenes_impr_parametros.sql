-- Bloque 9.8.2 — Márgenes mínimos de impresión para el aviso de formato.
-- Usados por la librería formato-cabe.ts para comprobar si el papel cabe en el troquel.
-- Valores en milímetros. Editables desde Variables Sistema (UI pendiente 9.8.2).

insert into public.sys_parametros (seccion, clave, valor_num, valor_text, descripcion)
values
  ('produccion', 'impr_margen_pinza',    15, null, 'Margen inferior (pinza/agarre) en mm — aviso formato troquel vs papel (9.8.2).'),
  ('produccion', 'impr_margen_superior',  5, null, 'Margen superior en mm — aviso formato troquel vs papel (9.8.2).'),
  ('produccion', 'impr_margen_lateral',  10, null, 'Margen lateral por cada lado en mm — aviso formato troquel vs papel (9.8.2).')
on conflict (clave) do update
  set valor_num   = excluded.valor_num,
      descripcion = excluded.descripcion;
