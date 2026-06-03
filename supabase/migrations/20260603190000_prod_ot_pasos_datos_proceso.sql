-- ============================================================================
-- prod_ot_pasos: datos_proceso jsonb (campos específicos por proceso)
-- ----------------------------------------------------------------------------
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- Campo JSONB para almacenar datos específicos de cada proceso de forma flexible:
-- - Guillotina: tamaños, hojas, patrón corte, horas
-- - Impresión Offset: hojas brutas/netas/merma, tintas, acabados, densidades, incidencias
-- - Impresión Digital Plana: hojas, tintas, acabado CLEAR, horas previsto/real
-- - Troquelado: troquel, poses, expulsor, arreglos, horas preparación/tiraje, merma
-- - Engomado: tipo engomado, estuches, tiempo, embalaje, palets
-- - Externo: enlace a módulo Externos (notas sync si procede)
-- - Manipulados Internos: descripción, unidades, tiempo total
-- ============================================================================

alter table public.prod_ot_pasos
  add column if not exists datos_proceso jsonb null default '{}'::jsonb;

comment on column public.prod_ot_pasos.datos_proceso is
  'Datos específicos del proceso (guillotina, offset, digital, troquelado, engomado, externo, manipulados). Campos dinámicos según config TypeScript (previsto/real, cantidades, materiales, incidencias).';

-- Índice GIN para permitir búsquedas eficientes en JSONB si se necesitan reportes avanzados
create index if not exists prod_ot_pasos_datos_proceso_gin_idx
  on public.prod_ot_pasos using gin (datos_proceso);
