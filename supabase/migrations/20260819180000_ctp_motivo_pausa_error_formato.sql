-- Bloque 9.8.2 — Motivo de pausa CTP: error formato papel/cartón detectado en preimpresión.

insert into public.sys_motivos_pausa
  (slug, label, categoria, color_hex, activo, orden, tipos_maquina)
values
  (
    'CTP_ERROR_FORMATO_PAPEL_CARTON',
    'CTP: error formato papel/cartón',
    'calidad',
    '#D97706',
    true,
    255,
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
