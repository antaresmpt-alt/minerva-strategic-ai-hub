-- Calendario Producción multi-ámbito (Impresión / Digital / Troquelado / Engomado).
-- Misma OT puede planificarse en varios ámbitos y fechas.
-- Escritura: admin/gerencia = todos; resto solo su ámbito (produccion → impresion).

alter table public.prod_calendario_produccion_ot
  add column if not exists ambito text;

update public.prod_calendario_produccion_ot
set ambito = 'impresion'
where ambito is null or btrim(ambito) = '';

alter table public.prod_calendario_produccion_ot
  alter column ambito set default 'impresion';

alter table public.prod_calendario_produccion_ot
  alter column ambito set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_calendario_produccion_ot_ambito_chk'
  ) then
    alter table public.prod_calendario_produccion_ot
      add constraint prod_calendario_produccion_ot_ambito_chk
      check (ambito in ('impresion', 'digital', 'troquelado', 'engomado'));
  end if;
end $$;

alter table public.prod_calendario_produccion_ot
  drop constraint if exists prod_calendario_produccion_ot_fecha_ot_uq;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prod_calendario_produccion_ot_fecha_ot_ambito_uq'
  ) then
    alter table public.prod_calendario_produccion_ot
      add constraint prod_calendario_produccion_ot_fecha_ot_ambito_uq
      unique (fecha, ot_numero, ambito);
  end if;
end $$;

create index if not exists idx_prod_calendario_produccion_ot_ambito_fecha
  on public.prod_calendario_produccion_ot (ambito, fecha, orden, created_at);

comment on column public.prod_calendario_produccion_ot.ambito is
  'Ámbito de planificación visual: impresion | digital | troquelado | engomado.';

-- ─── Permisos escritura por ámbito ─────────────────────────────────────────

create or replace function public.calendario_produccion_can_write_ambito(p_ambito text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles me
    where me.id = (select auth.uid())
      and (
        me.role::text in ('admin', 'gerencia')
        or (
          coalesce(nullif(btrim(p_ambito), ''), '') = 'impresion'
          and me.role::text in (
            'produccion',
            'produccion_ejecucion',
            'impresion',
            'almacen',
            'logistica'
          )
        )
        or (
          coalesce(nullif(btrim(p_ambito), ''), '') = 'digital'
          and me.role::text = 'digital'
        )
        or (
          coalesce(nullif(btrim(p_ambito), ''), '') = 'troquelado'
          and me.role::text = 'troquelado'
        )
        or (
          coalesce(nullif(btrim(p_ambito), ''), '') = 'engomado'
          and me.role::text = 'engomado'
        )
      )
  );
$$;

revoke all on function public.calendario_produccion_can_write_ambito(text) from public;
grant execute on function public.calendario_produccion_can_write_ambito(text) to authenticated;

create or replace function public.calendario_produccion_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles me
    where me.id = (select auth.uid())
      and me.role::text = any (
        array[
          'admin',
          'gerencia',
          'produccion',
          'produccion_ejecucion',
          'impresion',
          'digital',
          'troquelado',
          'engomado',
          'almacen',
          'logistica'
        ]
      )
  );
$$;

revoke all on function public.calendario_produccion_can_read() from public;
grant execute on function public.calendario_produccion_can_read() to authenticated;

drop policy if exists prod_calendario_produccion_ot_select on public.prod_calendario_produccion_ot;
create policy prod_calendario_produccion_ot_select
  on public.prod_calendario_produccion_ot for select
  to authenticated
  using (public.calendario_produccion_can_read());

drop policy if exists prod_calendario_produccion_ot_insert on public.prod_calendario_produccion_ot;
create policy prod_calendario_produccion_ot_insert
  on public.prod_calendario_produccion_ot for insert
  to authenticated
  with check (public.calendario_produccion_can_write_ambito(ambito));

drop policy if exists prod_calendario_produccion_ot_update on public.prod_calendario_produccion_ot;
create policy prod_calendario_produccion_ot_update
  on public.prod_calendario_produccion_ot for update
  to authenticated
  using (public.calendario_produccion_can_write_ambito(ambito))
  with check (public.calendario_produccion_can_write_ambito(ambito));

drop policy if exists prod_calendario_produccion_ot_delete on public.prod_calendario_produccion_ot;
create policy prod_calendario_produccion_ot_delete
  on public.prod_calendario_produccion_ot for delete
  to authenticated
  using (public.calendario_produccion_can_write_ambito(ambito));

-- Notas del día: ampliar lectura/escritura a roles de sección (sin ámbito).
drop policy if exists prod_calendario_produccion_nota_select on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_select
  on public.prod_calendario_produccion_nota for select
  to authenticated
  using (public.calendario_produccion_can_read());

drop policy if exists prod_calendario_produccion_nota_insert on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_insert
  on public.prod_calendario_produccion_nota for insert
  to authenticated
  with check (public.calendario_produccion_can_read());

drop policy if exists prod_calendario_produccion_nota_update on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_update
  on public.prod_calendario_produccion_nota for update
  to authenticated
  using (public.calendario_produccion_can_read())
  with check (public.calendario_produccion_can_read());

drop policy if exists prod_calendario_produccion_nota_delete on public.prod_calendario_produccion_nota;
create policy prod_calendario_produccion_nota_delete
  on public.prod_calendario_produccion_nota for delete
  to authenticated
  using (public.calendario_produccion_can_read());
