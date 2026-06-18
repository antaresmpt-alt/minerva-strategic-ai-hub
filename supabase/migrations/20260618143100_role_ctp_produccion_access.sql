-- Rol CTP (Marc/Gemma): acceso a planificación y ejecución de producción.
-- El rol en profiles es `ctp` (no existe `preimpresion` como rol de usuario).

UPDATE public.role_permissions
SET is_enabled = true
WHERE role = 'ctp'
  AND module_name IN ('produccion', 'produccion_ejecucion');

INSERT INTO public.role_permissions (role, module_name, is_enabled)
SELECT 'ctp', m.module_name, true
FROM (VALUES ('produccion'), ('produccion_ejecucion')) AS m(module_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_permissions rp
  WHERE rp.role = 'ctp' AND rp.module_name = m.module_name
);
