# Bloque 12 — Detalle del día «vista mesa» (implementación)

> **Estado:** ✅ Implementado en rama `feature/bloque12-detalle-dia-mesa-ui` (29 ago 2026). Pendiente merge `main`.  
> **Sesión:** `SESION_29AGO2026_BLOQUE12_DETALLE_DIA_MESA.md`  
> **Persistencia:** sigue §6.5 Bloque 11 — tabla `prod_calendario_detalle_dia` (opción B).  
> **No confundir con:** `MINERVA_BLOQUE12_ROLES_PERMISOS_NAVEGACION.md` (landing/menú por perfil, aún sin código).

---

## 1. Qué es

Pantalla **«Organizar detalle del día — vista mesa»** desde Calendario Producción (día + ámbito I/D/T/E):

- **Izquierda:** pool = OTs del día sin slot en detalle (pastillas calendario, no hechas).
- **Derecha:** columnas por **máquina activa** × turnos **mañana / tarde** (8 h default, editable).
- **Drag & drop** pool ↔ columnas ↔ entre máquinas.
- **Guardar orden** → `saveDetalleDiaBoard` (todas las máquinas del ámbito en una pasada).
- **No ejecuta** — solo planifica orden fino.

Reemplaza el dialog v2 (dropdown una máquina + lista vertical).

---

## 2. Ámbitos y máquinas

`fetchMaquinasForAmbito` → `prod_maquinas` where `tipo_maquina = ambito` and `activa = true`, orden `orden_visual`.

| Ámbito calendario | Máquinas en UI | Excluidas (`DETALLE_DIA_EXCLUDE_MAQUINA_NOMBRES`) |
|-------------------|----------------|---------------------------------------------------|
| impresion | SpeedMaster CD 102 | — |
| troquelado | Dayuan, JR, ASPAS, Manual | — |
| engomado | engomadora 65, engomadora 110, KONIKA | Manipulados MNRV, desbroce |
| digital | Xerox Iridesse 1/2 | etiqueta digital |

Desbroce y Manipulados siguen en **contenedor sección** (`contenedor-seccion.ts`), no en columnas del detalle E.

---

## 3. Archivos clave

```
src/components/produccion/ots/calendario-detalle-dia-mesa-dialog.tsx  # UI
src/lib/calendario-detalle-dia-board.ts                               # DnD, pool, draft
src/lib/calendario-detalle-dia.ts                                     # saveDetalleDiaBoard, fetchPlanHoyDetalleByOt
src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx  # claim + Hoy planificado
```

Tests: `calendario-detalle-dia-board.test.ts`, ampliado `calendario-detalle-dia.test.ts` (`planHoyDetalleByOtFromRows`).

---

## 4. Integración con ejecución (claim)

Antes (bug 29 ago): claim en modal OT solo pre-rellenaba el **filtro de máquina** de la lista → todas las OTs parecían la misma máquina.

Ahora:

1. `fetchPlanHoyDetalleByOt` devuelve por OT: `{ rank, maquinaId, turno }`.
2. Filas virtuales contenedor llevan `planMaquinaId`, `planTurnoHoy`, `planSlotHoy`.
3. Subtítulo lista: p. ej. `Troquelado · Dayuan · mañana` (si hay plan).
4. Modal claim: prefill desde `planMaquinaId`; texto «Planificado en detalle del día…».
5. Filtro máquina en lista: OTs claim solo si `planMaquinaId` coincide (o sin plan).

**Hoy · planificado** en contenedor exige **detalle del día + paso itinerario `disponible`**. Ordenar en calendario con semáforo amarillo **no** fuerza aparición en ejecución hasta que el paso toque.

---

## 5. UX modal

- Ancho: `detalleDiaDialogMaxWidth(n)` — crece con máquinas visibles (3+ casi pantalla completa).
- Chips máquinas: mostrar/ocultar columnas (persist `localStorage` por usuario).
- **PDF plan del día** (footer): `MesaDiariaPrintTemplate` + `printElementInNewWindow` — mismo estilo visual que mesa diaria LEGACY (A4 landscape, todas las máquinas visibles).
- **PDF por máquina** (icono impresora en columna): `buildDetalleDiaPrintHtml` — hoja operario rica (cartelas, material, M/T).
- Capacidad turno: `EditCapacidadDialog` → `prod_mesa_capacidad_turnos`.

---

## 6. Lo que NO hacemos (decisiones)

| Idea | Decisión |
|------|----------|
| Botón «Asignar máquina» en pastilla calendario | **Retirado** 29 ago — desincronizaba con tablero; una sola UI: vista mesa |
| Manipulados MNRV como columna E | **Fuera** — no es engomadora |
| Etiqueta digital en ámbito D calendario | **Fuera** — pool Rita/Hugo |
| Mesa LEGACY como puerta | Sigue oculta (§27); anular plan LEGACY si bloquea contenedor |

---

## 7. Convivencia mesa LEGACY

Si una OT tiene fila activa en `prod_mesa_planificacion_trabajos` (planificación antigua), puede **no aparecer** en contenedor troquel/engomado aunque tenga pastilla calendario. Solución operativa: **anular** plan LEGACY → OT vuelve al pool contenedor → respeta detalle del día.

---

## 8. Checklist merge

- [ ] Smoke troquel: 2 OTs, 2 máquinas, filtros + claim
- [ ] Smoke engomado: orden con OT upstream; tras cerrar paso previo → Hoy planificado
- [ ] `npm test` board + detalle-dia
- [ ] `npm run build`
- [ ] PR → `main`

---

*Doc técnico Bloque 12 UI · complementa `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` §6 y §28*
