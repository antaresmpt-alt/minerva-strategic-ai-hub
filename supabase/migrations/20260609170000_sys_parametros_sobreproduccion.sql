insert into public.sys_parametros (seccion, clave, valor_num, descripcion)
values
  (
    'produccion_sobreproduccion',
    'produccion_sobreprod_margen_impresion',
    10,
    'Aviso de sobreproduccion en Impresion: porcentaje por encima del pedido (hojas netas x poses) que dispara el semaforo naranja. Margen alto porque aun quedan mermas aguas abajo.'
  ),
  (
    'produccion_sobreproduccion',
    'produccion_sobreprod_margen_troquelado',
    5,
    'Aviso de sobreproduccion en Troquelado: porcentaje por encima del pedido (hojas troqueladas x poses). Cada hoja de mas son N poses de mas.'
  ),
  (
    'produccion_sobreproduccion',
    'produccion_sobreprod_margen_engomado',
    5,
    'Aviso de sobreproduccion en Engomado: porcentaje por encima del pedido. En esta fase ya se trabaja a unidad/caja y se estropean pocas unidades.'
  )
on conflict (clave) do nothing;
