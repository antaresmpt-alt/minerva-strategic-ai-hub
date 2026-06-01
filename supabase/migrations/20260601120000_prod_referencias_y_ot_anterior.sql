-- =====================================================================
-- Migración: Referencias Minerva + enlaces blandos de repetición + líneas de material flexibles
-- Fase 0 — Cimientos de la Hoja de Ruta e Inteligencia de Repeticiones
--
-- IMPORTANTE: Esta migración es 100% ADITIVA.
--   - Crea tablas nuevas (prod_referencias, prod_despacho_materiales_lineas).
--   - Añade columnas NULLABLE a produccion_ot_despachadas.
-- No renombra, borra ni modifica nada existente, por lo que NO afecta a los
-- procesos actuales (etiquetas, externos, compras, despacho).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabla maestra de Referencias Minerva (agrupador de productos/modelos)
-- ---------------------------------------------------------------------
create table if not exists public.prod_referencias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descripcion text,
  cliente text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists prod_referencias_codigo_idx
  on public.prod_referencias(codigo);

create index if not exists prod_referencias_cliente_idx
  on public.prod_referencias(cliente);

create or replace function public.update_prod_referencias_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists prod_referencias_updated_at_trigger
  on public.prod_referencias;

create trigger prod_referencias_updated_at_trigger
  before update on public.prod_referencias
  for each row
  execute function public.update_prod_referencias_updated_at();

alter table public.prod_referencias enable row level security;

create policy "prod_referencias_select_policy"
  on public.prod_referencias
  for select
  using (auth.role() = 'authenticated');

create policy "prod_referencias_insert_policy"
  on public.prod_referencias
  for insert
  with check (auth.role() = 'authenticated');

create policy "prod_referencias_update_policy"
  on public.prod_referencias
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "prod_referencias_delete_policy"
  on public.prod_referencias
  for delete
  using (auth.role() = 'authenticated');

comment on table public.prod_referencias is
  'Referencias Minerva: agrupador de productos/modelos que comparten todas las repeticiones de una misma faena. Motor de la inteligencia de repeticiones (histórico, medias ponderadas).';
comment on column public.prod_referencias.codigo is
  'Código de referencia Minerva (ej: M-00001). Único. Independiente del código del cliente.';
comment on column public.prod_referencias.descripcion is
  'Descripción del producto/modelo (ej: estuche biform morfotipos).';
comment on column public.prod_referencias.cliente is
  'Cliente asociado a la referencia (informativo).';

-- ---------------------------------------------------------------------
-- 2) Enlaces blandos de repetición en produccion_ot_despachadas
-- ---------------------------------------------------------------------
alter table public.produccion_ot_despachadas
  add column if not exists referencia_id uuid null;

alter table public.produccion_ot_despachadas
  add column if not exists ot_anterior_numero text null;

alter table public.produccion_ot_despachadas
  add column if not exists ot_anterior_id uuid null;

-- FK a prod_referencias: integridad sin bloqueo (al borrar referencia, se desvincula).
-- No usamos FK para ot_anterior_id porque puede apuntar a OT históricas (archivo físico)
-- que todavía no existen en el sistema.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produccion_ot_despachadas_referencia_id_fkey'
  ) then
    alter table public.produccion_ot_despachadas
      add constraint produccion_ot_despachadas_referencia_id_fkey
      foreign key (referencia_id)
      references public.prod_referencias(id)
      on delete set null;
  end if;
end$$;

create index if not exists produccion_ot_despachadas_referencia_id_idx
  on public.produccion_ot_despachadas(referencia_id);

create index if not exists produccion_ot_despachadas_ot_anterior_numero_idx
  on public.produccion_ot_despachadas(ot_anterior_numero);

comment on column public.produccion_ot_despachadas.referencia_id is
  'Enlace a prod_referencias. Agrupador real de repeticiones; base del histórico y futuras medias ponderadas de horas.';
comment on column public.produccion_ot_despachadas.ot_anterior_numero is
  'Número de OT anterior escrito a mano (referencia de negocio). Puntero opcional para clonar de una OT concreta.';
comment on column public.produccion_ot_despachadas.ot_anterior_id is
  'Enlace blando (uuid, sin FK estricto) a prod_ots_general.id si la OT anterior ya existe en el sistema. Nunca bloquea el guardado.';

-- ---------------------------------------------------------------------
-- 3) Líneas de material flexibles del despacho (tabla hija)
--    Para casos especiales: varios papeles, mermas, procesos no estándar.
--    Tabla hija (no JSONB) para poder consultar y agregar en el futuro.
-- ---------------------------------------------------------------------
create table if not exists public.prod_despacho_materiales_lineas (
  id uuid primary key default gen_random_uuid(),
  ot_numero text not null,
  tipo text,
  descripcion text,
  cantidad numeric,
  unidad text,
  orden integer default 0,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists prod_despacho_materiales_lineas_ot_numero_idx
  on public.prod_despacho_materiales_lineas(ot_numero);

create or replace function public.update_prod_despacho_materiales_lineas_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists prod_despacho_materiales_lineas_updated_at_trigger
  on public.prod_despacho_materiales_lineas;

create trigger prod_despacho_materiales_lineas_updated_at_trigger
  before update on public.prod_despacho_materiales_lineas
  for each row
  execute function public.update_prod_despacho_materiales_lineas_updated_at();

alter table public.prod_despacho_materiales_lineas enable row level security;

create policy "prod_despacho_materiales_lineas_select_policy"
  on public.prod_despacho_materiales_lineas
  for select
  using (auth.role() = 'authenticated');

create policy "prod_despacho_materiales_lineas_insert_policy"
  on public.prod_despacho_materiales_lineas
  for insert
  with check (auth.role() = 'authenticated');

create policy "prod_despacho_materiales_lineas_update_policy"
  on public.prod_despacho_materiales_lineas
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "prod_despacho_materiales_lineas_delete_policy"
  on public.prod_despacho_materiales_lineas
  for delete
  using (auth.role() = 'authenticated');

comment on table public.prod_despacho_materiales_lineas is
  'Líneas de material/proceso flexibles asociadas a una OT del despacho. Permite casos especiales (varios papeles, mermas, procesos no estándar) sin romper las columnas analíticas core de produccion_ot_despachadas.';
comment on column public.prod_despacho_materiales_lineas.ot_numero is
  'OT (num_pedido) a la que pertenece la línea. Enlaza con produccion_ot_despachadas.ot_numero.';
comment on column public.prod_despacho_materiales_lineas.tipo is
  'Tipo de línea: material, tinta, proceso_especial, merma, otro.';
comment on column public.prod_despacho_materiales_lineas.descripcion is
  'Descripción libre de la línea (ej: Zenith 300g, UV 3D zona logo).';
comment on column public.prod_despacho_materiales_lineas.cantidad is
  'Cantidad numérica opcional.';
comment on column public.prod_despacho_materiales_lineas.unidad is
  'Unidad de la cantidad (hojas, kg, m, ud).';
comment on column public.prod_despacho_materiales_lineas.orden is
  'Orden de visualización dentro de la OT.';
