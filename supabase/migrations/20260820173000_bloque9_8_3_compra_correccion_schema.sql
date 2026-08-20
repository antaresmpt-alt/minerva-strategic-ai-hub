-- Bloque 9.8.3 — Compra de corrección
-- Añade campos para marcar una compra como corrección de otra compra fallida,
-- y registrar el motivo del STOP material.

-- 1. Enum tipo de compra
create type public.compra_tipo as enum ('normal', 'correccion');

-- 2. Columnas nuevas en prod_compra_material
alter table public.prod_compra_material
  add column if not exists tipo public.compra_tipo not null default 'normal',
  add column if not exists compra_origen_id uuid,
  add column if not exists motivo text;

-- 3. FK a la compra origen (opcional)
alter table public.prod_compra_material
  add constraint fk_compra_origen
  foreign key (compra_origen_id)
  references public.prod_compra_material(id)
  on delete set null;

-- 4. Índice para buscar correcciones de una compra
create index if not exists idx_prod_compra_material_compra_origen_id
  on public.prod_compra_material(compra_origen_id)
  where compra_origen_id is not null;

comment on column public.prod_compra_material.tipo is
  'Tipo de compra: normal (por defecto) o correccion (cuando se recompra tras STOP material)';

comment on column public.prod_compra_material.compra_origen_id is
  'UUID de la compra original que falló (solo si tipo=correccion)';

comment on column public.prod_compra_material.motivo is
  'Notas sobre el motivo del STOP / corrección (ej: formato equivocado, material defectuoso)';
