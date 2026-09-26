-- Revisado y visto bueno 26 sep 2026. Aplicada.
-- prod_ot_entrega_marcar es security definer: sin esta comprobación,
-- cualquier sesión podía marcar o desmarcar una OT y saltarse el RLS.

create or replace function public.prod_ot_entrega_marcar(
  p_num_pedido text,
  p_marcar boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ot text;
  v_id uuid;
  v_proceso integer;
  v_cerrada boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión obligatoria';
  end if;
  if not public.minerva_can_write_stock_articulos() then
    raise exception 'Sin permiso';
  end if;

  v_ot := nullif(btrim(p_num_pedido), '');
  if v_ot is null then
    raise exception 'p_num_pedido obligatorio';
  end if;

  v_proceso := public.prod_ot_entrega_proceso_id();
  if v_proceso is null then
    raise exception 'Falta el proceso Entrega en el catálogo';
  end if;

  select id into v_id
  from public.prod_ots_general
  where num_pedido = v_ot
  for update;

  if not found then
    raise exception 'No existe la OT % en el maestro. Impórtala desde Optimus.', v_ot;
  end if;

  select exists (
    select 1
    from public.prod_ot_producidas
    where ot_numero = v_ot
      and reabierta_at is null
  ) into v_cerrada;

  if coalesce(p_marcar, false) then
    if exists (
      select 1
      from public.prod_ot_pasos
      where ot_id = v_id
        and proceso_id is distinct from v_proceso
    ) then
      raise exception
        'La OT % ya tiene itinerario de planta. No se marca como entrega.', v_ot;
    end if;

    update public.prod_ots_general
    set es_ot_entrega = true, updated_at = now()
    where id = v_id;

    if not v_cerrada and not exists (
      select 1
      from public.prod_ot_pasos
      where ot_id = v_id
        and proceso_id = v_proceso
    ) then
      insert into public.prod_ot_pasos (ot_id, orden, estado, proceso_id, notas_instrucciones)
      values (
        v_id,
        1,
        'disponible',
        v_proceso,
        'Pendiente de salir. María José cierra con Consumir en Stock artículos.'
      );
    end if;
  else
    if v_cerrada then
      raise exception 'La OT % ya está en histórico. No se puede quitar la marca.', v_ot;
    end if;

    update public.prod_ots_general
    set es_ot_entrega = false, updated_at = now()
    where id = v_id;

    delete from public.prod_ot_pasos
    where ot_id = v_id
      and proceso_id = v_proceso
      and estado in ('pendiente', 'disponible');
  end if;
end;
$$;

revoke all on function public.prod_ot_entrega_marcar(text, boolean) from public, anon;
grant execute on function public.prod_ot_entrega_marcar(text, boolean) to authenticated;
