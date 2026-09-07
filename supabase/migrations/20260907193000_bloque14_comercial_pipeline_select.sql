-- Bloque 14: comercial puede LEER itinerario (pasos + ejecuciones) para Pipeline RO.

drop policy if exists "prod_ot_pasos_select_authenticated" on public.prod_ot_pasos;
create policy "prod_ot_pasos_select_authenticated"
  on public.prod_ot_pasos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'impresion',
            'digital',
            'troquelado',
            'engomado',
            'logistica',
            'ctp',
            'comercial'
          ]
        )
    )
  );

drop policy if exists "prod_mesa_ejecuciones_select" on public.prod_mesa_ejecuciones;
create policy "prod_mesa_ejecuciones_select"
  on public.prod_mesa_ejecuciones
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'impresion',
            'digital',
            'troquelado',
            'engomado',
            'ctp',
            'comercial'
          ]
        )
    )
  );
