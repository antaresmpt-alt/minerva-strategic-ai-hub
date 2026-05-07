create table if not exists public.prod_despacho_catalogo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('material', 'acabado_pral')),
  label text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  created_by_email text null
);

create unique index if not exists idx_prod_despacho_catalogo_tipo_label
  on public.prod_despacho_catalogo (tipo, lower(label));

create index if not exists idx_prod_despacho_catalogo_tipo_activo_orden
  on public.prod_despacho_catalogo (tipo, activo, orden, label);

alter table public.prod_despacho_catalogo enable row level security;

drop policy if exists "read despacho catalogo authenticated" on public.prod_despacho_catalogo;
create policy "read despacho catalogo authenticated"
  on public.prod_despacho_catalogo
  for select
  to authenticated
  using (true);
