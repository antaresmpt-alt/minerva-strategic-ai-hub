-- Fichas técnicas de impresión (Producción).
-- Ejecutar en Supabase SQL Editor. Ajusta políticas RLS al mismo criterio que el resto de tablas prod_*.

create table if not exists public.prod_fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  ot integer not null,
  cliente text not null default '',
  trabajo text not null default '',
  gramaje text,
  tipo_material text,
  formato text,
  pasadas text,
  tipo_impresion text,
  densidad_1 numeric,
  densidad_2 numeric,
  densidad_3 numeric,
  densidad_4 numeric,
  densidad_5 numeric,
  densidad_6 numeric,
  densidad_7 numeric,
  densidad_8 numeric,
  notas text,
  ruta_backup text,
  fecha date,
  maquinista text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_fichas_tecnicas_ot_key unique (ot)
);

create index if not exists prod_fichas_tecnicas_created_at_idx
  on public.prod_fichas_tecnicas (created_at desc);

comment on table public.prod_fichas_tecnicas is
  'Fichas técnicas de impresión; una fila por OT (upsert por ot).';

comment on column public.prod_fichas_tecnicas.ruta_backup is
  'Ruta de backup / adjuntos en red local (copiar al portapapeles).';
