-- Insertar Desbroce (proceso 22) entre Troquelado (10) y Engomado (12)
-- en plantillas offset habituales que aún no lo incluyen.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pp.plantilla_id, pp.orden AS troq_orden
    FROM public.prod_rutas_plantilla_pasos pp
    JOIN public.prod_rutas_plantilla p ON p.id = pp.plantilla_id
    WHERE pp.proceso_id = 10
      AND p.nombre IN (
        'Est.normal-Barniz',
        'Est.Plastificado',
        'Est.con Stamping',
        'Est.MICRO',
        'Interior/Celdillas-engomadas'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.prod_rutas_plantilla_pasos d
        WHERE d.plantilla_id = pp.plantilla_id
          AND d.proceso_id = 22
      )
      AND EXISTS (
        SELECT 1
        FROM public.prod_rutas_plantilla_pasos e
        WHERE e.plantilla_id = pp.plantilla_id
          AND e.proceso_id = 12
          AND e.orden = pp.orden + 1
      )
  LOOP
    UPDATE public.prod_rutas_plantilla_pasos
    SET orden = orden + 100
    WHERE plantilla_id = r.plantilla_id
      AND orden > r.troq_orden;

    INSERT INTO public.prod_rutas_plantilla_pasos (plantilla_id, proceso_id, orden)
    VALUES (r.plantilla_id, 22, r.troq_orden + 1);

    UPDATE public.prod_rutas_plantilla_pasos
    SET orden = orden - 99
    WHERE plantilla_id = r.plantilla_id
      AND orden > 100;
  END LOOP;
END $$;
