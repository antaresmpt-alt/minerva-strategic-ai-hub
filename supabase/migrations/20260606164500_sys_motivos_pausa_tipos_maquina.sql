-- ============================================================================
-- sys_motivos_pausa: ámbito por tipo de máquina
-- ----------------------------------------------------------------------------
-- NULL / array vacío = motivo universal, visible en todos los tipos.
-- Array con tipos = visible solo en esas máquinas/procesos de planificación.
-- ============================================================================

alter table public.sys_motivos_pausa
  add column if not exists tipos_maquina text[] null;

comment on column public.sys_motivos_pausa.tipos_maquina is
  'Tipos de máquina/proceso donde aplica el motivo de pausa. NULL o array vacío = universal. Ej.: {impresion,digital,troquelado,engomado}.';

update public.sys_motivos_pausa
set tipos_maquina = array['impresion', 'digital']::text[]
where slug in (
  'AJUSTE_COLOR',
  'AJUSTE_REGISTRO',
  'AJUSTE_BARNIZ',
  'FALTA_TINTAS_PANTONE',
  'REPINTE_SECADO'
);

update public.sys_motivos_pausa
set tipos_maquina = array['impresion']::text[]
where slug in (
  'ESPERANDO_PLANCHAS'
);
