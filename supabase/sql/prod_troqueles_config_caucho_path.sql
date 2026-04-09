-- Carpeta de PDFs de cauchos (patrón [num_troquel]_*.pdf). Ejecutar en Supabase SQL editor si aún no existe la columna.
alter table public.prod_troqueles_config
  add column if not exists caucho_path text;

comment on column public.prod_troqueles_config.caucho_path is
  'Ruta base en el servidor para archivos de caucho: [num_troquel]_*.pdf';
