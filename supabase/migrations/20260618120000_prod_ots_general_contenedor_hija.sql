-- Bloque 8.0: OT contenedor / hija para pedidos complejos (formas y componentes).
-- Aditivo: todas las OTs existentes quedan como ot_tipo = 'simple'.

alter table public.prod_ots_general
  add column if not exists ot_tipo text not null default 'simple',
  add column if not exists ot_padre_numero text null,
  add column if not exists tipo_hija text null,
  add column if not exists forma_descripcion text null;

comment on column public.prod_ots_general.ot_tipo is
  'Rol de la OT en pedidos complejos: simple (defecto), contenedor (barco/pedido) o hija (unidad de ejecucion).';
comment on column public.prod_ots_general.ot_padre_numero is
  'num_pedido del contenedor padre cuando ot_tipo = hija. Enlace blando (sin FK estricta).';
comment on column public.prod_ots_general.tipo_hija is
  'Subtipo semantico de la hija: forma, componente, preimpresion o acabado.';
comment on column public.prod_ots_general.forma_descripcion is
  'Etiqueta legible de la hija (ej. Hoja exterior, Forma 3).';

alter table public.prod_ots_general
  drop constraint if exists prod_ots_general_ot_tipo_check;

alter table public.prod_ots_general
  add constraint prod_ots_general_ot_tipo_check
  check (ot_tipo in ('simple', 'contenedor', 'hija'));

alter table public.prod_ots_general
  drop constraint if exists prod_ots_general_tipo_hija_check;

alter table public.prod_ots_general
  add constraint prod_ots_general_tipo_hija_check
  check (
    tipo_hija is null
    or tipo_hija in ('forma', 'componente', 'preimpresion', 'acabado')
  );

alter table public.prod_ots_general
  drop constraint if exists prod_ots_general_ot_tipo_hija_consistency_check;

alter table public.prod_ots_general
  add constraint prod_ots_general_ot_tipo_hija_consistency_check
  check (
    (ot_tipo in ('simple', 'contenedor') and ot_padre_numero is null and tipo_hija is null)
    or (ot_tipo = 'hija' and ot_padre_numero is not null and btrim(ot_padre_numero) <> '')
  );

update public.prod_ots_general
set ot_tipo = 'simple'
where ot_tipo is distinct from 'simple'
  and ot_tipo not in ('contenedor', 'hija');

create index if not exists prod_ots_general_ot_padre_numero_idx
  on public.prod_ots_general (ot_padre_numero)
  where ot_padre_numero is not null;

create index if not exists prod_ots_general_ot_tipo_idx
  on public.prod_ots_general (ot_tipo);
