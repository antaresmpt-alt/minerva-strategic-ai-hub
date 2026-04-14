-- Espejo de datos de material con `produccion_ot_despachadas` para la pestaña Compras.
-- Ejecutar en Supabase si la tabla aún no tiene estas columnas.

ALTER TABLE public.prod_compra_material
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS gramaje numeric,
  ADD COLUMN IF NOT EXISTS tamano_hoja text,
  ADD COLUMN IF NOT EXISTS num_hojas_brutas integer;
