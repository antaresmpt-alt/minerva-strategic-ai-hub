-- Pipeline: índices de lectura para listados por .in() y order/limit reciente.
-- Idempotente. Varios ya existen en prod (ot_paso_id, ot_id/orden, num_pedido, ot_numero);
-- se reafirman aquí y se añade despachado_at para el ORDER BY del Pipeline.

create index if not exists produccion_ot_despachadas_despachado_at_idx
  on public.produccion_ot_despachadas (despachado_at desc nulls last);

create index if not exists prod_mesa_ejecuciones_ot_paso_id_idx
  on public.prod_mesa_ejecuciones (ot_paso_id)
  where ot_paso_id is not null;

create index if not exists prod_seguimiento_externos_ot_paso_id_idx
  on public.prod_seguimiento_externos (ot_paso_id)
  where ot_paso_id is not null;

-- ot_id ya cubierto por unique (ot_id, orden); índice simple por si falta en algún entorno.
create index if not exists prod_ot_pasos_ot_id_idx
  on public.prod_ot_pasos (ot_id);
