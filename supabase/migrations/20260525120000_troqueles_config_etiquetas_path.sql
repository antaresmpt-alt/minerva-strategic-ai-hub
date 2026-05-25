-- Migration: Add etiquetas_troqueles_path to prod_troqueles_config
-- Description: Añade columna para almacenar la ruta raíz de los troqueles de etiquetas.
-- Author: Agent
-- Date: 2026-05-25

alter table public.prod_troqueles_config
  add column if not exists etiquetas_troqueles_path text null;

comment on column public.prod_troqueles_config.etiquetas_troqueles_path is
  'Carpeta raíz donde están las carpetas de troqueles de etiquetas.
   Se concatena con prod_etiquetas_troqueles.carpeta_original + archivo.';
