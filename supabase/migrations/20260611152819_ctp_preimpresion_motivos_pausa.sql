-- ============================================================================
-- Motivos de pausa específicos para CTP / Preimpresión
-- ----------------------------------------------------------------------------
-- CTP trabaja sobre la máquina virtual CTP-MNRV (tipo_maquina = preimpresion).
-- Estos motivos separan las esperas propias de artes finales, pruebas, troqueles
-- y consumibles CTP de los motivos universales del taller.
-- ============================================================================

insert into public.sys_motivos_pausa
  (slug, label, categoria, color_hex, activo, orden, tipos_maquina)
values
  (
    'CTP_ESPERANDO_APROBACION_CLIENTE',
    'CTP: esperando aprobación cliente / BAT',
    'calidad',
    '#7C3AED',
    true,
    240,
    array['preimpresion']::text[]
  ),
  (
    'CTP_ESPERANDO_ARCHIVOS_ARTE_FINAL',
    'CTP: esperando archivos / arte final',
    'suministros',
    '#2563EB',
    true,
    140,
    array['preimpresion']::text[]
  ),
  (
    'CTP_PREFLIGHT_FALLIDO',
    'CTP: archivo defectuoso / preflight fallido',
    'calidad',
    '#7C3AED',
    true,
    250,
    array['preimpresion']::text[]
  ),
  (
    'CTP_ESPERANDO_VALIDACION_TROQUEL',
    'CTP: esperando validación de troquel / plano',
    'suministros',
    '#2563EB',
    true,
    150,
    array['preimpresion']::text[]
  ),
  (
    'CTP_ESPERANDO_COLOR_PANTONE',
    'CTP: esperando referencia color / Pantone',
    'suministros',
    '#2563EB',
    true,
    160,
    array['preimpresion']::text[]
  ),
  (
    'CTP_AVERIA_RIP_CTP',
    'CTP: avería CTP / RIP',
    'tecnicos',
    '#DC2626',
    true,
    340,
    array['preimpresion']::text[]
  ),
  (
    'CTP_CALIBRACION_LINEALIZACION',
    'CTP: calibración / linealización',
    'tecnicos',
    '#DC2626',
    true,
    350,
    array['preimpresion']::text[]
  ),
  (
    'CTP_FALTA_PLANCHAS_CONSUMIBLES',
    'CTP: falta planchas / consumibles',
    'suministros',
    '#2563EB',
    true,
    170,
    array['preimpresion']::text[]
  ),
  (
    'CTP_CONSULTA_TECNICA',
    'CTP: consulta técnica producción / comercial',
    'operativos',
    '#6B7280',
    true,
    40,
    array['preimpresion']::text[]
  )
on conflict (slug) do update
set
  label = excluded.label,
  categoria = excluded.categoria,
  color_hex = excluded.color_hex,
  activo = excluded.activo,
  orden = excluded.orden,
  tipos_maquina = excluded.tipos_maquina,
  updated_at = timezone('utc'::text, now());
