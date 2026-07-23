# MINERVA — Briefing Bloque 6: Producidas / Historico / Cierre de OT

> Documento autocontenido para brainstorming y diseño funcional.
> Tema: como cerrar una OT, congelar su hoja de ruta y convertir lo producido en historico util.
> Complementa a `MINERVA_BRIEFING.md`, `MINERVA_CONTEXTO_TECNICO.md` y `FASES_HOJA_RUTA_DIGITAL.md`.
>
> Fecha: 13 de junio de 2026.
> Actualizado: 23 jul 2026 — Reabrir OT + editar exclusión + Excel + fix PDF Dialog/Dropdown. Mapper y pantalla Producidas OK. Pendiente: Engomado prep/tiraje, recálculo promedios.

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

**ESTADO (23 jul 2026):** Tabla creada (`20260723170000_prod_ot_producidas.sql`).
UI de cierre MVP implementada (solo OTs simples; contenedor/hijas = Fase 8.4).

Motivo:

- El snapshot preserva toda la verdad historica, aunque el modelo cambie en el futuro.
- Las columnas planas evitan consultas lentas dentro de JSONB para cosas frecuentes.

### Cierre en dos fases

No cerrar automaticamente al finalizar el ultimo paso.

Flujo acordado (MVP opción 3 — estado derivado):

```text
Ultimo paso finalizado
  -> OT cumple condición derivada "pendiente revisión" (itinerario completo + no archivada)
  -> Botón "Cerrar y enviar a histórico" visible en HojaRutaOtDialog
  -> revision humana + checklist
  -> INSERT en prod_ot_producidas
  -> botón desaparece (OT ya archivada)
```

**NO hay transición automática de estado** en esta versión. El botón aparece cuando
se cumplen las 3 condiciones: OT simple, itinerario completo, sin fila en histórico.

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

## 7.1 Recalculo precalculado y persistido (decision cerrada — jul 2026)

> Sesion Manel + Claude + Cursor (jul 2026). Refina y en parte **corrige** el §7:
> el §7 describia mostrar la sugerencia "al vuelo" al despachar; aqui se decide
> **precalcular y persistir** el resultado en el maestro. Esta es la decision de
> arquitectura vigente para el recalculo.

### 7.1.1 El patron: maestro como cache de lectura, historico como fuente

La idea de Manel: el despacho **no debe calcular nada online**. En vez de que el
wizard haga `AVG()` / mediana sobre `prod_ot_producidas` cada vez que se abre, un
proceso **bajo demanda** (boton "Actualizar promedios" en el Maestro) recorre el
historico, calcula, y **escribe el resultado en columnas de `prod_referencias`**.
El despacho luego solo **lee** el maestro (lectura simple, instantanea).

```text
OT termina -> revision -> prod_ot_producidas   (historico inmutable = fuente)
                                 |
                                 v
             boton "Actualizar promedios"       (bajo demanda, control humano)
                                 |
                                 v
                        prod_referencias         (maestro = cache de decision)
                                 |
                                 v
             Despacho nuevo -> prefill instantaneo (lectura simple, sin calculo)
```

**Por que precalcular y no calcular al vuelo:**

- El despacho es el momento de **maxima prisa** en oficina tecnica; meter ahi una
  agregacion sobre historico (con snapshots JSONB y OTs contenedor/hijas) es
  arriesgado en latencia justo donde no se quiere.
- **Coherencia con lo que ya existe:** el flujo actual `tipo_engomado_habitual`
  (maestro) -> despacho ya es este mismo patron. Esto lo **extiende**, no introduce
  un modelo nuevo.
- **Control humano:** el historico no pisa el maestro solo; alguien revisa y pulsa
  actualizar. Alineado con el Riesgo 4 del §8 ("nunca pisar el maestro sin aprobacion").

### 7.1.2 Por que aqui SI se cachea un derivado (y en Bloque 9 NO)

Tension conceptual a dejar por escrito, para no auto-contradecirse mas adelante:

En **Bloque 9** se decidio que los campos calculados (`cantidad_libre`) **nunca se
almacenan** — se derivan siempre (vista `stock_palets_atp`), porque "el estado nunca
miente". Aqui se hace lo contrario **a proposito**, y esta bien. La diferencia:

| | `cantidad_libre` (Bloque 9) | promedio de referencia (Bloque 6.x) |
|---|---|---|
| Frecuencia de cambio | Con **cada movimiento** de stock | Solo al **cerrar una OT nueva** de esa referencia |
| Control del recalculo | Ninguno (cambia solo) | Total (Manel pulsa el boton) |
| Si se cachea | Se descuadra en segundos | Se mantiene valido semanas |

**Regla general:** un derivado que cambia constantemente y sin control **no** se cachea;
uno que cambia rara vez y bajo control humano **si** se cachea. El promedio es del
segundo tipo.

### 7.1.3 Separacion promedio / oficial (no mezclar en la misma columna)

El boton de recalculo **nunca** debe pisar un valor fijado a mano. Por cada campo
promediable, dos capas:

| Capa | Ejemplo | Quien la escribe |
|------|---------|------------------|
| **Promedio calculado** | `horas_impresion_promedio` | Solo el boton "Actualizar promedios" |
| **Valor oficial / lock** | `horas_impresion_oficial` (o flag `_lock`) | Solo un humano, a mano |

- Prefill en despacho = `oficial ?? promedio`.
- El boton recalcula y pisa **solo** la columna `_promedio`; jamas toca `_oficial`.
- Esto materializa el Riesgo 4 del §8 ("guardar sugerencias separadas de valores oficiales").

### 7.1.4 Metadatos del calculo (guardar mas que el numero)

Junto a cada promedio, persistir el contexto para poder confiar en el:

- `promedios_actualizados_at` — cuando se recalculo por ultima vez.
- `promedios_basados_en_n_ots` (o `x_muestra_n` por campo) — sobre cuantas OTs se calculo.
- Opcional: guardar **mediana Y media** para numericos, para detectar dispersion.

Motivo: en despacho, ver "impresion 1,8 h" no es lo mismo si sale de **5 OTs** o de **1 sola**
anomala. El `n` da confianza (o alerta) sobre el dato.

### 7.1.5 Estadistico por tipo de campo

- **Categoricos** (material, troquel, tipo_engomado, caja): **moda** (valor mas frecuente en las N).
- **Numericos** (horas por proceso, merma, estuches/bulto): **mediana** (o media recortada),
  no media simple — menos sensible a una OT con averia.
- **Horas de produccion:** ver §7.1.10 — no promediar "horas totales" a pelo; separar
  **entrada/preparacion** (absoluta) de **tiraje** (normalizado a horas/millar).

### 7.1.6 Dependencia dura: esto NO se construye sin Bloque 6

El boton de promedios necesita una **fuente de historico real, cerrada y limpia**:
`prod_ot_producidas` con el flag de "produccion anomala / excluir de medias". Hoy esa
tabla **no existe** todavia.

- Mientras no exista, el unico "promedio" posible saldria de `produccion_ot_despachadas`,
  que es **planificado, no real**. Sirve de puente, pero **no** responde a la pregunta
  de negocio ("troquelamos en 2 h o en 3 de media?").
- Por tanto: **Bloque 6 (tabla + cierre en dos fases + flag anomala) va primero.**
  El boton de recalculo (esta sub-fase, "Bloque 6.x") va **despues** y lee de ahi.

Lo unico que se puede adelantar sin Bloque 6, por ser barato y aditivo:
- Anadir a `prod_referencias` las columnas `*_promedio`, `*_oficial`,
  `promedios_actualizados_at`, `*_muestra_n`. Migracion aditiva, sin dependencia.

### 7.1.7 Fase 2 (bootstrap manual) vs Fase 6.x (promedios): son complementarias

No son excluyentes; cubren momentos distintos del proyecto:

| | **Fase 2 — Despacho -> Maestro** | **Fase 6.x — Historico -> Maestro** |
|---|---|---|
| Que es | Boton "guardar esto como predeterminado" al despachar | Boton "actualizar promedios" en el maestro |
| Fuente | El despacho que se esta haciendo | `prod_ot_producidas` (N OTs cerradas) |
| Necesita Bloque 6 | **No** | **Si** |
| Cuando aporta | **Ya** — es el bootstrap manual, sin historico | Cuando hay volumen de OTs cerradas fiables (Ramon cerrando) |
| Regla de escritura | Solo rellena vacios o con confirmacion explicita | Solo pisa `_promedio`, respeta `_oficial` |

Durante meses, la **Fase 2 sera la unica fuente real** (Ramon aun no cierra OTs con
datos fiables). La Fase 6.x brilla cuando `prod_ot_producidas` tenga masa critica.

### 7.1.8 Deuda tecnica del prefill y bug del picker — RESUELTO (Ola 3, jul 2026)

Estado historico (antes de Ola 3), para contexto:

- El prefill de despacho no leia del maestro. Al elegir referencia, el orden era:
  (1) valores ya en el formulario, (2) ultimo despacho de esa referencia
  (`applyClonePrefill`, solo campos vacios), (3) fallback `tipo_engomado_habitual`
  (roto, ver bug abajo), (4) el resto de `*_habitual` no se usaba.
- **Bug:** `referencia-minerva-picker.tsx` no incluia `tipo_engomado_habitual` (ni
  ningun otro `*_habitual`, ni `defaults_proceso`) en su `SELECT`, asi que el
  fallback (3) casi nunca llegaba a aplicarse.

**Resuelto en Ola 3** (ver `FASES_MAESTRO_ARTICULOS.md` § Fase 2 / Ola 3):

- El prefill automatico **sigue siendo el ultimo despacho** (sin cambios, decision
  respetada — no se cambio en silencio).
- Fix del `SELECT` del picker: ahora trae todos los `*_habitual` + `defaults_proceso`.
- Botones explicitos junto al picker: **"Usar ultimo trabajo"** / **"Usar maestro"**
  (este ultimo rellena solo vacios desde `*_habitual` + `defaults_proceso`, nunca
  sobrescribe). `ruta_habitual` queda fuera del boton — ver Fase 6 (pendiente).

### 7.1.9 Roadmap de esta sub-fase

| Orden | Paso | Depende de | Riesgo | Estado |
|-------|------|-----------|--------|--------|
| 1 | **Fase 2**: boton "guardar en maestro" al despachar (solo vacios/confirmacion) | Nada | Bajo — no cambia prefill | ✅ Hecho |
| 2 | Columnas `*_promedio` / `*_oficial` / `_muestra_n` / `promedios_actualizados_at` en `prod_referencias` | Nada (aditivo) | Bajo | Pendiente |
| 3 | **Bloque 6**: `prod_ot_producidas` + cierre 2 fases + flag anomala | — | Bloque grande | ✅ Tabla + cierre MVP + mapper + pantalla Producidas (`/produccion/producidas`). ⏭️ Reabrir / promedios. |
| 4 | **Boton "Actualizar promedios"** en Maestro (lee historico, escribe `_promedio` + horas/millar §7.1.10) | Paso 3 | Medio | Pendiente (depende de 3) |
| 5 | Prefill despacho desde maestro con **botones explicitos** + fix picker | Acuerdo con planta | Medio (cambio visible) | ✅ Hecho (Ola 3, no dependia de Bloque 6) |

### 7.1.10 Normalizacion de horas: entrada/preparacion vs tiraje por millar

> Decision cerrada sesion jul 2026 (Manel). Aplica a **impresion, troquelado y engomado**.
> No implementar hasta existir `prod_ot_producidas` + boton de recalculo (§7.1.9 pasos 3–4).
> Documentado ahora para que las olas de maestro (embalaje/ruta/defaults) no inventen
> promedios de horas incorrectos.

#### Problema

Promediar "horas de impresion = 2,1 h" entre OTs de 3.500 y 12.000 unidades **no sirve**
para planificar: las horas de **tiraje** escalan con la cantidad pedida (y, en impresion/
troquel, el trabajo real ya incorpora poses, formato, etc.).

#### Separacion obligatoria (tres procesos)

Para **cada** proceso (impresion, troquelado, engomado) hay **dos familias** de metricas:

| Familia | Que mide | Como se agrega | Ejemplo orientativo (ver convenio abajo) |
|---------|----------|----------------|------------------------------------------|
| **Entrada / preparacion** | Arranque, montaje, prep. Casi **fija por trabajo**; distinta segun articulo, pero **estable** en repeticiones del mismo codigo. **No** escala lineal con la cantidad. | Mediana (o media) **absoluta** en horas | `horas_prep_impresion_promedio`, `horas_prep_troquelado_promedio`, `horas_prep_engomado_promedio` |
| **Tiraje / trabajo** | Tiempo de produccion que **si** crece con unidades pedidas | Normalizar a **horas por millar de pedido**, luego mediana de esos millar | `horas_millar_impresion_promedio`, `horas_millar_troquelado_promedio`, `horas_millar_engomado_promedio` |

**Engomado:** igual que impresion y troquel — la preparacion (montar, ajustar) es distinta
por trabajo pero estable; el pegado/tiraje depende de la cantidad. **Separar prep de tiraje.**

**Convenio de nombres (pendiente de fijar al escribir la migracion 6.x):** unificar
`entrada` vs `prep` (recomendacion: siempre `prep`), sufijo `_promedio` / `_oficial` /
`_muestra_n` en **todas** las metricas (tambien en millar), y nombres de proceso
(`impresion` / `troquelado` / `engomado`) en singular de proceso, no mezclar
`troquel` vs `troquelado`. Los ejemplos de esta seccion son orientativos hasta esa migracion.
Misma deuda abierta que `_promedio` / `_oficial` en §7.1.3.

**Alcance de la estabilidad de la prep:** la entrada/prep es estable **dentro del mismo
codigo de articulo** (tintas y troquel suelen ser fijos ahi; montar 6 planchas vs 2 queda
absorbido al promediar OTs de ese codigo). **No** es trasladable entre codigos distintos
sin ajustar por tintas/troquel: no copiar la prep de un articulo a otro "por analogia"
sin revisar eso.

#### Formula del millar (tiraje)

Por cada OT cerrada no anomala, con cantidad pedida `Q > 0` y horas de tiraje reales `H`:

```text
horas_millar = H × 1000 / Q
```

Al despachar una OT nueva con cantidad `Q'`:

```text
horas_tiraje_previstas ≈ horas_millar × (Q' / 1000)
horas_totales_proceso  ≈ entrada/prep + horas_tiraje_previstas
```

#### Por que no hace falta "poses" en la formula

El denominador es **cantidad de pedido** (unidades cliente), no hojas. Las poses, el
formato y el ritmo de aquella produccion ya estan **embebidos** en las horas historicas
`H` de ese articulo. Extrapolamos el resultado pasado a la cantidad nueva del **mismo codigo**.

Si cambian poses de forma estructural (p. ej. 4 → 8), el millar se desvia: override
`_oficial` o recalcular tras nuevas OTs cerradas.

#### Capas promedio / oficial (§7.1.3)

Misma regla: el boton escribe solo `*_promedio`; nunca pisa `*_oficial`.
Prefill = `oficial ?? promedio`. Guardar `muestra_n` y `promedios_actualizados_at`.

#### Controles al calcular

- Solo OTs en `prod_ot_producidas`, no despachos planificados.
- Excluir flag anomala / outliers de cantidad muy rara.
- Mediana de los millar (y de las entradas absolutas), no media simple.
- Si `n` es bajo (p. ej. < 3), mostrar aviso de poca confianza; no planificar a ciegas.

#### Que NO hacer en las olas de maestro (Fase 2 ampliada)

Las olas 1–3 de ampliacion despacho→maestro **no** implementan estos campos de horas.
Solo documentan / dejan hueco. Los promedios de horas llegan con Bloque 6.x.

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
10. Cuando se recalcula el maestro: al cerrar, bajo demanda o en una pantalla de revision? → **RESUELTO §7.1:** bajo demanda (boton en Maestro), precalculado y persistido.

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
