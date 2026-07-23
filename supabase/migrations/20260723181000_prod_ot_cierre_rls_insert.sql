-- =====================================================================
-- Bloque 6 MVP — RLS endurecida para INSERT en prod_ot_producidas
--
-- Policy: solo usuarios autorizados pueden cerrar OTs.
-- Criterio: role in ('admin','gerencia') OR puede_cerrar_ot = true
-- =====================================================================

-- Drop existing INSERT policy if exists (may be too permissive from skeleton migration)
drop policy if exists "prod_ot_producidas_insert_policy" on public.prod_ot_producidas;

-- Helper function: ¿puede el usuario actual cerrar OTs?
create or replace function public.puede_cerrar_ot_actual()
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_role text;
  v_puede boolean;
begin
  -- Sin auth → false
  if auth.uid() is null then
    return false;
  end if;

  -- Leer profile del usuario actual
  select p.role, p.puede_cerrar_ot
  into v_role, v_puede
  from public.profiles p
  where p.id = auth.uid();

  -- admin/gerencia siempre pueden
  if v_role in ('admin', 'gerencia') then
    return true;
  end if;

  -- Otros roles: flag explícito
  return coalesce(v_puede, false);
end;
$$;

comment on function public.puede_cerrar_ot_actual is
  'Bloque 6 MVP: verifica si el usuario autenticado actual puede cerrar OTs. '
  'Roles admin/gerencia siempre pueden; otros usuarios necesitan flag '
  'puede_cerrar_ot = true en profiles. Usado en RLS de prod_ot_producidas.';

-- Nueva policy INSERT: solo si puede_cerrar_ot_actual() = true
create policy "prod_ot_producidas_insert_policy_v2"
  on public.prod_ot_producidas
  for insert
  with check (puede_cerrar_ot_actual());

comment on policy "prod_ot_producidas_insert_policy_v2" on public.prod_ot_producidas is
  'Solo usuarios autorizados (admin/gerencia o con flag puede_cerrar_ot) pueden '
  'insertar en prod_ot_producidas (cerrar OTs).';
