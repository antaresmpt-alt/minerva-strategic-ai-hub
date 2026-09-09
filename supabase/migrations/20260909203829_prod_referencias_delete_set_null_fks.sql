-- Al borrar un artículo del maestro, desvincular OTs (no bloquear).
-- Asegura ON DELETE SET NULL en despachadas y producidas.

alter table public.produccion_ot_despachadas
  drop constraint if exists produccion_ot_despachadas_referencia_id_fkey;

alter table public.produccion_ot_despachadas
  add constraint produccion_ot_despachadas_referencia_id_fkey
  foreign key (referencia_id)
  references public.prod_referencias(id)
  on delete set null;

alter table public.prod_ot_producidas
  drop constraint if exists prod_ot_producidas_referencia_id_fkey;

alter table public.prod_ot_producidas
  add constraint prod_ot_producidas_referencia_id_fkey
  foreign key (referencia_id)
  references public.prod_referencias(id)
  on delete set null;
