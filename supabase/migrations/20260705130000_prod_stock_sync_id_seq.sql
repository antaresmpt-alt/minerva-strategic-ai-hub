-- Sincroniza la secuencia id_stock tras import masivo con IDs explícitos de Optimus.
create or replace function public.prod_stock_sync_id_stock_seq()
returns bigint
language sql
security definer
set search_path = public
as $$
  select setval(
    'prod_stock_id_stock_seq',
    greatest(coalesce((select max(id_stock) from public.prod_stock_palets), 10309), 10309)
  );
$$;

comment on function public.prod_stock_sync_id_stock_seq() is
  'Tras import Optimus con id_stock explícitos, alinea prod_stock_id_stock_seq al MAX(id_stock).';

grant execute on function public.prod_stock_sync_id_stock_seq() to authenticated;
