-- Parámetros de semáforo OT / Compras (umbrales en días naturales hasta f_entrega).
-- Ejecutar en Supabase SQL Editor si la tabla no existe o faltan filas.

create table if not exists public.sys_parametros (
  id uuid primary key default gen_random_uuid(),
  seccion text not null,
  clave text not null unique,
  valor_num numeric,
  descripcion text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.sys_parametros (seccion, clave, valor_num, descripcion) values
  (
    'Producción',
    'produccion_ots_compras_dias_critico_rojo',
    14,
    'Días hasta la entrega OT: umbral inclusive para semáforo rojo (urgencia máxima).'
  ),
  (
    'Producción',
    'produccion_ots_compras_dias_aviso_naranja',
    25,
    'Días hasta la entrega OT: hasta este valor (inclusive) aplica semáforo naranja si ya superó el umbral rojo.'
  ),
  (
    'Producción',
    'produccion_ots_compras_sobrestock_umbral',
    30,
    'Si los días hasta la entrega superan este valor, se muestra el aviso de sobrestock (icono € junto a la OT).'
  )
on conflict (clave) do update set
  descripcion = excluded.descripcion,
  updated_at = timezone('utc'::text, now());

-- Ajustar RLS según política del proyecto (lectura autenticada / escritura admin).
