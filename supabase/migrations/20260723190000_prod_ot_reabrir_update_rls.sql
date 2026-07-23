-- Bloque 6 — Reabrir OT + endurecer UPDATE de metadatos
--
-- reabierta_at / reabierta_por: marcan que una versión cerrada fue reabierta.
-- Mientras la versión más reciente tenga reabierta_at NOT NULL, la OT deja de
-- considerarse "archivada" (puede volver a pendiente de revisión y recerrarse
-- como version + 1 con reabierta_desde_id apuntando a esta fila).

alter table public.prod_ot_producidas
  add column if not exists reabierta_at timestamptz null;

alter table public.prod_ot_producidas
  add column if not exists reabierta_por uuid references auth.users(id) on delete set null;

comment on column public.prod_ot_producidas.reabierta_at is
  'Si no null, esta versión fue reabierta: la OT deja de estar archivada hasta el próximo cierre (version + 1).';

comment on column public.prod_ot_producidas.reabierta_por is
  'Usuario que ejecutó la reapertura (requiere puede_reabrir_ot o admin/gerencia).';

-- Helper: ¿puede el usuario actual reabrir?
create or replace function public.puede_reabrir_ot_actual()
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_role text;
  v_puede boolean;
begin
  if auth.uid() is null then return false; end if;
  select p.role, p.puede_reabrir_ot into v_role, v_puede
  from public.profiles p where p.id = auth.uid();
  if v_role in ('admin', 'gerencia') then return true; end if;
  return coalesce(v_puede, false);
end;
$$;

comment on function public.puede_reabrir_ot_actual is
  'Bloque 6: verifica si el usuario autenticado puede reabrir OTs cerradas.';

-- UPDATE: solo metadatos de revisión / reapertura por usuarios autorizados
drop policy if exists "prod_ot_producidas_update_policy" on public.prod_ot_producidas;

create policy "prod_ot_producidas_update_policy_v2"
  on public.prod_ot_producidas
  for update
  using (puede_cerrar_ot_actual() or puede_reabrir_ot_actual())
  with check (puede_cerrar_ot_actual() or puede_reabrir_ot_actual());
