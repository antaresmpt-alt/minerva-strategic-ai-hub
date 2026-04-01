-- Ejecutar en Supabase SQL Editor si la tabla de usuarios en Settings queda vacía:
-- permite a roles admin y gerencia leer todos los perfiles (además de la propia fila).

create policy "profiles_select_admin_or_gerencia_all"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as me
      where me.id = (select auth.uid())
        and me.role in ('admin', 'gerencia')
    )
  );
