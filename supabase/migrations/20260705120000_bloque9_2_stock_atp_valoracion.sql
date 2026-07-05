-- Bloque 9.2 — Reservas parciales (patrón ATP) + valoración + vista de stock.
-- Migración ADITIVA sobre 20260624183000. No rompe datos existentes.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CONTEXTO DE NEGOCIO (caso palet block, real y frecuente)
-- ═══════════════════════════════════════════════════════════════════════════
-- Se pide palet block a proveedor: 1.800 hojas. La OT necesita 1.600.
-- En muelle Juan recibe 1.800 (verdad física), aunque la OC diga 1.600.
--   → 1.600 quedan RESERVADAS a la OT (reserva dura)
--   → 200 quedan LIBRES (calculado)
-- Mismo palet, MISMA cartela. NO se crea una segunda cartela por lógica de
-- reserva: la cartela sigue al palet FÍSICO (patrón LPN de un WMS). Cartela
-- nueva SOLO si el material se separa físicamente (split de palet — fase 9.3).
--
-- MODELO ATP (Available-To-Promise), el que usan los ERP serios del sector:
--   cantidad_fisica    = cantidad_actual (lo que hay encima del palet)
--   reservas activas   = SUM(cantidad_reservada) de prod_stock_palet_ots
--   cantidad_libre     = fisica − reservada   (NUNCA se almacena: se calcula)
-- El estado del palet deja de ser un campo que alguien mantiene a mano y pasa
-- a ser DERIVADO (vista). El estado nunca miente porque nadie lo escribe.

-- ──────────────────────────────────────────
-- 1. prod_stock_palet_ots: cantidad_reservada (patrón ATP)
-- ──────────────────────────────────────────
-- NULL  = reserva BLANDA: el palet "es para esa OT" sin cantidad concreta
--         (caso Ramón, cuestionario D1 — multi-OT sin reparto fijo).
-- Valor = reserva DURA: N hojas comprometidas a esa OT (caso palet block:
--         1.600 hojas → OT 36204). Restan del físico para calcular el libre.

alter table public.prod_stock_palet_ots
  add column if not exists cantidad_reservada integer null;

alter table public.prod_stock_palet_ots
  drop constraint if exists prod_stock_palet_ots_cantidad_reservada_pos_chk;

alter table public.prod_stock_palet_ots
  add constraint prod_stock_palet_ots_cantidad_reservada_pos_chk
  check (cantidad_reservada is null or cantidad_reservada >= 0);

comment on column public.prod_stock_palet_ots.cantidad_reservada is
  'Reserva ATP por OT. NULL = reserva blanda (palet para la OT sin cantidad, '
  'caso Ramón D1). Valor = reserva dura (N hojas comprometidas, caso palet block '
  '1.600→OT). El libre del palet = cantidad_actual − SUM(cantidad_reservada) '
  'donde no es NULL. Ver vista stock_palets_atp.';

-- ──────────────────────────────────────────
-- 2. prod_stock_palets: coste (valoración)
-- ──────────────────────────────────────────
-- Coste TOTAL del palet en euros (mismo concepto que el campo "Coste" de
-- Optimus), no €/hoja. Lo pide dirección (Albert) para la valoración de
-- existencias. Opcional: nullable. NO se gestionan precios en compras.

alter table public.prod_stock_palets
  add column if not exists coste numeric(10, 2) null;

alter table public.prod_stock_palets
  drop constraint if exists prod_stock_palets_coste_nonneg_chk;

alter table public.prod_stock_palets
  add constraint prod_stock_palets_coste_nonneg_chk
  check (coste is null or coste >= 0);

comment on column public.prod_stock_palets.coste is
  'Valoración total del palet en euros (no €/hoja), como el campo Coste de Optimus. '
  'Opcional. Se suma en la vista Stock para la valoración total (dirección).';

-- La columna prod_stock_palets.estado queda como LEGACY. La UI nueva (vista
-- Stock 9.2) usa estado_derivado de stock_palets_atp, que se calcula y nunca
-- se descuadra. No se borra estado por compatibilidad con el wizard/listado
-- existentes y por si hace falta un valor persistido de respaldo.
comment on column public.prod_stock_palets.estado is
  'LEGACY. Estado persistido al crear la cartela. La UI 9.2+ usa '
  'stock_palets_atp.estado_derivado (calculado: agotado/reservado/parcial/disponible). '
  'No mantener a mano; preferir la vista.';

-- ──────────────────────────────────────────
-- 3. Vista stock_palets_atp — fuente única de la vista Stock 9.2
-- ──────────────────────────────────────────
-- Devuelve por palet la foto ATP calculada. NO almacena libre ni estado:
-- siempre derivados. security_invoker=on → respeta las RLS de las tablas base
-- (el usuario ve lo que puede ver en prod_stock_palets).

drop view if exists public.stock_palets_atp;

create view public.stock_palets_atp
with (security_invoker = on)
as
with reservas as (
  select
    palet_id,
    -- Total de hojas en reservas DURAS (con cantidad). Las blandas (NULL) no cuentan.
    coalesce(sum(cantidad_reservada) filter (where cantidad_reservada is not null), 0) as reservada_total,
    count(*) filter (where cantidad_reservada is not null) as reservas_duras,
    count(*) as ots_referenciadas
  from public.prod_stock_palet_ots
  group by palet_id
)
select
  p.id,
  p.id_stock,
  p.tipo_stock,
  p.unidad,
  p.codigo_articulo,
  p.descripcion_material,
  p.material_nombre,
  p.gramaje,
  p.formato,
  p.marca,
  p.ubicacion_fila,
  p.nota_entrega,
  p.ref_lote,
  p.ref_lote_proveedor,
  p.es_fsc,
  p.es_pefc,
  p.coste,
  p.ot_destino_numero,
  p.recepcion_id,
  p.compra_id,
  p.estado as estado_legacy,
  p.cantidad_inicial,
  p.created_at,
  p.updated_at,
  -- ── Foto ATP calculada ──
  p.cantidad_actual                                            as cantidad_fisica,
  coalesce(r.reservada_total, 0)                               as cantidad_reservada_total,
  greatest(p.cantidad_actual - coalesce(r.reservada_total, 0), 0) as cantidad_libre,
  coalesce(r.reservas_duras, 0)                                as reservas_duras,
  coalesce(r.ots_referenciadas, 0)                             as ots_referenciadas,
  -- Aviso de descuadre: reservas duras > físico (p. ej. tras consumir sin
  -- ajustar la reserva). No bloquea; se muestra como alerta en la vista Stock.
  (coalesce(r.reservada_total, 0) > p.cantidad_actual)         as sobre_reservado,
  -- ── Estado derivado (nunca miente) ──
  case
    when p.cantidad_actual <= 0 then 'agotado'
    when coalesce(r.reservada_total, 0) <= 0 then 'disponible'
    when p.cantidad_actual - coalesce(r.reservada_total, 0) <= 0 then 'reservado'
    else 'parcial'
  end                                                          as estado_derivado
from public.prod_stock_palets p
left join reservas r on r.palet_id = p.id;

comment on view public.stock_palets_atp is
  'Vista ATP del stock por palet (Bloque 9.2). cantidad_libre y estado_derivado '
  'SIEMPRE calculados (nunca almacenados). Fuente única de la vista Stock. '
  'security_invoker=on → respeta RLS de prod_stock_palets. Reserva dura = '
  'cantidad_reservada con valor; blanda = NULL (solo referencia de OT).';

grant select on public.stock_palets_atp to authenticated;

-- ──────────────────────────────────────────
-- 4. Nota: tablas MRP legacy huérfanas (NO DROP en esta sesión)
-- ──────────────────────────────────────────
-- El módulo "Almacén MRP" (UI + import Excel) se retira en 9.2 porque no se usa:
-- el stock real es el Bloque 9 (cartelas por palet). Se elimina el CÓDIGO
-- (rutas/componentes/tipos), pero NO se hace DROP de estas tablas por prudencia
-- (contienen datos de un import antiguo de Ramón). Quedan HUÉRFANAS y podrán
-- borrarse en una migración futura tras confirmar que no se necesitan:
--   • public.almacen_materiales           (stock agregado por material)
--   • public.almacen_reservas             (reservas por OT del MRP viejo)
--   • public.almacen_pedidos_transito     (pedidos en tránsito del MRP viejo)
--   • public.almacen_control_inteligente  (vista agregada del MRP viejo)
-- Sustituidas por: prod_stock_palets + prod_stock_palet_ots + stock_palets_atp.
