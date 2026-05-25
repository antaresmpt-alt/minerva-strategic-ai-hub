-- =====================================================================
-- Migración: prod_etiquetas_hoja_ruta.troquel_id
-- Descripción: Relación opcional con catálogo de troqueles de etiquetas
-- =====================================================================

alter table public.prod_etiquetas_hoja_ruta
  add column if not exists troquel_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_etiquetas_hoja_ruta_troquel_id_fkey'
      and conrelid = 'public.prod_etiquetas_hoja_ruta'::regclass
  ) then
    alter table public.prod_etiquetas_hoja_ruta
      add constraint prod_etiquetas_hoja_ruta_troquel_id_fkey
      foreign key (troquel_id)
      references public.prod_etiquetas_troqueles(id)
      on delete set null;
  end if;
end $$;

create index if not exists prod_etiquetas_hoja_ruta_troquel_id_idx
  on public.prod_etiquetas_hoja_ruta(troquel_id);

comment on column public.prod_etiquetas_hoja_ruta.troquel_id is
  'Referencia opcional al catálogo public.prod_etiquetas_troqueles. troquel_utillaje se conserva como texto libre/histórico.';
