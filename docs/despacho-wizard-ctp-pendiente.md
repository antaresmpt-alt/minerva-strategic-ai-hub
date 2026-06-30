# Pendiente: instrucciones CTP en wizard de despacho

> **Fecha nota:** 24 jun 2026 (noche)  
> **Contexto:** Tras iteración wizard despacho (guillotina / impresión brutas-netas / desbroce).  
> **Usuarios CTP:** Gemma y Marc (`preimpresion`).  
> **Estado actual:** La pestaña Producción del wizard solo muestra texto informativo en CTP; no se siembran opciones.

---

## Problema (igual patrón que Rita / ficha acabados)

Hoy CTP trabaja con **instrucciones en papel** porque Optimus no transmite bien qué hay que hacer en cada OT.

**Objetivo:** Al despachar, Carlos/Jordi marcan qué requiere esta OT en CTP. Gemma y Marc, al abrir la OT en su cola, ven **qué tienen que hacer** sin preguntar a oficina. Al cerrar CTP, deben haber cumplido/marcado esas tareas.

---

## Modelo de dos fases (importante)

| Fase | Quién | Qué |
|------|-------|-----|
| **Despacho** | Oficina (wizard tab Producción → CTP) | Marca checkboxes de lo **requerido** para esta OT. Puede dejar en blanco lo que aún no se sabe. |
| **Ejecución CTP** | Gemma / Marc (mesa / cola CTP) | Ven lo requerido, lo ejecutan, marcan **hecho** al terminar. |

### Regla de negocio acordada

- En **despacho**: las opciones son **requeridas si se marcan**, pero **no es obligatorio marcar todas** al despachar (quien despacha pone lo que sabe).
- En **CTP al cerrar**: lo que quedó marcado como requerido en despacho debe poder validarse como completado (checkboxes de ejecución). Si algo requerido no está confirmado → aviso tipo **«Pendiente de confirmar»** (no bloquear ciego el primer día; iterar severidad).

Analogía: despacho = «pedido de trabajo»; ejecución = «albarán de hecho».

---

## Opciones Optimus → Minerva (referencia RDC / terminal planta)

De las capturas Optimus y del catálogo ya modelado en Minerva (`hoja-ruta-campos-config.ts`, proceso id **16**):

| Campo `datos_proceso` | Etiqueta UI | Tipo Optimus / notas |
|----------------------|-------------|----------------------|
| `prueba_digital` | Prueba digital | Checkbox |
| `prueba_gmg` | Prueba GMG | Prueba contractual color |
| `pdf_x_ok` | PDF X OK | Validación contractual PDF/X |
| `maqueta` | Maqueta | Checkbox |
| `gestion_troquel` | Gestión troquel | Nuevo troquel o recuperado archivo |
| `preparacion_montaje` | Preparación montaje | Checkbox |
| `retoque_diseno` | Retoque diseño | Checkbox |
| `gestion_relieves_stamping` | Relieves / stamping / varios | Checkbox |
| `gestion_fsc` | Gestión FSC | Checkbox |
| `planchas_hechas` | Planchas hechas | Solo ejecución (real) |
| `num_planchas` | Nº de planchas | Solo ejecución; condicional a planchas hechas |
| `horas_proceso` | Horas proceso | Solo ejecución (real) |

**En despacho (propuesta):** checkboxes de la primera fila (requerimientos de trabajo).  
**Solo en mesa CTP:** planchas hechas, nº planchas, horas reales.

---

## UX deseada

### Wizard — tab Producción, bloque CTP

Reemplazar el texto actual («Planchas y detalle CTP se registran en mesa…») por:

```
Instrucciones CTP para esta OT
Marca lo que Gemma/Marc deben hacer. Lo no marcado no se exige.
```

- Grid de checkboxes (mismas etiquetas que Optimus / `CTP_PREIMPRESION_CAMPOS`).
- Opcional: campo notas CTP libre (`notas_ctp` o reutilizar `notas` despacho si no hay columna).
- Guardar en `prod_ot_pasos.datos_proceso` del paso CTP al despachar (semilla, como guillotina/impresión).

**Propuesta técnica campos despacho vs ejecución:**

```json
{
  "requiere_prueba_digital": true,
  "requiere_prueba_gmg": true,
  "requiere_maqueta": false,
  "requiere_gestion_troquel": true,
  "requiere_preparacion_montaje": true,
  "requiere_retoque_diseno": false,
  "requiere_gestion_relieves_stamping": false,
  "requiere_gestion_fsc": false
}
```

En ejecución, los booleanos existentes (`prueba_gmg`, `maqueta`, …) pasan a **hecho**. La UI puede mostrar:

- ✓ Requerido en despacho + ✓ Hecho en CTP → verde  
- ⚠ Requerido en despacho + vacío en CTP → «Pendiente de confirmar»  
- (no requerido) → oculto o gris

### Cola / tarjeta CTP (Gemma, Marc)

En planificación pool, mesa diaria o tarjeta de ejecución:

- Lista compacta de requerimientos marcados en despacho (iconos o chips).
- Destacar pendientes si el paso está en curso y falta confirmar.

### Hoja de ruta / resumen despacho

- Tab Resumen: línea «CTP: prueba GMG, maqueta, gestión troquel…» si hay algo marcado.

---

## Estado código actual (24 jun 2026)

| Pieza | Estado |
|-------|--------|
| `hoja-ruta-campos-config.ts` → `CTP_PREIMPRESION_CAMPOS` | ✅ Campos ejecución definidos |
| `despacho-wizard-dialog.tsx` → sección CTP | ✅ Checkboxes requerimiento |
| `buildDatosProcesoSeed()` para `PROCESO_CTP_ID` | ✅ `requiere_*` en `datos_proceso` |
| `DespachoWizardProcesoDatos.ctp` | ✅ |
| Cola CTP — bloque requisitos en ejecución | ✅ `ctp-ejecucion-requisitos-block.tsx` |
| Validación al cerrar CTP | ✅ Aviso toast (soft, no bloquea) |
| Resumen wizard + seed engomado | ✅ |

**Archivos a tocar en la iteración:**

1. `src/lib/despacho-wizard-shared.ts` — tipo `DespachoWizardCtpDatos`, seed/parse `datos_proceso`
2. `src/components/produccion/ots/despacho-wizard-dialog.tsx` — UI checkboxes CTP + resumen
3. `src/components/produccion/planificacion/` — tarjeta OT en área preimpresión (mostrar chips)
4. `src/lib/hoja-ruta-campos-config.ts` — opcional: flags `despachable` / `soloEjecucion` por campo

---

## Alcance sugerido mañana (v1 CTP despacho)

**Mínimo viable:**

1. Checkboxes requerimiento en wizard (8 opciones de trabajo, sin planchas/horas).
2. Persistir en `datos_proceso` al guardar despacho.
3. En mesa ejecución CTP: bloque «Requerido en despacho» read-only arriba del formulario actual.

**Siguiente iteración:**

4. Validación al cerrar paso CTP (avisos pendientes).
5. Import desde Optimus si algún día hay API/campo (hoy manual en despacho).
6. Prefill desde OT anterior / referencia Minerva (clonar requerimientos CTP).

---

## Fuera de alcance (por ahora)

- Sustituir Optimus como fuente de verdad de diseño.
- Obligar a marcar todo en despacho antes de guardar.
- CTP compartido entre hijas de contenedor (ver `GUIA_MAÑANA.md` — cada hija independiente hoy).

---

## Prueba manual sugerida (cuando esté implementado)

1. Despachar OT con CTP en itinerario → marcar prueba GMG + gestión troquel.
2. Login Gemma → cola CTP → OT muestra esos dos chips.
3. Abrir ejecución → marcar prueba GMG hecha, dejar troquel pendiente → aviso al cerrar.
4. Completar ambos → cerrar CTP OK.
5. Resumen despacho y hoja de ruta reflejan lo guardado.

---

## Relacionado

- `GUIA_MAÑANA.md` — demo OT 98010, hijas en fase CTP  
- `src/lib/hoja-ruta-campos-config.ts` — `CTP_PREIMPRESION_CAMPOS`, `PROCESO_CTP_ID = 16`  
- Wizard despacho — iteración noche 24 jun: modal ancho, guillotina, impresión brutas/netas, desbroce con netas
