-- ============================================================================
-- Mesa de Secuenciación multi-máquina (APS)
-- ----------------------------------------------------------------------------
-- Incluye:
-- 1) Snapshot fields + turno en mesa
-- 2) Catálogo de máquinas (prod_maquinas)
-- 3) Relación maquina_id en mesa y capacidades
-- 4) Índices/constraints corregidos (slot único por fecha+turno+máquina)
-- 5) Compatibilidad troquel_status (desconocido/sin_informar)
-- 6) RLS y policies para tabla de máquinas
--
-- Script idempotente (seguro para re-ejecutar).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Mesa: columnas snapshot y turno
-- ---------------------------------------------------------------------------
alter table public.prod_mesa_planificacion_trabajos
  add column if not exists turno text,
  add column if not exists num_hojas_brutas_snapshot integer,
  add column if not exists horas_planificadas_snapshot numeric,
  add column if not exists papel_snapshot text,
  add column if not exists tintas_snapshot text,
  add column if not exists barniz_snapshot text,
  add column if not exists cliente_snapshot text;

update public.prod_mesa_planificacion_trabajos
set turno = case
  when turno is null then null
  when lower(turno) in ('mañana', 'manana', 'm') then 'manana'
  when lower(turno) in ('tarde', 't') then 'tarde'
  else lower(turno)
end;

alter table public.prod_mesa_planificacion_trabajos
  drop constraint if exists prod_mesa_planificacion_trabajos_turno_check;

alter table public.prod_mesa_planificacion_trabajos
  add constraint prod_mesa_planificacion_trabajos_turno_check
  check (turno is null or turno in ('manana', 'tarde'));

alter table public.prod_mesa_planificacion_trabajos
  drop constraint if exists prod_mesa_planificacion_trabajos_estado_mesa_check;

alter table public.prod_mesa_planificacion_trabajos
  add constraint prod_mesa_planificacion_trabajos_estado_mesa_check
  check (estado_mesa in ('borrador', 'confirmado', 'en_ejecucion', 'finalizada'));

create index if not exists prod_mesa_planificacion_trabajos_fecha_turno_idx
  on public.prod_mesa_planificacion_trabajos (fecha_planificada, turno);

create index if not exists prod_mesa_planificacion_trabajos_estado_idx
  on public.prod_mesa_planificacion_trabajos (estado_mesa);

comment on column public.prod_mesa_planificacion_trabajos.turno is
  'Turno asignado (manana | tarde). NULL = sin turno (compat histórica).';
comment on column public.prod_mesa_planificacion_trabajos.num_hojas_brutas_snapshot is
  'Snapshot de hojas brutas planificadas en el momento de mover a la mesa.';
comment on column public.prod_mesa_planificacion_trabajos.horas_planificadas_snapshot is
  'Snapshot de horas planificadas (entrada+tiraje) en el momento de mover a la mesa.';
comment on column public.prod_mesa_planificacion_trabajos.papel_snapshot is
  'Snapshot de papel/material en el momento de mover a la mesa.';
comment on column public.prod_mesa_planificacion_trabajos.tintas_snapshot is
  'Snapshot de tintas (p. ej. 5+0) en el momento de mover a la mesa.';
comment on column public.prod_mesa_planificacion_trabajos.barniz_snapshot is
  'Snapshot de barniz/acabado asociado al impreso (p. ej. Acrílico Mate).';
comment on column public.prod_mesa_planificacion_trabajos.cliente_snapshot is
  'Snapshot del cliente para mostrar en la tarjeta sin joins.';

-- ---------------------------------------------------------------------------
-- 1) Catálogo de máquinas
-- ---------------------------------------------------------------------------
create table if not exists public.prod_maquinas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo_maquina text not null check (tipo_maquina in ('impresion', 'troquelado', 'engomado')),
  activa boolean not null default true,
  orden_visual integer not null default 0,
  capacidad_horas_default_manana numeric not null default 8,
  capacidad_horas_default_tarde numeric not null default 8,
  notas text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid,
  created_by_email text
);

create index if not exists prod_maquinas_tipo_activa_orden_idx
  on public.prod_maquinas (tipo_maquina, activa, orden_visual, nombre);

alter table public.prod_maquinas enable row level security;

drop policy if exists prod_maquinas_select_authenticated on public.prod_maquinas;
drop policy if exists prod_maquinas_insert_authenticated on public.prod_maquinas;
drop policy if exists prod_maquinas_update_authenticated on public.prod_maquinas;
drop policy if exists prod_maquinas_delete_authenticated on public.prod_maquinas;

create policy prod_maquinas_select_authenticated
  on public.prod_maquinas for select
  to authenticated
  using (true);

create policy prod_maquinas_insert_authenticated
  on public.prod_maquinas for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  );

create policy prod_maquinas_update_authenticated
  on public.prod_maquinas for update
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  )
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  );

create policy prod_maquinas_delete_authenticated
  on public.prod_maquinas for delete
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

comment on table public.prod_maquinas is
  'Catálogo de recursos productivos para planificación APS (impresión/troquelado/engomado).';

insert into public.prod_maquinas (codigo, nombre, tipo_maquina, activa, orden_visual)
values
  ('SM-CD102', 'SpeedMaster CD 102', 'impresion', true, 10),
  ('TROQ-DAYUAN', 'Dayuan', 'troquelado', true, 10),
  ('TROQ-JR', 'JR', 'troquelado', true, 20),
  ('ENG-065', 'engomadora 65', 'engomado', true, 10),
  ('ENG-110', 'engomadora 110', 'engomado', true, 20)
on conflict (codigo) do update
set
  nombre = excluded.nombre,
  tipo_maquina = excluded.tipo_maquina,
  activa = excluded.activa,
  orden_visual = excluded.orden_visual,
  updated_at = timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- 2) Mesa: referencia a máquina
-- ---------------------------------------------------------------------------
alter table public.prod_mesa_planificacion_trabajos
  add column if not exists maquina_id uuid;

alter table public.prod_mesa_planificacion_trabajos
  drop constraint if exists prod_mesa_planificacion_trabajos_maquina_id_fkey;

alter table public.prod_mesa_planificacion_trabajos
  add constraint prod_mesa_planificacion_trabajos_maquina_id_fkey
  foreign key (maquina_id) references public.prod_maquinas(id) on delete set null;

with default_machine as (
  select id
  from public.prod_maquinas
  where tipo_maquina = 'impresion'
  order by orden_visual asc, nombre asc
  limit 1
)
update public.prod_mesa_planificacion_trabajos m
set maquina_id = coalesce(
  (
    select pm.id
    from public.prod_maquinas pm
    where lower(trim(pm.nombre)) = lower(trim(coalesce(m.maquina, '')))
       or lower(trim(pm.codigo)) = lower(trim(coalesce(m.maquina, '')))
    limit 1
  ),
  (select id from default_machine)
)
where m.maquina_id is null;

-- ---------------------------------------------------------------------------
-- 3) Capacidad por turno: añadir máquina
-- ---------------------------------------------------------------------------
create table if not exists public.prod_mesa_capacidad_turnos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  turno text not null check (turno in ('manana', 'tarde')),
  capacidad_horas numeric not null default 8,
  motivo_ajuste text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid,
  created_by_email text,
  unique (fecha, turno)
);

alter table public.prod_mesa_capacidad_turnos
  add column if not exists maquina_id uuid;

alter table public.prod_mesa_capacidad_turnos
  drop constraint if exists prod_mesa_capacidad_turnos_maquina_id_fkey;

alter table public.prod_mesa_capacidad_turnos
  add constraint prod_mesa_capacidad_turnos_maquina_id_fkey
  foreign key (maquina_id) references public.prod_maquinas(id) on delete set null;

with default_machine as (
  select id
  from public.prod_maquinas
  where tipo_maquina = 'impresion'
  order by orden_visual asc, nombre asc
  limit 1
)
update public.prod_mesa_capacidad_turnos c
set maquina_id = (select id from default_machine)
where c.maquina_id is null;

alter table public.prod_mesa_capacidad_turnos
  drop constraint if exists prod_mesa_capacidad_turnos_fecha_turno_key;

alter table public.prod_mesa_capacidad_turnos
  add constraint prod_mesa_capacidad_turnos_fecha_turno_maquina_key
  unique (fecha, turno, maquina_id);

create index if not exists prod_mesa_capacidad_turnos_fecha_idx
  on public.prod_mesa_capacidad_turnos (fecha);

create index if not exists prod_mesa_capacidad_turnos_maquina_idx
  on public.prod_mesa_capacidad_turnos (maquina_id);

comment on table public.prod_mesa_capacidad_turnos is
  'Capacidad real (horas) por fecha/turno/máquina para la Mesa APS.';
comment on column public.prod_mesa_capacidad_turnos.capacidad_horas is
  'Horas disponibles en el turno (>=0). Se usa para calcular % de carga.';
comment on column public.prod_mesa_capacidad_turnos.motivo_ajuste is
  'Texto libre para registrar el motivo del ajuste de capacidad.';

alter table public.prod_mesa_capacidad_turnos enable row level security;

drop policy if exists prod_mesa_capacidad_turnos_select_authenticated
  on public.prod_mesa_capacidad_turnos;
drop policy if exists prod_mesa_capacidad_turnos_insert_authenticated
  on public.prod_mesa_capacidad_turnos;
drop policy if exists prod_mesa_capacidad_turnos_update_authenticated
  on public.prod_mesa_capacidad_turnos;
drop policy if exists prod_mesa_capacidad_turnos_delete_authenticated
  on public.prod_mesa_capacidad_turnos;

create policy prod_mesa_capacidad_turnos_select_authenticated
  on public.prod_mesa_capacidad_turnos for select
  to authenticated
  using (true);

create policy prod_mesa_capacidad_turnos_insert_authenticated
  on public.prod_mesa_capacidad_turnos for insert
  to authenticated
  with check (true);

create policy prod_mesa_capacidad_turnos_update_authenticated
  on public.prod_mesa_capacidad_turnos for update
  to authenticated
  using (true)
  with check (true);

create policy prod_mesa_capacidad_turnos_delete_authenticated
  on public.prod_mesa_capacidad_turnos for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4) Índice único de slot (corregido para multi-turno + multi-máquina)
-- ---------------------------------------------------------------------------
drop index if exists public.ux_mesa_fecha_maquina_slot;
drop index if exists public.ux_mesa_fecha_turno_maquina_slot;

create unique index ux_mesa_fecha_turno_maquina_slot
on public.prod_mesa_planificacion_trabajos (
  fecha_planificada,
  turno,
  coalesce(maquina_id::text, ''),
  slot_orden
)
where estado_mesa in ('borrador', 'confirmado', 'en_ejecucion', 'finalizada');

-- Acceso tablet limitado: el rol `impresion` solo puede leer la mesa y marcar
-- como finalizada la OT vinculada cuando cierra una ejecución.
alter table public.prod_mesa_planificacion_trabajos enable row level security;

drop policy if exists plan_mesa_select_impresion
  on public.prod_mesa_planificacion_trabajos;
drop policy if exists plan_mesa_update_impresion_finalizar
  on public.prod_mesa_planificacion_trabajos;

create policy plan_mesa_select_impresion
  on public.prod_mesa_planificacion_trabajos for select
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = 'impresion'
    )
  );

create policy plan_mesa_update_impresion_finalizar
  on public.prod_mesa_planificacion_trabajos for update
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = 'impresion'
    )
  )
  with check (
    estado_mesa = 'finalizada'
    and exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = 'impresion'
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Compatibilidad troquel_status
-- ---------------------------------------------------------------------------
alter table public.prod_mesa_planificacion_trabajos
  drop constraint if exists prod_mesa_planificacion_trabajos_troquel_status_check;

alter table public.prod_mesa_planificacion_trabajos
  add constraint prod_mesa_planificacion_trabajos_troquel_status_check
  check (
    troquel_status is null
    or troquel_status in ('ok', 'falta', 'no_aplica', 'desconocido', 'sin_informar')
  );

alter table public.prod_planificacion_pool
  drop constraint if exists prod_planificacion_pool_troquel_status_check;

alter table public.prod_planificacion_pool
  add constraint prod_planificacion_pool_troquel_status_check
  check (
    troquel_status is null
    or troquel_status in ('ok', 'falta', 'no_aplica', 'desconocido', 'sin_informar')
  );

-- Estado de ciclo de vida en Pool: pendiente -> enviada_mesa -> cerrada.
alter table public.prod_planificacion_pool
  add column if not exists closed_at timestamptz null,
  add column if not exists closed_by uuid null,
  add column if not exists closed_by_email text null;

alter table public.prod_planificacion_pool
  drop constraint if exists prod_planificacion_pool_estado_pool_check;
alter table public.prod_planificacion_pool
  drop constraint if exists prod_planificacion_pool_estado_check;

alter table public.prod_planificacion_pool
  add constraint prod_planificacion_pool_estado_pool_check
  check (estado_pool in ('pendiente', 'enviada_mesa', 'cerrada'));

create index if not exists prod_planificacion_pool_estado_ot_idx
  on public.prod_planificacion_pool (estado_pool, ot_numero);

create index if not exists prod_planificacion_pool_closed_at_idx
  on public.prod_planificacion_pool (closed_at desc);

comment on column public.prod_planificacion_pool.closed_at is
  'Marca temporal de cierre operativo de la OT en Pool.';
comment on column public.prod_planificacion_pool.closed_by is
  'Usuario que cerró la OT en Pool (normalmente al finalizar ejecución).';
comment on column public.prod_planificacion_pool.closed_by_email is
  'Email del usuario que cerró la OT en Pool.';

-- Backfill histórico: cerrar en Pool las OTs que ya figuran como finalizadas.
update public.prod_planificacion_pool p
set
  estado_pool = 'cerrada',
  closed_at = coalesce(
    p.closed_at,
    (
      select max(e.fin_real_at)
      from public.prod_mesa_ejecuciones e
      where e.ot_numero = p.ot_numero
        and e.estado_ejecucion = 'finalizada'
    ),
    timezone('utc'::text, now())
  ),
  notas = coalesce(
    nullif(trim(p.notas), ''),
    'Cerrada automáticamente por backfill de finalizadas'
  )
where p.estado_pool in ('pendiente', 'enviada_mesa')
  and (
    exists (
      select 1
      from public.prod_mesa_planificacion_trabajos m
      where m.ot_numero = p.ot_numero
        and m.estado_mesa = 'finalizada'
    )
    or exists (
      select 1
      from public.prod_mesa_ejecuciones e
      where e.ot_numero = p.ot_numero
        and e.estado_ejecucion = 'finalizada'
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Ejecución manual de OTs en máquina (sin integración Optimus)
-- ---------------------------------------------------------------------------
create table if not exists public.prod_mesa_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  mesa_trabajo_id uuid null references public.prod_mesa_planificacion_trabajos(id) on delete set null,
  ot_numero text not null,
  maquina_id uuid not null references public.prod_maquinas(id),
  fecha_planificada date null,
  turno text null check (turno in ('manana','tarde')),
  slot_orden integer null,
  liberada_at timestamptz null,
  inicio_real_at timestamptz null default timezone('utc'::text, now()),
  fin_real_at timestamptz null,
  estado_ejecucion text not null default 'en_curso'
    check (estado_ejecucion in ('pendiente_inicio','en_curso','pausada','finalizada','cancelada')),
  ha_estado_pausada boolean not null default false,
  num_pausas integer not null default 0,
  minutos_pausada_acum integer not null default 0,
  horas_planificadas_snapshot numeric null,
  horas_reales numeric null,
  incidencia text null,
  accion_correctiva text null,
  maquinista text null,
  densidades_json jsonb null,
  observaciones text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid null,
  created_by_email text null,
  updated_by uuid null,
  updated_by_email text null
);

alter table public.prod_mesa_ejecuciones
  add column if not exists liberada_at timestamptz null,
  add column if not exists ha_estado_pausada boolean not null default false,
  add column if not exists num_pausas integer not null default 0,
  add column if not exists minutos_pausada_acum integer not null default 0;

alter table public.prod_mesa_ejecuciones
  alter column inicio_real_at drop not null;

alter table public.prod_mesa_ejecuciones
  drop constraint if exists prod_mesa_ejecuciones_estado_ejecucion_check;

alter table public.prod_mesa_ejecuciones
  add constraint prod_mesa_ejecuciones_estado_ejecucion_check
  check (estado_ejecucion in ('pendiente_inicio','en_curso','pausada','finalizada','cancelada'));

alter table public.prod_mesa_ejecuciones
  drop column if exists pausada_at,
  drop column if exists reanudada_at,
  drop column if exists motivo_pausa;

create index if not exists prod_mesa_ejecuciones_maquina_estado_inicio_idx
  on public.prod_mesa_ejecuciones (maquina_id, estado_ejecucion, inicio_real_at desc);

create index if not exists prod_mesa_ejecuciones_ot_maquina_inicio_idx
  on public.prod_mesa_ejecuciones (ot_numero, maquina_id, inicio_real_at desc);

create index if not exists prod_mesa_ejecuciones_estado_liberada_idx
  on public.prod_mesa_ejecuciones (estado_ejecucion, liberada_at desc);

drop index if exists public.ux_prod_mesa_ejecuciones_ot_maquina_activa;

create unique index ux_prod_mesa_ejecuciones_ot_maquina_activa
  on public.prod_mesa_ejecuciones (ot_numero, maquina_id)
  where estado_ejecucion in ('pendiente_inicio','en_curso','pausada');

alter table public.prod_mesa_ejecuciones enable row level security;

drop policy if exists prod_mesa_ejecuciones_select on public.prod_mesa_ejecuciones;
drop policy if exists prod_mesa_ejecuciones_insert on public.prod_mesa_ejecuciones;
drop policy if exists prod_mesa_ejecuciones_update on public.prod_mesa_ejecuciones;
drop policy if exists prod_mesa_ejecuciones_delete on public.prod_mesa_ejecuciones;

create policy prod_mesa_ejecuciones_select
  on public.prod_mesa_ejecuciones for select
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  );

create policy prod_mesa_ejecuciones_insert
  on public.prod_mesa_ejecuciones for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  );

create policy prod_mesa_ejecuciones_update
  on public.prod_mesa_ejecuciones for update
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  )
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  );

create policy prod_mesa_ejecuciones_delete
  on public.prod_mesa_ejecuciones for delete
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

comment on table public.prod_mesa_ejecuciones is
  'Registro operativo manual de OTs iniciadas/finalizadas desde la Mesa APS de impresión.';

create table if not exists public.sys_motivos_pausa (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  categoria text not null check (categoria in ('operativos','suministros','calidad','tecnicos')),
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists sys_motivos_pausa_activo_categoria_orden_idx
  on public.sys_motivos_pausa (activo, categoria, orden);

insert into public.sys_motivos_pausa (slug, label, categoria, color_hex, activo, orden)
values
  ('CAMBIO_TURNO', 'Cambio de turno', 'operativos', '#6B7280', true, 10),
  ('DESCANSO_COMIDA', 'Descanso / comida', 'operativos', '#6B7280', true, 20),
  ('LIMPIEZA_MAQUINA', 'Limpieza de máquina', 'operativos', '#6B7280', true, 30),
  ('FALTA_PAPEL_MATERIAL', 'Falta papel / material', 'suministros', '#2563EB', true, 110),
  ('ESPERANDO_PLANCHAS', 'Esperando planchas', 'suministros', '#2563EB', true, 120),
  ('FALTA_TINTAS_PANTONE', 'Falta tintas / Pantone', 'suministros', '#2563EB', true, 130),
  ('AJUSTE_COLOR', 'Ajuste de color', 'calidad', '#7C3AED', true, 210),
  ('AJUSTE_REGISTRO', 'Ajuste de registro', 'calidad', '#7C3AED', true, 220),
  ('AJUSTE_BARNIZ', 'Ajuste de barniz', 'calidad', '#7C3AED', true, 230),
  ('AVERIA_MECANICA', 'Avería mecánica', 'tecnicos', '#DC2626', true, 310),
  ('FALLO_ELECTRONICO', 'Fallo electrónico', 'tecnicos', '#DC2626', true, 320),
  ('REPINTE_SECADO', 'Repinte / secado', 'tecnicos', '#DC2626', true, 330),
  ('OTROS', 'Otros', 'operativos', '#64748B', true, 900)
on conflict (slug) do update
set
  label = excluded.label,
  categoria = excluded.categoria,
  color_hex = excluded.color_hex,
  activo = excluded.activo,
  orden = excluded.orden,
  updated_at = timezone('utc'::text, now());

alter table public.sys_motivos_pausa enable row level security;

drop policy if exists sys_motivos_pausa_select on public.sys_motivos_pausa;
drop policy if exists sys_motivos_pausa_insert on public.sys_motivos_pausa;
drop policy if exists sys_motivos_pausa_update on public.sys_motivos_pausa;
drop policy if exists sys_motivos_pausa_delete on public.sys_motivos_pausa;

create policy sys_motivos_pausa_select
  on public.sys_motivos_pausa for select
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  );

create policy sys_motivos_pausa_insert
  on public.sys_motivos_pausa for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

create policy sys_motivos_pausa_update
  on public.sys_motivos_pausa for update
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  )
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

create policy sys_motivos_pausa_delete
  on public.sys_motivos_pausa for delete
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

create table if not exists public.prod_mesa_ejecuciones_pausas (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.prod_mesa_ejecuciones(id) on delete cascade,
  paused_at timestamptz not null,
  resumed_at timestamptz null,
  motivo_id uuid not null references public.sys_motivos_pausa(id),
  motivo text null,
  observaciones_pausa text null,
  minutos_pausa integer null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid null,
  created_by_email text null,
  updated_by uuid null,
  updated_by_email text null
);

alter table public.prod_mesa_ejecuciones_pausas
  add column if not exists motivo_id uuid references public.sys_motivos_pausa(id),
  add column if not exists observaciones_pausa text null;

alter table public.prod_mesa_ejecuciones_pausas
  alter column motivo drop not null;

with resolved as (
  select
    p.id,
    coalesce(m.id, otros.id) as motivo_id,
    case
      when m.id is null and nullif(trim(coalesce(p.motivo, '')), '') is not null
        then coalesce(p.observaciones_pausa, p.motivo)
      else p.observaciones_pausa
    end as observaciones_pausa
  from public.prod_mesa_ejecuciones_pausas p
  cross join (select id from public.sys_motivos_pausa where slug = 'OTROS') otros
  left join public.sys_motivos_pausa m
    on upper(trim(coalesce(p.motivo, ''))) = m.slug
    or upper(trim(coalesce(p.motivo, ''))) = upper(trim(m.label))
  where p.motivo_id is null
)
update public.prod_mesa_ejecuciones_pausas p
set
  motivo_id = r.motivo_id,
  observaciones_pausa = r.observaciones_pausa,
  updated_at = timezone('utc'::text, now())
from resolved r
where p.id = r.id;

alter table public.prod_mesa_ejecuciones_pausas
  alter column motivo_id set not null;

create index if not exists prod_mesa_ejecuciones_pausas_ejecucion_idx
  on public.prod_mesa_ejecuciones_pausas (ejecucion_id, paused_at desc);

create index if not exists prod_mesa_ejecuciones_pausas_motivo_idx
  on public.prod_mesa_ejecuciones_pausas (motivo_id);

create index if not exists prod_mesa_ejecuciones_pausas_abiertas_idx
  on public.prod_mesa_ejecuciones_pausas (ejecucion_id)
  where resumed_at is null;

alter table public.prod_mesa_ejecuciones_pausas enable row level security;

drop policy if exists prod_mesa_ejecuciones_pausas_select on public.prod_mesa_ejecuciones_pausas;
drop policy if exists prod_mesa_ejecuciones_pausas_insert on public.prod_mesa_ejecuciones_pausas;
drop policy if exists prod_mesa_ejecuciones_pausas_update on public.prod_mesa_ejecuciones_pausas;
drop policy if exists prod_mesa_ejecuciones_pausas_delete on public.prod_mesa_ejecuciones_pausas;

create policy prod_mesa_ejecuciones_pausas_select
  on public.prod_mesa_ejecuciones_pausas for select
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  );

create policy prod_mesa_ejecuciones_pausas_insert
  on public.prod_mesa_ejecuciones_pausas for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  );

create policy prod_mesa_ejecuciones_pausas_update
  on public.prod_mesa_ejecuciones_pausas for update
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion','impresion'])
    )
  )
  with check (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia','produccion'])
    )
  );

create policy prod_mesa_ejecuciones_pausas_delete
  on public.prod_mesa_ejecuciones_pausas for delete
  to authenticated
  using (
    exists (
      select 1 from profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin','gerencia'])
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Parámetros IA para ordenación de simulación
-- ---------------------------------------------------------------------------
alter table public.sys_parametros
  add column if not exists valor_text text;

insert into public.sys_parametros (seccion, clave, valor_num, valor_text, descripcion)
values
  ('planificacion_ia', 'planificacion_ia_peso_tintas', 80, null, 'Peso para agrupar tintas/Pantones similares en secuenciación IA.'),
  ('planificacion_ia', 'planificacion_ia_peso_cmyk', 55, null, 'Peso para agrupar trabajos CMYK.'),
  ('planificacion_ia', 'planificacion_ia_peso_barniz', 70, null, 'Peso para minimizar cambios de barniz/acabado.'),
  ('planificacion_ia', 'planificacion_ia_peso_papel', 65, null, 'Peso para agrupar por papel/formato/material.'),
  ('planificacion_ia', 'planificacion_ia_peso_fecha_entrega', 50, null, 'Peso para priorizar fecha de entrega.'),
  ('planificacion_ia', 'planificacion_ia_peso_balance_carga', 35, null, 'Peso para mantener balance de carga por turno.'),
  ('planificacion_ia', 'planificacion_ia_prompt_base', null, 'Prioriza minimizar cambios de tintas/Pantones, barnices/acabados y papel; respeta OTs en ejecución; conserva capacidad de turno y fecha de entrega.', 'Prompt base editable para explicar reglas de ordenación IA en la Mesa de Secuenciación.')
on conflict (clave) do update
set
  seccion = excluded.seccion,
  descripcion = excluded.descripcion,
  valor_num = coalesce(public.sys_parametros.valor_num, excluded.valor_num),
  valor_text = coalesce(public.sys_parametros.valor_text, excluded.valor_text),
  updated_at = timezone('utc'::text, now());
