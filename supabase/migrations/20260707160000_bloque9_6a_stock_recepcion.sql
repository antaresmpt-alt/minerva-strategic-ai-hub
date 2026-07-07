-- Bloque 9.6a — Recepción STOCK sin OC + snapshot material en recepción.
-- Permite cartelar material sin compra (Papers Tordera «STOCK»).

alter table public.prod_recepciones_material
  alter column compra_id drop not null;

alter table public.prod_recepciones_material
  add column if not exists tipo_recepcion text not null default 'oc';

alter table public.prod_recepciones_material
  drop constraint if exists prod_recepciones_material_tipo_recepcion_chk;

alter table public.prod_recepciones_material
  add constraint prod_recepciones_material_tipo_recepcion_chk
  check (tipo_recepcion in ('oc', 'stock_libre'));

alter table public.prod_recepciones_material
  add column if not exists proveedor_id uuid null references public.prod_proveedores(id) on delete set null;

alter table public.prod_recepciones_material
  add column if not exists material_nombre text null,
  add column if not exists gramaje integer null,
  add column if not exists formato text null;

comment on column public.prod_recepciones_material.tipo_recepcion is
  'oc = recepción ligada a compra/OC; stock_libre = material sin OT (Papers Tordera STOCK).';
comment on column public.prod_recepciones_material.material_nombre is
  'Snapshot material en recepción STOCK (sin compra_id).';
comment on column public.prod_recepciones_material.formato is
  'Formato hoja en recepción STOCK (ej. 72×102).';

-- Coherencia: stock_libre no requiere compra; oc suele tener compra_id.
alter table public.prod_recepciones_material
  drop constraint if exists prod_recepciones_material_stock_sin_compra_chk;

alter table public.prod_recepciones_material
  add constraint prod_recepciones_material_stock_sin_compra_chk
  check (
    tipo_recepcion = 'oc'
    or (tipo_recepcion = 'stock_libre' and compra_id is null)
  );
