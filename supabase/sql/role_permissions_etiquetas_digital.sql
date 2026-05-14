-- Módulo Etiquetas digital (`etiquetas_digital` en Hub / middleware).
-- Ejecutar en Supabase SQL Editor (o migración) si ya existe `public.role_permissions`.
-- Ajusta is_enabled por rol según política; aquí: acceso típico planificación + impresión digital.

insert into public.role_permissions (role, module_name, is_enabled) values
  ('admin', 'etiquetas_digital', true),
  ('gerencia', 'etiquetas_digital', true),
  ('comercial', 'etiquetas_digital', false),
  ('produccion', 'etiquetas_digital', true),
  ('logistica', 'etiquetas_digital', true),
  ('impresion', 'etiquetas_digital', false),
  ('digital', 'etiquetas_digital', true),
  ('troquelado', 'etiquetas_digital', false),
  ('engomado', 'etiquetas_digital', false),
  ('almacen', 'etiquetas_digital', false),
  ('ctp', 'etiquetas_digital', false),
  ('administracion', 'etiquetas_digital', false),
  ('oficina_tecnica', 'etiquetas_digital', false)
on conflict (role, module_name) do update set
  is_enabled = excluded.is_enabled,
  updated_at = timezone('utc'::text, now());
