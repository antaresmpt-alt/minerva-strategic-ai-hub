-- =====================================================================
-- Bloque 6 MVP — Permisos de cierre: flags puente en profiles
--
-- DECISIÓN DE ARQUITECTURA (puente, no definitivo):
-- Solución ligera mientras no exista el rediseño de roles/permisos
-- (Eje 2 de MINERVA_ROLES_Y_NAVEGACION.md — capacidades finas tipo
-- ot.cerrar / ot.reabrir).
--
-- Cuando llegue ese rediseño, estos flags se pliegan en
-- role_permissions/user_permissions; no son la arquitectura final.
--
-- DECISIÓN DE NEGOCIO:
-- Pueden cerrar/reabrir: Manel, Zaida, Albert, Jordi Gaya, Gemma Gaya, Carlos.
-- Roles admin/gerencia siempre pueden; otros usuarios necesitan flag explícito.
-- =====================================================================

alter table public.profiles
  add column if not exists puede_cerrar_ot boolean not null default false;

alter table public.profiles
  add column if not exists puede_reabrir_ot boolean not null default false;

comment on column public.profiles.puede_cerrar_ot is
  'Flag puente para cierre manual de OTs (Bloque 6 MVP). '
  'Permite cerrar una OT y archivarla en prod_ot_producidas. '
  'Roles admin/gerencia siempre pueden; este flag habilita a usuarios de otros roles. '
  'Se plegará en role_permissions cuando llegue el rediseño de Eje 2.';

comment on column public.profiles.puede_reabrir_ot is
  'Flag puente para reapertura de OTs cerradas (Bloque 6 futuro). '
  'Permite reabrir una OT ya archivada (genera version + 1). '
  'Roles admin/gerencia siempre pueden; este flag habilita a usuarios de otros roles. '
  'Se plegará en role_permissions cuando llegue el rediseño de Eje 2.';

-- ─── Seed de permisos ─────────────────────────────────────────────────
-- Activar flags para usuarios específicos que NO son admin/gerencia pero deben
-- poder cerrar/reabrir OTs.
--
-- Carlos (produccion@minervaglobal.es, role produccion): necesita flags.
-- Manel y Jordi ya cubiertos por admin/gerencia respectivamente.
-- Zaida, Albert, Gemma: si existen y no son admin/gerencia, también activar.

-- Carlos (produccion@minervaglobal.es)
update public.profiles
set
  puede_cerrar_ot = true,
  puede_reabrir_ot = true
where id in (
  select p.id
  from public.profiles p
  join auth.users u on p.id = u.id
  where u.email = 'produccion@minervaglobal.es'
);

-- Zaida (varios emails posibles: zaida@..., oficina_tecnica@...)
update public.profiles
set
  puede_cerrar_ot = true,
  puede_reabrir_ot = true
where id in (
  select p.id
  from public.profiles p
  join auth.users u on p.id = u.id
  where u.email ilike '%zaida%'
    and p.role not in ('admin', 'gerencia')
);

-- Albert, Gemma (gerencia@..., direccion@..., o nombres directos)
-- Si ya son gerencia, no hace falta; si no, activar flags
update public.profiles
set
  puede_cerrar_ot = true,
  puede_reabrir_ot = true
where id in (
  select p.id
  from public.profiles p
  join auth.users u on p.id = u.id
  where (u.email ilike '%albert%' or u.email ilike '%gemma%')
    and p.role not in ('admin', 'gerencia')
);

-- Verificación: mostrar quién tiene permisos de cierre (debugging; no afecta funcionalidad)
do $$
declare
  rec record;
begin
  raise notice '=== Usuarios con permisos de cierre (Bloque 6) ===';
  for rec in
    select
      u.email,
      p.role,
      p.puede_cerrar_ot,
      p.puede_reabrir_ot
    from public.profiles p
    join auth.users u on p.id = u.id
    where p.puede_cerrar_ot = true
       or p.puede_reabrir_ot = true
       or p.role in ('admin', 'gerencia')
    order by p.role, u.email
  loop
    raise notice 'Email: %, Role: %, Cerrar: %, Reabrir: %',
      rec.email, rec.role, rec.puede_cerrar_ot, rec.puede_reabrir_ot;
  end loop;
end $$;
