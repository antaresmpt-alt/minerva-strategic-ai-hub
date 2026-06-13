-- ============================================================================
-- Etiquetas digital - troqueles:
-- - Hugo no usa cliente/trabajo en el maestro de troqueles.
-- - Se conserva necesita_revision porque sigue disponible como checkbox interno.
-- ============================================================================

drop index if exists public.prod_etiquetas_troqueles_cliente_idx;

alter table public.prod_etiquetas_troqueles
  drop column if exists cliente,
  drop column if exists trabajo;
