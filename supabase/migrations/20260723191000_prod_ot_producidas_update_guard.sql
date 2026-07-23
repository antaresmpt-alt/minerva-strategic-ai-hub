-- Bloque 6 — Inmutabilidad del histórico en UPDATE
--
-- La policy UPDATE permite la fila completa a quien puede cerrar/reabrir.
-- Este trigger limita QUÉ columnas pueden cambiar: solo metadatos de
-- revisión y reapertura. Snapshot y columnas planas quedan inmutables.

create or replace function public.prod_ot_producidas_guard_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Columnas permitidas (metadatos de revisión / reapertura)
  -- Todo lo demás debe ser idéntico al OLD.

  if new.id is distinct from old.id
     or new.ot_numero is distinct from old.ot_numero
     or new.ot_id is distinct from old.ot_id
     or new.referencia_id is distinct from old.referencia_id
     or new.referencia_minerva is distinct from old.referencia_minerva
     or new.referencia_cliente is distinct from old.referencia_cliente
     or new.cliente is distinct from old.cliente
     or new.trabajo is distinct from old.trabajo
     or new.cantidad_pedida is distinct from old.cantidad_pedida
     or new.cantidad_producida is distinct from old.cantidad_producida
     or new.material is distinct from old.material
     or new.gramaje is distinct from old.gramaje
     or new.formato is distinct from old.formato
     or new.tintas is distinct from old.tintas
     or new.troquel is distinct from old.troquel
     or new.poses is distinct from old.poses
     or new.acabado_pral is distinct from old.acabado_pral
     or new.tipo_engomado is distinct from old.tipo_engomado
     or new.codigo_caja_embalaje is distinct from old.codigo_caja_embalaje
     or new.estuches_por_bulto is distinct from old.estuches_por_bulto
     or new.fsc is distinct from old.fsc
     or new.fecha_inicio_real is distinct from old.fecha_inicio_real
     or new.fecha_fin_real is distinct from old.fecha_fin_real
     or new.fecha_cierre is distinct from old.fecha_cierre
     or new.horas_prep_impresion_reales is distinct from old.horas_prep_impresion_reales
     or new.horas_tiraje_impresion_reales is distinct from old.horas_tiraje_impresion_reales
     or new.horas_prep_troquelado_reales is distinct from old.horas_prep_troquelado_reales
     or new.horas_tiraje_troquelado_reales is distinct from old.horas_tiraje_troquelado_reales
     or new.horas_prep_engomado_reales is distinct from old.horas_prep_engomado_reales
     or new.horas_tiraje_engomado_reales is distinct from old.horas_tiraje_engomado_reales
     or new.horas_guillotina_reales is distinct from old.horas_guillotina_reales
     or new.horas_ctp_reales is distinct from old.horas_ctp_reales
     or new.horas_desbroce_reales is distinct from old.horas_desbroce_reales
     or new.horas_total_reales is distinct from old.horas_total_reales
     or new.merma_total is distinct from old.merma_total
     or new.snapshot is distinct from old.snapshot
     or new.snapshot_version is distinct from old.snapshot_version
     or new.version is distinct from old.version
     or new.cerrada_por is distinct from old.cerrada_por
     or new.cerrada_at is distinct from old.cerrada_at
     or new.reabierta_desde_id is distinct from old.reabierta_desde_id
     or new.created_at is distinct from old.created_at
  then
    raise exception
      'prod_ot_producidas es histórico inmutable: solo se pueden actualizar observaciones_revision, excluido_de_promedios, motivo_exclusion, reabierta_at y reabierta_por'
      using errcode = '42501';
  end if;

  -- Reapertura: solo null -> valor (no se puede "des-reabrir" borrando el flag
  -- ni cambiar reabierta_por una vez fijado).
  if old.reabierta_at is not null
     and (new.reabierta_at is distinct from old.reabierta_at
          or new.reabierta_por is distinct from old.reabierta_por)
  then
    raise exception
      'prod_ot_producidas: no se puede modificar una reapertura ya registrada'
      using errcode = '42501';
  end if;

  if old.reabierta_at is null
     and new.reabierta_at is not null
     and new.reabierta_por is null
  then
    raise exception
      'prod_ot_producidas: reabierta_at requiere reabierta_por'
      using errcode = '23502';
  end if;

  return new;
end;
$$;

comment on function public.prod_ot_producidas_guard_update is
  'Bloque 6: whitelist de columnas en UPDATE. Protege snapshot y columnas planas; '
  'solo permite metadatos de revisión y campos de reapertura.';

drop trigger if exists prod_ot_producidas_guard_update_trg on public.prod_ot_producidas;

create trigger prod_ot_producidas_guard_update_trg
  before update on public.prod_ot_producidas
  for each row
  execute function public.prod_ot_producidas_guard_update();
