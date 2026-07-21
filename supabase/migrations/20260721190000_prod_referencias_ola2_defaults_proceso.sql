-- Ola 2 Fase 2 Maestro de Artículos (21 jul 2026)
-- Añade campo defaults_proceso jsonb para guardar configuración estable
-- por proceso (CTP, guillotina, externos) desde el wizard de despacho.
-- Solo datos estables por artículo — prohibido hojas ini/fin/brutas/netas y horas.

alter table public.prod_referencias
  add column if not exists defaults_proceso jsonb null;

comment on column public.prod_referencias.defaults_proceso is
  'Configuración habitual por proceso (CTP checks, guillotina patrón/tamaño, externos acabado).
   Estructura: { ctp?: Record<CtpHechoKey, bool>, guillotina?: { patron_corte, tamano_final },
   externos?: Record<procesoId, { acabado_detalle, acabado_cara, acabado_dorso }> }.
   Solo campos estables por artículo, nunca cantidades ni horas (esos van en Bloque 6.x).';
