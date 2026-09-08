-- Bloque 14: tintas ecológicas (checkbox Sí/No en ficha comercial).

alter table public.prod_referencias
  add column if not exists tintas_ecologicas boolean not null default false;

comment on column public.prod_referencias.tintas_ecologicas is
  'Bloque 14: tintas ecológicas (Sí/No) junto a tintas habituales.';
