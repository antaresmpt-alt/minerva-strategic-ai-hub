-- Bloque 9.3 fix — Prorratear coste al partir palet.
-- Antes: la cartela nueva copiaba coste total del padre → valoración inflada.
-- Ahora: coste_nueva = coste * split / actual; padre queda con el resto;
-- cantidad_inicial se alinea al físico residual en ambos.

create or replace function public.prod_stock_split_palet(
  p_palet_id uuid,
  p_cantidad_split integer,
  p_notas text default null
)
returns table(new_palet_id uuid, new_id_stock integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.prod_stock_palets%rowtype;
  v_new_id uuid;
  v_new_id_stock integer;
  v_coste_new numeric(10, 2);
  v_coste_remain numeric(10, 2);
  v_nuevo_actual integer;
begin
  if p_cantidad_split is null or p_cantidad_split <= 0 then
    raise exception 'La cantidad a separar debe ser > 0';
  end if;

  select *
  into v_src
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Palet no encontrado';
  end if;

  if v_src.cantidad_actual <= p_cantidad_split then
    raise exception
      'La cantidad a separar (%) debe ser menor que la cantidad actual (%)',
      p_cantidad_split, v_src.cantidad_actual;
  end if;

  if exists (
    select 1
    from public.prod_stock_palet_ots o
    where o.palet_id = p_palet_id
      and o.cantidad_reservada is not null
      and o.cantidad_reservada > 0
  ) then
    raise exception 'Este palet tiene reservas duras. Quita/ajusta reservas antes de partir.';
  end if;

  if v_src.coste is not null and v_src.cantidad_actual > 0 then
    v_coste_new := round((v_src.coste * p_cantidad_split / v_src.cantidad_actual)::numeric, 2);
    v_coste_remain := round((v_src.coste - v_coste_new)::numeric, 2);
  else
    v_coste_new := null;
    v_coste_remain := v_src.coste;
  end if;

  insert into public.prod_stock_palets (
    tipo_stock,
    unidad,
    recepcion_id,
    compra_id,
    codigo_articulo,
    descripcion_material,
    material_nombre,
    gramaje,
    formato,
    marca,
    cantidad_peso,
    cantidad_peso_unidad,
    cantidad_inicial,
    cantidad_actual,
    ot_destino_numero,
    estado,
    coste,
    ubicacion_fila,
    nota_entrega,
    ref_lote_proveedor,
    ref_lote,
    es_fsc,
    es_pefc,
    fsc_certificado_proveedor,
    pefc_certificado_proveedor,
    notas,
    es_prueba,
    created_by,
    last_seen_in_optimus_import_at
  ) values (
    v_src.tipo_stock,
    v_src.unidad,
    v_src.recepcion_id,
    v_src.compra_id,
    v_src.codigo_articulo,
    v_src.descripcion_material,
    v_src.material_nombre,
    v_src.gramaje,
    v_src.formato,
    v_src.marca,
    v_src.cantidad_peso,
    v_src.cantidad_peso_unidad,
    p_cantidad_split,
    p_cantidad_split,
    v_src.ot_destino_numero,
    v_src.estado,
    v_coste_new,
    v_src.ubicacion_fila,
    v_src.nota_entrega,
    v_src.ref_lote_proveedor,
    v_src.ref_lote,
    v_src.es_fsc,
    v_src.es_pefc,
    v_src.fsc_certificado_proveedor,
    v_src.pefc_certificado_proveedor,
    coalesce(
      nullif(btrim(v_src.notas), ''),
      format('Split 9.3 desde #%s', v_src.id_stock)
    ),
    v_src.es_prueba,
    auth.uid(),
    v_src.last_seen_in_optimus_import_at
  )
  returning id, id_stock into v_new_id, v_new_id_stock;

  update public.prod_stock_palets
  set
    cantidad_actual = cantidad_actual - p_cantidad_split,
    coste = v_coste_remain,
    updated_at = timezone('utc', now())
  where id = p_palet_id
  returning cantidad_actual into v_nuevo_actual;

  update public.prod_stock_palets
  set cantidad_inicial = v_nuevo_actual
  where id = p_palet_id;

  insert into public.prod_stock_palet_ots (palet_id, ot_numero, cantidad_reservada)
  select v_new_id, o.ot_numero, null
  from public.prod_stock_palet_ots o
  where o.palet_id = p_palet_id
  on conflict (palet_id, ot_numero) do nothing;

  insert into public.prod_stock_movimientos (palet_id, tipo, cantidad, notas, created_by)
  values
  (
    p_palet_id,
    'ajuste',
    p_cantidad_split,
    coalesce(
      nullif(btrim(p_notas), ''),
      format('Split 9.3 salida: %s h a nuevo palet #%s', p_cantidad_split, v_new_id_stock)
    ),
    auth.uid()
  ),
  (
    v_new_id,
    'entrada',
    p_cantidad_split,
    coalesce(
      nullif(btrim(p_notas), ''),
      format('Split 9.3 entrada desde #%s', v_src.id_stock)
    ),
    auth.uid()
  );

  new_palet_id := v_new_id;
  new_id_stock := v_new_id_stock;
  return next;
end;
$$;

comment on function public.prod_stock_split_palet(uuid, integer, text) is
  'Bloque 9.3: split físico con prorrateo de coste (origen + nueva cartela) y cantidad_inicial alineada.';

-- Repair one-shot lab #10987/#10988 (split 1700→1400+300 con coste total duplicado).
update public.prod_stock_palets p
set
  coste = round((593.00 * 300 / 1700)::numeric, 2),
  cantidad_inicial = 300,
  updated_at = timezone('utc', now())
where p.id_stock = 10988
  and p.cantidad_actual = 300
  and coalesce(p.coste, 0) >= 590;

update public.prod_stock_palets p
set
  coste = round((593.00 * 1400 / 1700)::numeric, 2),
  cantidad_inicial = 1400,
  updated_at = timezone('utc', now())
where p.id_stock = 10987
  and p.cantidad_actual = 1400;
