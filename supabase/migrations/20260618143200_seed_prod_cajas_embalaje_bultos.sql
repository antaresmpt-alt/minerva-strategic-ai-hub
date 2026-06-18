-- Seed/actualización de bultos_por_palet_default (datos Gabri, cargados en prod 9 jun 2026).
-- Idempotente por código de caja.

INSERT INTO public.prod_cajas_embalaje (
  codigo, descripcion, bultos_por_palet_default, con_logo, activo, orden
) VALUES
  ('MN1L', 'Embalaje MN1L logo 295x215x281 (int)', 30, true, true, 10),
  ('BP1N', 'Embalaje BP1N neutro 361x260x351 (int)', 30, false, true, 20),
  ('CR2L', 'Embalaje CR2L logo 405x315x166 (int)', 40, true, true, 30),
  ('BP2L', 'Embalaje BP2L logo 425x300x301 (int)', 20, true, true, 40),
  ('BP2N', 'Embalaje BP2N neutro 425x300x301 (int)', 20, false, true, 50),
  ('MN2L', 'Embalaje MN2L logo 425x305x211 (int)', 25, true, true, 60),
  ('MN2N', 'Embalaje MN2N neutro 425x305x211 (int)', 25, false, true, 70),
  ('MN3L', 'Embalaje MN3L logo 515x415x411 (int)', 12, true, true, 80),
  ('MN3N', 'Embalaje MN3N neutro 515x415x411 (int)', 12, false, true, 90),
  ('BP3N', 'Embalaje BP3N neutro 652x397x345 (int)', 9, false, true, 100)
ON CONFLICT ((lower(codigo)))
DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  bultos_por_palet_default = EXCLUDED.bultos_por_palet_default,
  con_logo = EXCLUDED.con_logo,
  activo = EXCLUDED.activo,
  orden = EXCLUDED.orden,
  updated_at = now();
