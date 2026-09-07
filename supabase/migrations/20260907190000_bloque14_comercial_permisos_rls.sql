-- Bloque 14 — Permisos mínimo comercial: módulo producción ON + RLS acotado.
-- App: solo /produccion/articulos + /produccion/pipeline (middleware).
-- BD: maestro escritura sin delete; pipeline/planta lectura (sin write) para comercial.

-- ── Helpers de rol ───────────────────────────────────────────────────────────
create or replace function public.minerva_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(role::text), '')
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.minerva_profile_role() from public;
grant execute on function public.minerva_profile_role() to authenticated;

create or replace function public.minerva_is_comercial()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.minerva_profile_role(), '') in ('comercial', 'commercial');
$$;

revoke all on function public.minerva_is_comercial() from public;
grant execute on function public.minerva_is_comercial() to authenticated;

comment on function public.minerva_is_comercial() is
  'Bloque 14: true si profiles.role es comercial (para RLS).';

-- ── Matriz Hub: comercial puede entrar al módulo Producción ─────────────────
update public.role_permissions
set is_enabled = true
where role = 'comercial'
  and module_name = 'produccion';

insert into public.role_permissions (role, module_name, is_enabled)
select 'comercial', 'produccion', true
where not exists (
  select 1 from public.role_permissions
  where role = 'comercial' and module_name = 'produccion'
);

-- ── Maestro artículos: comercial NO puede borrar ─────────────────────────────
drop policy if exists "prod_referencias_delete_policy" on public.prod_referencias;
create policy "prod_referencias_delete_policy"
  on public.prod_referencias
  for delete
  to authenticated
  using (
    auth.role() = 'authenticated'
    and not public.minerva_is_comercial()
  );

drop policy if exists "prod_cliente_ficha_delete_policy" on public.prod_cliente_ficha;
create policy "prod_cliente_ficha_delete_policy"
  on public.prod_cliente_ficha
  for delete
  to authenticated
  using (not public.minerva_is_comercial());

drop policy if exists "prod_referencia_adjuntos_delete_policy" on public.prod_referencia_adjuntos;
create policy "prod_referencia_adjuntos_delete_policy"
  on public.prod_referencia_adjuntos
  for delete
  to authenticated
  using (not public.minerva_is_comercial());

-- ── Pipeline / planta: comercial solo SELECT (sin write) ─────────────────────
-- produccion_ot_despachadas (antes ALL)
drop policy if exists "acceso total" on public.produccion_ot_despachadas;
create policy "produccion_ot_despachadas_select_authenticated"
  on public.produccion_ot_despachadas
  for select
  to authenticated
  using (true);
create policy "produccion_ot_despachadas_insert_not_comercial"
  on public.produccion_ot_despachadas
  for insert
  to authenticated
  with check (not public.minerva_is_comercial());
create policy "produccion_ot_despachadas_update_not_comercial"
  on public.produccion_ot_despachadas
  for update
  to authenticated
  using (not public.minerva_is_comercial())
  with check (not public.minerva_is_comercial());
create policy "produccion_ot_despachadas_delete_not_comercial"
  on public.produccion_ot_despachadas
  for delete
  to authenticated
  using (not public.minerva_is_comercial());

-- prod_ots_general (antes ALL)
drop policy if exists "Permitir todo a usuarios autenticados" on public.prod_ots_general;
create policy "prod_ots_general_select_authenticated"
  on public.prod_ots_general
  for select
  to authenticated
  using (auth.role() = 'authenticated');
create policy "prod_ots_general_insert_not_comercial"
  on public.prod_ots_general
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and not public.minerva_is_comercial()
  );
create policy "prod_ots_general_update_not_comercial"
  on public.prod_ots_general
  for update
  to authenticated
  using (
    auth.role() = 'authenticated'
    and not public.minerva_is_comercial()
  )
  with check (
    auth.role() = 'authenticated'
    and not public.minerva_is_comercial()
  );
create policy "prod_ots_general_delete_not_comercial"
  on public.prod_ots_general
  for delete
  to authenticated
  using (
    auth.role() = 'authenticated'
    and not public.minerva_is_comercial()
  );

-- prod_mesa_ejecuciones: reforzar write (select ya existe)
drop policy if exists "prod_mesa_ejecuciones_insert" on public.prod_mesa_ejecuciones;
create policy "prod_mesa_ejecuciones_insert"
  on public.prod_mesa_ejecuciones
  for insert
  to authenticated
  with check (not public.minerva_is_comercial());

drop policy if exists "prod_mesa_ejecuciones_update" on public.prod_mesa_ejecuciones;
create policy "prod_mesa_ejecuciones_update"
  on public.prod_mesa_ejecuciones
  for update
  to authenticated
  using (not public.minerva_is_comercial())
  with check (not public.minerva_is_comercial());

drop policy if exists "prod_mesa_ejecuciones_delete" on public.prod_mesa_ejecuciones;
create policy "prod_mesa_ejecuciones_delete"
  on public.prod_mesa_ejecuciones
  for delete
  to authenticated
  using (not public.minerva_is_comercial());

-- prod_planificacion_pool: write sin comercial
drop policy if exists "plan_pool_insert" on public.prod_planificacion_pool;
create policy "plan_pool_insert"
  on public.prod_planificacion_pool
  for insert
  to authenticated
  with check (not public.minerva_is_comercial());

drop policy if exists "plan_pool_update" on public.prod_planificacion_pool;
create policy "plan_pool_update"
  on public.prod_planificacion_pool
  for update
  to authenticated
  using (not public.minerva_is_comercial())
  with check (not public.minerva_is_comercial());

drop policy if exists "plan_pool_delete" on public.prod_planificacion_pool;
create policy "plan_pool_delete"
  on public.prod_planificacion_pool
  for delete
  to authenticated
  using (not public.minerva_is_comercial());
