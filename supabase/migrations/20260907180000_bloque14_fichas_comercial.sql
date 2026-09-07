-- Bloque 14 — Fichas técnicas comercial / cliente
-- Aditivo: campos ficha en prod_referencias + defaults por cliente + hueco fotos.

-- 1) Campos por artículo (ficha Access / PDF cliente)
alter table public.prod_referencias
  add column if not exists tipo_fondo text,
  add column if not exists peso_unitario numeric,
  add column if not exists foto_producto_path text,
  add column if not exists foto_troquel_path text;

comment on column public.prod_referencias.tipo_fondo is
  'Tipo de fondo del estuche/caja (ficha técnica). Oficina técnica o comercial si lo conoce.';
comment on column public.prod_referencias.peso_unitario is
  'Peso real de 1 unidad acabada (g). Tras 1ª producción; comercial no lo adivina.';
comment on column public.prod_referencias.foto_producto_path is
  'Hueco Bloque 14: path/URL en Storage (foto producto). Upload UI pendiente.';
comment on column public.prod_referencias.foto_troquel_path is
  'Hueco Bloque 14: path/URL perfil troquel (o futuro enlace a prod_troqueles). Upload pendiente.';

-- 2) Defaults fijos por cliente (RGS, temperatura) — no repetir en cada artículo
create table if not exists public.prod_cliente_ficha (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  registro_sanitario text,
  temperatura_conservacion text,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint prod_cliente_ficha_cliente_uq unique (cliente)
);

create index if not exists prod_cliente_ficha_cliente_idx
  on public.prod_cliente_ficha (cliente);

comment on table public.prod_cliente_ficha is
  'Bloque 14: datos ficha técnica a nivel cliente (RGS, temp.). El PDF los hereda.';

create or replace function public.update_prod_cliente_ficha_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists prod_cliente_ficha_updated_at_trigger
  on public.prod_cliente_ficha;
create trigger prod_cliente_ficha_updated_at_trigger
  before update on public.prod_cliente_ficha
  for each row
  execute function public.update_prod_cliente_ficha_updated_at();

alter table public.prod_cliente_ficha enable row level security;

drop policy if exists "prod_cliente_ficha_select_policy" on public.prod_cliente_ficha;
create policy "prod_cliente_ficha_select_policy"
  on public.prod_cliente_ficha for select to authenticated using (true);

drop policy if exists "prod_cliente_ficha_insert_policy" on public.prod_cliente_ficha;
create policy "prod_cliente_ficha_insert_policy"
  on public.prod_cliente_ficha for insert to authenticated with check (true);

drop policy if exists "prod_cliente_ficha_update_policy" on public.prod_cliente_ficha;
create policy "prod_cliente_ficha_update_policy"
  on public.prod_cliente_ficha for update to authenticated using (true) with check (true);

drop policy if exists "prod_cliente_ficha_delete_policy" on public.prod_cliente_ficha;
create policy "prod_cliente_ficha_delete_policy"
  on public.prod_cliente_ficha for delete to authenticated using (true);

-- 3) Tabla adjuntos (fotos / PDF diseño) — estructura lista; UI upload después
create table if not exists public.prod_referencia_adjuntos (
  id uuid primary key default gen_random_uuid(),
  referencia_id uuid not null references public.prod_referencias(id) on delete cascade,
  tipo text not null check (tipo in ('foto_producto', 'perfil_troquel', 'pdf_diseno', 'otro')),
  storage_path text not null,
  public_url text,
  created_by uuid,
  created_at timestamptz default now()
);

create index if not exists prod_referencia_adjuntos_ref_idx
  on public.prod_referencia_adjuntos (referencia_id);

comment on table public.prod_referencia_adjuntos is
  'Bloque 14: adjuntos de ficha (Storage). Preferible a BYTEA en prod_referencias.';

alter table public.prod_referencia_adjuntos enable row level security;

drop policy if exists "prod_referencia_adjuntos_select_policy" on public.prod_referencia_adjuntos;
create policy "prod_referencia_adjuntos_select_policy"
  on public.prod_referencia_adjuntos for select to authenticated using (true);

drop policy if exists "prod_referencia_adjuntos_insert_policy" on public.prod_referencia_adjuntos;
create policy "prod_referencia_adjuntos_insert_policy"
  on public.prod_referencia_adjuntos for insert to authenticated with check (true);

drop policy if exists "prod_referencia_adjuntos_update_policy" on public.prod_referencia_adjuntos;
create policy "prod_referencia_adjuntos_update_policy"
  on public.prod_referencia_adjuntos for update to authenticated using (true) with check (true);

drop policy if exists "prod_referencia_adjuntos_delete_policy" on public.prod_referencia_adjuntos;
create policy "prod_referencia_adjuntos_delete_policy"
  on public.prod_referencia_adjuntos for delete to authenticated using (true);
