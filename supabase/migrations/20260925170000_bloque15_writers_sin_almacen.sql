-- Bloque 15 — writers sin almacen/administracion.
-- almacen (Juan) = solo muelle/material B9. administracion sin acceso a producción.
-- Revisado Claude 25 sep 2026. Gabri sigue por profiles_capacidades.stock_articulos_write.

create or replace function public.minerva_can_write_stock_articulos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role::text = any (array[
          'admin', 'gerencia', 'oficina_tecnica', 'logistica'
        ])
    )
    or exists (
      select 1 from public.profiles_capacidades c
      where c.user_id = auth.uid()
        and c.capacidad = 'stock_articulos_write'
    );
$$;

comment on function public.minerva_can_write_stock_articulos() is
  'Writers B15: admin|gerencia|oficina_tecnica|logistica '
  'o capacidad stock_articulos_write. Sin almacen ni administracion.';
