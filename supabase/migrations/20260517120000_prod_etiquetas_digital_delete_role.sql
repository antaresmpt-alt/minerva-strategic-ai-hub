-- Permitir DELETE en etiquetas digital al rol digital (hoja de ruta + compras).

drop policy if exists prod_etiquetas_hoja_ruta_delete on public.prod_etiquetas_hoja_ruta;
create policy prod_etiquetas_hoja_ruta_delete
  on public.prod_etiquetas_hoja_ruta for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  );

drop policy if exists prod_etiquetas_compras_delete on public.prod_etiquetas_compras;
create policy prod_etiquetas_compras_delete
  on public.prod_etiquetas_compras for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  );
