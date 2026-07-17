-- Alinear DELETE del calendario producción con INSERT/UPDATE
-- (antes faltaban almacen y logistica → podían añadir pero no quitar).

drop policy if exists prod_calendario_produccion_ot_delete on public.prod_calendario_produccion_ot;
create policy prod_calendario_produccion_ot_delete
  on public.prod_calendario_produccion_ot for delete
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
            'produccion_ejecucion',
            'almacen',
            'logistica'
          ]
        )
    )
  );
