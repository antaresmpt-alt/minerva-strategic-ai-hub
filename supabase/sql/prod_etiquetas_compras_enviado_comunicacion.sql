-- Compras etiquetas digital: enviado + log comunicación + plantillas correo en prod_configuracion.
-- (Copia de supabase/migrations/20260516100000_prod_etiquetas_compras_enviado_comunicacion.sql)

-- ---------------------------------------------------------------------------
-- Columnas enviado en prod_etiquetas_compras
-- ---------------------------------------------------------------------------
alter table public.prod_etiquetas_compras
  add column if not exists enviado boolean not null default false;

alter table public.prod_etiquetas_compras
  add column if not exists enviado_at timestamptz null;

create index if not exists idx_prod_etiquetas_compras_enviado
  on public.prod_etiquetas_compras (enviado, fecha_pedido desc);

comment on column public.prod_etiquetas_compras.enviado is
  'True si el usuario confirmó el envío del correo de petición desde el hub.';

-- ---------------------------------------------------------------------------
-- Log de comunicaciones (lotes de líneas en un mismo mail)
-- ---------------------------------------------------------------------------
create table if not exists public.prod_etiquetas_compras_comunicacion (
  id uuid primary key default gen_random_uuid(),
  compra_ids uuid[] not null,
  asunto text not null default '',
  cuerpo text not null default '',
  enviado_por uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_etq_compras_comunicacion_created
  on public.prod_etiquetas_compras_comunicacion (created_at desc);

create index if not exists idx_etq_compras_comunicacion_compra_ids
  on public.prod_etiquetas_compras_comunicacion using gin (compra_ids);

comment on table public.prod_etiquetas_compras_comunicacion is
  'Historial de envíos de correo de petición de compras (etiquetas digital).';

alter table public.prod_etiquetas_compras_comunicacion enable row level security;

grant select, insert on public.prod_etiquetas_compras_comunicacion to authenticated;

drop policy if exists prod_etiquetas_compras_comunicacion_select on public.prod_etiquetas_compras_comunicacion;
create policy prod_etiquetas_compras_comunicacion_select
  on public.prod_etiquetas_compras_comunicacion for select
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

drop policy if exists prod_etiquetas_compras_comunicacion_insert on public.prod_etiquetas_compras_comunicacion;
create policy prod_etiquetas_compras_comunicacion_insert
  on public.prod_etiquetas_compras_comunicacion for insert
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

-- ---------------------------------------------------------------------------
-- Plantillas Gmail (prod_configuracion) — valores por defecto si no existen
-- ---------------------------------------------------------------------------
insert into public.prod_configuracion (clave, valor, updated_at)
values
  (
    'template_etiquetas_compras_subject',
    'Petición compras — Etiquetas digital ({n_lineas} líneas)',
    timezone('utc'::text, now())
  ),
  (
    'template_etiquetas_compras_header',
    'Buenos días,

Solicitamos lo siguiente:',
    timezone('utc'::text, now())
  ),
  (
    'template_etiquetas_compras_detail',
    '{producto} · Ud.: {unidad} · {equipo} · {marca} · {prioridad}',
    timezone('utc'::text, now())
  ),
  (
    'template_etiquetas_compras_footer',
    'Gracias.

Saludos,',
    timezone('utc'::text, now())
  )
on conflict (clave) do nothing;
