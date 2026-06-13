# MINERVA — Briefing Bloque 6: Producidas / Historico / Cierre de OT

> Documento autocontenido para brainstorming y diseño funcional.
> Tema: como cerrar una OT, congelar su hoja de ruta y convertir lo producido en historico util.
> Complementa a `MINERVA_BRIEFING.md`, `MINERVA_CONTEXTO_TECNICO.md` y `FASES_HOJA_RUTA_DIGITAL.md`.
>
> Fecha: 13 de junio de 2026.

---

## 1. Idea central

El Bloque 6 debe convertir Minerva en un sistema que **aprende de lo producido**.

Hasta ahora, la Hoja de Ruta Digital captura lo que ocurre durante la ejecucion de una OT:
despacho, itinerario, datos por proceso, tiempos, pausas, incidencias, materiales, mermas y resultados
reales.

El siguiente paso es definir que ocurre cuando la OT termina:

1. El ultimo paso de la ruta finaliza.
2. La OT no debe ir directamente a historico sin control.
3. Debe pasar a una cola de **pendiente de revision**.
4. Una persona revisa que los datos estan bien apuntados.
5. Al confirmar, Minerva genera un **snapshot inmutable** de toda la Hoja de Ruta.
6. Ese snapshot se guarda en `prod_ot_producidas`.
7. Ese historico sirve para trazabilidad, analitica y para recalcular valores por defecto del Maestro de Articulos.

La idea no es solo archivar. Es crear la base de memoria industrial de Minerva.

---

## 2. Problema de negocio

Hoy uno de los dolores reales es:

> \"Que usamos la ultima vez?\"

Esto puede referirse a:

- Material exacto.
- Gramaje.
- Troquel.
- Poses.
- Tintas.
- Acabado.
- Caja de embalaje.
- Estuches por bulto.
- Bultos por palet.
- Tiempo real de impresion, troquelado o engomado.
- Merma real.
- Incidencias recurrentes.

Si esos datos quedan en papel, texto libre o repartidos en varias pantallas, no se pueden explotar.

El historico debe permitir:

- Consultar una OT producida tal como ocurrio.
- Comparar previsto vs real.
- Ver la ultima produccion de una referencia.
- Calcular medias razonables para futuras OTs.
- Detectar desviaciones, cuellos de botella y problemas repetitivos.
- Alimentar el Maestro de Articulos con datos reales, sin pisar manualmente valores oficiales.

---

## 3. Decision base ya acordada

### Modelo hibrido

La tabla `prod_ot_producidas` deberia tener:

1. **`snapshot jsonb`**: copia completa de la Hoja de Ruta en el momento del cierre.
2. **Columnas planas indexadas**: campos clave para busqueda, filtros, promedios y analitica.

Motivo:

- El snapshot preserva toda la verdad historica, aunque el modelo cambie en el futuro.
- Las columnas planas evitan consultas lentas dentro de JSONB para cosas frecuentes.

### Cierre en dos fases

No cerrar automaticamente al finalizar el ultimo paso.

Flujo acordado:

```text
Ultimo paso finalizado
  -> OT pasa a pendiente_revision
  -> revision humana
  -> Cerrar y enviar a historico
  -> snapshot en prod_ot_producidas
  -> OT pasa a producida / cerrada
```

Motivo:

- El ultimo paso finalizado no garantiza que todos los datos esten bien apuntados.
- El historico alimentara futuras decisiones. Si entra basura, la planificacion futura empeora.

### Reapertura

Si una OT ya cerrada contiene un error:

- Se debe poder **reabrir**.
- No se debe pisar el snapshot antiguo sin rastro.
- Al volver a cerrar, se genera una nueva **version** del snapshot.

---

## 4. Que deberia contener el snapshot

El snapshot deberia parecerse a lo que ya monta `fetchHojaRutaOt(otNumero)`:

- Cabecera OT:
  - OT, cliente, trabajo, pedido, cantidad, fecha entrega, prioridad, estado.
- Maestro / referencia:
  - referencia Minerva, referencia cliente, datos FSC si aplican.
- Despacho:
  - material, gramaje, formato, hojas brutas/netas, tintas, troquel, poses, acabado, notas.
- Itinerario:
  - todos los pasos, orden, proceso, maquina, estado, fechas.
- `datos_proceso` por paso:
  - impresion, troquelado, desbroce, engomado, CTP, manipulados, externos, etc.
- Ejecuciones:
  - maquinista, inicio, fin, horas reales, incidencias, accion correctiva, observaciones.
- Pausas:
  - motivo, categoria, inicio, fin, duracion, observacion.
- Externos:
  - proveedor, estado, envio, recepcion, observaciones.
- Metricas calculadas:
  - horas totales, merma, cantidad producida, desviacion previsto vs real.
- Metadata de cierre:
  - cerrado por, cerrado en, version, observacion de revision.

---

## 5. Columnas planas recomendadas

Estas columnas permitirian filtrar y calcular rapido sin entrar al JSONB.

### Identidad

| Columna | Motivo |
|---|---|
| `id` | PK. |
| `ot_numero` | Busqueda directa. |
| `ot_id` | Enlace a `prod_ots_general`, si se conserva. |
| `referencia_id` | Enlace al Maestro. |
| `referencia_minerva` | Snapshot legible. |
| `referencia_cliente` | Busqueda por codigo cliente. |
| `cliente` | Filtro habitual. |
| `trabajo` | Texto visible. |
| `cantidad_pedida` | Comparativa. |
| `cantidad_producida` | Resultado real final. |

### Tecnico

| Columna | Motivo |
|---|---|
| `material` | Filtro y memoria tecnica. |
| `gramaje` | Filtro tecnico. |
| `formato` | Repeticion / preparacion. |
| `tintas` | Planificacion y agrupacion. |
| `troquel` | Busqueda clave. |
| `poses` | Calculos hojas -> estuches. |
| `acabado_pral` | Filtro tecnico. |
| `tipo_engomado` | Repeticion. |
| `codigo_caja_embalaje` | Embalaje. |
| `estuches_por_bulto` | Embalaje / maestro. |
| `bultos_por_palet` | Embalaje / logistica. |
| `palets` | Logistica. |
| `fsc` | Trazabilidad FSC. |

### Produccion real

| Columna | Motivo |
|---|---|
| `fecha_inicio_real` | Analitica de ciclo. |
| `fecha_fin_real` | Analitica de ciclo. |
| `fecha_cierre` | Historico. |
| `horas_total_reales` | Coste / planificacion. |
| `horas_impresion_reales` | Promedios por proceso. |
| `horas_troquelado_reales` | Promedios por proceso. |
| `horas_engomado_reales` | Promedios por proceso. |
| `horas_ctp_reales` | Promedios por proceso. |
| `horas_desbroce_reales` | Promedios por proceso. |
| `merma_total` | Calidad / rendimiento. |
| `num_pausas` | Analitica. |
| `minutos_pausa_total` | Analitica. |
| `tiene_incidencias` | Filtro rapido. |

### Control

| Columna | Motivo |
|---|---|
| `snapshot` | Verdad completa congelada. |
| `snapshot_version` | Evolucion del formato. |
| `version` | Reaperturas/cierres sucesivos. |
| `cerrada_por` | Auditoria. |
| `cerrada_at` | Auditoria. |
| `reabierta_desde_id` | Trazabilidad si se versiona en filas separadas. |
| `observaciones_revision` | Comentario humano al cierre. |

---

## 6. Flujo UX propuesto

### En Pipeline

Crear filtro / seccion:

```text
Pendientes de revision
```

Una OT entra aqui cuando:

- Todos sus pasos obligatorios estan finalizados.
- No esta archivada en `prod_ot_producidas`.

Acciones:

- Abrir Hoja de Ruta.
- Revisar datos.
- Marcar incidencias de revision.
- Cerrar y archivar.

### En `HojaRutaOtDialog`

Boton nuevo:

```text
Cerrar y enviar a historico
```

Visible solo si:

- OT esta en estado `pendiente_revision`.
- Usuario tiene rol permitido.

Antes de cerrar, mostrar checklist:

- Todos los procesos estan finalizados o marcados como no aplica.
- Hay cantidad producida final.
- Horas reales coherentes.
- Incidencias revisadas.
- Embalaje informado si aplica.
- FSC/material revisado si aplica.

### En Producidas / Historico

Nueva pestaña o modulo:

```text
Produccion -> Producidas
```

Filtros recomendados:

- OT.
- Cliente.
- Referencia Minerva.
- Referencia cliente.
- Material.
- Troquel.
- Fecha cierre desde/hasta.
- Tiene incidencias.
- FSC.

Acciones:

- Ver snapshot en modo lectura.
- Exportar Excel.
- Comparar con producciones anteriores.
- Reabrir (rol restringido).

---

## 7. Recalculo del Maestro desde historico

Principio:

- **Maestro** = como se deberia hacer.
- **Historico** = evidencia real de como se hizo.

El historico no deberia pisar automaticamente el Maestro sin control.

### Propuesta de algoritmo

Para una referencia:

1. Tomar las ultimas N producciones cerradas (por ejemplo 5 o 10).
2. Excluir producciones marcadas como anomalias:
   - averia grave.
   - incidencia importante.
   - reproceso.
   - cantidad muy distinta.
3. Calcular:
   - valores mas frecuentes para campos categoricos: material, troquel, caja, tipo engomado.
   - medianas o medias recortadas para numericos: horas, merma, estuches por bulto.
4. Mostrar sugerencia al usuario:
   - \"Ultimas 5 producciones: material Zenith 300g en 4/5; troquel TAG00205 en 5/5; horas impresion mediana 1,8h\".
5. Permitir:
   - aplicar todo.
   - aplicar seleccionados.
   - bloquear un campo como valor oficial manual.

### Campos candidatos a recalcular

- Material habitual.
- Troquel habitual.
- Poses.
- Tintas.
- Acabado principal.
- Ruta habitual.
- Tipo engomado habitual.
- Caja embalaje.
- Estuches por bulto.
- Bultos por palet.
- Horas previstas por proceso.
- Merma esperada.

---

## 8. Riesgos y puntos delicados

### Riesgo 1: cerrar con datos malos

Mitigacion:

- estado `pendiente_revision`.
- checklist de cierre.
- roles.
- warnings si faltan campos clave.

### Riesgo 2: historico demasiado pesado

Mitigacion:

- snapshot JSONB completo.
- columnas planas para consultas frecuentes.
- indices por cliente/referencia/troquel/fecha.

### Riesgo 3: versionado confuso

Mitigacion:

- decidir si cada cierre versionado crea nueva fila o actualiza fila con historial.
- recomendacion inicial: nueva fila versionada si una OT cerrada se reabre y vuelve a cerrar.

### Riesgo 4: recalculo automatico peligroso

Mitigacion:

- nunca pisar el maestro sin aprobacion.
- guardar sugerencias separadas de valores oficiales.
- permitir override manual.

### Riesgo 5: Odoo / albaran se mezcla demasiado pronto

Mitigacion:

- separar cierre productivo de expedicion.
- el albaran no debe ser el disparador del historico.

---

## 9. Preguntas para brainstorming

1. Que estado exacto debe disparar `pendiente_revision`?
2. Que pasos son obligatorios y cuales pueden ser no aplica?
3. Quien puede cerrar y quien puede reabrir?
4. Conviene que `prod_ot_producidas` tenga una fila por OT o una fila por version?
5. Que columnas planas son imprescindibles desde el dia 1?
6. Que datos deben bloquear el cierre si faltan?
7. Que datos solo deben generar aviso no bloqueante?
8. Como marcar una produccion como anomala para excluirla de medias?
9. Como mostrar al usuario \"lo que usamos la ultima vez\" sin saturar la pantalla?
10. Cuando se recalcula el maestro: al cerrar, bajo demanda o en una pantalla de revision?

---

## 10. Prompt sugerido para Claude

```text
Te paso el briefing especifico del Bloque 6 de Minerva.
Minerva es una plataforma de gestion de produccion para una imprenta/packaging que debe sustituir a Optimus.

Quiero diseñar bien el modulo de Producidas / Historico / Cierre de OT.

Objetivos:
- Cuestionar el flujo propuesto.
- Diseñar un modelo de datos robusto pero pragmatico.
- Evitar que el historico se llene de datos malos.
- Conseguir que el historico alimente el Maestro de Articulos sin pisar valores oficiales.
- Mantener agilidad de planta.

Devuelveme:
1. Riesgos principales del diseño.
2. 2-3 alternativas de modelo de datos con trade-offs.
3. Flujo UX recomendado para cierre y reapertura.
4. Lista minima de campos para MVP.
5. Roadmap de implementacion en fases pequeñas.

--- BRIEFING ---
<pegar MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md>
```

