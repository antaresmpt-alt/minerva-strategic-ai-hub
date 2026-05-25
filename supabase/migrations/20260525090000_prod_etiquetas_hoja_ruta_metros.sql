-- Etiquetas digital - Hoja de ruta: campo "metros de impresión" (Konica).
-- Cantidad de metros de papel consumidos en la impresión. Se solicita en la
-- UI cuando el usuario marca konica = true (tabla escritorio o vista muelle).
-- Nullable para datos históricos.

alter table public.prod_etiquetas_hoja_ruta
  add column if not exists metros_impresion numeric null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_etiquetas_hoja_ruta_metros_nonneg_chk'
      and conrelid = 'public.prod_etiquetas_hoja_ruta'::regclass
  ) then
    alter table public.prod_etiquetas_hoja_ruta
      add constraint prod_etiquetas_hoja_ruta_metros_nonneg_chk
      check (metros_impresion is null or metros_impresion >= 0);
  end if;
end $$;

comment on column public.prod_etiquetas_hoja_ruta.metros_impresion is
  'Metros de papel consumidos en impresión Konica. Se pide cuando se marca konica = true.';
