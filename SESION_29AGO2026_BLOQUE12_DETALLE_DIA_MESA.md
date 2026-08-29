# Sesión 29 ago 2026 — Bloque 12: detalle del día vista mesa + claim desde plan

> **Rama:** `feature/bloque12-detalle-dia-mesa-ui` (push origin ✅)  
> **Base:** `origin/main` tras merge Bloque 11 (`feature/bloque11-contenedor-ctp-spike`)  
> **Commits:** `3242b31` (feat) · `57e4e3e` (quitar asignación rápida pastilla)

---

## 1. Objetivo de la sesión

Sustituir el detalle del día v2 (selector + una máquina) por **vista tipo mesa diaria LEGACY**: pool + columnas por máquina + drag & drop, persistiendo en `prod_calendario_detalle_dia` **sin lanzar ejecución**.

Cablear el **claim** en «OTs en ejecución» para que lea máquina/turno guardados (no el filtro de lista).

---

## 2. Entregado (código)

| Área | Archivos / notas |
|------|------------------|
| **UI mesa** | `src/components/produccion/ots/calendario-detalle-dia-mesa-dialog.tsx` |
| **Lógica tablero** | `src/lib/calendario-detalle-dia-board.ts` + tests |
| **Re-export** | `calendario-detalle-dia-dialog.tsx` → apunta al mesa-dialog |
| **Calendario** | `calendario-produccion-page.tsx` → import mesa-dialog |
| **Persistencia** | `saveDetalleDiaBoard` en `calendario-detalle-dia.ts` (todas las máquinas del ámbito) |
| **Ejecución** | `planificacion-ots-ejecucion-tab.tsx` → `fetchPlanHoyDetalleByOt`, `planMaquinaId`, prefill claim |
| **Componentes mesa** | `planningOnly` en `MaquinaColumn` / `TurnoColumn` (sin acciones LEGACY) |

### Modal ancho dinámico

- 1 máquina ~56rem · 2 ~72rem · **3+ ~98vw** (hasta 120rem).
- Toggles máquinas + enlace **«Mostrar todas»** (localStorage ocultas).
- Columnas: `minWidth` según máquinas visibles.

### Máquinas por ámbito (detalle calendario)

| Ámbito | Columnas | Excluido del detalle |
|--------|----------|----------------------|
| **Troquelado** | Dayuan, JR, ASPAS 32×45, Manual 45×65 | — |
| **Engomado** | engomadora 65, engomadora 110, KONIKA | **Manipulados MNRV**, **Desbroce** (no son «máquinas» de plan fino E) |
| **Digital** | Xerox Iridesse 1 y 2 | **etiqueta digital** (pool Rita/Hugo, fuera de este ámbito) |
| **Impresión** | SpeedMaster (1 máquina) | — |

Guillotina / desbroce / manipulados / CTP → **fuera** del detalle calendario (contenedor propio).

---

## 3. Smoke planta (29 ago, casa / troquel + engomado)

### Troquelado

- OT **98002** → Dayuan · mañana; **98024** → JR · mañana (vista mesa + Guardar).
- **OTs en ejecución:** lista muestra máquina/turno; filtro JR solo 98024; filtro Dayuan solo 98002.
- Claim al abrir OT: pre-rellena máquina del **plan**, no el filtro de lista.
- **Nota:** 98002 no aparecía en «Hoy planificado» troquel hasta **anular planificación mesa LEGACY** previa — convivencia Pool/mesa antigua vs contenedor.

### Engomado

- Tres OTs en calendario E (29/08): 98002, 98024, 98015 — **semáforo amarillo** (aún no en paso engomado).
- **Regla validada:** calendario **sí deja ordenar** aunque el paso no esté disponible (brief §6 / itinerario autoriza después).
- **98015:** tras cerrar **Desbroce** → aparece en ejecución **«engomadora 65 · tarde»** (#1 Hoy planificado) ✅
- **98002 / 98024** (aún en troquelado): **no** en contenedor engomado → **no** en Hoy planificado engomado ✅ (correcto).

### Fixes durante la sesión

1. **Toast «No se pudo cargar detalle»** — query despacho pedía columnas inexistentes (`cliente`, `titulo` en `produccion_ot_despachadas`). Corregido: `prod_ots_general` + despacho (como PDF).
2. **Claim copiaba filtro JR/Dayuan** — solo leía `selectedMaquinaFilter`. Corregido: `planMaquinaId` desde detalle_dia.
3. **PDF perdido al migrar a vista mesa** — el dialog v2 tenía botón «PDF» en footer; la vista mesa solo dejaba icono por columna. Restaurado **«Imprimir plan del día»** con `MesaDiariaPrintTemplate` (estilo LEGACY) + se mantiene PDF rico por máquina.

---

## 4. Decisión: NO botón «Asignar máquina» en pastilla

**Probado** modal rápido (icono CPU en pastilla): actualizaba `maquina_id` en BD pero **no movía la tarjeta** en el tablero mesa → desincronización (usuario cambió 65→110 fuera y dentro seguía en 65).

**Decisión (29 ago noche):** eliminar asignación rápida. **Única fuente de verdad:** Calendario → **Organizar detalle del día** → drag → **Guardar orden**.

Commit: `57e4e3e` — borrado `calendario-asignar-maquina-dialog.tsx`.

---

## 5. Reglas operativas (recordatorio)

```
Calendario + detalle del día  →  ORDENAN (aunque semáforo amarillo)
Itinerario (paso disponible)  →  AUTORIZA ejecución
Contenedor «Hoy planificado»  →  detalle HOY + paso disponible
Claim al Iniciar              →  prefill desde detalle_dia.maquina_id
```

---

## 6. Pendiente (backlog Bloque 12 / pulido)

- [ ] Merge `feature/bloque12-detalle-dia-mesa-ui` → `main` + smoke lunes planta
- [ ] Material status real en tarjetas pool (ahora placeholder rojo)
- [ ] Iniciar desde lista con claim ya resuelto (opcional UX)
- [ ] DnD detalle-día · M/T en PDF detalle (backlog §27)
- [ ] Brief Jordi/Carlos v2 en planta
- [ ] Bloque 12 roles/navegación (`MINERVA_BLOQUE12_ROLES_PERMISOS_NAVEGACION.md`) — aparte de esta UI

---

## 7. PR

https://github.com/antaresmpt-alt/minerva-strategic-ai-hub/pull/new/feature/bloque12-detalle-dia-mesa-ui

---

*Sesión improvisada casa · 29 ago 2026 noche · Manel + Cursor*
