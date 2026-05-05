-- Pool: SELECT/INSERT/UPDATE para digital, troquelado, engomado (misma matriz que mesa por sección).

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
