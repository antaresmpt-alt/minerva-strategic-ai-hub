-- ============================================================================
-- RLS: catálogo de procesos, itinerario por OT, plantillas de ruta
-- ----------------------------------------------------------------------------
-- prod_maquinas ya tiene políticas en prod_mesa_secuenciacion.sql.
-- Idempotente: DROP POLICY IF EXISTS + CREATE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- prod_procesos_cat
-- ---------------------------------------------------------------------------
alter table public.prod_procesos_cat enable row level security;

drop policy if exists prod_procesos_cat_select_authenticated on public.prod_procesos_cat;
create policy prod_procesos_cat_select_authenticated
  on public.prod_procesos_cat for select
  to authenticated
  using (true);

drop policy if exists prod_procesos_cat_insert_admin_gerencia on public.prod_procesos_cat;
create policy prod_procesos_cat_insert_admin_gerencia
  on public.prod_procesos_cat for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

drop policy if exists prod_procesos_cat_update_admin_gerencia on public.prod_procesos_cat;
create policy prod_procesos_cat_update_admin_gerencia
  on public.prod_procesos_cat for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

drop policy if exists prod_procesos_cat_delete_admin_gerencia on public.prod_procesos_cat;
create policy prod_procesos_cat_delete_admin_gerencia
  on public.prod_procesos_cat for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

-- ---------------------------------------------------------------------------
-- prod_rutas_plantilla
-- ---------------------------------------------------------------------------
alter table public.prod_rutas_plantilla enable row level security;

drop policy if exists prod_rutas_plantilla_select_authenticated on public.prod_rutas_plantilla;
create policy prod_rutas_plantilla_select_authenticated
  on public.prod_rutas_plantilla for select
  to authenticated
  using (true);

drop policy if exists prod_rutas_plantilla_insert_admin_gerencia on public.prod_rutas_plantilla;
create policy prod_rutas_plantilla_insert_admin_gerencia
  on public.prod_rutas_plantilla for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

drop policy if exists prod_rutas_plantilla_update_admin_gerencia on public.prod_rutas_plantilla;
create policy prod_rutas_plantilla_update_admin_gerencia
  on public.prod_rutas_plantilla for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

drop policy if exists prod_rutas_plantilla_delete_admin_gerencia on public.prod_rutas_plantilla;
create policy prod_rutas_plantilla_delete_admin_gerencia
  on public.prod_rutas_plantilla for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

-- ---------------------------------------------------------------------------
-- prod_rutas_plantilla_pasos
-- ---------------------------------------------------------------------------
alter table public.prod_rutas_plantilla_pasos enable row level security;

drop policy if exists prod_rutas_plantilla_pasos_select_authenticated
  on public.prod_rutas_plantilla_pasos;
create policy prod_rutas_plantilla_pasos_select_authenticated
  on public.prod_rutas_plantilla_pasos for select
  to authenticated
  using (true);

drop policy if exists prod_rutas_plantilla_pasos_insert_admin_gerencia
  on public.prod_rutas_plantilla_pasos;
create policy prod_rutas_plantilla_pasos_insert_admin_gerencia
  on public.prod_rutas_plantilla_pasos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

drop policy if exists prod_rutas_plantilla_pasos_update_admin_gerencia
  on public.prod_rutas_plantilla_pasos;
create policy prod_rutas_plantilla_pasos_update_admin_gerencia
  on public.prod_rutas_plantilla_pasos for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

drop policy if exists prod_rutas_plantilla_pasos_delete_admin_gerencia
  on public.prod_rutas_plantilla_pasos;
create policy prod_rutas_plantilla_pasos_delete_admin_gerencia
  on public.prod_rutas_plantilla_pasos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

-- ---------------------------------------------------------------------------
-- prod_ot_pasos
-- ---------------------------------------------------------------------------
alter table public.prod_ot_pasos enable row level security;

drop policy if exists prod_ot_pasos_select_authenticated on public.prod_ot_pasos;
create policy prod_ot_pasos_select_authenticated
  on public.prod_ot_pasos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'impresion',
            'digital',
            'troquelado',
            'engomado',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_ot_pasos_insert_produccion_plus on public.prod_ot_pasos;
create policy prod_ot_pasos_insert_produccion_plus
  on public.prod_ot_pasos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  );

drop policy if exists prod_ot_pasos_update_produccion_plus on public.prod_ot_pasos;
create policy prod_ot_pasos_update_produccion_plus
  on public.prod_ot_pasos for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  );

drop policy if exists prod_ot_pasos_delete_admin_gerencia on public.prod_ot_pasos;
create policy prod_ot_pasos_delete_admin_gerencia
  on public.prod_ot_pasos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );
