# GUIA_MAÑANA

## Estado Actual - Fase 0

Rama de trabajo: `feature/fase0-hoja-ruta-digital`.

Hoy se han dejado los cimientos de la Hoja de Ruta Digital y de la inteligencia de repeticiones:

- Nueva tabla `prod_referencias` para Referencias Minerva (`M-00001`, `M-00002`, etc.).
- Nuevo campo `referencia_cliente` para relacionar la referencia Minerva con el código del artículo del cliente (`EU858`, `EU1079`, etc.).
- Nuevos campos blandos en `produccion_ot_despachadas`: `referencia_id`, `ot_anterior_numero`, `ot_anterior_id`.
- Nueva tabla base `prod_despacho_materiales_lineas` para futuros materiales flexibles.
- Nuevo componente `ReferenciaMinervaPicker` para buscar/crear referencias.
- Integración de Referencia Minerva y OT anterior en despacho, despacho express y edición de despachos.
- Cabecera informativa en el modal de despacho: cliente, trabajo, pedido cliente, cantidad y fecha entrega OT.
- Clonado no destructivo de datos técnicos desde referencia u OT anterior.
- Clonado de itinerario si la OT origen tiene ruta informada.
- Referencias de prueba:
  - `M-00001` -> `EU858` -> `EST BBP PROBIOMIX 10 CAP`
  - `M-00002` -> `EU1079` -> `ESTUCE AQUILEA LIBIPLUS 60 CAPS`
- OT ficticias:
  - `98001` clonada desde `35267`, actualmente no despachada para pruebas.
  - `98002` clonada desde `35464`, actualmente no despachada para pruebas.

Validación hecha:

- `npx tsc --noEmit` OK.
- Lints OK en archivos tocados.

## Checklist Para Arrancar Mañana

1. Revisar estado de la rama:

```powershell
git status
git diff
```

2. Probar flujo básico:

- Abrir OT `98001`.
- Seleccionar/buscar `M-00001` o `EU858`.
- Comprobar que hereda datos técnicos desde `35267`.
- Si se usa `OT anterior = 35267`, comprobar también el clonado.
- Guardar despacho si el resultado es correcto.

3. Probar segunda referencia:

- Abrir OT `98002`.
- Seleccionar/buscar `M-00002` o `EU1079`.
- Comprobar datos heredados desde `35464`.

4. Nota sobre itinerarios:

- `35267` y `35464` no tenían pasos reales en `prod_ot_pasos` cuando se revisó.
- Si una OT origen tiene ruta informada, el clonado ya debería copiarla.
- Si se quiere demo visual con ruta, elegir una OT origen con itinerario real o informar una ruta en esas OT antiguas.

5. Si todo está OK, hacer commit de Fase 0 y push para preview Vercel.

## Fase 1 - Modal Visual de Hoja de Ruta

Objetivo: construir una vista clara y usable de la Hoja de Ruta Digital, encima de lo que ya existe: maestro OT, despacho, itinerario, planificación y ejecución.

Propuesta inicial del modal:

- Cabecera OT:
  - OT
  - Cliente
  - Trabajo
  - Pedido cliente
  - Cantidad
  - Fecha entrega
  - Referencia Minerva
  - Referencia cliente

- Bloque Datos Tecnicos:
  - Tintas
  - Material
  - Gramaje
  - Tamano hoja
  - Troquel
  - Poses
  - Acabado principal
  - Notas

- Bloque Materiales Flexibles:
  - Lineas variables: tipo, descripcion, cantidad, unidad, notas.
  - Usar tabla `prod_despacho_materiales_lineas`.

- Radar / Timeline de Procesos:
  - Itinerario desde `prod_ot_pasos`.
  - Estado por proceso.
  - Previsto vs real cuando exista.
  - Incidencias si existen.

- Historico / Repeticiones:
  - Mostrar OTs anteriores con la misma Referencia Minerva.
  - Mostrar ultima OT usada para clonar.
  - Futuro: medias ponderadas de horas reales.

## Editor de Materiales Flexibles

La estructura de BD ya existe: `prod_despacho_materiales_lineas`.

Pasos propuestos:

1. Crear componente `DespachoMaterialesLineasEditor`.
2. Campos por linea:
   - `tipo`
   - `descripcion`
   - `cantidad`
   - `unidad`
   - `notas`
3. Cargar lineas por `ot_numero` al abrir modal.
4. Permitir anadir, editar y borrar lineas.
5. Guardar lineas al guardar despacho.
6. Heredar lineas cuando se clone desde OT anterior o Referencia Minerva.

## Decisiones Pendientes

- Multiples referencias en una misma OT:
  - Futuro: tabla `prod_ot_referencias`.
  - Campos probables: `ot_numero`, `referencia_id`, `cantidad`, `orden`.

- Reglas de calidad para Referencias Minerva:
  - Mantener formato `M-00001` con 5 digitos.
  - Futuro posible: check constraint regex `^M-[0-9]{5}$`.

- Unicidad de referencia cliente:
  - Evaluar mas adelante si conviene UNIQUE por `(cliente, referencia_cliente)`.
  - De momento no bloquear porque puede haber datos historicos sucios o ambiguos.

- Parsing automatico de titulos tipo `EU858 - descripcion`:
  - Ya se usa para sugerir valores al crear referencia.
  - Futuro: sugerir enlace automatico si ya existe esa referencia cliente.

- Supabase staging:
  - Ahora solo hay una BD real.
  - A medio plazo conviene crear un proyecto Supabase de test/staging.

## Comandos Utiles

```powershell
git status
git diff
git log --oneline -10
npx tsc --noEmit
```

## Recordatorio

No olvidar que la Fase 0 es aditiva: tablas nuevas y columnas nullable. No deberia afectar a etiquetas, externos ni compras.

