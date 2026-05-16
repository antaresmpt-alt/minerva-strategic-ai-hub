#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
values = (ROOT / "supabase/migrations/_etiquetas_material_seed_values.sql").read_text(
    encoding="utf-8"
)

ddl = """-- Catálogo material proveedor (Adestor / Fedrigoni) — consulta en Etiquetas digital.
-- Seed: Catalogo_Consolidado_MERGED_Adestor_Fedrigoni.xlsx (171 filas).

create table if not exists public.prod_etiquetas_material_catalogo (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  categoria text null,
  item_number text not null,
  face_name text null,
  adhesive text null,
  backing text null,
  price_m2 numeric(12, 4) null,
  ean_code text null,
  notes text null,
  stock_dimensions text null,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_material_catalogo_marca_chk
    check (marca in ('ADESTOR', 'FEDRIGONI'))
);

create index if not exists idx_prod_etiquetas_material_marca
  on public.prod_etiquetas_material_catalogo (marca, activo);

create index if not exists idx_prod_etiquetas_material_item
  on public.prod_etiquetas_material_catalogo (lower(item_number));

comment on table public.prod_etiquetas_material_catalogo is
  'Catálogo técnico Adestor/Fedrigoni para consulta de códigos y EAN (Etiquetas digital).';

create or replace function public.prod_etiquetas_material_catalogo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_material_catalogo_set_updated_at
  on public.prod_etiquetas_material_catalogo;

create trigger prod_etiquetas_material_catalogo_set_updated_at
  before update on public.prod_etiquetas_material_catalogo
  for each row
  execute function public.prod_etiquetas_material_catalogo_set_updated_at();

alter table public.prod_etiquetas_material_catalogo enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_material_catalogo to authenticated;

drop policy if exists prod_etiquetas_material_catalogo_select
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_select
  on public.prod_etiquetas_material_catalogo for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_material_catalogo_insert
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_insert
  on public.prod_etiquetas_material_catalogo for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_material_catalogo_update
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_update
  on public.prod_etiquetas_material_catalogo for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_material_catalogo_delete
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_delete
  on public.prod_etiquetas_material_catalogo for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );

-- Seed idempotente (solo si tabla vacía)
insert into public.prod_etiquetas_material_catalogo (
  marca,
  categoria,
  item_number,
  face_name,
  adhesive,
  backing,
  price_m2,
  ean_code,
  notes,
  stock_dimensions,
  activo
)
select v.marca, v.categoria, v.item_number, v.face_name, v.adhesive, v.backing,
  v.price_m2, v.ean_code, v.notes, v.stock_dimensions, v.activo
from (
  values
"""

footer = """
) as v(
  marca, categoria, item_number, face_name, adhesive, backing,
  price_m2, ean_code, notes, stock_dimensions, activo
)
where not exists (select 1 from public.prod_etiquetas_material_catalogo limit 1);
"""

out_path = ROOT / "supabase/migrations/20260518120000_prod_etiquetas_material_catalogo.sql"
out_path.write_text(ddl + values + footer, encoding="utf-8")
print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
