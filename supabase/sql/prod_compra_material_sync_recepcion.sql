-- Sincroniza compras "Recibido" con recepciones administrativas.
-- Objetivo: evitar compras recibidas sin detalle en prod_recepciones_material.

create or replace function public.prod_sync_recepcion_from_compra()
returns trigger
language plpgsql
as $$
begin
  if lower(trim(coalesce(new.estado, ''))) = 'recibido' then
    if not exists (
      select 1
      from public.prod_recepciones_material r
      where r.compra_id = new.id
    ) then
      insert into public.prod_recepciones_material (
        compra_id,
        fecha_recepcion,
        albaran_proveedor,
        hojas_recibidas,
        palets_recibidos,
        estado_recepcion,
        notas,
        recepcionado_por,
        recepcionado_por_email,
        recepcionado_por_nombre
      )
      values (
        new.id,
        coalesce(new.fecha_recepcion, now()),
        coalesce(nullif(trim(coalesce(new.albaran_proveedor, '')), ''), '-'),
        coalesce(new.num_hojas_brutas, 0),
        0,
        'Total',
        'Alta automatica desde Compras (sin datos de muelle)',
        null,
        'compras@minervaglobal.es',
        'Dpto. Compras'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prod_compra_material_sync_recepcion
on public.prod_compra_material;

create trigger trg_prod_compra_material_sync_recepcion
after insert or update of estado, fecha_recepcion, albaran_proveedor, num_hojas_brutas
on public.prod_compra_material
for each row
execute function public.prod_sync_recepcion_from_compra();

-- Backfill idempotente para compras que ya estaban en "Recibido".
insert into public.prod_recepciones_material (
  compra_id,
  fecha_recepcion,
  albaran_proveedor,
  hojas_recibidas,
  palets_recibidos,
  estado_recepcion,
  notas,
  recepcionado_por,
  recepcionado_por_email,
  recepcionado_por_nombre
)
select
  c.id,
  coalesce(c.fecha_recepcion, now()),
  coalesce(nullif(trim(coalesce(c.albaran_proveedor, '')), ''), '-'),
  coalesce(c.num_hojas_brutas, 0),
  0,
  'Total',
  'Alta automatica desde Compras (sin datos de muelle)',
  null,
  'compras@minervaglobal.es',
  'Dpto. Compras'
from public.prod_compra_material c
where lower(trim(coalesce(c.estado, ''))) = 'recibido'
  and not exists (
    select 1
    from public.prod_recepciones_material r
    where r.compra_id = c.id
  );
