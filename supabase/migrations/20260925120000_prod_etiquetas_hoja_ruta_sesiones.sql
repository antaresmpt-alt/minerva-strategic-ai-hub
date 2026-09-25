-- Etiquetas digital — sesiones diarias por proceso I/T/N (Hugo: «Hoy»).
-- Una fila = OT + proceso + día trabajado (sin cerrar el proceso).
-- I/T/N en hoja de ruta siguen siendo «proceso terminado».

create table if not exists public.prod_etiquetas_hoja_ruta_sesiones (
  id uuid primary key default gen_random_uuid(),
  hoja_ruta_id uuid not null
    references public.prod_etiquetas_hoja_ruta (id) on delete cascade,
  proceso text not null,
  fecha date not null,
  nota text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_hoja_ruta_sesiones_proceso_chk
    check (proceso in ('I', 'T', 'N')),
  constraint prod_etiquetas_hoja_ruta_sesiones_unique
    unique (hoja_ruta_id, proceso, fecha)
);

create index if not exists idx_prod_etiquetas_hr_sesiones_fecha
  on public.prod_etiquetas_hoja_ruta_sesiones (fecha desc);

create index if not exists idx_prod_etiquetas_hr_sesiones_hoja
  on public.prod_etiquetas_hoja_ruta_sesiones (hoja_ruta_id);

comment on table public.prod_etiquetas_hoja_ruta_sesiones is
  'Días en que Hugo trabajó un proceso I/T/N sin cerrarlo (calendario multi-día).';

comment on column public.prod_etiquetas_hoja_ruta_sesiones.proceso is
  'I = Konica, T = Troqueladora, N = Numeradora.';

comment on column public.prod_etiquetas_hoja_ruta_sesiones.fecha is
  'Día laborable en que se tocó el proceso (YYYY-MM-DD).';

alter table public.prod_etiquetas_hoja_ruta_sesiones enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_hoja_ruta_sesiones
  to authenticated;

drop policy if exists prod_etiquetas_hr_sesiones_select
  on public.prod_etiquetas_hoja_ruta_sesiones;
create policy prod_etiquetas_hr_sesiones_select
  on public.prod_etiquetas_hoja_ruta_sesiones for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_etiquetas_hr_sesiones_insert
  on public.prod_etiquetas_hoja_ruta_sesiones;
create policy prod_etiquetas_hr_sesiones_insert
  on public.prod_etiquetas_hoja_ruta_sesiones for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_etiquetas_hr_sesiones_update
  on public.prod_etiquetas_hoja_ruta_sesiones;
create policy prod_etiquetas_hr_sesiones_update
  on public.prod_etiquetas_hoja_ruta_sesiones for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array[
            'admin',
            'gerencia',
            'produccion',
            'digital',
            'logistica'
          ]
        )
    )
  );

drop policy if exists prod_etiquetas_hr_sesiones_delete
  on public.prod_etiquetas_hoja_ruta_sesiones;
create policy prod_etiquetas_hr_sesiones_delete
  on public.prod_etiquetas_hoja_ruta_sesiones for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'digital']
        )
    )
  );
