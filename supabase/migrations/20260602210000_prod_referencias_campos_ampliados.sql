-- Ampliar prod_referencias con campos maestro de artículos.
-- Todo nullable → cambio aditivo, sin romper nada existente.

alter table public.prod_referencias
  add column if not exists tipo_producto      text null,
  add column if not exists subtipo            text null,
  add column if not exists activo             boolean not null default true,

  -- Dimensiones (mm)
  add column if not exists formato_largo_mm   numeric null,
  add column if not exists formato_ancho_mm   numeric null,
  add column if not exists formato_fondo_mm   numeric null,

  -- Sugerencias técnicas por defecto (pre-rellenan el despacho)
  add column if not exists material_habitual  text null,
  add column if not exists poses_habitual     integer null,
  add column if not exists troquel_habitual   text null,
  add column if not exists tintas_habituales  text null,
  add column if not exists acabado_habitual   text null,
  add column if not exists ruta_habitual      text null,

  -- Trazabilidad (lo actualiza el sistema al cerrar OTs)
  add column if not exists ultima_ot_numero   text null,
  add column if not exists ultima_ot_fecha    date null,
  add column if not exists total_repeticiones integer not null default 0,

  -- Notas libres
  add column if not exists notas              text null;

-- Índices útiles
create index if not exists prod_referencias_tipo_producto_idx
  on public.prod_referencias(tipo_producto);

create index if not exists prod_referencias_activo_idx
  on public.prod_referencias(activo);

-- Índice único compuesto: un par (cliente, referencia_cliente) solo puede aparecer una vez
-- solo cuando ambos campos tienen valor (no afecta a NULL).
create unique index if not exists prod_referencias_cliente_ref_cliente_uq
  on public.prod_referencias(cliente, referencia_cliente)
  where cliente is not null and referencia_cliente is not null;

-- Comentarios de columnas nuevas
comment on column public.prod_referencias.tipo_producto is
  'Tipo de artículo: estuche, etiqueta, prospecto, manual, caja, otro…';
comment on column public.prod_referencias.subtipo is
  'Subtipo libre: automontable, vertical, con ventana…';
comment on column public.prod_referencias.activo is
  'false = referencia discontinuada, no aparece en el picker de despacho.';
comment on column public.prod_referencias.formato_largo_mm is
  'Largo del formato (mm). Sugerencia por defecto para el despacho.';
comment on column public.prod_referencias.formato_ancho_mm is
  'Ancho del formato (mm).';
comment on column public.prod_referencias.formato_fondo_mm is
  'Fondo del formato (mm). Solo estuches.';
comment on column public.prod_referencias.material_habitual is
  'Material habitual (ej: Zenith 300g). Pre-rellena el despacho.';
comment on column public.prod_referencias.poses_habitual is
  'Número de poses habitual. Pre-rellena el despacho.';
comment on column public.prod_referencias.troquel_habitual is
  'Número de troquel habitual (ej: TAG00205). Pre-rellena el despacho.';
comment on column public.prod_referencias.tintas_habituales is
  'Tintas habituales (ej: 4+1). Pre-rellena el despacho.';
comment on column public.prod_referencias.acabado_habitual is
  'Acabado habitual (ej: Barniz AC brillo). Pre-rellena el despacho.';
comment on column public.prod_referencias.ruta_habitual is
  'Ruta habitual de producción (ej: impresion+troquelado+engomado). Pre-rellena el itinerario.';
comment on column public.prod_referencias.ultima_ot_numero is
  'Número de la última OT cerrada para esta referencia. Lo actualiza el sistema automáticamente.';
comment on column public.prod_referencias.ultima_ot_fecha is
  'Fecha de cierre de la última OT. Lo actualiza el sistema.';
comment on column public.prod_referencias.total_repeticiones is
  'Contador de OTs cerradas para esta referencia. Lo incrementa el sistema.';
comment on column public.prod_referencias.notas is
  'Notas libres: incidencias históricas, avisos, observaciones permanentes.';
