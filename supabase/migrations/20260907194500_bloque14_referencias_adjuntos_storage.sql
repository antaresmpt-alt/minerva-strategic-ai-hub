-- Bloque 14: Storage para adjuntos de fichas (foto producto + perfil troquel).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referencias-adjuntos',
  'referencias-adjuntos',
  true,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "referencias_adjuntos_select_public" on storage.objects;
create policy "referencias_adjuntos_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'referencias-adjuntos');

drop policy if exists "referencias_adjuntos_insert_authenticated" on storage.objects;
create policy "referencias_adjuntos_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'referencias-adjuntos');

drop policy if exists "referencias_adjuntos_update_authenticated" on storage.objects;
create policy "referencias_adjuntos_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'referencias-adjuntos')
  with check (bucket_id = 'referencias-adjuntos');

drop policy if exists "referencias_adjuntos_delete_not_comercial" on storage.objects;
drop policy if exists "referencias_adjuntos_delete_authenticated" on storage.objects;
create policy "referencias_adjuntos_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'referencias-adjuntos');

-- Comercial puede reemplazar adjuntos (no borrar artículos).
drop policy if exists "prod_referencia_adjuntos_delete_policy" on public.prod_referencia_adjuntos;
create policy "prod_referencia_adjuntos_delete_policy"
  on public.prod_referencia_adjuntos
  for delete
  to authenticated
  using (true);
