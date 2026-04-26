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
  with check (true);

create policy prod_maquinas_update_authenticated
  on public.prod_maquinas for update
  to authenticated
  using (true)
  with check (true);

create policy prod_maquinas_delete_authenticated
  on public.prod_maquinas for delete
  to authenticated
  using (true);

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
  inicio_real_at timestamptz not null default timezone('utc'::text, now()),
  fin_real_at timestamptz null,
  estado_ejecucion text not null default 'en_curso'
    check (estado_ejecucion in ('en_curso','pausada','finalizada','cancelada')),
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

create index if not exists prod_mesa_ejecuciones_maquina_estado_inicio_idx
  on public.prod_mesa_ejecuciones (maquina_id, estado_ejecucion, inicio_real_at desc);

create index if not exists prod_mesa_ejecuciones_ot_maquina_inicio_idx
  on public.prod_mesa_ejecuciones (ot_numero, maquina_id, inicio_real_at desc);

create unique index if not exists ux_prod_mesa_ejecuciones_ot_maquina_activa
  on public.prod_mesa_ejecuciones (ot_numero, maquina_id)
  where estado_ejecucion in ('en_curso','pausada');

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
        and me.role::text = any (array['admin','gerencia','produccion'])
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
