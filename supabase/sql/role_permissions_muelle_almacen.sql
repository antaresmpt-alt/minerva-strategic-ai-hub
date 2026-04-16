-- Migración: módulo Muelle + rol almacén (ejecutar en Supabase SQL Editor si ya existe role_permissions).
-- Tras aplicar, crear el usuario en Configuración → Añadir usuario:
--   email: almacen@minervaglobal.es  |  rol: Almacén  |  contraseña: (la que defina gerencia)

insert into public.role_permissions (role, module_name, is_enabled) values
  ('admin', 'muelle', true),
  ('gerencia', 'muelle', true),
  ('comercial', 'muelle', false),
  ('produccion', 'muelle', false),
  ('logistica', 'muelle', false),
  ('ctp', 'muelle', false),
  ('administracion', 'muelle', false),
  ('oficina_tecnica', 'muelle', false),
  ('almacen', 'sales', false), ('almacen', 'sem', false), ('almacen', 'seo', false), ('almacen', 'muelle', true), ('almacen', 'produccion', false), ('almacen', 'chat', true), ('almacen', 'settings', false)
on conflict (role, module_name) do update set
  is_enabled = excluded.is_enabled,
  updated_at = timezone('utc'::text, now());
