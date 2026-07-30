-- Calendario: marca manual «hecho» (independiente del semáforo HR).
-- Carlos/Jordi marcan OTs ya impresas/hechas sin usar ejecución al 100%.

alter table public.prod_calendario_produccion_ot
  add column if not exists marcado_hecho boolean not null default false;

alter table public.prod_calendario_produccion_ot
  add column if not exists marcado_hecho_at timestamptz null;

alter table public.prod_calendario_produccion_ot
  add column if not exists marcado_hecho_por uuid null references auth.users (id) on delete set null;

comment on column public.prod_calendario_produccion_ot.marcado_hecho is
  'Marca operativa manual (hecho en área). Independiente del estado del itinerario / semáforo.';

comment on column public.prod_calendario_produccion_ot.marcado_hecho_at is
  'Cuándo se marcó como hecho a mano (null si no marcado).';

comment on column public.prod_calendario_produccion_ot.marcado_hecho_por is
  'Usuario que marcó/desmarcó por última vez como hecho.';
