-- DRAFT — PENDIENTE REVISIÓN CLAUDE. NO APLICAR EN REMOTO HASTA OK.
-- Bloque 15.1a — editar datos de lote (nunca la cantidad).
--
-- Objetivo: Gabri puede cambiar ubicación, embalaje (bultos, uds/bulto, pico,
-- palets, caja), notas, condición — sin tocar cantidad_actual.
-- Auditoría: movimiento tipo 'ajuste' con cantidad=0 y nota descriptiva.
--
-- Tras OK Claude: renombrar a supabase/migrations/YYYYMMDDHHMMSS_*.sql y aplicar.

create or replace function public.prod_stock_articulos_editar_datos(
  p_stock_id uuid,
  p_ubicacion_fisica text default null,
  p_bultos integer default null,
  p_unidades_por_bulto integer default null,
  p_pico integer default null,
  p_palets numeric default null,
  p_caja_embalaje text default null,
  p_notas text default null,
  p_condicion text default null,
  p_clear_ubicacion boolean default false,
  p_clear_caja_embalaje boolean default false,
  p_clear_notas boolean default false,
  p_clear_condicion boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prod_stock_articulos%rowtype;
  v_parts text[] := array[]::text[];
  v_audit text;
  v_new_ubicacion text;
  v_new_caja text;
  v_new_notas text;
  v_new_condicion text;
  v_new_bultos integer;
  v_new_uds_bulto integer;
  v_new_pico integer;
  v_new_palets numeric;
begin
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso stock_articulos_write';
  end if;
  if p_stock_id is null then
    raise exception 'p_stock_id obligatorio';
  end if;
  if p_unidades_por_bulto is not null and p_unidades_por_bulto <= 0 then
    raise exception 'p_unidades_por_bulto debe ser > 0';
  end if;
  if p_pico is not null and p_pico < 0 then
    raise exception 'p_pico debe ser >= 0';
  end if;
  if p_bultos is not null and p_bultos < 0 then
    raise exception 'p_bultos debe ser >= 0';
  end if;
  if p_palets is not null and p_palets < 0 then
    raise exception 'p_palets debe ser >= 0';
  end if;

  select * into v_row
  from public.prod_stock_articulos
  where id = p_stock_id
  for update;

  if not found then
    raise exception 'Lote no encontrado: %', p_stock_id;
  end if;

  -- null en p_* = no tocar; p_clear_* = poner a null explícitamente.
  v_new_ubicacion := case
    when p_clear_ubicacion then null
    when p_ubicacion_fisica is not null then nullif(btrim(p_ubicacion_fisica), '')
    else v_row.ubicacion_fisica
  end;
  v_new_caja := case
    when p_clear_caja_embalaje then null
    when p_caja_embalaje is not null then nullif(btrim(p_caja_embalaje), '')
    else v_row.caja_embalaje
  end;
  v_new_notas := case
    when p_clear_notas then null
    when p_notas is not null then nullif(btrim(p_notas), '')
    else v_row.notas
  end;
  v_new_condicion := case
    when p_clear_condicion then null
    when p_condicion is not null then nullif(btrim(p_condicion), '')
    else v_row.condicion
  end;
  v_new_bultos := coalesce(p_bultos, v_row.bultos);
  v_new_uds_bulto := coalesce(p_unidades_por_bulto, v_row.unidades_por_bulto);
  v_new_pico := coalesce(p_pico, v_row.pico);
  v_new_palets := coalesce(p_palets, v_row.palets);

  if v_new_ubicacion is distinct from v_row.ubicacion_fisica then
    v_parts := array_append(
      v_parts,
      format(
        'ubicación %s → %s',
        coalesce(v_row.ubicacion_fisica, '∅'),
        coalesce(v_new_ubicacion, '∅')
      )
    );
  end if;
  if v_new_bultos is distinct from v_row.bultos then
    v_parts := array_append(
      v_parts,
      format('bultos %s → %s', coalesce(v_row.bultos::text, '∅'), coalesce(v_new_bultos::text, '∅'))
    );
  end if;
  if v_new_uds_bulto is distinct from v_row.unidades_por_bulto then
    v_parts := array_append(
      v_parts,
      format(
        'uds/bulto %s → %s',
        coalesce(v_row.unidades_por_bulto::text, '∅'),
        coalesce(v_new_uds_bulto::text, '∅')
      )
    );
  end if;
  if v_new_pico is distinct from v_row.pico then
    v_parts := array_append(
      v_parts,
      format('pico %s → %s', coalesce(v_row.pico::text, '∅'), coalesce(v_new_pico::text, '∅'))
    );
  end if;
  if v_new_palets is distinct from v_row.palets then
    v_parts := array_append(
      v_parts,
      format('palets %s → %s', coalesce(v_row.palets::text, '∅'), coalesce(v_new_palets::text, '∅'))
    );
  end if;
  if v_new_caja is distinct from v_row.caja_embalaje then
    v_parts := array_append(
      v_parts,
      format('caja %s → %s', coalesce(v_row.caja_embalaje, '∅'), coalesce(v_new_caja, '∅'))
    );
  end if;
  if v_new_notas is distinct from v_row.notas then
    v_parts := array_append(v_parts, 'notas');
  end if;
  if v_new_condicion is distinct from v_row.condicion then
    v_parts := array_append(v_parts, 'condición');
  end if;

  if coalesce(array_length(v_parts, 1), 0) = 0 then
    raise exception 'Sin cambios en datos del lote';
  end if;

  v_audit := 'Edición datos: ' || array_to_string(v_parts, '; ');

  update public.prod_stock_articulos set
    ubicacion_fisica = v_new_ubicacion,
    bultos = v_new_bultos,
    unidades_por_bulto = v_new_uds_bulto,
    pico = v_new_pico,
    palets = v_new_palets,
    caja_embalaje = v_new_caja,
    notas = v_new_notas,
    condicion = v_new_condicion
  where id = p_stock_id;

  insert into public.prod_stock_articulos_movimientos (
    stock_articulo_id, tipo, cantidad, cantidad_antes, cantidad_despues,
    bultos, notas, created_by
  ) values (
    p_stock_id, 'ajuste', 0, v_row.cantidad_actual, v_row.cantidad_actual,
    v_new_bultos, v_audit, auth.uid()
  );
end;
$$;

revoke all on function public.prod_stock_articulos_editar_datos(
  uuid, text, integer, integer, integer, numeric, text, text, text,
  boolean, boolean, boolean, boolean
) from public, anon;

grant execute on function public.prod_stock_articulos_editar_datos(
  uuid, text, integer, integer, integer, numeric, text, text, text,
  boolean, boolean, boolean, boolean
) to authenticated;

comment on function public.prod_stock_articulos_editar_datos is
  '15.1a: edita metadatos/embalaje del lote; nunca cantidad. Auditoría en movimientos.';
