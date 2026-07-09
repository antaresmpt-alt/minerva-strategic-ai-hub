-- Bloque 9 — Sync Optimus: last_seen_in_optimus_import_at
-- Permite saber qué palets se vieron en el último import de Optimus.
-- Los que llevan más de N días sin aparecer en el Excel son candidatos a "desaparecidos".

alter table public.prod_stock_palets
  add column if not exists last_seen_in_optimus_import_at timestamptz null;

comment on column public.prod_stock_palets.last_seen_in_optimus_import_at is
  'Última vez que este palet apareció en un import del Excel de Optimus. '
  'NULL = palet creado en Minerva (no viene de Optimus) o import previo a esta migración. '
  'Palets Optimus ausentes en importaciones sucesivas se detectan comparando esta fecha.';

create index if not exists idx_prod_stock_palets_last_seen_optimus
  on public.prod_stock_palets (last_seen_in_optimus_import_at)
  where last_seen_in_optimus_import_at is not null;
