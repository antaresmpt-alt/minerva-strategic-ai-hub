-- ============================================================================
-- Roles de sección: digital | troquelado | engomado
-- ----------------------------------------------------------------------------
-- Idempotente razonable: DROP POLICY IF EXISTS + CREATE; INSERT … ON CONFLICT.
-- Ejecutar en Supabase SQL Editor (proyecto ya desplegado) después del deploy
-- del Hub que incluye esos valores en PROFILE_ROLES.
--
-- Si `public.profiles.role` es un ENUM de Postgres, añade primero los valores:
--   alter type <nombre_tipo_role> add value if not exists 'digital';
--   (repite troquelado, engomado — el nombre del tipo varía por proyecto)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Permisos dinámicos del Hub (misma matriz que rol `produccion`)
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, module_name, is_enabled) values
  ('digital', 'sales', false), ('digital', 'sem', false), ('digital', 'seo', false), ('digital', 'muelle', false),
  ('digital', 'produccion', true), ('digital', 'produccion_ejecucion', true), ('digital', 'chat', true), ('digital', 'settings', false),
  ('troquelado', 'sales', false), ('troquelado', 'sem', false), ('troquelado', 'seo', false), ('troquelado', 'muelle', false),
  ('troquelado', 'produccion', true), ('troquelado', 'produccion_ejecucion', true), ('troquelado', 'chat', true), ('troquelado', 'settings', false),
  ('engomado', 'sales', false), ('engomado', 'sem', false), ('engomado', 'seo', false), ('engomado', 'muelle', false),
  ('engomado', 'produccion', true), ('engomado', 'produccion_ejecucion', true), ('engomado', 'chat', true), ('engomado', 'settings', false)
on conflict (role, module_name) do update set
  is_enabled = excluded.is_enabled,
  updated_at = timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- 2) Itinerario: lectura de pasos por OT para secciones
-- ---------------------------------------------------------------------------
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
            'engomado'
          ]
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Mesa APS: CRUD completo para responsables de sección (no solo tablet)
-- ---------------------------------------------------------------------------
drop policy if exists plan_mesa_seccion_select on public.prod_mesa_planificacion_trabajos;
drop policy if exists plan_mesa_seccion_insert on public.prod_mesa_planificacion_trabajos;
drop policy if exists plan_mesa_seccion_update on public.prod_mesa_planificacion_trabajos;
drop policy if exists plan_mesa_seccion_delete on public.prod_mesa_planificacion_trabajos;

create policy plan_mesa_seccion_select
  on public.prod_mesa_planificacion_trabajos for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

create policy plan_mesa_seccion_insert
  on public.prod_mesa_planificacion_trabajos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

create policy plan_mesa_seccion_update
  on public.prod_mesa_planificacion_trabajos for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

create policy plan_mesa_seccion_delete
  on public.prod_mesa_planificacion_trabajos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

-- ---------------------------------------------------------------------------
-- 3b) Pool de planificación: mismo ámbito que mesa por sección (enviar a mesa)
-- ---------------------------------------------------------------------------
drop policy if exists plan_pool_seccion_select on public.prod_planificacion_pool;
drop policy if exists plan_pool_seccion_insert on public.prod_planificacion_pool;
drop policy if exists plan_pool_seccion_update on public.prod_planificacion_pool;

create policy plan_pool_seccion_select
  on public.prod_planificacion_pool for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

create policy plan_pool_seccion_insert
  on public.prod_planificacion_pool for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

create policy plan_pool_seccion_update
  on public.prod_planificacion_pool for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['digital', 'troquelado', 'engomado'])
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Ejecuciones de mesa + motivos de pausa + pausas
-- ---------------------------------------------------------------------------
drop policy if exists prod_mesa_ejecuciones_select on public.prod_mesa_ejecuciones;
drop policy if exists prod_mesa_ejecuciones_insert on public.prod_mesa_ejecuciones;
drop policy if exists prod_mesa_ejecuciones_update on public.prod_mesa_ejecuciones;
drop policy if exists prod_mesa_ejecuciones_delete on public.prod_mesa_ejecuciones;

create policy prod_mesa_ejecuciones_select
  on public.prod_mesa_ejecuciones for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

create policy prod_mesa_ejecuciones_insert
  on public.prod_mesa_ejecuciones for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

create policy prod_mesa_ejecuciones_update
  on public.prod_mesa_ejecuciones for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

create policy prod_mesa_ejecuciones_delete
  on public.prod_mesa_ejecuciones for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );

drop policy if exists sys_motivos_pausa_select on public.sys_motivos_pausa;

create policy sys_motivos_pausa_select
  on public.sys_motivos_pausa for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

drop policy if exists prod_mesa_ejecuciones_pausas_select on public.prod_mesa_ejecuciones_pausas;
drop policy if exists prod_mesa_ejecuciones_pausas_insert on public.prod_mesa_ejecuciones_pausas;
drop policy if exists prod_mesa_ejecuciones_pausas_update on public.prod_mesa_ejecuciones_pausas;
drop policy if exists prod_mesa_ejecuciones_pausas_delete on public.prod_mesa_ejecuciones_pausas;

create policy prod_mesa_ejecuciones_pausas_select
  on public.prod_mesa_ejecuciones_pausas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

create policy prod_mesa_ejecuciones_pausas_insert
  on public.prod_mesa_ejecuciones_pausas for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

create policy prod_mesa_ejecuciones_pausas_update
  on public.prod_mesa_ejecuciones_pausas for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'impresion', 'digital', 'troquelado', 'engomado']
        )
    )
  );

create policy prod_mesa_ejecuciones_pausas_delete
  on public.prod_mesa_ejecuciones_pausas for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );
