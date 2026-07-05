-- Cartelas de prueba (sandbox): Id Stock ≥ 99000, secuencia aparte, sync producción acotado.

alter table public.prod_stock_palets
  add column if not exists es_prueba boolean not null default false;

comment on column public.prod_stock_palets.es_prueba is
  'true = cartela sandbox (Id ≥ 99000). No se machaca con import Optimus; oculta por defecto en Stock.';

create index if not exists idx_prod_stock_palets_es_prueba
  on public.prod_stock_palets (es_prueba)
  where es_prueba = true;

-- Secuencia sandbox (independiente de prod_stock_id_stock_seq).
create sequence if not exists public.prod_stock_id_stock_sandbox_seq
  start with 99000
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create or replace function public.next_id_stock_sandbox()
returns integer
language sql
security definer
set search_path = public
as $$
  select nextval('public.prod_stock_id_stock_sandbox_seq')::integer;
$$;

comment on function public.next_id_stock_sandbox() is
  'Siguiente Id Stock para cartelas de prueba (sandbox ≥ 99000).';

grant execute on function public.next_id_stock_sandbox() to authenticated;
grant usage on sequence public.prod_stock_id_stock_sandbox_seq to authenticated;

-- Sync producción: ignora sandbox (evita subir la secuencia real a 99xxx).
create or replace function public.prod_stock_sync_id_stock_seq()
returns bigint
language sql
security definer
set search_path = public
as $$
  select setval(
    'prod_stock_id_stock_seq',
    greatest(
      coalesce(
        (select max(id_stock) from public.prod_stock_palets where id_stock < 99000),
        10309
      ),
      10309
    )
  );
$$;

comment on function public.prod_stock_sync_id_stock_seq() is
  'Tras import Optimus, alinea prod_stock_id_stock_seq al MAX(id_stock) producción (< 99000).';

-- Vista ATP: exponer es_prueba para filtros en Stock 9.2.
drop view if exists public.stock_palets_atp;

create view public.stock_palets_atp
with (security_invoker = on)
as
with reservas as (
  select
    palet_id,
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
  p.es_prueba,
  p.cantidad_actual                                            as cantidad_fisica,
  coalesce(r.reservada_total, 0)                               as cantidad_reservada_total,
  greatest(p.cantidad_actual - coalesce(r.reservada_total, 0), 0) as cantidad_libre,
  coalesce(r.reservas_duras, 0)                                as reservas_duras,
  coalesce(r.ots_referenciadas, 0)                             as ots_referenciadas,
  (coalesce(r.reservada_total, 0) > p.cantidad_actual)         as sobre_reservado,
  case
    when p.cantidad_actual <= 0 then 'agotado'
    when coalesce(r.reservada_total, 0) <= 0 then 'disponible'
    when p.cantidad_actual - coalesce(r.reservada_total, 0) <= 0 then 'reservado'
    else 'parcial'
  end                                                          as estado_derivado
from public.prod_stock_palets p
left join reservas r on r.palet_id = p.id;

comment on view public.stock_palets_atp is
  'Vista ATP del stock por palet (Bloque 9.2). Incluye es_prueba para ocultar sandbox en UI.';

grant select on public.stock_palets_atp to authenticated;

-- Alinear sandbox seq si ya hay pruebas.
select setval(
  'prod_stock_id_stock_sandbox_seq',
  greatest(
    coalesce(
      (select max(id_stock) from public.prod_stock_palets where id_stock >= 99000),
      98999
    ),
    98999
  )
);
