-- Sync albarán compra → recepción (+ nota_entrega cartela si placeholder / igual al viejo).
-- KEEP IN SYNC con src/lib/albaran-placeholders.ts (ALBARAN_PLACEHOLDERS / canónico "-").

create or replace function public.prod_albaran_es_placeholder(p_alb text)
returns boolean
language sql
immutable
as $$
  select case
    when p_alb is null then true
    when btrim(p_alb) = '' then true
    when btrim(p_alb) = '-' then true
    when lower(btrim(p_alb)) in ('(sin albarán)', '(sin albaran)') then true
    else false
  end;
$$;

comment on function public.prod_albaran_es_placeholder(text) is
  'KEEP IN SYNC con ALBARAN_PLACEHOLDERS en src/lib/albaran-placeholders.ts';

create or replace function public.prod_sync_recepcion_from_compra()
returns trigger
language plpgsql
as $$
declare
  v_alb text;
  v_alb_old text;
  v_old_raw text;
begin
  if lower(trim(coalesce(new.estado, ''))) <> 'recibido' then
    return new;
  end if;

  v_alb := nullif(trim(coalesce(new.albaran_proveedor, '')), '');
  if v_alb is null or public.prod_albaran_es_placeholder(v_alb) then
    v_alb := '-';
  end if;

  if tg_op = 'INSERT' then
    v_old_raw := null;
    v_alb_old := '-';
  else
    v_old_raw := old.albaran_proveedor;
    v_alb_old := nullif(trim(coalesce(old.albaran_proveedor, '')), '');
    if v_alb_old is null or public.prod_albaran_es_placeholder(v_alb_old) then
      v_alb_old := '-';
    end if;
  end if;

  -- 1) Si no hay recepción, crear (comportamiento histórico).
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
      v_alb,
      coalesce(new.num_hojas_brutas, 0),
      0,
      'Total',
      'Alta automatica desde Compras (sin datos de muelle)',
      null,
      'compras@minervaglobal.es',
      'Dpto. Compras'
    );
  else
    -- 2) Ya hay recepción: propagar albarán desde la compra (fuente de verdad admin).
    update public.prod_recepciones_material r
    set albaran_proveedor = v_alb
    where r.compra_id = new.id
      and coalesce(nullif(trim(coalesce(r.albaran_proveedor, '')), ''), '-')
        is distinct from v_alb;
  end if;

  -- 3) Cartelas: solo si nota_entrega es placeholder o igual al albarán anterior.
  update public.prod_stock_palets p
  set nota_entrega = v_alb
  from public.prod_recepciones_material r
  where p.recepcion_id = r.id
    and r.compra_id = new.id
    and (
      public.prod_albaran_es_placeholder(p.nota_entrega)
      or nullif(trim(coalesce(p.nota_entrega, '')), '') = v_alb_old
      or (
        public.prod_albaran_es_placeholder(v_old_raw)
        and nullif(trim(coalesce(p.nota_entrega, '')), '') = '-'
      )
    )
    and coalesce(nullif(trim(coalesce(p.nota_entrega, '')), ''), '-')
      is distinct from v_alb;

  return new;
end;
$$;

comment on function public.prod_sync_recepcion_from_compra() is
  'Al pasar/editar compra Recibido: crea o actualiza recepción.albarán; sync nota_entrega cartela solo si placeholder o igual al albarán viejo. KEEP IN SYNC placeholders con src/lib/albaran-placeholders.ts';

drop trigger if exists trg_prod_compra_material_sync_recepcion
on public.prod_compra_material;

create trigger trg_prod_compra_material_sync_recepcion
after insert or update of estado, fecha_recepcion, albaran_proveedor, num_hojas_brutas
on public.prod_compra_material
for each row
execute function public.prod_sync_recepcion_from_compra();

-- Backfill una vez: recepciones todavía en placeholder cuando la compra ya tiene albarán real.
update public.prod_recepciones_material r
set albaran_proveedor = btrim(c.albaran_proveedor)
from public.prod_compra_material c
where r.compra_id = c.id
  and lower(trim(coalesce(c.estado, ''))) = 'recibido'
  and public.prod_albaran_es_placeholder(r.albaran_proveedor)
  and not public.prod_albaran_es_placeholder(c.albaran_proveedor);

update public.prod_stock_palets p
set nota_entrega = btrim(c.albaran_proveedor)
from public.prod_recepciones_material r
join public.prod_compra_material c on c.id = r.compra_id
where p.recepcion_id = r.id
  and lower(trim(coalesce(c.estado, ''))) = 'recibido'
  and public.prod_albaran_es_placeholder(p.nota_entrega)
  and not public.prod_albaran_es_placeholder(c.albaran_proveedor);

-- Backfill una vez: recepciones todavía en placeholder cuando la compra ya tiene albarán real.
update public.prod_recepciones_material r
set albaran_proveedor = btrim(c.albaran_proveedor)
from public.prod_compra_material c
where r.compra_id = c.id
  and lower(trim(coalesce(c.estado, ''))) = 'recibido'
  and public.prod_albaran_es_placeholder(r.albaran_proveedor)
  and not public.prod_albaran_es_placeholder(c.albaran_proveedor);

update public.prod_stock_palets p
set nota_entrega = btrim(c.albaran_proveedor)
from public.prod_recepciones_material r
join public.prod_compra_material c on c.id = r.compra_id
where p.recepcion_id = r.id
  and lower(trim(coalesce(c.estado, ''))) = 'recibido'
  and public.prod_albaran_es_placeholder(p.nota_entrega)
  and not public.prod_albaran_es_placeholder(c.albaran_proveedor);
