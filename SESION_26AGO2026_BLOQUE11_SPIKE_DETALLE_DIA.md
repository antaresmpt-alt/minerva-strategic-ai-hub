# Sesión 26 ago 2026 — Spike §6.5 + fase 3 detalle del día (cierre noche)

> **Rama:** `feature/bloque11-contenedor-ctp-spike`  
> **Brief:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` §6.5 / §24–25  
> **Migración aplicada:** `supabase/migrations/20260826200000_prod_calendario_detalle_dia.sql`  
> **Cierre sesión:** PDF rico + bug cierre impresión (Electron) documentados y corregidos

---

## 1. Decisión persistencia (spike mañana/tarde)

**Opción B — tabla ligera `prod_calendario_detalle_dia`.**  
No reutilizar `prod_mesa_planificacion_trabajos`.

### Due diligence: ¿coexistencia en la misma tabla?

Si detalle-día escribiera en `prod_mesa_planificacion_trabajos` junto a Pool/LEGACY:

| Hallazgo | Efecto |
|----------|--------|
| `ux_mesa_ot_activa` (OT + máquina, estados activos) | **Choque** misma OT Pool + detalle |
| `mesa_trabajo_id` + trigger finaliza → `estado_mesa` | Semántica de ejecución de mesa |
| Contenedor ya usa `mesa_trabajo_id = null` | Camino feliz ≠ mesa |
| `calendario-mesa-espejo.ts` | Mentiría «en mesa» con filas de planning |
| `origen_pool_id`, ciclo `estado_mesa` | Pensado para Pool/`launchExecution` |
| LEGACY por rol | Misma tabla = aislamiento frágil |

→ **A descartada.** B zanjada.

*(Fix horas «Cerrar proceso» 23 ago: solo `prod_mesa_ejecuciones` / `datos_proceso` — no tocó la tabla de mesa. Spike limpio.)*

### Modelo

```
calendario (pastilla día) ──CASCADE──► detalle_dia (máquina/turno/slot/horas)
                                              │
                                              ▼ lectura orden
                                    contenedor ejecución
                                    (Hoy planificado ∩ disponible
                                     + cola por fecha entrega)
```

- **Itinerario autoriza; detalle solo prioriza.**
- **Sin columna `fecha`:** la fecha vive en `prod_calendario_produccion_ot`. Mover día = UPDATE mismo `id` → CASCADE no dispara → el orden fino se conserva.
- Huérfanas: CASCADE al quitar pastilla; no auto-borrar planes del día no cumplidos (Carlos debe ver la rotura).

### Diseño cerrado junto al spike

1. **Ejecución:** 2 grupos visuales (Hoy / Disponibles) — orden «Hoy» por `slot_orden` + **cabeceras UI 27 ago** ✅.
2. **Material en calendario:** icono no bloqueante ✅ 27 ago; color = Pool `materialStatus` + gris N/A; compra en tooltip. Verde = cartelado ≥ objetivo.
3. **Nav:** no bautizar «Planificador» ahora (Bloque 12). Sí: entrada detalle desde calendario; valla LEGACY por rol cuando toque (§10).
4. **Backlog:** exponer «Guillotina cortado / pendiente» en contenedor I/D (dolor Rita/Ramón) — no bloquea fase 3.
5. **Drag&drop** en detalle-día: diferido. Piloto Carlos con botones ↑↓ / →M / →T unos días.

---

## 2. Fase 3 — UI «Organizar detalle del día» (v1 → v2)

### Archivos clave

| Pieza | Ruta |
|-------|------|
| Tipos | `src/types/prod-calendario-detalle-dia.ts` |
| CRUD + draft + sync orden + append pegar | `src/lib/calendario-detalle-dia.ts` |
| Impresión rica + ventana nueva | `src/lib/calendario-detalle-dia-print.ts` |
| Dialog UX | `src/components/produccion/ots/calendario-detalle-dia-dialog.tsx` |
| Entrada calendario | `calendario-produccion-page.tsx` (modal día → Organizar…) |
| Contenedor orden Hoy | `planificacion-ots-ejecucion-tab.tsx` (`compareConPlanHoy` / `fetchPlanHoySlotByOt`) |

### UX v2 (smoke Manel OK)

- Draft local + **Guardar orden** / **Atrás** (confirm si dirty).
- `<select>` nativo de máquina (UUID legible; evita bug Radix Select).
- Seed desde `orden` del calendario si no hay filas guardadas.
- Mañana arriba / tarde abajo; botones **→ M** / **→ T**; ↑↓ reordenan.
- Sync `prod_calendario_produccion_ot.orden` al guardar (misma secuencia visible en pastillas).
- Hechas en cajón colapsable.
- Pegar OT → `appendDetalleSlotAfterCalendarMove` (final del mismo máquina/turno; default mañana). Aceptado como default de piloto.
- Contenedor I/D/E: «Hoy planificado» ordena por `slot_orden` del detalle antes que fecha entrega.

### Pendiente UX (no bloquea piloto)

- Cabeceras visuales «Hoy» / «Disponibles» en lista ejecución.
- Icono material en pastilla calendario.
- Drag&drop slots.
- Cajón «Atrasadas».
- Semáforos M/T vivos en PDF (hoy: datos despacho + maestro; M/T omitidos si gris / sin informar).

---

## 3. LOTE PDF + BUG CIERRE (noche 26 ago) — **CERRADO**

### Problema A — PDF del detalle demasiado pobre

El primer PDF (template React mínimo + `react-to-print`) solo listaba OT + título.  
Carlos/Gemma necesitan el **mismo tipo de ficha** que la mesa diaria LEGACY: cliente, tintas, acabado, papel, hojas, horas, carga % por turno.

### Solución A — PDF rico HTML

`src/lib/calendario-detalle-dia-print.ts`:

1. `fetchDetalleDiaPrintMetaByOts` — `prod_ots_general` (cliente, título, entrega) + `produccion_ot_despachadas` (tintas, acabado_pral, material, troquel, hojas, horas entrada+tiraje).  
   - **No hay columna `barniz`** en despachadas → el PDF usa acabado; barniz vacío (sin inventar).
2. `buildDetalleDiaPrintHtml` — A4 **landscape**, bloque máquina, turnos mañana/tarde, cards con OT/cliente/trabajo/pills/hojas·horas, % carga vs 8h (default).
3. Botón **PDF** del dialog: genera HTML y llama `printHtmlInNewWindow`.

Plantilla React fina `calendario-detalle-dia-print.tsx` **eliminada** (ya no se usa).

### Problema B — Cerrar el diálogo de impresión tumba toda Minerva

**Síntoma (Manel):** al cerrar el print dialog del sistema (Cancelar / tras imprimir), se cierra **toda** la app (Electron/webview / embebido), no solo el diálogo.  
Reproducible en:

- PDF del detalle del día (`useReactToPrint` en el dialog).
- «Imprimir plan del día» de mesa diaria LEGACY (`planificacion-mesa-diaria-tab.tsx` + mismo patrón).

**Causa raíz (hipótesis confirmada por patrón):** `react-to-print` / `window.print()` sobre la **misma ventana** donde vive la app. En el shell Electron/Cursor webview, el ciclo `beforeprint` / `afterprint` / teardown del diálogo nativo puede destruir o recargar el host window → la UI Minerva desaparece.

**No** es un bug de negocio BD ni de React Dialog Radix; es de **dónde** se invoca `print()`.

### Solución B — Imprimir siempre en ventana nueva

Helpers compartidos en `calendario-detalle-dia-print.ts`:

| Función | Uso |
|---------|-----|
| `printHtmlInNewWindow(html, title)` | Abre `window.open`, escribe HTML, `print()` **solo ahí**, `afterprint` → `w.close()`. La app principal no recibe el teardown. |
| `printElementInNewWindow(el, title, css?)` | Clona nodo offscreen + estilos de la página → misma vía. |

Cableado:

1. **Detalle del día** → `printHtmlInNewWindow` (HTML rico).
2. **Mesa diaria LEGACY** → deja de usar `useReactToPrint`; botón llama `printElementInNewWindow(printDiariaRef.current, …)` manteniendo `MesaDiariaPrintTemplate` offscreen.

Si el bloqueador de popups impide `window.open`, toast pidiendo permitir ventanas emergentes.

### Alcance consciente (no tocado hoy)

Otros módulos siguen con `useReactToPrint` (externos, fichas técnicas, tablón semanal, ventas…). Mismo riesgo potencial en Electron. **Backlog:** migrar a `printHtmlInNewWindow` / `printElementInNewWindow` cuando toque; prioridad = lo que Carlos/Gemma usan a diario (detalle + mesa diaria) ✅.

### Smoke recomendado (próxima sesión / piloto)

1. Detalle día → PDF → Cancelar diálogo impresión → **Minerva sigue abierta**.
2. Mesa diaria → Imprimir plan del día → mismo check.
3. PDF detalle: cards con cliente/tintas/acabado/papel/hojas/h y % mañana/tarde.
4. Guardar orden sigue OK (regresión v2).

---

## 4. Estado rama / merge

- Rama spike sigue **sin merge a `main`** hasta OK Manel.
- No commitear: `.MANUALES/MINERVA_MANUAL_CARTELAS_*`, `MINERVA_MANUAL_RESERVAS_*`, `DISQUISICIONES VARIAS MANEL/`.

### Siguiente (mañana / piloto)

1. Smoke PDF + bug cierre en planta / Electron.
2. Piloto Carlos UX botones (sin DnD).
3. ~~Cabeceras visuales Hoy/Disponibles en contenedor~~ ✅ 27 ago
4. ~~Icono material pastilla~~ ✅ 27 ago (`calendario-material-status.ts`)
5. Valla LEGACY por rol (§10) cuando toque.
6. Bloque 12: nombres menú.
7. Backlog print transversal → **maestro** (ítem plataforma abierto).

---

## 5. Cabeceras cola + icono material — 27 ago

### Contenedor ejecución
- Grupos visuales: **En ejecución** · **Hoy · planificado** · **Disponibles sin plan** · Otras.
- `planSlotHoy` / `fechaEntregaCola` en filas virtuales I/D/E; `colaRows` respeta slot (ya no se pierde al reordenar por OT).
- Badge `#n` + acento navy/oro en filas del plan de hoy.

### Calendario pastillas
- Icono `Package` con color Pool (gris/rojo/ámbar/verde).
- Tooltip: cartelas / muelle / nº compra · **no bloquea** colocar.
- Lib: `src/lib/calendario-material-status.ts`.

---

*Manel + Cursor · 26 ago — spike B + fase 3 v1/v2 + PDF rico + fix cierre impresión · 27 ago cabeceras + material*
