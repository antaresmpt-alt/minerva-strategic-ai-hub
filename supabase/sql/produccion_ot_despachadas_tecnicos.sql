-- Campos técnicos opcionales para despachos (troquel / poses / acabado).
-- Ejecutar en Supabase SQL si aún no existen las columnas.
-- Nota: en muchos proyectos la columna ya se llama `troquel` (no `codigo_troquel`).

ALTER TABLE produccion_ot_despachadas
  ADD COLUMN IF NOT EXISTS troquel text,
  ADD COLUMN IF NOT EXISTS poses integer,
  ADD COLUMN IF NOT EXISTS acabado_pral text;
