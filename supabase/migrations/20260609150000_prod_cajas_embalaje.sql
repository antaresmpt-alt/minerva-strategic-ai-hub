-- Mini-maestro de cajas de embalaje (MN1L, MN2L, MN2N, BP2L...).
-- Sirve para informar por defecto cuántos bultos por palet europeo lleva
-- cada caja (valor orientativo de Gabri, editable por OT en Engomado).

create table if not exists public.prod_cajas_embalaje (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  descripcion text null,
  bultos_por_palet_default integer null,
  con_logo boolean null,
  activo boolean not null default true,
  orden integer not null default 0,
  notas text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  created_by_email text null
);

-- Un código de caja solo puede existir una vez (case-insensitive).
create unique index if not exists prod_cajas_embalaje_codigo_uq
  on public.prod_cajas_embalaje (lower(codigo));

create index if not exists prod_cajas_embalaje_activo_orden_idx
  on public.prod_cajas_embalaje (activo, orden, codigo);

alter table public.prod_cajas_embalaje enable row level security;

-- Lectura para cualquier usuario autenticado (la usa Engomado).
drop policy if exists "read cajas embalaje authenticated" on public.prod_cajas_embalaje;
create policy "read cajas embalaje authenticated"
  on public.prod_cajas_embalaje
  for select
  to authenticated
  using (true);

-- Escrituras solo vía service-role (API admin), sin policy para usuarios normales.

comment on table public.prod_cajas_embalaje is
  'Maestro de cajas de embalaje. bultos_por_palet_default es el valor orientativo por defecto; se puede ajustar por OT en el proceso de Engomado.';
comment on column public.prod_cajas_embalaje.codigo is
  'Código corto interno de la caja (ej: MN2L = Minerva tipo 2, L = con logo; N = anónima).';
comment on column public.prod_cajas_embalaje.descripcion is
  'Descripción incluyendo medidas (ej: Embalaje MN2L logo 425x305x211 int).';
comment on column public.prod_cajas_embalaje.bultos_por_palet_default is
  'Bultos por palet europeo por defecto (orientativo). No siempre es fijo: algunos clientes admiten más/menos altura.';
comment on column public.prod_cajas_embalaje.con_logo is
  'true = caja con logo Minerva (L); false = caja anónima/neutra (N).';
