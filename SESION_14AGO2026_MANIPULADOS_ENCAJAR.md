# Sesión 14 ago 2026 — Encajar en Manipulados, flags de despacho, portada

> **Fuente de esta jornada.** Commits en `main`: `b1c4104`, `1305dcc`. Deploy: Vercel rama `main`.  
> **Caso de campo:** OT **36286** (nidos, sin Engomado: retractilar 25 → encajar MN1L 2500 uds/caja).  
> Ayer (13 ago): `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md`.

---

## Mensaje clave

Tres pulidos de planta de cara al TEST de septiembre:

1. **Encajar** en Manipulados internos (15), mismos campos de embalaje que Engomado (caja, estuches/bulto, pico, palets).
2. El **wizard de despacho** siembra Retractilar / Etiquetar / Encajar en `datos_proceso` — mesa no parte de cero.
3. **`/produccion` entra directo al maestro de OTs.** La portada del módulo no tenía uso operativo. El lápiz de redespacho sale del **Pool**; queda en OTs Despachadas.

---

## 1. Encajar en Manipulados (como Engomado)

### Problema

OTs tipo nidos (p. ej. **36286**) no tienen Engomado. El encajado se hacía en **notas** de Manipulado. Retractilar/Etiquetar ya existían en mesa; Encajar no.

### Qué hay ahora

Al marcar **Encajar** en mesa (proceso 15) aparecen:

| Campo | Notas |
|-------|--------|
| `codigo_caja_embalaje` | Catálogo `prod_cajas_embalaje` (mismo select dinámico) |
| `estuches_por_bulto` | Uds. por caja. **No** reutiliza `unidades_por_paquete` (ese id es retractilar) |
| `bultos_por_palet` | Default del catálogo al elegir caja |
| `bultos_completos` / `pico` / `bultos_totales` / `palets` | Mismo `computeEngomadoReparto` (tolerancia 1 bulto) |

Config: `MANIPULADOS_INTERNOS_CAMPOS` + tipo `DatosProcesoManipuladosInternos` en `hoja-ruta-campos-config.ts`.  
Cálculo: `enrichManipuladoDatosProceso` en `planificacion-ots-ejecucion-tab.tsx`.

### Prueba planta — OT 36286

Despacho: Retractilar 25, Etiquetar 25, Encajar MN1L / 2500. Mesa sembró descripción y cifras:

- Unidades **28.800**
- Paquetes retractilar/etiquetar **1.152**
- Bultos 11 + pico 1.300 → **12** bultos, **1** palet

No hace falta cerrar el proceso para ver Encajar: si ya estaba abierto, recargar mesa y marcar el flag.

---

## 2. Flags en el wizard de despacho

Paso Producción, proceso **Manipulados / Encajado**:

- Checkboxes **Retractilar**, **Etiquetar**, **Encajar**
- Campos condicionales (uds/paquete, caja, estuches/bulto)
- Seed `buildDatosProcesoSeed` (proceso 15) + descripción automática  
  p. ej. *«Retractilar de 25. Etiquetar de 25. Encajar en MN1L (2500 uds/caja).»*
- Restaura desde pasos: `parseProcesoDatosFromPasos`
- Resumen del wizard muestra la misma línea

Embalaje de **Engomado** sigue en `form.codigo_caja_embalaje` / `unidades_por_embalaje`. Manipulados usa `procesoDatos.manipulados` para no mezclar nidos con engomado.

---

## 3. Pool sin lápiz + portada

| Antes | Ahora |
|-------|--------|
| Pool: lápiz abría el wizard de redespacho | Solo icono hoja de ruta. Redespacho = **OTs Despachadas** (Ruta / Lápiz) |
| Portal → `/produccion` = portada ilustrada | `redirect("/produccion/ots")` |

El href del portal puede seguir siendo `/produccion`. Bloque 12 (landing por rol) sigue aparcado; esta redirección es el default de gestor hasta entonces.

---

## 4. Relación con ayer (Ramón / itinerario)

No se tocó impresión externa. Estado al cierre de hoy:

| Tema | Estado |
|------|--------|
| Imprimir fuera 1/2 → 21 | ✅ 13 ago, OT 98015 |
| Anular mesa → Pool | ✅ 13 ago |
| Ruta / cola viva + wizard sin wipe | ✅ 13 ago (+ noche `325429d`); campo 14 ago OT **36286** |
| Captura envío/recepción (`ExternoCantidadDialog`) | ✅ ya estaba; 98015 envió 1600 / recibió 1400 |
| Muelle: netas vs brutas | ⏳ consciente, no urgente |
| Prefill horas al añadir proceso en Ruta | ⏳ el paso entra; horas luego |

---

## 5. Archivos / commits

| Commit | Qué |
|--------|-----|
| `b1c4104` | Encajar + flags wizard + quitar lápiz Pool |
| `1305dcc` | `/produccion` → `/produccion/ots` |

Archivos clave:

- `src/lib/hoja-ruta-campos-config.ts`
- `src/lib/despacho-wizard-shared.ts`
- `src/components/produccion/ots/despacho-wizard-dialog.tsx`
- `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx`
- `src/components/produccion/planificacion/planificacion-pool-ots-tab-v2.tsx`
- `src/app/produccion/page.tsx`

---

## 6. Pendiente (no de esta sesión)

- Prefill de horas al añadir proceso desde Ajustar itinerario.
- Muelle: mostrar netas pedidas en vez de brutas.
- Plan engomado desde salida troquel; OCR / sobrantes al cierre.
- Bloques 11 / 12 / 5 / 8.5 — no abrir ahora; pulir fricción de planta hacia TEST septiembre.

Tarde del mismo día: lista gorda de OTs en ejecución — `SESION_14AGO2026_EJECUCION_LISTA.md`.
