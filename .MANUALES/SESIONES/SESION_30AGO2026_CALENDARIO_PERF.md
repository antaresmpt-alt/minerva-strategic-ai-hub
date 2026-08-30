# Sesión 30 ago 2026 — Calendario + ejecución: perf (3 PRs) ✅

> **Rama:** `main`  
> **Commits:** `8357edf` (PR1 bandeja) · `a37f759` (PR2 guardar detalle-día) · `28f8a72` (PR3 render/carga)  
> **Relacionado mismo día:** `4413fa5` — OTs en ejecución (filtros / lista sin plan)  
> **Auditoría origen:** Claude Code solo lectura (agosto 2026) — plan ajustado con Manel/Claude

---

## Resumen

Tres PRs de rendimiento en **Calendario Producción** (sin cambio de diseño Bloque 11). El grid del mes estaba razonablemente bien; el coste real era **bandeja lateral + escritura detalle-día + inputs en el padre**.

| PR | Qué | Impacto |
|----|-----|---------|
| **1** | Bandeja: no montar si cerrada + `fetchCalendarioBandejaRaw` separado del filtro cliente | ~65 queries menos en cada carga si bandeja cerrada; 0 refetch al teclear en filtro bandeja |
| **2** | `saveDetalleDiaBoard` batched (delete + upsert + orden en paralelo) | Guardar orden del día: de ~40 round-trips en serie a 3 oleadas |
| **3** | Filtro/modal día con estado local, `DiaCelda` memo, `rowsRef`, maestro chunked, material `Promise.all` | Fluencia al escribir; bug latente `.in()` >100 OTs |

**Smoke manual Manel:** PR1 y PR2 OK en planta. PR3: build + tests automatizados OK (ver abajo).

---

## Patrón reutilizable (leer antes de re-auditar)

> **«Módulo fantasma que carga aunque esté cerrado»** fue la causa real **dos veces** en la semana del 29–30 ago 2026:
>
> 1. **Calendario — bandeja** (`hidden` CSS pero montada → ~65 queries siempre).  
> 2. **Compras** (21 ago, `20a06a5`) — cascada re-render + estado de edición en el padre de cientos de filas.  
> 3. **Menor:** OTs en ejecución (`4413fa5`) — 170+ filas re-renderizadas por tecla en el buscador del padre.

**Si un módulo «va lento» sin que el usuario lo use:** buscar primero paneles/modales montados con `hidden`, fetches en `useEffect` que dependen de filtros ya resueltos en cliente, e inputs de búsqueda en el componente padre de listas grandes.

**Checklist rápido**

- [ ] ¿Panel cerrado = desmontado (`{open && <Panel />}`) o `if (!open) return` en load?  
- [ ] ¿Filtro de texto = `useMemo` local sin refetch de red?  
- [ ] ¿Modal con estado de formulario fuera del grid/lista padre?  
- [ ] ¿Guardado N filas = batch/RPC, no N awaits en serie?

---

## Archivos tocados

| Área | Archivos |
|------|----------|
| PR1 | `calendario-bandeja-panel.tsx`, `calendario-produccion-page.tsx` |
| PR2 | `calendario-detalle-dia.ts`, `calendario-detalle-dia.test.ts` |
| PR3 | `calendario-produccion-page.tsx`, `calendario-material-status.ts` |
| Ejecución (mismo día) | `planificacion-ots-ejecucion-tab.tsx` |

---

## Smoke (30 ago)

### Automatizado ✅

- `npm run build` — OK  
- `vitest` calendario: `calendario-bandeja`, `calendario-detalle-dia`, `calendario-detalle-dia-board` — **19/19 OK**

### Manual — checklist piloto lunes

| # | Paso | Esperado |
|---|------|----------|
| 1 | Calendario → filtro «OT / trabajo / cliente» — escribir rápido | Texto fluido; grid no congela |
| 2 | Abrir día → buscar OT + escribir nota | Modal responde; mes detrás sin lag |
| 3 | Bandeja **cerrada** → recargar → DevTools Network | Sin ráfaga de queries bandeja (~65) |
| 4 | Detalle del día vista mesa → reordenar → **Guardar orden** | Respuesta claramente más rápida que antes |
| 5 | Cambiar ámbito I/D/T/E con mes cargado | Sin error (maestro chunked) |

**Nota bandeja (cambio vs sesión 23 ago):** el toggle **desmonta** el panel al cerrar (antes `hidden` sin desmontar). Al reabrir bandeja recarga una vez — comportamiento intencional PR1.

---

## Veredicto auditoría (recordatorio)

- **Red dominante:** bandeja (1500 OTs / ~65 queries) — PR1.  
- **Percepción «Guardar»:** N writes en serie — PR2.  
- **Lag al escribir:** inputs en padre + celdas sin memo — PR3.  
- **Grid del mes:** volumen sano; no virtualizar salvo regresión futura.

---

## Siguiente

- Piloto lunes: Rita (pool etiquetas B5) · Hugo (hoja de ruta) · Carlos (calendario/detalle-día).  
- No requiere brief Jordi/Carlos (solo perf, sin decisión de negocio).  
- Si vuelve lentitud: comparar con este patrón antes de nueva auditoría completa.
