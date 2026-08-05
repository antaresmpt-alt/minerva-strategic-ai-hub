-- Etiquetas digital — Hoja de ruta: "PDF OK" informativo (gestión Hugo).
-- Marcado por OT (1 check por OT). Se guarda la fecha cuando se hace tick.

alter table public.prod_etiquetas_hoja_ruta
  add column if not exists pdf_ok boolean not null default false;

alter table public.prod_etiquetas_hoja_ruta
  add column if not exists fecha_pdf_ok date null;

do $$
begin
  -- Consistencia: si pdf_ok=true entonces fecha_pdf_ok debe existir;
  -- si pdf_ok=false entonces fecha_pdf_ok debe ser NULL.
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_etiquetas_hoja_ruta_pdf_ok_fecha_consistency_chk'
      and conrelid = 'public.prod_etiquetas_hoja_ruta'::regclass
  ) then
    alter table public.prod_etiquetas_hoja_ruta
      add constraint prod_etiquetas_hoja_ruta_pdf_ok_fecha_consistency_chk
      check (
        (pdf_ok = true and fecha_pdf_ok is not null)
        or
        (pdf_ok = false and fecha_pdf_ok is null)
      );
  end if;
end $$;

comment on column public.prod_etiquetas_hoja_ruta.pdf_ok is
  'Marcado por Hugo: PDF aprobado para imprimir (informativo).';

comment on column public.prod_etiquetas_hoja_ruta.fecha_pdf_ok is
  'Fecha (YYYY-MM-DD) en la que Hugo marcó PDF OK. Se rellena al hacer tick.';

