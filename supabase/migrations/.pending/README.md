# Migraciones pendientes

Esta carpeta contiene migraciones SQL que **NO deben ser ejecutadas todavía**
por el CLI / MCP de Supabase. La CLI de Supabase solo procesa los archivos
`.sql` directamente bajo `supabase/migrations/`, por lo que cualquier archivo
dentro de subcarpetas (como `.pending/`) queda fuera del flujo normal.

Cada archivo aquí incluye una cabecera con el procedimiento de validación
previo y los pasos para moverlo (con timestamp) a `supabase/migrations/`
cuando esté listo para aplicarse.

## Archivos actuales

- **`prod_etiquetas_hoja_ruta_ot_unique.sql`** — Añade `UNIQUE` sobre
  `ot_numero` en `prod_etiquetas_hoja_ruta`. Aplicar solo tras limpiar los
  duplicados históricos de la tabla.
