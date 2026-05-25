-- ⚠ MIGRACIÓN PENDIENTE — NO APLICAR HASTA HABER LIMPIADO DUPLICADOS ⚠
--
-- Esta migración añade un índice UNIQUE sobre `ot_numero` en la tabla
-- `prod_etiquetas_hoja_ruta`. Mientras existan filas con `ot_numero`
-- repetidos, la creación del índice fallará con:
--   ERROR: could not create unique index
--   DETAIL: Key (ot_numero)=(XXXXX) is duplicated.
--
-- PROCEDIMIENTO ANTES DE APLICAR (en este orden):
--
--   1. Listar duplicados:
--        select ot_numero,
--               count(*) as repeticiones,
--               array_agg(id order by created_at) as ids,
--               bool_or(finalizado) as alguna_finalizada,
--               bool_and(finalizado) as todas_finalizadas
--        from public.prod_etiquetas_hoja_ruta
--        group by ot_numero
--        having count(*) > 1
--        order by repeticiones desc, ot_numero;
--
--   2. Para cada OT duplicada, decidir cuál fila conservar (normalmente la
--      más reciente o la que tenga datos completos) y fusionar manualmente
--      los datos relevantes de las demás antes de eliminarlas.
--      Tip: hacer copia de seguridad previa (similar a las tablas
--      `prod_etiquetas_hoja_ruta_bkp_*` ya existentes).
--
--   3. Verificar que no quedan duplicados (la query del paso 1 debe
--      devolver 0 filas).
--
--   4. Mover ESTE archivo a `supabase/migrations/` con un timestamp en el
--      nombre (p. ej. `20260530120000_prod_etiquetas_hoja_ruta_ot_unique.sql`).
--      Aplicar la migración con el CLI / MCP de Supabase.
--
-- Cuando el índice exista, la defensa anti-duplicados deja de ser solo en UI
-- (helpers en src/lib/etiquetas-hoja-ruta-duplicados.ts) y queda blindada
-- también a nivel de base de datos.

create unique index if not exists prod_etiquetas_hoja_ruta_ot_numero_uniq
  on public.prod_etiquetas_hoja_ruta (ot_numero);

comment on index public.prod_etiquetas_hoja_ruta_ot_numero_uniq is
  'Garantiza unicidad de ot_numero en hoja de ruta de etiquetas digital. Defensa final tras la validación UI de duplicados.';
