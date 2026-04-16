-- Fecha de entrega final pactada con el cliente (OT), manual; comparación con logística de externos.
-- Ejecutar en Supabase SQL si la columna aún no existe.
ALTER TABLE public.prod_seguimiento_externos
  ADD COLUMN IF NOT EXISTS f_entrega_ot timestamptz NULL;

COMMENT ON COLUMN public.prod_seguimiento_externos.f_entrega_ot IS
  'Fecha de entrega final pactada con el cliente para la OT (manual).';
