-- Bloque 9.3 — Sobrantes: ajuste manual y split de palet (atómico).

-- Ajuste manual de cantidad física de un palet.
create or replace function public.prod_stock_ajustar_cantidad(
  p_palet_id uuid,
  p_nueva_cantidad integer,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual integer;
  v_delta integer;
begin
  if p_nueva_cantidad is null or p_nueva_cantidad < 0 then
    raise exception 'La nueva cantidad debe ser >= 0';
  end if;

  select cantidad_actual
  into v_actual
  from public.prod_stock_palets
  where id = p_palet_id
  for update;

  if not found then
    raise exception 'Palet no encontrado';
  end if;

  v_delta := abs(p_nueva_cantidad - v_actual);

  if v_delta = 0 then
    return;
  end if;

  update public.prod_stock_palets
  set
    cantidad_actual = p_nueva_cantidad,
    updated_at = timezone('utc', now())
  where id = p_palet_id;

  insert into public.prod_stock_movimientos (
    palet_id,
    tipo,
    cantidad,
    notas,
    created_by
  ) values (
    p_palet_id,
    'ajuste',
    v_delta,
    coalesce(
      nullif(btrim(p_notas), ''),
      format('Ajuste manual 9.3: %s h -> %s h', v_actual, p_nueva_cantidad)
    ),
    auth.uid()
  );
end;
$$;

comment on function public.prod_stock_ajustar_cantidad(uuid, integer, text) is
  'Bloque 9.3: ajuste manual de cantidad_actual con movimiento tipo ajuste.';

grant execute on function public.prod_stock_ajustar_cantidad(uuid, integer, text)
  to authenticated;

-- Split físico de palet:
-- - reduce cantidad del palet origen
-- - crea nuevo palet con mismo material y nueva cantidad
-- - copia referencias OT en blando (cantidad_reservada = NULL)
-- - registra movimientos tipo ajuste en ambos palets
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

  -- v1 9.3: solo split si no hay reservas duras (evita duplicar compromisos ATP).
  if exists (
    select 1
    from public.prod_stock_palet_ots o
    where o.palet_id = p_palet_id
      and o.cantidad_reservada is not null
      and o.cantidad_reservada > 0
  ) then
    raise exception 'Este palet tiene reservas duras. Quita/ajusta reservas antes de partir.';
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
    v_src.coste,
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
    updated_at = timezone('utc', now())
  where id = p_palet_id;

  -- Copia OTs en blando al nuevo palet para conservar contexto.
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
  'Bloque 9.3: split físico de palet con nueva cartela y movimientos.';

grant execute on function public.prod_stock_split_palet(uuid, integer, text)
  to authenticated;
