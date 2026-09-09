-- Ficha técnica (maestro): bultos por palet habitual.
-- Prefill sugerido desde prod_cajas_embalaje.bultos_por_palet_default al elegir caja;
-- el usuario puede sobrescribirlo. Uds×palet = uds/caja × bultos/palet (calculado en UI/PDF).

alter table public.prod_referencias
  add column if not exists bultos_por_palet_habitual integer null;

comment on column public.prod_referencias.bultos_por_palet_habitual is
  'Bultos (cajas) por palet habitual. Suele venir de prod_cajas_embalaje.bultos_por_palet_default al elegir caja; editable por el usuario.';
