-- Impresión EXTERNA (21): debe estar marcada es_externo para cola Externos y no mesa offset.
-- Sin esto, prod_ots_proximo_paso_externo_queue la ignora y planificacion la trata como impresión interna.

update public.prod_procesos_cat
set es_externo = true
where id = 21
  and coalesce(es_externo, false) = false;

comment on column public.prod_procesos_cat.es_externo is
  'Si true, el paso entra en cola Externos (RPC prod_ots_proximo_paso_externo_queue) y no en mesa interna.';
