-- Bloque 8.2: tabla de componentes/referencias por hija (forma de imposición).
-- Cada fila = una referencia (código Optimus/cliente) con sus poses en la chapa de esa hija.

create table if not exists public.prod_ot_hija_componentes (
  id uuid primary key default gen_random_uuid(),
  ot_hija_numero text not null,
  referencia_codigo text not null,
  referencia_descripcion text,
  poses_en_forma integer not null check (poses_en_forma > 0),
  cantidad_objetivo integer check (cantidad_objetivo >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  constraint prod_ot_hija_componentes_ot_hija_fk
    foreign key (ot_hija_numero)
    references public.prod_ots_general(num_pedido)
    on delete cascade
);

comment on table public.prod_ot_hija_componentes is
  'Componentes (referencias/modelos) dentro de una OT hija (forma de imposición).
   Bloque 8.2 — wizard despacho contenedor.
   Caso ref: OT 36204 (ampollas, 2 formas, 4 referencias, troquel 4 poses).';

comment on column public.prod_ot_hija_componentes.ot_hija_numero is
  'num_pedido de la OT hija, ej. 36204-01.';
comment on column public.prod_ot_hija_componentes.referencia_codigo is
  'Código de referencia Optimus / cliente, ej. 605212.';
comment on column public.prod_ot_hija_componentes.poses_en_forma is
  'Poses de esta referencia en la chapa (no confundir con poses totales del troquel).';
comment on column public.prod_ot_hija_componentes.cantidad_objetivo is
  'Unidades calculadas: hojas_netas_hija × poses_en_forma.';

create index if not exists prod_ot_hija_componentes_hija_idx
  on public.prod_ot_hija_componentes (ot_hija_numero);

-- RLS: misma política que prod_ot_pasos (autenticados leen/escriben).
alter table public.prod_ot_hija_componentes enable row level security;

create policy "Authenticated users can read hija componentes"
  on public.prod_ot_hija_componentes for select
  to authenticated using (true);

create policy "Authenticated users can insert hija componentes"
  on public.prod_ot_hija_componentes for insert
  to authenticated with check (true);

create policy "Authenticated users can update hija componentes"
  on public.prod_ot_hija_componentes for update
  to authenticated using (true);

create policy "Authenticated users can delete hija componentes"
  on public.prod_ot_hija_componentes for delete
  to authenticated using (true);
