-- ============================================================================
-- Reparación puntual: ejecución finalizada pero itinerario sin avanzar
-- ----------------------------------------------------------------------------
-- Ejecutar en SQL Editor (service role / postgres). Idempotente razonable:
-- cierra el paso ligado si aún no está finalizado y desbloquea el siguiente
-- pendiente. Usa la ejecución más reciente por ot_paso_id si hubiera duplicados.
-- ============================================================================

do $$
declare
  r record;
  v_ot_id uuid;
  v_orden int;
  v_next_id uuid;
  v_now timestamptz;
begin
  for r in
    select distinct on (e.ot_paso_id)
      e.ot_paso_id,
      e.fin_real_at
    from public.prod_mesa_ejecuciones e
    where e.estado_ejecucion = 'finalizada'
      and e.ot_paso_id is not null
    order by e.ot_paso_id, e.fin_real_at desc nulls last, e.updated_at desc
  loop
    v_now := coalesce(r.fin_real_at, timezone('utc'::text, now()));

    update public.prod_ot_pasos p
    set
      estado = 'finalizado'::public.paso_estado,
      fecha_fin = coalesce(p.fecha_fin, v_now)
    where p.id = r.ot_paso_id
      and p.estado is distinct from 'finalizado'::public.paso_estado;

    select p.ot_id, p.orden
      into v_ot_id, v_orden
    from public.prod_ot_pasos p
    where p.id = r.ot_paso_id;

    if v_ot_id is null then
      continue;
    end if;

    select p.id
      into v_next_id
    from public.prod_ot_pasos p
    where p.ot_id = v_ot_id
      and p.estado = 'pendiente'::public.paso_estado
      and p.orden > v_orden
    order by p.orden asc
    limit 1;

    if v_next_id is not null then
      update public.prod_ot_pasos
      set
        estado = 'disponible'::public.paso_estado,
        fecha_disponible = coalesce(fecha_disponible, v_now)
      where id = v_next_id
        and estado = 'pendiente'::public.paso_estado;
    end if;
  end loop;
end;
$$;
