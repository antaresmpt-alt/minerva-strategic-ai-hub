-- Persistir el tipo de engomado en el despacho y su valor habitual en el maestro.

alter table public.produccion_ot_despachadas
  add column if not exists tipo_engomado text null;

alter table public.prod_referencias
  add column if not exists tipo_engomado_habitual text null;

comment on column public.produccion_ot_despachadas.tipo_engomado is
  'Tipo de engomado marcado en despacho (catálogo prod_despacho_catalogo tipo=tipo_engomado, admite texto libre). Pre-rellena la tarjeta de Engomado.';
comment on column public.prod_referencias.tipo_engomado_habitual is
  'Tipo de engomado habitual del artículo. Pre-rellena el despacho.';
